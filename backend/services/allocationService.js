const Table = require("../models/Table");
const WaitingQueue = require("../models/WaitingQueue");
const { emitToRestaurant } = require("./socketService");

const WAITLIST_RESPONSE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/*
  NORMAL ALLOCATION
*/
exports.allocateTableService = async (groupSize, restaurantId, customerId = null) => {
  if (!groupSize || groupSize <= 0)
    throw new Error("Invalid group size");
  if (!restaurantId)
    throw new Error("restaurantId required");

  // Find smallest available table >= group
  const table = await Table.findOne({
    restaurantId,
    status: "available",  
    capacity: { $gte: groupSize }
  }).sort({ capacity: 1 });

  if (table) {
    table.status = "occupied";
    await table.save();

    emitToRestaurant(table.restaurantId.toString(), "table:statusChanged", {
      tableId: table._id.toString(),
      restaurantId: table.restaurantId.toString(),
      status: table.status
    });

    return {
      status: "allocated",
      tableId: table._id,
      capacity: table.capacity
    };
  }

  // If no table fits → check if bigger table even exists
  const biggestTable = await Table.findOne({ restaurantId }).sort({ capacity: -1 });

  // Means this group is too large for system tables
  if (biggestTable && biggestTable.capacity < groupSize) {
    return {
      status: "manager_required",
      message: "Group too large. Manager override needed."
    };
  }

  // Else → add to waiting queue
  const entry = await WaitingQueue.create({ 
    restaurantId,
    groupSize,
    customer: customerId || null
  });

  const position = await WaitingQueue.countDocuments({
    restaurantId,
    status: "waiting",
    createdAt: { $lt: entry.createdAt }
  });

  return {
    status: "waiting",
    queueId: entry._id,
    position: position + 1
  };
};

/*
  FREE TABLE → AUTO ASSIGN WAITING GROUP IF POSSIBLE
  Also handles transition from 'notified' status on acceptance
*/
exports.freeTableService = async (tableId, restaurantId) => {
  if (!restaurantId)
    throw new Error("restaurantId required");

  const table = await Table.findOne({ _id: tableId, restaurantId });
  if (!table) throw new Error("Table not found");

  table.status = "available";
  await table.save();

  emitToRestaurant(table.restaurantId.toString(), "table:statusChanged", {
    tableId: table._id.toString(),
    restaurantId: table.restaurantId.toString(),
    status: table.status
  });

  // Find FIRST compatible waiting entry in FIFO order
  // Skip incompatible entries (too large for this table), don't stop
  const waitingList = await WaitingQueue.find({
    restaurantId,
    status: "waiting"
  }).sort({ createdAt: 1 });

  for (let group of waitingList) {
    // Check if this table can fit this group
    if (table.capacity >= group.groupSize) {
      // Found a compatible match
      // Mark table as reserved to hold it for this waitlist entry
      table.status = "reserved";
      await table.save();

      // Mark waitlist entry as notified, not allocated yet
      const now = new Date();
      group.status = "notified";
      group.notifiedAt = now;
      group.responseDeadline = new Date(now.getTime() + WAITLIST_RESPONSE_WINDOW_MS);
      await group.save();

      // Emit notification socket event
      emitToRestaurant(restaurantId.toString(), "waitlist:notified", {
        waitingQueueId: group._id.toString(),
        restaurantId: restaurantId.toString(),
        tableId: table._id.toString(),
        responseDeadline: group.responseDeadline
      });

      return {
        freed: true,
        notified: true,
        waitingQueueId: group._id,
        tableId: table._id,
        responseDeadlineMs: group.responseDeadline.getTime()
      };
    }
    // If not compatible, continue to next entry (don't stop here)
  }

  return { freed: true, allocated: false };
};

