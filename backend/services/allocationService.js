const Table = require("../models/Table");
const WaitingQueue = require("../models/WaitingQueue");
const Restaurant = require("../models/Restaurant");
const reservationService = require("./reservationService");
const { emitToRestaurant } = require("./socketService");

const WAITLIST_RESPONSE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const WALK_IN_EXPIRY_WINDOW_MS = 2 * 60 * 60 * 1000;

const getRestaurantDuration = async (restaurantId) => {
  const restaurant = await Restaurant.findById(restaurantId).select("defaultSeatingDurationMinutes");
  if (!restaurant) throw new Error("Restaurant not found");
  if (!Number.isFinite(Number(restaurant.defaultSeatingDurationMinutes))) {
    throw new Error("Restaurant seating duration is required");
  }
  return Number(restaurant.defaultSeatingDurationMinutes);
};

exports.rematchAfterTableAvailable = async (table) => {
  const requestedDurationMinutes = await getRestaurantDuration(table.restaurantId);
  return exports.rematchWaitingEntries({
    restaurantId: table.restaurantId,
    tableId: table._id,
    availabilityStart: new Date(),
    availabilityDurationMinutes: requestedDurationMinutes
  });
};

const notifyWaitingEntry = async (entry, table, restaurantId) => {
  table.status = "reserved";
  await table.save();

  const now = new Date();
  entry.status = "notified";
  entry.notifiedAt = now;
  entry.responseDeadline = new Date(now.getTime() + WAITLIST_RESPONSE_WINDOW_MS);
  await entry.save();

  emitToRestaurant(restaurantId.toString(), "waitlist:notified", {
    waitingQueueId: entry._id.toString(),
    restaurantId: restaurantId.toString(),
    tableId: table._id.toString(),
    responseDeadline: entry.responseDeadline,
    responseDeadlineMs: entry.responseDeadline.getTime()
  });

  return {
    allocated: true,
    groupId: entry._id,
    tableId: table._id,
    status: "notified",
    responseDeadlineMs: entry.responseDeadline.getTime(),
    notificationChannel: entry.notificationChannel
  };
};

exports.rematchWaitingEntries = async ({ restaurantId, tableId, availabilityStart, availabilityDurationMinutes }) => {
  const table = await Table.findOne({ _id: tableId, restaurantId, status: "available" });
  if (!table) return { allocated: false, reason: "table_not_available" };

  const now = new Date();
  const waitingList = await WaitingQueue.find({
    restaurantId,
    status: "waiting",
    needsManagerReview: { $ne: true }
  }).sort({ requestedTimeSlot: 1 });

  for (const entry of waitingList) {
    if (isWaitingEntryExpired(entry, now.getTime())) {
      entry.status = "expired";
      await entry.save();
      continue;
    }

    if (table.capacity < entry.groupSize) continue;
    if (!reservationService.timeWindowsOverlap(
      entry.requestedTimeSlot,
      entry.requestedDurationMinutes,
      availabilityStart,
      availabilityDurationMinutes
    )) continue;

    return notifyWaitingEntry(entry, table, restaurantId);
  }

  return { allocated: false, reason: "no_compatible_group" };
};

