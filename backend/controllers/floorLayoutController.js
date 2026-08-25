const mongoose = require("mongoose");
const Table = require("../models/Table");
const FloorElement = require("../models/FloorElement");

const isValidGridCoordinate = (value) => Number.isInteger(value) && value >= 0;

const normalizeTablePayload = (table, restaurantId) => ({
  ...(table._id ? { _id: table._id } : {}),
  number: table.number,
  capacity: table.capacity,
  gridX: table.gridX,
  gridY: table.gridY,
  shape: table.shape,
  combinable: table.combinable,
  adjacentTo: Array.isArray(table.adjacentTo) ? table.adjacentTo : [],
  restaurantId
});

const validateTableEntry = (entry, restaurantId) => {
  if (entry._id && !mongoose.Types.ObjectId.isValid(entry._id)) {
    return "Invalid table id";
  }

  if (entry.gridX === undefined || entry.gridY === undefined) {
    return "gridX and gridY are required";
  }

  if (!isValidGridCoordinate(entry.gridX) || !isValidGridCoordinate(entry.gridY)) {
    return "gridX and gridY must be non-negative integers";
  }

  if (entry.number === undefined || entry.capacity === undefined) {
    return "number and capacity are required";
  }

  if (entry.shape !== undefined && !["square", "round", "rect"].includes(entry.shape)) {
    return "shape must be one of: square, round, rect";
  }

  if (Array.isArray(entry.adjacentTo)) {
    const invalidAdjacent = entry.adjacentTo.find((adjacentId) => !mongoose.Types.ObjectId.isValid(adjacentId));
    if (invalidAdjacent) {
      return "adjacentTo contains an invalid table id";
    }
  }

  return null;
};

exports.saveFloorLayout = async (req, res) => {
  try {
    if (!req.restaurantId && !req.user?.restaurantId) {
      return res.status(400).json({ message: "You must own a restaurant first" });
    }

    const { tables = [], elements = [] } = req.body || {};

    const tableEntries = Array.isArray(tables) ? tables : [];
    const elementEntries = Array.isArray(elements) ? elements : [];

    const restaurantId = req.restaurantId || req.user.restaurantId;

    for (const [index, entry] of tableEntries.entries()) {
      const validationMessage = validateTableEntry(entry, restaurantId);
      if (validationMessage) {
        return res.status(400).json({ message: `Table entry ${index + 1} failed validation: ${validationMessage}` });
      }
    }

    const tableIdsInRequest = tableEntries
      .filter((entry) => entry._id)
      .map((entry) => entry._id.toString());

    const existingTables = await Table.find({ restaurantId }).select("_id");
    const existingTableIds = existingTables.map((table) => table._id.toString());

    for (const incomingId of tableIdsInRequest) {
      const belongsToRestaurant = existingTableIds.includes(incomingId);
      if (!belongsToRestaurant) {
        return res.status(403).json({ message: "You can only update tables from your own restaurant" });
      }
    }

    const adjacentTableIds = new Set();
    for (const entry of tableEntries) {
      if (Array.isArray(entry.adjacentTo)) {
        for (const adjacentId of entry.adjacentTo) {
          adjacentTableIds.add(adjacentId.toString());
        }
      }
    }

    const adjacentTables = await Table.find({ _id: { $in: [...adjacentTableIds] } }).select("_id restaurantId");
    const adjacentTableMap = new Map(adjacentTables.map((table) => [table._id.toString(), table]));

    for (const entry of tableEntries) {
      if (!Array.isArray(entry.adjacentTo)) continue;

      for (const adjacentId of entry.adjacentTo) {
        const adjacentTable = adjacentTableMap.get(adjacentId.toString());

        if (!adjacentTable) {
          return res.status(400).json({ message: "adjacentTo references a table that does not exist in this restaurant" });
        }

        if (adjacentTable.restaurantId.toString() !== restaurantId.toString()) {
          return res.status(400).json({ message: "adjacentTo contains a table from another restaurant" });
        }
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const createdOrUpdatedTables = [];

      for (const entry of tableEntries) {
        if (entry._id) {
          const existingTable = await Table.findOne({ _id: entry._id, restaurantId }).session(session);
          if (!existingTable) {
            await session.abortTransaction();
            return res.status(403).json({ message: "You can only update tables from your own restaurant" });
          }

          const updatedTable = await Table.findByIdAndUpdate(
            entry._id,
            {
              number: entry.number,
              capacity: entry.capacity,
              gridX: entry.gridX,
              gridY: entry.gridY,
              shape: entry.shape,
              combinable: entry.combinable,
              adjacentTo: entry.adjacentTo || []
            },
            { new: true, runValidators: true, session }
          );
          createdOrUpdatedTables.push(updatedTable);
        } else {
          const createdTable = await Table.create([
            {
              ...normalizeTablePayload(entry, restaurantId),
              restaurantId
            }
          ], { session });
          createdOrUpdatedTables.push(createdTable[0]);
        }
      }

      await FloorElement.deleteMany({ restaurantId }).session(session);

      const floorElements = elementEntries.map((element) => ({
        ...element,
        restaurantId
      }));

      await FloorElement.insertMany(floorElements, { session });

      await session.commitTransaction();
      return res.status(200).json({ message: "Floor layout saved", tables: createdOrUpdatedTables, elements: floorElements });
    } catch (err) {
      await session.abortTransaction();
      if (err?.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: err.message });
    } finally {
      session.endSession();
    }
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: err.message });
  }
};

exports.getFloorLayout = async (req, res) => {
  try {
    let restaurantId = req.query.restaurantId;

    if (!restaurantId) {
      if (req.user?.restaurantId) {
        restaurantId = req.user.restaurantId;
      } else {
        return res.status(400).json({ message: "restaurantId query parameter is required for customers" });
      }
    }

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurantId" });
    }

    const tables = await Table.find({ restaurantId }).sort({ number: 1 });
    const elements = await FloorElement.find({ restaurantId }).sort({ createdAt: 1 });

    return res.json({ tables, elements });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
