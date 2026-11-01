const Reservation = require("../models/Reservation");
const socketService = require("../services/socketService");
const { EXPIRY_SWEEP_MARGIN_MS, APPROVAL_PENDING_GRACE_MS } = require("../config/timing");

const BATCH_SIZE = 200;

exports.expireStaleReservations = async (now = new Date()) => {
  const regularCutoff = new Date(now.getTime() - EXPIRY_SWEEP_MARGIN_MS);
  const approvalCutoff = new Date(now.getTime() - APPROVAL_PENDING_GRACE_MS);
  const candidates = await Reservation.find({
    status: "locked",
    $or: [
      { requiresApproval: { $ne: true }, lockExpiresAt: { $lt: regularCutoff } },
      { requiresApproval: true, lockExpiresAt: { $lt: approvalCutoff } }
    ]
  })
    .sort({ lockExpiresAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  const ids = [];
  for (const candidate of candidates) {
    const requiresApproval = candidate.requiresApproval === true;
    const cutoff = requiresApproval ? approvalCutoff : regularCutoff;
    const updatedReservation = await Reservation.findOneAndUpdate(
      {
        _id: candidate._id,
        status: "locked",
        requiresApproval: requiresApproval ? true : { $ne: true },
        lockExpiresAt: { $lt: cutoff }
      },
      {
        $set: {
          status: "expired",
          expiredAt: now,
          lockedTableSlots: []
        }
      },
      { new: true }
    );

    if (!updatedReservation) continue;

    const reservationId = updatedReservation._id.toString();
    ids.push(reservationId);
    try {
      socketService.emitToRestaurant(updatedReservation.restaurantId.toString(), "reservation:expired", {
        reservationId,
        restaurantId: updatedReservation.restaurantId.toString(),
        tableIds: updatedReservation.tables.map((table) => table.toString())
      });
    } catch (error) {
      console.error(`Failed to emit reservation:expired for ${reservationId}:`, error);
    }
  }

  return { expiredCount: ids.length, ids };
};
