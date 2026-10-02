const Table = require("../models/Table");
const WaitingQueue = require("../models/WaitingQueue");
const Restaurant = require("../models/Restaurant");
const reservationService = require("./reservationService");
const { emitToRestaurant, emitToUser } = require("./socketService");

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
    tableIds: [table._id],
    availabilityStart: new Date(),
    availabilityDurationMinutes: requestedDurationMinutes
  });
};

const notifyWaitingEntry = async (entry, tableIds, restaurantId) => {
  const now = new Date();
  entry.matchedTableIds = tableIds;
  if (entry.customer) {
    entry.status = "notified";
    entry.notifiedAt = now;
    entry.responseDeadline = new Date(now.getTime() + WAITLIST_RESPONSE_WINDOW_MS);
  }
  await entry.save();

  const payload = {
    waitingQueueId: entry._id.toString(),
    restaurantId: restaurantId.toString(),
    tableIds: tableIds.map((id) => id.toString()),
    responseDeadline: entry.responseDeadline,
    responseDeadlineMs: entry.responseDeadline?.getTime() || null
  };

  if (entry.customer) {
    emitToRestaurant(restaurantId.toString(), "waitlist:notified", payload);
    emitToUser(entry.customer.toString(), "waitlist:notified", payload);
  } else {
    emitToRestaurant(restaurantId.toString(), "waitlist:seatNow", payload);
  }

  return {
    matched: true,
    groupId: entry._id,
    tableIds,
    status: entry.status,
    responseDeadlineMs: entry.responseDeadline?.getTime() || null
  };
};

exports.rematchWaitingEntries = async ({ restaurantId, tableIds, tableId, availabilityStart, availabilityDurationMinutes }) => {
  const freedTableIds = (tableIds || (tableId ? [tableId] : [])).map((id) => id.toString());
  if (!freedTableIds.length) return { matched: false, reason: "no_freed_tables" };
  const freedTables = await Table.find({ _id: { $in: freedTableIds }, restaurantId, status: "available" }).lean();
  if (!freedTables.length) return { matched: false, reason: "table_not_available" };
  const now = new Date();
  const waitingList = await WaitingQueue.find({
    restaurantId,
    status: "waiting",
    needsManagerReview: { $ne: true },
    $or: [{ matchedTableIds: { $size: 0 } }, { matchedTableIds: { $exists: false } }]
  }).sort({ requestedTimeSlot: 1 });
  const activeMatches = await WaitingQueue.find({
    restaurantId,
    status: { $in: ["waiting", "notified"] }
  }).select("matchedTableIds requestedTimeSlot requestedDurationMinutes").lean();

  for (const entry of waitingList) {
    if (isWaitingEntryExpired(entry, now.getTime())) {
      entry.status = "expired";
      await entry.save();
      emitToRestaurant(restaurantId.toString(), "waitlist:expired", { waitingQueueId: entry._id.toString() });
      continue;
    }

    if (!reservationService.timeWindowsOverlap(
      entry.requestedTimeSlot,
      entry.requestedDurationMinutes,
      availabilityStart,
      availabilityDurationMinutes
    )) continue;

    const availableTables = await Table.find({ restaurantId, status: "available" }).lean();
    const freeTables = [];
    for (const table of availableTables) {
      if (!(await reservationService.checkTableOverlap([table._id], entry.requestedTimeSlot, entry.requestedDurationMinutes))) {
        freeTables.push(table);
      }
    }
    const candidates = reservationService.buildCombinationCandidates({
      tables: freeTables,
      combinableTables: freeTables.filter((table) => table.combinable === true),
      partySize: entry.groupSize,
      maxTables: 4,
      resultLimit: Infinity
    });
    const freedIds = new Set(freedTableIds);
    const blockedTableIds = new Set(activeMatches
      .filter((matchEntry) => matchEntry.matchedTableIds?.length && reservationService.timeWindowsOverlap(
        entry.requestedTimeSlot,
        entry.requestedDurationMinutes,
        matchEntry.requestedTimeSlot,
        matchEntry.requestedDurationMinutes
      ))
      .flatMap((matchEntry) => matchEntry.matchedTableIds.map((id) => id.toString())));
    const match = candidates.find((candidate) => candidate.tableIds.some((id) => freedIds.has(id))
      && candidate.tableIds.every((id) => !blockedTableIds.has(id)));
    if (!match) continue;

    return notifyWaitingEntry(entry, match.tableIds, restaurantId);
  }

  return { matched: false, reason: "no_compatible_group" };
};

