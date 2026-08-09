const {
  allocateTableService,
  freeTableService,
  viewWaitingQueue,
  managerOverrideAllocate
} = require("../services/allocationService");

exports.allocateTable = async (req, res) => {
  try {
    const { groupSize } = req.body;
    const result = await allocateTableService(groupSize);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.freeTable = async (req, res) => {
  try {
    const { tableId } = req.body;
    const result = await freeTableService(tableId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getWaitingQueue = async (req, res) => {
  try {
    const queue = await viewWaitingQueue();
    res.json(queue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.managerOverride = async (req, res) => {
  try {
    const { groupSize } = req.body;
    const result = await managerOverrideAllocate(groupSize);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
