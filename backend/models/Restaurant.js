const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  address: { type: String },
  phone: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Restaurant", RestaurantSchema);
