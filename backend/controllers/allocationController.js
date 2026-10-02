const {
  allocateTableService,
  freeTableService,
  viewWaitingQueue,
  viewWaitingQueueWithPosition,
  viewCustomerWaitingQueue,
  managerOverrideAllocate,
  rematchWaitingEntries,
  countActiveWaitingEntries,
  isWaitingEntryExpired,
  expireStaleWaitingEntries
} = require("../services/allocationService");

const WaitingQueue = require("../models/WaitingQueue");
const Table = require("../models/Table");
const Restaurant = require("../models/Restaurant");
const Reservation = require("../models/Reservation");
const { emitToRestaurant } = require("../services/socketService");
const reservationService = require("../services/reservationService");

const WAITLIST_DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

exports.allocateTable = async (req, res) => {
  try {
    const { groupSize, guestName, guestPhone, tableIds } = req.body;
    const restaurantId = req.user.restaurantId;

    if (!restaurantId) {
      return res.status(400).json({ error: "Customer role cannot allocate tables" });
    }

    const staffCreated = ["manager", "waiter", "host"].includes(req.user.role);
    const result = await allocateTableService(groupSize, restaurantId, staffCreated ? null : req.user._id, guestName, guestPhone, tableIds);
    if (result.status === "combination_unavailable") return res.status(409).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.freeTable = async (req, res) => {
  try {
    const { tableId } = req.body;
    const restaurantId = req.user.restaurantId;

    if (!restaurantId) {
      return res.status(400).json({ error: "Unauthorized" });
    }

    const result = await freeTableService(tableId, restaurantId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.joinWaitlist = async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can create future waitlist requests" });
    }
    const { restaurantId, groupSize, requestedTimeSlot } = req.body;
    const parsedGroupSize = Number(groupSize);

    if (!restaurantId || !parsedGroupSize || !Number.isInteger(parsedGroupSize) || parsedGroupSize < 1) {
      return res.status(400).json({ message: "restaurantId and a positive groupSize are required" });
    }

    const parsedTimeSlot = requestedTimeSlot ? new Date(requestedTimeSlot) : new Date();
    if (Number.isNaN(parsedTimeSlot.getTime())) {
      return res.status(400).json({ message: "requestedTimeSlot must be a valid date string" });
    }

    const restaurant = await Restaurant.findById(restaurantId).select("defaultSeatingDurationMinutes");
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
    if (!Number.isFinite(Number(restaurant.defaultSeatingDurationMinutes))) {
      return res.status(500).json({ message: "Restaurant seating duration is required" });
    }

    const combinationSuggestions = await reservationService.findTableCombinations(
      restaurantId,
      parsedGroupSize,
      parsedTimeSlot,
      Number(restaurant.defaultSeatingDurationMinutes),
      { enforceOvershootCap: true, resultLimit: Infinity }
    );
    const availableCombination = combinationSuggestions.find((suggestion) => suggestion.tableIds.length > 1);
    if (availableCombination) {
      return res.status(409).json({
        status: "combination_available",
        suggestions: combinationSuggestions.filter((suggestion) => suggestion.tableIds.length > 1),
        message: "A combined-table option is available. Select it from the booking options to request host approval."
      });
    }

    await expireStaleWaitingEntries({ restaurantId, customerId: req.user._id });
    const existingEntries = await WaitingQueue.find({
      restaurantId,
      customer: req.user._id,
      status: { $in: ["waiting", "notified"] }
    }).select("requestedTimeSlot");
    const hasNearbyRequest = existingEntries.some((entry) => Math.abs(
      new Date(entry.requestedTimeSlot).getTime() - parsedTimeSlot.getTime()
    ) <= WAITLIST_DUPLICATE_WINDOW_MS);

    if (hasNearbyRequest) {
      return res.status(400).json({
        message: "You already have a waitlist request within 30 minutes of this time"
      });
    }

    const maximumSeatablePartySize = await reservationService.getRestaurantMaxCapacity(restaurantId);
    const needsManagerReview = parsedGroupSize > maximumSeatablePartySize;
    const entry = await WaitingQueue.create({
      restaurantId,
      groupSize: parsedGroupSize,
      customer: req.user._id,
      requestedTimeSlot: parsedTimeSlot,
      requestedDurationMinutes: Number(restaurant.defaultSeatingDurationMinutes),
      needsManagerReview
    });

    if (needsManagerReview) {
      emitToRestaurant(restaurantId.toString(), "waitlist:managerReviewNeeded", {
        waitingQueueId: entry._id.toString(),
        restaurantId: restaurantId.toString(),
        groupSize: entry.groupSize
      });
      return res.status(201).json({ status: "manager_review", needsManagerReview: true, queueId: entry._id });
    }

    const position = await countActiveWaitingEntries({
      restaurantId,
      beforeRequestedTimeSlot: entry.requestedTimeSlot
    });

    return res.status(201).json({ status: entry.status, queueId: entry._id, position: position + 1 });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getWaitingQueue = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    if (!restaurantId) {
      return res.status(400).json({ error: "Unauthorized" });
    }

    const queue = await viewWaitingQueue(restaurantId);
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyWaitingQueue = async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ error: "Only customers can view their waitlist requests" });
    }

    const entries = await viewCustomerWaitingQueue(req.user._id);
    return res.json(entries);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Get waiting queue with computed position and wait time
exports.getWaitingQueueWithPosition = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    if (!restaurantId) {
      return res.status(400).json({ error: "Unauthorized" });
    }

    const queue = await viewWaitingQueueWithPosition(restaurantId);
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelWaitlistEntry = async (req, res) => {
  try {
    const entry = await WaitingQueue.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Waitlist entry not found" });

    const isRestaurantStaff = ["manager", "host"].includes(req.user.role)
      && req.user.restaurantId
      && entry.restaurantId.equals(req.user.restaurantId);
    const isOwnCustomerEntry = req.user.role === "customer"
      && entry.customer
      && entry.customer.equals(req.user._id);
    if (!isRestaurantStaff && !isOwnCustomerEntry) {
      return res.status(403).json({ error: "Only this restaurant's manager or host, or the entry's customer, can cancel it" });
    }

    entry.status = "cancelled";
    const matchedTableIds = entry.matchedTableIds || [];
    entry.matchedTableIds = [];
    await entry.save();
    emitToRestaurant(entry.restaurantId.toString(), "waitlist:cancelled", { waitingQueueId: entry._id.toString() });
    if (matchedTableIds.length) {
      await rematchWaitingEntries({
        restaurantId: entry.restaurantId,
        tableIds: matchedTableIds,
        availabilityStart: entry.requestedTimeSlot,
        availabilityDurationMinutes: entry.requestedDurationMinutes
      });
    }
    return res.json({ success: true, message: "Waitlist entry cancelled", entry });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.resolveManagerReview = async (req, res) => {
  try {
    const entry = await WaitingQueue.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Waitlist entry not found" });
    if (req.user.role !== "manager" || req.user.restaurantId?.toString() !== entry.restaurantId.toString()) {
      return res.status(403).json({ error: "Only this restaurant's manager can resolve manager-review entries" });
    }
    if (!entry.needsManagerReview || entry.status !== "waiting") {
      return res.status(400).json({ error: "This entry is not awaiting manager review" });
    }

    const { decision, tableIds } = req.body;
    if (decision === "reject") {
      entry.status = "cancelled";
      await entry.save();
      emitToRestaurant(entry.restaurantId.toString(), "waitlist:cancelled", { waitingQueueId: entry._id.toString() });
      return res.json({ success: true, message: "Waitlist request rejected", entry });
    }
    if (decision !== "approve") return res.status(400).json({ error: "decision must be approve or reject" });
    if (!Array.isArray(tableIds) || !tableIds.length || new Set(tableIds.map((id) => id.toString())).size !== tableIds.length) {
      return res.status(400).json({ error: "Select one or more distinct tables to approve this request" });
    }

    const isWalkIn = !entry.customer;
    const tableFilter = { _id: { $in: tableIds }, restaurantId: entry.restaurantId };
    if (isWalkIn) tableFilter.status = "available";
    const tables = await Table.find(tableFilter);
    if (tables.length !== tableIds.length) return res.status(409).json({ error: "One or more selected tables are unavailable" });
    if (await reservationService.checkTableOverlap(tableIds, entry.requestedTimeSlot, entry.requestedDurationMinutes)) {
      return res.status(409).json({ error: "The selected tables are already reserved for that time" });
    }

    let reservation = null;
    if (entry.customer) {
      reservation = await Reservation.create({
        restaurantId: entry.restaurantId,
        customer: entry.customer,
        tables: tableIds,
        partySize: entry.groupSize,
        timeSlot: entry.requestedTimeSlot,
        durationMinutes: entry.requestedDurationMinutes,
        status: "confirmed",
        requiresApproval: false,
        lockedTableSlots: Reservation.getLockedTableSlots({
          tables: tableIds,
          timeSlot: entry.requestedTimeSlot,
          durationMinutes: entry.requestedDurationMinutes
        })
      });
      entry.reservation = reservation._id;
      emitToRestaurant(entry.restaurantId.toString(), "reservation:confirmed", {
        reservationId: reservation._id.toString(),
        restaurantId: entry.restaurantId.toString(),
        tableIds: tableIds.map((tableId) => tableId.toString()),
        timeSlot: reservation.timeSlot
      });
    } else {
      for (const table of tables) {
        table.status = "occupied";
        await table.save();
        emitToRestaurant(table.restaurantId.toString(), "table:statusChanged", {
          tableId: table._id.toString(),
          restaurantId: table.restaurantId.toString(),
          status: table.status
        });
      }
    }

    entry.matchedTableIds = tableIds;
    entry.status = "allocated";
    await entry.save();
    emitToRestaurant(entry.restaurantId.toString(), "waitlist:allocated", {
      waitingQueueId: entry._id.toString(),
      reservationId: reservation?._id.toString() || null
    });
    return res.json({ success: true, message: reservation ? "Reservation approved and confirmed" : "Walk-in guest seated", entry, reservation });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "Those tables were just booked; select another combination" });
    return res.status(500).json({ error: err.message });
  }
};

// Respond to waitlist notification: accept or decline
exports.respondToWaitlistNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { accept } = req.body;

    if (typeof accept !== "boolean") {
      return res.status(400).json({ error: "accept must be true or false" });
    }

    const entry = await WaitingQueue.findById(id);
    if (!entry) return res.status(404).json({ error: "Waitlist entry not found" });
    if (req.user.role !== "customer" || !entry.customer?.equals(req.user._id)) {
      return res.status(403).json({ error: "Only the customer who owns this waitlist request can respond" });
    }
    if (entry.status !== "notified") return res.status(400).json({ error: "Entry is not in notified state" });

    if (!entry.responseDeadline || Date.now() > entry.responseDeadline.getTime()) {
      entry.status = "expired";
      const matchedTableIds = entry.matchedTableIds || [];
      entry.matchedTableIds = [];
      await entry.save();
      if (matchedTableIds.length) {
        await rematchWaitingEntries({
          restaurantId: entry.restaurantId,
          tableIds: matchedTableIds,
          availabilityStart: entry.requestedTimeSlot,
          availabilityDurationMinutes: entry.requestedDurationMinutes
        });
      }
      return res.status(410).json({ error: "Response deadline has passed" });
    }

    const matchedTableIds = entry.matchedTableIds || [];
    if (!matchedTableIds.length) return res.status(409).json({ error: "No table match is attached to this request" });

    if (!accept) {
      entry.status = "cancelled";
      entry.matchedTableIds = [];
      await entry.save();
      await rematchWaitingEntries({
        restaurantId: entry.restaurantId,
        tableIds: matchedTableIds,
        availabilityStart: entry.requestedTimeSlot,
        availabilityDurationMinutes: entry.requestedDurationMinutes
      });
      emitToRestaurant(entry.restaurantId.toString(), "waitlist:cancelled", { waitingQueueId: entry._id.toString() });
      return res.json({ success: true, message: "Waitlist request declined", entry });
    }

    const isWalkIn = new Date(entry.requestedTimeSlot).getTime() <= new Date(entry.createdAt).getTime();
    const tables = await Table.find({ _id: { $in: matchedTableIds }, restaurantId: entry.restaurantId });
    if (tables.length !== matchedTableIds.length) return res.status(409).json({ error: "The matched tables are no longer available" });
    if (isWalkIn && tables.some((table) => table.status !== "available")) {
      return res.status(409).json({ error: "The matched tables are no longer available" });
    }
    if (await reservationService.checkTableOverlap(matchedTableIds, entry.requestedTimeSlot, entry.requestedDurationMinutes)) {
      return res.status(409).json({ error: "The matched tables were just booked for that time" });
    }

    let reservation = null;
    if (isWalkIn) {
      await Promise.all(tables.map(async (table) => {
        table.status = "occupied";
        await table.save();
        emitToRestaurant(table.restaurantId.toString(), "table:statusChanged", {
          tableId: table._id.toString(), restaurantId: table.restaurantId.toString(), status: table.status
        });
      }));
    } else {
      reservation = await Reservation.create({
        restaurantId: entry.restaurantId,
        customer: entry.customer,
        tables: matchedTableIds,
        partySize: entry.groupSize,
        timeSlot: entry.requestedTimeSlot,
        durationMinutes: entry.requestedDurationMinutes,
        status: "confirmed",
        requiresApproval: false,
        lockedTableSlots: Reservation.getLockedTableSlots({
          tables: matchedTableIds,
          timeSlot: entry.requestedTimeSlot,
          durationMinutes: entry.requestedDurationMinutes
        })
      });
      entry.reservation = reservation._id;
      emitToRestaurant(entry.restaurantId.toString(), "reservation:confirmed", {
        reservationId: reservation._id.toString(),
        restaurantId: entry.restaurantId.toString(),
        tableIds: matchedTableIds.map((tableId) => tableId.toString()),
        timeSlot: reservation.timeSlot
      });
    }

    entry.status = "allocated";
    await entry.save();
    emitToRestaurant(entry.restaurantId.toString(), "waitlist:allocated", {
      waitingQueueId: entry._id.toString(),
      reservationId: reservation?._id.toString() || null
    });
    return res.json({ success: true, message: isWalkIn ? "Guest seated" : "Reservation confirmed", entry, reservation });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "That time was just booked; please try again" });
    res.status(500).json({ error: err.message });
  }
};

