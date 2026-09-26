const Order = require("../models/Order");
const Table = require("../models/Table");
const Reservation = require("../models/Reservation");
const { emitToRestaurant } = require("../services/socketService");
const { rematchAfterTableAvailable } = require("../services/allocationService");

// Get unpaid completed orders
exports.getPendingBills = async (req, res) => {
  try {
    const orders = await Order.find({
      restaurantId: req.user.restaurantId,
      status: "completed",
      paidStatus: "unpaid"
    }).populate("table", "number").populate({
      path: "reservation",
      select: "customer",
      populate: { path: "customer", select: "name" }
    });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// Mark bill as paid
exports.markPaid = async (req, res) => {
  try {
    const { paymentMethod } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.restaurantId.toString() !== req.user.restaurantId?.toString()) {
      return res.status(403).json({ message: "Cannot pay an order from another restaurant" });
    }

    if (order.paidStatus === "paid")
      return res.status(400).json({ message: "Bill is already paid" });

    order.paidStatus = "paid";
    order.paymentMethod = paymentMethod;
    order.paidAt = new Date();
    await order.save();

    let tables = [];
    if (order.reservation) {
      const unpaidOrderCount = await Order.countDocuments({
        reservation: order.reservation,
        paidStatus: "unpaid"
      });

      if (unpaidOrderCount === 0) {
        const reservation = await Reservation.findById(order.reservation);
        if (reservation?.status === "seated") {
          reservation.status = "completed";
          reservation.lockExpiresAt = null;
          reservation.lockedTableSlots = [];
          await reservation.save();
          tables = await Table.find({ _id: { $in: reservation.tables } });
        }
      }
    } else {
      // Preserve legacy walk-in billing behavior.
      tables = order.combinedGroupId
        ? await Table.find({ combinedGroupId: order.combinedGroupId })
        : await Table.find({ _id: order.table });
    }

    for (const table of tables) {
      table.status = "available";
      table.currentOrder = null;
      table.combinedGroupId = null;
      await table.save();
      await rematchAfterTableAvailable(table);

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
