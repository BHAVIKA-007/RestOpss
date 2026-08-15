const {
  allocateTableService,
  freeTableService,
  viewWaitingQueue,
  viewWaitingQueueWithPosition,
  managerOverrideAllocate,
  allocateFromWaitlistForTable
} = require("../services/allocationService");

const WaitingQueue = require("../models/WaitingQueue");
const Table = require("../models/Table");
const { emitToRestaurant } = require("./socketService");

const WAITLIST_RESPONSE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

exports.allocateTable = async (req, res) => {
  try {
    const { groupSize } = req.body;
    const restaurantId = req.user.restaurantId;

    if (!restaurantId) {
      return res.status(400).json({ error: "Customer role cannot allocate tables" });
    }

    const result = await allocateTableService(groupSize, restaurantId, req.user._id);
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
    if (!entry.restaurantId.equals(req.user.restaurantId)) {
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
      if (!["host", "manager"].includes(req.user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }
    } else if (!entry.customer) {
      // Walk-in entry (no customer), only host/manager can respond
      if (!["host", "manager"].includes(req.user.role)) {
        return res.status(403).json({ error: "Only host or manager can respond for walk-ins" });
      }
    }

    if (accept) {
      // Accept: mark as allocated and set table to occupied
      if (!tableId) {
        return res.status(400).json({ error: "tableId required to accept" });
      }

      const table = await Table.findOne({ _id: tableId, restaurantId: req.user.restaurantId });
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      if (table.status !== "reserved") {
        return res.status(400).json({ error: "Table is not in reserved state" });
      }

      // Mark table as occupied
      table.status = "occupied";
      await table.save();

      emitToRestaurant(req.user.restaurantId.toString(), "table:statusChanged", {
        tableId: table._id.toString(),
        restaurantId: req.user.restaurantId.toString(),
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

      const table = await Table.findOne({ _id: tableId, restaurantId: req.user.restaurantId });
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }

      // Mark table as available again for reallocation
      table.status = "available";
      await table.save();

      emitToRestaurant(req.user.restaurantId.toString(), "table:statusChanged", {
        tableId: table._id.toString(),
        restaurantId: req.user.restaurantId.toString(),
        status: table.status
      });

      entry.status = "cancelled";
      await entry.save();

      // Re-run allocation for this table against remaining queue
      try {
        const reallocationResult = await allocateFromWaitlistForTable(tableId, req.user.restaurantId);
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

    // Only manager can trigger manual expiry check
    if (req.user.role !== "manager") {
      return res.status(403).json({ error: "Only manager can perform expiry check" });
    }

    if (entry.status !== "notified") {
      return res.status(400).json({ error: "Entry is not in notified state" });
    }

    if (new Date() <= entry.responseDeadline) {
      return res.status(400).json({ error: "Response deadline has not yet passed" });
    }

    // Mark as expired
    entry.status = "expired";
    await entry.save();

    // Try to re-run matching for this table if one was provided
    let reallocationResult = { allocated: false };

    if (tableId) {
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
      message: "Entry expired; table freed for next entry",
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