/*
  Internal helper: attempt to allocate next compatible waiting entry for a table
  Used by decline/expire logic to re-run matching after a table becomes available again
  This is similar to freeTableService but for a table that's already available
*/
exports.allocateFromWaitlistForTable = async (tableId, restaurantId) => {
  if (!restaurantId)
    throw new Error("restaurantId required");

  const table = await Table.findOne({ _id: tableId, restaurantId });
  if (!table || table.status !== "available") {
    // Table not available for allocation
    return { allocated: false, reason: "table_not_available" };
  }

  const waitingList = await WaitingQueue.find({
    restaurantId,
    status: "waiting"
  }).sort({ createdAt: 1 });

  for (let group of waitingList) {
    if (table.capacity >= group.groupSize) {
      // Found a compatible match
      table.status = "reserved";
      await table.save();

      const now = new Date();
      group.status = "notified";
      group.notifiedAt = now;
      group.responseDeadline = new Date(now.getTime() + WAITLIST_RESPONSE_WINDOW_MS);
      await group.save();

      emitToRestaurant(restaurantId.toString(), "table:statusChanged", {
        tableId: table._id.toString(),
        restaurantId: restaurantId.toString(),
        status: table.status
      });

      emitToRestaurant(restaurantId.toString(), "waitlist:notified", {
        waitingQueueId: group._id.toString(),
        restaurantId: restaurantId.toString(),
        tableId: table._id.toString(),
        responseDeadlineMs: group.responseDeadline.getTime()
      });

      return {
        allocated: true,
        groupId: group._id,
        tableId: table._id,
        status: "notified"
      };
    }
  }

  return { allocated: false, reason: "no_compatible_group" };
};

/*
  VIEW WAITING QUEUE - scoped to restaurant
*/
exports.viewWaitingQueue = async (restaurantId) => {
  if (!restaurantId)
    throw new Error("restaurantId required");

  return await WaitingQueue.find({ restaurantId, status: "waiting" })
    .sort({ createdAt: 1 });
};

/*
  VIEW ALL WAITING ENTRIES (for dashboard) - includes computed fields
*/
exports.viewWaitingQueueWithPosition = async (restaurantId) => {
  if (!restaurantId)
    throw new Error("restaurantId required");

  const entries = await WaitingQueue.find({ restaurantId })
    .sort({ createdAt: 1 });

  const now = new Date();

  // Compute 1-indexed position based on 'waiting' status entries only
  const waitingEntries = entries.filter(e => e.status === "waiting");

  return entries.map(entry => {
    const position = entry.status === "waiting"
      ? waitingEntries.findIndex(e => e._id.equals(entry._id)) + 1
      : null;

    const waitingSinceMs = now - entry.createdAt;
    const waitingSinceMinutes = Math.round(waitingSinceMs / (60 * 1000));

    return {
      ...entry.toObject(),
      position,
      waitingSinceMinutes
    };
  });
};

/*
  MANAGER OVERRIDE
  Combine tables to handle big groups
*/
exports.managerOverrideAllocate = async (groupSize, restaurantId) => {
  if (!groupSize || groupSize <= 0)
    throw new Error("Invalid group size");
  if (!restaurantId)
    throw new Error("restaurantId required");

  const tables = await Table.find({ restaurantId, status: "available" })
    .sort({ capacity: -1 });

  if (tables.length === 0) {
    return { status: "failed", reason: "No tables available" };
  }

  let selected = [];
  let totalCap = 0;

  for (let t of tables) {
    selected.push(t);
    totalCap += t.capacity;

    if (totalCap >= groupSize) break;
  }

  if (totalCap < groupSize) {
    return {
      status: "failed",
      reason: "Even combining tables cannot handle this group"
    };
  }

  for (let t of selected) {
    t.status = "occupied";
    await t.save();

    emitToRestaurant(t.restaurantId.toString(), "table:statusChanged", {
      tableId: t._id.toString(),
      restaurantId: t.restaurantId.toString(),
      status: t.status
    });
  }

  return {
    status: "override_success",
    tablesAssigned: selected.map(t => ({ id: t._id, capacity: t.capacity })),
    totalCapacity: totalCap
  };
};