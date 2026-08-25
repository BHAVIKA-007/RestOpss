const mongoose = require("mongoose");

const waitingSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true
  },

  groupSize: {
    type: Number,
    required: true
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  guestName: { type: String, default: null },
  guestPhone: { type: String, default: null },
  notificationChannel: { type: String, enum: ["in_app_only"], default: "in_app_only" },

  status: {
    type: String,
    enum: ["waiting", "notified", "allocated", "cancelled", "expired"],
    default: "waiting"
  },

  notifiedAt: {
    type: Date,
    default: null
  },

  responseDeadline: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("WaitingQueue", waitingSchema);