/*
  NORMAL ALLOCATION
*/
exports.allocateTableService = async (groupSize, restaurantId, customerId = null, guestName = null, guestPhone = null) => {
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

  // Else → add to waiting queue
    if (customerId) {
      const existingEntry = await WaitingQueue.findOne({
        restaurantId,
        customer: customerId,
        status: { $in: ["waiting", "notified"] }
      });
      if (existingEntry) {
        return {
          status: "already_waiting",
          message: "You're already on the waitlist for this restaurant",
          queueId: existingEntry._id
        };
      }
    }

  const maximumSeatablePartySize = await reservationService.getRestaurantMaxCapacity(restaurantId);
  const requestedDurationMinutes = await getRestaurantDuration(restaurantId);
  const needsManagerReview = groupSize > maximumSeatablePartySize;
  const entry = await WaitingQueue.create({
    restaurantId,
    groupSize,
    customer: customerId || null,
    guestName: guestName || null,
    guestPhone: guestPhone || null,
    requestedTimeSlot: new Date(),
    requestedDurationMinutes,
    needsManagerReview
  });

  if (needsManagerReview) {
    emitToRestaurant(restaurantId.toString(), "waitlist:managerReviewNeeded", {
      waitingQueueId: entry._id.toString(),
      restaurantId: restaurantId.toString(),
      groupSize: entry.groupSize
    });
    return {
      status: "manager_review",
      needsManagerReview: true,
      queueId: entry._id
    };
  }

  const position = await exports.countActiveWaitingEntries({
    restaurantId,
    beforeCreatedAt: entry.createdAt
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

  const requestedDurationMinutes = await getRestaurantDuration(restaurantId);
  const result = await exports.rematchWaitingEntries({
    restaurantId,
    tableId,
    availabilityStart: new Date(),
    availabilityDurationMinutes: requestedDurationMinutes
  });
  return { freed: true, ...result };
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

  const requestedDurationMinutes = await getRestaurantDuration(restaurantId);
  return exports.rematchWaitingEntries({
    restaurantId,
    tableId,
    availabilityStart: new Date(),
    availabilityDurationMinutes: requestedDurationMinutes
  });
};

/*
  VIEW WAITING QUEUE - scoped to restaurant
*/
exports.viewWaitingQueue = async (restaurantId) => {
  if (!restaurantId)
    throw new Error("restaurantId required");

  const entries = await WaitingQueue.find({ restaurantId, status: "waiting" })
    .sort({ requestedTimeSlot: 1 });
  return entries.map(decorateWaitingEntry);
};

exports.viewCustomerWaitingQueue = async (customerId) => {
  const entries = await WaitingQueue.find({ customer: customerId })
    .populate("restaurantId", "name")
    .sort({ createdAt: -1 });
  return entries.map(decorateWaitingEntry);
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
  const waitingEntries = entries.filter(e => e.status === "waiting" && !e.needsManagerReview && !isWaitingEntryExpired(e, now.getTime()));

  entries.sort((a, b) => {
    if (Boolean(a.needsManagerReview) !== Boolean(b.needsManagerReview)) {
      return a.needsManagerReview ? 1 : -1;
    }
    return a.createdAt - b.createdAt;
  });

  return entries.map(entry => {
    const expired = entry.status === "waiting" && isWaitingEntryExpired(entry, now.getTime());
    const position = entry.status === "waiting" && !entry.needsManagerReview && !expired
      ? waitingEntries.findIndex(e => e._id.equals(entry._id)) + 1
      : null;

    const waitingSinceMs = now - entry.createdAt;
    const waitingSinceMinutes = Math.round(waitingSinceMs / (60 * 1000));

    return {
      ...entry.toObject(),
      status: expired ? "expired" : entry.status,
      displayName: entry.customer ? undefined : (entry.guestName || "Walk-in guest"),
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

  const mongoose = require("mongoose");
  const combinedGroupId = new mongoose.Types.ObjectId();
  for (let t of selected) {
    t.status = "occupied";
    t.combinedGroupId = combinedGroupId;
    await t.save();

    emitToRestaurant(t.restaurantId.toString(), "table:statusChanged", {
      tableId: t._id.toString(),
      restaurantId: t.restaurantId.toString(),
      status: t.status
    });
  }

  return {
    status: "override_success",
    combinedGroupId,
    tablesAssigned: selected.map(t => ({ id: t._id, capacity: t.capacity })),
    totalCapacity: totalCap
  };
};

const isWaitingEntryExpired = (entry, now = Date.now()) => {
  if (entry.status !== "waiting") return false;

  const requestedAt = new Date(entry.requestedTimeSlot).getTime();
  const createdAt = new Date(entry.createdAt).getTime();
  const wasScheduledForFuture = requestedAt > createdAt;
  const expiryAt = wasScheduledForFuture
    ? requestedAt + Number(entry.requestedDurationMinutes) * 60000
    : requestedAt + WALK_IN_EXPIRY_WINDOW_MS;
  return expiryAt <= now;
};

const decorateWaitingEntry = (entry) => isWaitingEntryExpired(entry)
  ? { ...entry.toObject(), status: "expired" }
  : entry;

exports.countActiveWaitingEntries = async ({ restaurantId, beforeCreatedAt }) => {
  const entries = await WaitingQueue.find({
    restaurantId,
    status: "waiting",
    ...(beforeCreatedAt ? { createdAt: { $lt: beforeCreatedAt } } : {})
  }).select("requestedTimeSlot requestedDurationMinutes createdAt status");
  return entries.filter((entry) => !isWaitingEntryExpired(entry)).length;
};

exports.isWaitingEntryExpired = isWaitingEntryExpired;