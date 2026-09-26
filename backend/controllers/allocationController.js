const {
  allocateTableService,
  freeTableService,
  viewWaitingQueue,
  viewWaitingQueueWithPosition,
  viewCustomerWaitingQueue,
  managerOverrideAllocate,
  allocateFromWaitlistForTable,
  rematchWaitingEntries,
  countActiveWaitingEntries,
  isWaitingEntryExpired
} = require("../services/allocationService");

const WaitingQueue = require("../models/WaitingQueue");
const Table = require("../models/Table");
const Restaurant = require("../models/Restaurant");
const { emitToRestaurant } = require("../services/socketService");
const reservationService = require("../services/reservationService");

const WAITLIST_DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

exports.allocateTable = async (req, res) => {
  try {
    const { groupSize, guestName, guestPhone } = req.body;
    const restaurantId = req.user.restaurantId;

    if (!restaurantId) {
      return res.status(400).json({ error: "Customer role cannot allocate tables" });
    }

    const staffCreated = ["manager", "waiter", "host"].includes(req.user.role);
    const result = await allocateTableService(groupSize, restaurantId, staffCreated ? null : req.user._id, guestName, guestPhone);
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
      beforeCreatedAt: entry.createdAt
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
    await entry.save();
    emitToRestaurant(entry.restaurantId.toString(), "waitlist:cancelled", { waitingQueueId: entry._id.toString() });
    return res.json({ success: true, message: "Waitlist entry cancelled", entry });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Respond to waitlist notification: accept or decline
exports.respondToWaitlistNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { accept, tableId } = req.body;

    if (typeof accept !== "boolean") {
      return res.status(400).json({ error: "accept must be true or false" });
    }

    const entry = await WaitingQueue.findById(id);
    if (!entry) {
      return res.status(404).json({ error: "Waitlist entry not found" });
    }

    // Verify restaurant scoping
    const restaurant = await Restaurant.findById(entry.restaurantId).select("owner");
    const restaurantId = entry.restaurantId;
    const isOwner = restaurant?.owner.equals(req.user._id);
    const isRestaurantStaff = entry.restaurantId.equals(req.user.restaurantId);
    if (!isOwner && !isRestaurantStaff) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Verify status is 'notified'
    if (entry.status !== "notified") {
      return res.status(400).json({ error: "Entry is not in notified state" });
    }

    // Check if response deadline has passed
    if (new Date() > entry.responseDeadline) {
      return res.status(410).json({ error: "Response deadline has passed" });
    }

    // Verify that either the customer matches OR this is a host/manager responding for a walk-in
    if (entry.customer && !entry.customer.equals(req.user._id)) {
      // Customer is set, but it's not the current user
      if (!["host", "manager", "owner"].includes(req.user.role) || (!isOwner && req.user.role === "owner")) {
        return res.status(403).json({ error: "Unauthorized" });
      }
    } else if (!entry.customer) {
      // Walk-in entry (no customer), only host/manager can respond
      if (!["host", "manager", "owner"].includes(req.user.role) || (!isOwner && req.user.role === "owner")) {
        return res.status(403).json({ error: "Only host or manager can respond for walk-ins" });
      }
    }

    if (accept) {
      // Accept: mark as allocated and set table to occupied
      if (!tableId) {
        return res.status(400).json({ error: "tableId required to accept" });
      }

      const table = await Table.findOne({ _id: tableId, restaurantId });
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      if (table.status !== "reserved") {
        return res.status(400).json({ error: "Table is not in reserved state" });
      }

      // Mark table as occupied
      table.status = "occupied";
      await table.save();

      emitToRestaurant(restaurantId.toString(), "table:statusChanged", {
        tableId: table._id.toString(),
        restaurantId: restaurantId.toString(),
        status: table.status
      });

      // Mark entry as allocated
      entry.status = "allocated";
      await entry.save();

      return res.json({
        success: true,
        message: "Table allocated successfully",
        entry
      });
    } else {
      // Decline: mark as cancelled, try to allocate table to next compatible entry
      if (!tableId) {
        return res.status(400).json({ error: "tableId required to decline" });
      }

      const table = await Table.findOne({ _id: tableId, restaurantId });
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Mark table as available again for reallocation
      table.status = "available";
      await table.save();

      emitToRestaurant(restaurantId.toString(), "table:statusChanged", {
        tableId: table._id.toString(),
        restaurantId: restaurantId.toString(),
        status: table.status
      });

      entry.status = "cancelled";
      await entry.save();

      // Re-run allocation for this table against remaining queue
      try {
        const reallocationResult = await allocateFromWaitlistForTable(tableId, restaurantId);
        return res.json({
          success: true,
          message: "Declined; table freed for next entry",
          declined: true,
          reallocated: reallocationResult.allocated,
          reallocationResult
        });
      } catch (reallocationErr) {
        // Even if reallocation fails, the decline succeeded
        return res.json({
          success: true,
          message: "Declined; no compatible entry found for table",
          declined: true,
          reallocated: false
        });
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Manual expiry check for notified entries
exports.expireWaitlistEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { tableId } = req.body;

    const entry = await WaitingQueue.findById(id);
    if (!entry) {
      return res.status(404).json({ error: "Waitlist entry not found" });
    }

    // Verify restaurant scoping
    if (!entry.restaurantId.equals(req.user.restaurantId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Only restaurant managers and hosts can trigger a manual expiry check.
    if (!["manager", "host"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only a manager or host can perform expiry check" });
    }

    const expiredWaitingEntry = isWaitingEntryExpired(entry);
    const expiredNotification = entry.status === "notified" && new Date() > entry.responseDeadline;
    if (!expiredWaitingEntry && !expiredNotification) {
      return res.status(400).json({ error: "Entry is not eligible for an expiry check" });
    }

    if (expiredWaitingEntry || expiredNotification) {
      entry.status = "expired";
      await entry.save();
    }

    // Try to re-run matching for this table if one was provided
    let reallocationResult = { allocated: false };

    if (tableId && expiredNotification) {
      const table = await Table.findOne({ _id: tableId, restaurantId: req.user.restaurantId });
      if (table) {
        // Mark table as available for reallocation
        table.status = "available";
        await table.save();

        emitToRestaurant(req.user.restaurantId.toString(), "table:statusChanged", {
          tableId: table._id.toString(),
          restaurantId: req.user.restaurantId.toString(),
          status: table.status
        });

        try {
          reallocationResult = await allocateFromWaitlistForTable(tableId, req.user.restaurantId);
        } catch (err) {
          // Expiry succeeded even if reallocation fails
        }
      }
    }

    return res.json({
      success: true,
      message: expiredNotification ? "Entry expired; table freed for next entry" : "Waiting entry expired",
      entry,
      reallocated: reallocationResult.allocated,
      reallocationResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