/*
  NORMAL ALLOCATION
*/
exports.allocateTableService = async (groupSize, restaurantId, customerId = null, guestName = null, guestPhone = null, selectedTableIds = null) => {
  if (!groupSize || groupSize <= 0)
    throw new Error("Invalid group size");
  if (!restaurantId)
    throw new Error("restaurantId required");

  if (Array.isArray(selectedTableIds) && selectedTableIds.length) {
    const uniqueTableIds = [...new Set(selectedTableIds.map((id) => id.toString()))];
    const selectedTables = await Table.find({
      _id: { $in: uniqueTableIds },
      restaurantId,
      status: "available"
    });
    if (selectedTables.length !== uniqueTableIds.length) {
      return { status: "combination_unavailable", message: "One or more selected tables are no longer available" };
    }

    const selectedCandidate = reservationService.buildCombinationCandidates({
      tables: selectedTables,
      combinableTables: selectedTables.filter((table) => table.combinable === true),
      partySize: groupSize,
      maxTables: 4,
      resultLimit: Infinity
    }).find((candidate) => candidate.tableIds.length === uniqueTableIds.length
      && candidate.tableIds.every((tableId) => uniqueTableIds.includes(tableId)));
    if (!selectedCandidate || await reservationService.checkTableOverlap(uniqueTableIds, new Date(), await getRestaurantDuration(restaurantId))) {
      return { status: "combination_unavailable", message: "The selected tables cannot accommodate this party right now" };
    }

    const combinedGroupId = uniqueTableIds.length > 1 ? new (require("mongoose").Types.ObjectId)() : null;
    for (const table of selectedTables) {
      table.status = "occupied";
      if (combinedGroupId) table.combinedGroupId = combinedGroupId;
      await table.save();
      emitToRestaurant(table.restaurantId.toString(), "table:statusChanged", {
        tableId: table._id.toString(),
        restaurantId: table.restaurantId.toString(),
        status: table.status
      });
    }

    return {
      status: "allocated",
      tableIds: uniqueTableIds,
      tablesAssigned: selectedTables.map((table) => ({ id: table._id, number: table.number, capacity: table.capacity })),
      totalCapacity: selectedCandidate.totalCapacity,
      combinedGroupId
    };
  }

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

  const requestedDurationMinutes = await getRestaurantDuration(restaurantId);
  const combinationOptions = (await reservationService.findTableCombinations(
    restaurantId,
    groupSize,
    new Date(),
    requestedDurationMinutes,
    { onlyAvailableTables: true, resultLimit: 3 }
  )).filter((candidate) => candidate.tableCount > 1);
  if (combinationOptions.length) {
    return { status: "combination_options", suggestions: combinationOptions };
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
    tableIds: [tableId],
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
    return { matched: false, reason: "table_not_available" };
  }

  const requestedDurationMinutes = await getRestaurantDuration(restaurantId);
  return exports.rematchWaitingEntries({
    restaurantId,
    tableIds: [tableId],
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

  await exports.expireStaleWaitingEntries({ restaurantId });
  const entries = await WaitingQueue.find({ restaurantId, status: { $in: ["waiting", "notified"] } })
    .populate("customer", "name")
    .populate("matchedTableIds", "number")
    .populate("reservation", "status timeSlot")
    .sort({ requestedTimeSlot: 1 });
  return decorateWaitingEntries(entries);
};

exports.viewCustomerWaitingQueue = async (customerId) => {
  await exports.expireStaleWaitingEntries({ customerId });
  const entries = await WaitingQueue.find({ customer: customerId })
    .populate("restaurantId", "name")
    .populate("matchedTableIds", "number")
    .populate("reservation", "status timeSlot")
    .sort({ requestedTimeSlot: 1 });
  return decorateWaitingEntries(entries);
};

/*
  VIEW ALL WAITING ENTRIES (for dashboard) - includes computed fields
*/
exports.viewWaitingQueueWithPosition = async (restaurantId) => {
  if (!restaurantId)
    throw new Error("restaurantId required");

  await exports.expireStaleWaitingEntries({ restaurantId });
  const entries = await WaitingQueue.find({ restaurantId, status: { $in: ["waiting", "notified"] } })
    .populate("customer", "name")
    .populate("matchedTableIds", "number")
    .populate("reservation", "status timeSlot")
    .sort({ requestedTimeSlot: 1 });

  const now = new Date();

  const waitingEntries = entries.filter((entry) => entry.status === "waiting" && !entry.needsManagerReview);

  return entries.map(entry => {
    const position = entry.status === "waiting" && !entry.needsManagerReview
      ? waitingEntries.findIndex(e => e._id.equals(entry._id)) + 1
      : null;

    const requestedAt = new Date(entry.requestedTimeSlot).getTime();
    const waitingSinceMinutes = requestedAt <= now.getTime()
      ? Math.max(0, Math.round((now.getTime() - requestedAt) / 60000))
      : null;

    return {
      ...entry.toObject(),
      displayName: entry.customer?.name || entry.guestName || "Walk-in guest",
      position,
      waitingSinceMinutes,
      requestedFor: requestedAt > now.getTime() ? entry.requestedTimeSlot : null
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

const decorateWaitingEntries = (entries) => entries.map((entry) => ({
  ...entry.toObject(),
  displayName: entry.customer?.name || entry.guestName || "Walk-in guest",
  waitingSinceMinutes: new Date(entry.requestedTimeSlot).getTime() <= Date.now()
    ? Math.max(0, Math.round((Date.now() - new Date(entry.requestedTimeSlot).getTime()) / 60000))
    : null,
  requestedFor: new Date(entry.requestedTimeSlot).getTime() > Date.now() ? entry.requestedTimeSlot : null
}));

exports.expireStaleWaitingEntries = async ({ restaurantId, customerId, now = Date.now() }) => {
  const filter = { status: "waiting" };
  if (restaurantId) filter.restaurantId = restaurantId;
  if (customerId) filter.customer = customerId;
  const entries = await WaitingQueue.find(filter);
  const expiredEntries = entries.filter((entry) => isWaitingEntryExpired(entry, now));
  const expiredIds = expiredEntries.map((entry) => entry._id);
  if (!expiredIds.length) return 0;

  await WaitingQueue.updateMany(
    { _id: { $in: expiredIds }, status: "waiting" },
    { $set: { status: "expired", matchedTableIds: [] } }
  );
  for (const entry of expiredEntries) {
    emitToRestaurant(entry.restaurantId.toString(), "waitlist:expired", { waitingQueueId: entry._id.toString() });
    if (entry.matchedTableIds?.length) {
      await exports.rematchWaitingEntries({
        restaurantId: entry.restaurantId,
        tableIds: entry.matchedTableIds,
        availabilityStart: entry.requestedTimeSlot,
        availabilityDurationMinutes: entry.requestedDurationMinutes
      });
    }
  }
  return expiredIds.length;
};

exports.countActiveWaitingEntries = async ({ restaurantId, beforeCreatedAt, beforeRequestedTimeSlot }) => {
  const entries = await WaitingQueue.find({
    restaurantId,
    status: "waiting",
    ...(beforeRequestedTimeSlot ? { requestedTimeSlot: { $lt: beforeRequestedTimeSlot } } : beforeCreatedAt ? { createdAt: { $lt: beforeCreatedAt } } : {})
  }).select("requestedTimeSlot requestedDurationMinutes createdAt status");
  return entries.filter((entry) => !isWaitingEntryExpired(entry)).length;
};

exports.isWaitingEntryExpired = isWaitingEntryExpired;