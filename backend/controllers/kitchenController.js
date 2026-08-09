const Order = require("../models/Order");

// Get orders for kitchen
exports.getKitchenOrders = async (req, res) => {
  const orders = await Order.find({
    status: { $in: ["pending", "preparing"] }
  }).populate("table");

  res.json(orders);
};


// Update order status in kitchen
exports.updateKitchenStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["preparing", "ready"].includes(status)) {
      return res.status(400).json({ message: "Invalid kitchen status" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    await order.save();

    res.json({ message: "Order updated", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
