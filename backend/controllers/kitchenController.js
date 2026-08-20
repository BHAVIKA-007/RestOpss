const Order = require("../models/Order");

// Get orders for kitchen
exports.getKitchenOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      restaurantId: req.user.restaurantId,
      status: { $in: ["pending", "preparing"] }
    }).populate("table");

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
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

    if (order.restaurantId.toString() !== req.user.restaurantId?.toString()) {
      return res.status(403).json({ message: "Cannot operate on an order from another restaurant" });
    }

    order.status = status;
    await order.save();

    res.json({ message: "Order updated", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
