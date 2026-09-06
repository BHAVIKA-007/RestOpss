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

  combinedGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true
  },

  assignedWaiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  gridX: {
    type: Number,
    required: true
  },

  gridY: {
    type: Number,
    required: true
  },

  shape: {
    type: String,
    enum: ["square", "round", "rect"],
    default: "square"
  },

  combinable: {
    type: Boolean,
    default: false
  },

  adjacentTo: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Table" }],
    default: []
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

tableSchema.index({ restaurantId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("Table", tableSchema);
