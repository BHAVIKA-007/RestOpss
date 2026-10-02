const mongoose = require("mongoose");

const isValidPhone = (phone) => {
  if (phone == null || phone.trim() === "") return true;
  return /^[0-9 +()-]+$/.test(phone) && (phone.match(/[0-9]/g) || []).length >= 7;
};

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  defaultSeatingDurationMinutes: { type: Number, default: 60, min: 15, max: 240 },
  maxPartySizeOverride: { type: Number, default: null, min: 1 },
  address: { type: String },
  phone: {
    type: String,
    validate: {
      validator: isValidPhone,
      message: "Phone must contain only digits, spaces, +, -, and parentheses, and include at least 7 digits"
    }
  },
  cuisine: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Restaurant", RestaurantSchema);
