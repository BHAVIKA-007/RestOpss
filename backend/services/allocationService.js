const Table = require("../models/Table");
const WaitingQueue = require("../models/WaitingQueue");
const { emitToRestaurant } = require("./socketService");

/*
  NORMAL ALLOCATION
*/
exports.allocateTableService = async (groupSize) => {
  if (!groupSize || groupSize <= 0)
    throw new Error("Invalid group size");

  // Find smallest available table >= group
  const table = await Table.findOne({
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
  const biggestTable = await Table.findOne().sort({ capacity: -1 });

  // Means this group is too large for system tables
  if (biggestTable && biggestTable.capacity < groupSize) {
    return {
      status: "manager_required",
      message: "Group too large. Manager override needed."
    };
  }

  // Else → add to waiting queue
  const entry = await WaitingQueue.create({ groupSize });

  const position = await WaitingQueue.countDocuments({
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
*/
exports.freeTableService = async (tableId) => {
  const table = await Table.findById(tableId);
  if (!table) throw new Error("Table not found");

  table.status = "available";
  await table.save();

  emitToRestaurant(table.restaurantId.toString(), "table:statusChanged", {
    tableId: table._id.toString(),
    restaurantId: table.restaurantId.toString(),
    status: table.status
  });

  const waitingList = await WaitingQueue.find({
    status: "waiting"
  }).sort({ createdAt: 1 });

  for (let group of waitingList) {
    const suitableTable = await Table.findOne({
      status: "available",
      capacity: { $gte: group.groupSize }
    }).sort({ capacity: 1 });

    if (suitableTable) {
      suitableTable.status = "occupied";
      await suitableTable.save();

      emitToRestaurant(suitableTable.restaurantId.toString(), "table:statusChanged", {
        tableId: suitableTable._id.toString(),
        restaurantId: suitableTable.restaurantId.toString(),
        status: suitableTable.status
      });

      group.status = "allocated";
      await group.save();

      return {
        freed: true,
        allocated: true,
        assignedTable: suitableTable._id,
        groupId: group._id
      };
    }
  }

  return { freed: true, allocated: false };
};

/*
  VIEW WAITING QUEUE
*/
exports.viewWaitingQueue = async () => {
  return await WaitingQueue.find({ status: "waiting" })
    .sort({ createdAt: 1 });
};  

/*
  MANAGER OVERRIDE
  Combine tables to handle big groups
*/
exports.managerOverrideAllocate = async (groupSize) => {
  if (!groupSize || groupSize <= 0)
    throw new Error("Invalid group size");

  const tables = await Table.find({ status: "available" })
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