const mongoose = require("mongoose");

const waitingSchema = new mongoose.Schema({
  groupSize: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["waiting", "allocated", "cancelled"],
    default: "waiting"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("WaitingQueue", waitingSchema);
