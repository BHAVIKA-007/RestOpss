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
      combinedGroupId: tableExists.combinedGroupId,
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

    const nextStatuses = {
      pending: "accepted",
      accepted: "preparing",
      preparing: "ready",
      ready: "picked_up",
      picked_up: "served",
      served: "completed"
    };
    if (nextStatuses[order.status] !== status) {
      return res.status(400).json({ message: `Cannot transition order from ${order.status} to ${status}` });
    }
    order.status = status;
    await order.save();

    const events = { accepted: "order:accepted", picked_up: "order:pickedUp", served: "order:delivered" };
    if (events[status]) {
      emitToRestaurant(order.restaurantId.toString(), events[status], {
        orderId: order._id.toString(),
        restaurantId: order.restaurantId.toString()
      });
    }

    res.json({ message: "Order updated", order });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateDeliveryStatus = async (req, res, expected, status, eventName) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.restaurantId.toString() !== req.user.restaurantId?.toString()) return res.status(403).json({ message: "Cannot operate on an order from another restaurant" });
    if (order.status !== expected) return res.status(400).json({ message: `Order must be ${expected} before it can be ${status}` });
    order.status = status;
    await order.save();
    emitToRestaurant(order.restaurantId.toString(), eventName, { orderId: order._id.toString(), restaurantId: order.restaurantId.toString() });
    return res.json({ message: "Order updated", order });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

exports.pickupOrder = (req, res) => updateDeliveryStatus(req, res, "ready", "picked_up", "order:pickedUp");
exports.deliverOrder = (req, res) => updateDeliveryStatus(req, res, "picked_up", "served", "order:delivered");


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
