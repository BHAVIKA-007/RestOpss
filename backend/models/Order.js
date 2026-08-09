const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  table: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table",
    required: true
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  items: [
    {
      name: String,
      price: Number,
      quantity: Number
    }
  ],

  status: {
    type: String,
    enum: ["pending", "preparing", "ready", "served", "completed"],
    default: "pending"
  },

  totalAmount: {
    type: Number,
    default: 0
  },

  taxAmount: {
    type: Number,
    default: 0
  },

  finalBill: {
    type: Number,
    default: 0
  },

  paidStatus: {
  type: String,
  enum: ["unpaid", "paid"],
  default: "unpaid"
},

paymentMethod: {
  type: String,
  enum: ["cash", "card", "upi", null],
  default: null
},

paidAt: {
  type: Date,
  default: null
},

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Order", orderSchema);
