const Table = require("../models/Table");

const handleDuplicateTableError = (res, err) => {
  if (err?.code === 11000) {
    return res.status(400).json({ message: "Table number already exists for this restaurant" });
  }

  return res.status(500).json({ message: err.message });
};

// CREATE table
exports.createTable = async (req, res) => {
  try {
    const { number, capacity } = req.body;

    const exists = await Table.findOne({ number, restaurantId: req.user.restaurantId });
    if (exists)
      return res.status(400).json({ message: "Table number already exists for this restaurant" });

    const table = await Table.create({
      number,
      capacity,
      restaurantId: req.user.restaurantId
    });

    res.status(201).json({ message: "Table created", table });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    const table = await Table.findOneAndUpdate(
      { _id: req.params.id, restaurantId: req.user.restaurantId },
      req.body,
      { new: true }
    );

    if (!table) return res.status(404).json({ message: "Table not found" });

    res.json({ message: "Table updated", table });
  } catch (err) {
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
