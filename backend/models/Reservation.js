const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  tables: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Table" }],
    validate: {
      validator: function (v) {
        return Array.isArray(v) && v.length >= 1;
      },
      message: "At least one table must be selected"
    },
    required: true
  },

  partySize: {
    type: Number,
    required: true,
    min: 1
  },

  timeSlot: {
    type: Date,
    required: true
  },

  durationMinutes: {
    type: Number,
    required: true,
    default: 90
  },

  status: {
    type: String,
    enum: ["locked", "confirmed", "seated", "completed", "cancelled", "no_show"],
    default: "locked"
  },

  lockExpiresAt: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Reservation", reservationSchema);
