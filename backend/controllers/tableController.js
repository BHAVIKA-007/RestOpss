const Table = require("../models/Table");

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

    if (!req.user?.restaurantId) {
      return res.status(400).json({ message: "You must own a restaurant first" });
    }

    if (gridX === undefined || gridY === undefined) {
      return res.status(400).json({ message: "gridX and gridY are required" });
    }

    if (!isValidGridCoordinate(gridX) || !isValidGridCoordinate(gridY)) {
      return res.status(400).json({ message: "gridX and gridY must be non-negative integers" });
    }

    const exists = await Table.findOne({ number, restaurantId: req.user.restaurantId });
    if (exists)
      return res.status(400).json({ message: "Table number already exists for this restaurant" });

    const table = await Table.create({
      number,
      capacity,
      gridX,
      gridY,
      shape,
      combinable,
      restaurantId: req.user.restaurantId
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
  const tables = await Table.find({ restaurantId: req.user.restaurantId });
  res.json(tables);
};


// GET single table
exports.getTable = async (req, res) => {
  const table = await Table.findOne({ _id: req.params.id, restaurantId: req.user.restaurantId });
  if (!table) return res.status(404).json({ message: "Table not found" });

  res.json(table);
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
      { _id: req.params.id, restaurantId: req.user.restaurantId },
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
    const table = await Table.findOneAndDelete({ _id: req.params.id, restaurantId: req.user.restaurantId });
    if (!table) return res.status(404).json({ message: "Table not found" });

    res.json({ message: "Table deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
