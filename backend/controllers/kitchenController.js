const Order = require("../models/Order");
const { emitToRestaurant } = require("../services/socketService");

// Get orders for kitchen
exports.getKitchenOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      restaurantId: req.user.restaurantId,
      status: { $in: ["pending", "accepted", "preparing"] }
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

    if (!["accepted", "preparing", "ready"].includes(status)) {
      return res.status(400).json({ message: "Invalid kitchen status" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.restaurantId.toString() !== req.user.restaurantId?.toString()) {
      return res.status(403).json({ message: "Cannot operate on an order from another restaurant" });
    }

    const allowedNext = {
      pending: "accepted",
      accepted: "preparing",
      preparing: "ready"
    };
    if (allowedNext[order.status] !== status) {
      return res.status(400).json({ message: `Cannot transition order from ${order.status} to ${status}` });
    }
    order.status = status;
    await order.save();

    const events = { accepted: "order:accepted" };
    if (events[status]) emitToRestaurant(order.restaurantId.toString(), events[status], { orderId: order._id.toString(), restaurantId: order.restaurantId.toString() });

    res.json({ message: "Order updated", order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
