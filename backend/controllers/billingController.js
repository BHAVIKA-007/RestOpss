const Order = require("../models/Order");
const Table = require("../models/Table");
const { emitToRestaurant } = require("../services/socketService");

// Get unpaid completed orders
exports.getPendingBills = async (req, res) => {
  const orders = await Order.find({
    status: "completed",
    paidStatus: "unpaid"
  }).populate("table");

  res.json(orders);
};


// Mark bill as paid
exports.markPaid = async (req, res) => {
  try {
    const { paymentMethod } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.paidStatus === "paid")
      return res.status(400).json({ message: "Bill is already paid" });

    order.paidStatus = "paid";
    order.paymentMethod = paymentMethod;
    order.paidAt = new Date();
    await order.save();

    // Free table just in case
    const table = await Table.findById(order.table);
    if (table) {
      table.status = "available";
      table.currentOrder = null;
      await table.save();

      emitToRestaurant(table.restaurantId.toString(), "table:statusChanged", {
        tableId: table._id.toString(),
        restaurantId: table.restaurantId.toString(),
        status: table.status
      });
    }

    res.json({ message: "Payment successful", order });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
