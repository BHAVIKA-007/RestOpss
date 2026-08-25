const mongoose = require("mongoose");
const Order = require("../models/Order");
const Reservation = require("../models/Reservation");
const MenuItem = require("../models/MenuItem");
const { emitToRestaurant } = require("../services/socketService");

exports.createCustomerOrder = async (req, res) => {
  try {
    const { reservationId, items } = req.body;

    if (!reservationId || !mongoose.Types.ObjectId.isValid(reservationId)) {
      return res.status(400).json({ message: "A valid reservationId is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items must be a non-empty array" });
    }

    const invalidQuantity = items.some((item) => !item || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0);
    if (invalidQuantity) {
      return res.status(400).json({ message: "Each item quantity must be greater than zero" });
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    if (reservation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only order for your own reservation" });
    }

    if (!["confirmed", "seated"].includes(reservation.status)) {
      return res.status(400).json({ message: "Orders require a confirmed or seated reservation" });
    }

    const invalidItems = items
      .filter((item) => !item || !mongoose.Types.ObjectId.isValid(item.menuItemId))
      .map((item) => item?.menuItemId || "unknown");
    const menuItemIds = items
      .filter((item) => mongoose.Types.ObjectId.isValid(item.menuItemId))
      .map((item) => item.menuItemId);
    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
      restaurantId: reservation.restaurantId,
      isAvailable: true
    });
    const menuById = new Map(menuItems.map((item) => [item._id.toString(), item]));
    invalidItems.push(...items
      .filter((item) => item && mongoose.Types.ObjectId.isValid(item.menuItemId) && !menuById.has(item.menuItemId.toString()))
      .map((item) => item.menuItemId));

    if (invalidItems.length > 0) {
      return res.status(400).json({
        message: "Some menu items are unavailable or do not belong to this restaurant",
        invalidItems
      });
    }

    const orderItems = items.map((item) => {
      const menuItem = menuById.get(item.menuItemId.toString());
      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        priceAtOrder: menuItem.price,
        price: menuItem.price,
        quantity: Number(item.quantity)
      };
    });
    const total = orderItems.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);
    const tax = total * 0.05;
    const order = await Order.create({
      table: reservation.tables[0],
      restaurantId: reservation.restaurantId,
      customer: req.user._id,
      reservation: reservation._id,
      items: orderItems,
      status: "pending",
      totalAmount: total,
      taxAmount: tax,
      finalBill: total + tax
    });

    emitToRestaurant(reservation.restaurantId.toString(), "order:placed", {
      orderId: order._id.toString(),
      restaurantId: reservation.restaurantId.toString(),
      tableId: reservation.tables[0].toString(),
      reservationId: reservation._id.toString()
    });

    return res.status(201).json({ message: "Order placed", order });
  } catch (err) {
    if (err?.name === "ValidationError" || err?.name === "CastError") {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: err.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .populate("items.menuItem", "name");
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getMyOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.menuItem", "name")
      .populate("table");
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.customer || order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only view your own orders" });
    }
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.confirmReceived = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.customer) return res.status(400).json({ message: "Walk-in orders cannot be confirmed by a customer" });
    if (order.customer.toString() !== req.user._id.toString()) return res.status(403).json({ message: "You can only confirm your own order" });
    order.customerConfirmedAt = new Date();
    await order.save();
    return res.json({ message: "Order receipt confirmed", order });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};