exports.seatGuestWaitlistEntry = async (req, res) => {
  try {
    const entry = await WaitingQueue.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Waitlist entry not found" });
    const isStaff = ["manager", "host"].includes(req.user.role)
      && req.user.restaurantId?.toString() === entry.restaurantId.toString();
    if (!isStaff) return res.status(403).json({ error: "Only this restaurant's host or manager can seat this guest" });
    if (entry.customer) return res.status(400).json({ error: "Customer entries must be accepted by their customer" });
    if (entry.status !== "waiting" || !entry.matchedTableIds?.length) {
      return res.status(400).json({ error: "This guest does not have a live table match" });
    }
    if (isWaitingEntryExpired(entry)) {
      entry.status = "expired";
      entry.matchedTableIds = [];
      await entry.save();
      return res.status(410).json({ error: "This waitlist entry has expired" });
    }

    const tables = await Table.find({
      _id: { $in: entry.matchedTableIds },
      restaurantId: entry.restaurantId,
      status: "available"
    });
    if (tables.length !== entry.matchedTableIds.length) return res.status(409).json({ error: "The matched tables are no longer available" });
    if (await reservationService.checkTableOverlap(entry.matchedTableIds, entry.requestedTimeSlot, entry.requestedDurationMinutes)) {
      return res.status(409).json({ error: "The matched tables are no longer available for this time" });
    }

    await Promise.all(tables.map(async (table) => {
      table.status = "occupied";
      await table.save();
      emitToRestaurant(table.restaurantId.toString(), "table:statusChanged", {
        tableId: table._id.toString(), restaurantId: table.restaurantId.toString(), status: table.status
      });
    }));
    entry.status = "allocated";
    await entry.save();
    emitToRestaurant(entry.restaurantId.toString(), "waitlist:allocated", { waitingQueueId: entry._id.toString() });
    return res.json({ success: true, message: "Guest seated", entry });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Manual expiry check for notified entries
exports.expireWaitlistEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await WaitingQueue.findById(id);
    if (!entry) {
      return res.status(404).json({ error: "Waitlist entry not found" });
    }

    if (!entry.restaurantId.equals(req.user.restaurantId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    if (!["manager", "host"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only a manager or host can perform expiry check" });
    }

    const expiredWaitingEntry = isWaitingEntryExpired(entry);
    const expiredNotification = entry.status === "notified" && (!entry.responseDeadline || Date.now() > entry.responseDeadline.getTime());
    if (!expiredWaitingEntry && !expiredNotification) {
      return res.status(400).json({ error: "Entry is not eligible for an expiry check" });
    }

    const matchedTableIds = entry.matchedTableIds || [];
    entry.status = "expired";
    entry.matchedTableIds = [];
    await entry.save();

    let rematchResult = { matched: false };
    if (expiredNotification && matchedTableIds.length) {
      rematchResult = await rematchWaitingEntries({
        restaurantId: entry.restaurantId,
        tableIds: matchedTableIds,
        availabilityStart: entry.requestedTimeSlot,
        availabilityDurationMinutes: entry.requestedDurationMinutes
      });
    }

    return res.json({
      success: true,
      message: expiredNotification ? "Notification expired; the next matching request was checked" : "Waiting entry expired",
      entry,
      rematched: rematchResult.matched,
      rematchResult
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.managerOverride = async (req, res) => {
  try {
    const { groupSize } = req.body;
    const restaurantId = req.user.restaurantId;

    if (!restaurantId) {
      return res.status(400).json({ error: "Unauthorized" });
    }

    const result = await managerOverrideAllocate(groupSize, restaurantId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
