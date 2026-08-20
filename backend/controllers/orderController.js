const Order = require("../models/Order");
const Table = require("../models/Table");
const { emitToRestaurant } = require("../services/socketService");

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const { table, customer, items } = req.body;

    const tableExists = await Table.findById(table);
    if (!tableExists)
      return res.status(404).json({ message: "Table not found" });

    if (req.user.restaurantId && tableExists.restaurantId.toString() !== req.user.restaurantId.toString()) {
      return res.status(403).json({ message: "Cannot create an order for another restaurant" });
    }

    // Calculate total
    let total = 0;
    items.forEach(item => {
      total += item.price * item.quantity;
    });

    const tax = total * 0.05;       // 5% GST
    const finalAmount = total + tax;

    const order = await Order.create({
      table,
      customer,
      restaurantId: tableExists.restaurantId,
      items,
      totalAmount: total,
      taxAmount: tax,
      finalBill: finalAmount
    });

    // Mark table occupied
    tableExists.status = "occupied";
    tableExists.currentOrder = order._id;
    await tableExists.save();

    emitToRestaurant(tableExists.restaurantId.toString(), "table:statusChanged", {
      tableId: tableExists._id.toString(),
      restaurantId: tableExists.restaurantId.toString(),
      status: tableExists.status
    });

    res.status(201).json({
      message: "Order created",
      order
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Get all orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ restaurantId: req.user.restaurantId })
      .populate("table")
      .populate("customer");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Update Order Status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

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


// Get Single Order
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("table")
      .populate("customer");

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.restaurantId.toString() !== req.user.restaurantId?.toString()) {
      return res.status(403).json({ message: "Cannot view an order from another restaurant" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
