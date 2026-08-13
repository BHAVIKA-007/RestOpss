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
  const orders = await Order.find().populate("table").populate("customer");
  res.json(orders);
};


// Update Order Status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    await order.save();

    // If completed → free table
    if (status === "completed") {
      const table = await Table.findById(order.table);
      table.status = "available";
      table.currentOrder = null;
      await table.save();

      emitToRestaurant(table.restaurantId.toString(), "table:statusChanged", {
        tableId: table._id.toString(),
        restaurantId: table.restaurantId.toString(),
        status: table.status
      });
    }

    res.json({ message: "Order updated", order });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Get Single Order
exports.getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("table")
    .populate("customer");

  if (!order) return res.status(404).json({ message: "Order not found" });

  res.json(order);
};
