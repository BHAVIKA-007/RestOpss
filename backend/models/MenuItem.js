const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  description: {
    type: String
  },

  price: {
    type: Number,
    required: true,
    min: [0, "Price must be greater than or equal to 0"]
  },

  category: {
    type: String,
    required: true
  },

  isAvailable: {
    type: Boolean,
    default: true
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

menuItemSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("MenuItem", menuItemSchema);
