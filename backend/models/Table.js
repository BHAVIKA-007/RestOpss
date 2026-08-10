const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true
  },

  capacity: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["available", "reserved", "occupied", "cleaning"],
    default: "available"
  },

  currentOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null
  },

  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

tableSchema.index({ restaurantId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("Table", tableSchema);
