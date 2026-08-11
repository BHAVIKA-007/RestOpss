const mongoose = require("mongoose");

const floorElementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["wall", "window", "door", "divider"],
    required: true
  },

  gridX: {
    type: Number,
    required: true
  },

  gridY: {
    type: Number,
    required: true
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

module.exports = mongoose.model("FloorElement", floorElementSchema);
