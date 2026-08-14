const mongoose = require("mongoose");

const LOCKED_TABLE_BUCKET_MS = 15 * 60 * 1000;

const buildLockedTableSlots = ({ tables, timeSlot, durationMinutes }) => {
  if (!Array.isArray(tables) || tables.length === 0) return [];

  const startMs = new Date(timeSlot).getTime();
  const durationMs = (Number(durationMinutes) || 90) * 60 * 1000;
  const endMs = startMs + durationMs;

  const startBucket = Math.floor(startMs / LOCKED_TABLE_BUCKET_MS) * LOCKED_TABLE_BUCKET_MS;
  const endBucket = Math.floor((endMs - 1) / LOCKED_TABLE_BUCKET_MS) * LOCKED_TABLE_BUCKET_MS;

  const slots = new Set();

  for (const tableId of tables) {
    const tableKey = tableId.toString();
    for (let bucketMs = startBucket; bucketMs <= endBucket; bucketMs += LOCKED_TABLE_BUCKET_MS) {
      slots.add(`${tableKey}_${bucketMs}`);
    }
  }

  return Array.from(slots);
};

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

  requiresApproval: {
    type: Boolean,
    default: false
  },

  lockExpiresAt: {
    type: Date,
    default: null
  },

  lockedTableSlots: {
    type: [String],
    default: []
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

reservationSchema.statics.getLockedTableSlots = function ({ tables, timeSlot, durationMinutes }) {
  return buildLockedTableSlots({ tables, timeSlot, durationMinutes });
};

reservationSchema.pre("save", function () {
  if (!["confirmed", "seated"].includes(this.status)) {
    this.lockedTableSlots = [];
  }
});

reservationSchema.index(
  { lockedTableSlots: 1 },
  { unique: true, partialFilterExpression: { lockedTableSlots: { $exists: true, $ne: [] } } }
);

module.exports = mongoose.model("Reservation", reservationSchema);
