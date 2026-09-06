const Table = require("../models/Table");
const User = require("../models/User");

const handleDuplicateTableError = (res, err) => {
  if (err?.code === 11000) {
    return res.status(400).json({ message: "Table number already exists for this restaurant" });
  }

  return res.status(500).json({ message: err.message });
};

const isValidGridCoordinate = (value) => Number.isInteger(value) && value >= 0;

// CREATE table
exports.createTable = async (req, res) => {
  try {
    const { number, capacity, gridX, gridY, shape, combinable } = req.body;

    if (!req.restaurantId) {
      return res.status(400).json({ message: "You must own a restaurant first" });
    }

    if (gridX === undefined || gridY === undefined) {
      return res.status(400).json({ message: "gridX and gridY are required" });
    }

    if (!isValidGridCoordinate(gridX) || !isValidGridCoordinate(gridY)) {
      return res.status(400).json({ message: "gridX and gridY must be non-negative integers" });
    }

    const exists = await Table.findOne({ number, restaurantId: req.restaurantId });
    if (exists)
      return res.status(400).json({ message: "Table number already exists for this restaurant" });

    const table = await Table.create({
      number,
      capacity,
      gridX,
      gridY,
      shape,
      combinable,
      restaurantId: req.restaurantId
    });

    res.status(201).json({ message: "Table created", table });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    return handleDuplicateTableError(res, err);
  }
};


// GET all tables
exports.getTables = async (req, res) => {
  const tables = await Table.find({ restaurantId: req.query.restaurantId || req.user.restaurantId });
  res.json(tables);
};


// GET single table
exports.getTable = async (req, res) => {
  const table = await Table.findOne({ _id: req.params.id, restaurantId: req.query.restaurantId || req.user.restaurantId });
  if (!table) return res.status(404).json({ message: "Table not found" });

  res.json(table);
};

// GET tables assigned to the authenticated waiter
exports.getMyTables = async (req, res) => {
  try {
    const tables = await Table.find({
      restaurantId: req.user.restaurantId,
      assignedWaiter: req.user._id
    }).sort({ number: 1 });

    return res.json(tables);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ASSIGN OR UNASSIGN A WAITER
exports.assignWaiter = async (req, res) => {
  try {
    const body = req.body || {};
    const { waiterId } = body;
    if (!Object.prototype.hasOwnProperty.call(body, "waiterId")) {
      return res.status(400).json({ message: "waiterId is required and must be a waiter ID or null" });
    }
    if (waiterId !== null && !waiterId) {
      return res.status(400).json({ message: "waiterId must be a waiter ID or null" });
    }

    const table = await Table.findOne({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!table) return res.status(404).json({ message: "Table not found" });

    if (waiterId === null) {
      table.assignedWaiter = null;
    } else {
      const waiter = await User.findOne({
        _id: waiterId,
        role: "waiter",
        restaurantId: req.restaurantId
      }).select("_id");

      if (!waiter) {
        return res.status(400).json({ message: "waiterId must belong to a waiter in the same restaurant" });
      }

      table.assignedWaiter = waiter._id;
    }

    await table.save();
    return res.json({ message: table.assignedWaiter ? "Waiter assigned" : "Waiter unassigned", table });
  } catch (err) {
    if (err?.name === "CastError") return res.status(400).json({ message: "waiterId must be a valid user ID or null" });
    return res.status(500).json({ message: err.message });
  }
};

// HOST QUICK STATUS UPDATE
exports.updateHostTableStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["available", "cleaning"].includes(status)) {
      return res.status(400).json({ message: "Only available or cleaning may be set manually; reserved and occupied are system-managed" });
    }

    const table = await Table.findOneAndUpdate(
      { _id: req.params.id, restaurantId: req.restaurantId },
      { status },
      { new: true, runValidators: true }
    );

    if (!table) return res.status(404).json({ message: "Table not found" });
    return res.json({ message: "Table status updated", table });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


// UPDATE table status OR capacity
exports.updateTable = async (req, res) => {
  try {
    const updateData = {};
    const fields = ["number", "capacity", "status", "currentOrder", "gridX", "gridY", "shape", "combinable"];

    fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.prototype.hasOwnProperty.call(updateData, "gridX") || Object.prototype.hasOwnProperty.call(updateData, "gridY")) {
      const gridX = updateData.gridX;
      const gridY = updateData.gridY;

      if ((gridX !== undefined && !isValidGridCoordinate(gridX)) || (gridY !== undefined && !isValidGridCoordinate(gridY))) {
        return res.status(400).json({ message: "gridX and gridY must be non-negative integers" });
      }
    }

    const table = await Table.findOneAndUpdate(
      { _id: req.params.id, restaurantId: req.restaurantId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!table) return res.status(404).json({ message: "Table not found" });

    res.json({ message: "Table updated", table });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    return handleDuplicateTableError(res, err);
  }
};


// DELETE table
exports.deleteTable = async (req, res) => {
  try {
    const table = await Table.findOneAndDelete({ _id: req.params.id, restaurantId: req.restaurantId });
    if (!table) return res.status(404).json({ message: "Table not found" });

    res.json({ message: "Table deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
