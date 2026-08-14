const Reservation = require("../models/Reservation");

console.log(
  "Loaded Reservation model from:",
  require.resolve("../models/Reservation")
);

console.log("Reservation:", Reservation);
console.log("Reservation.find:", typeof Reservation.find);
console.log("Reservation.findById:", typeof Reservation.findById);
/**
 * Check if any existing confirmed/seated reservation on the given tables
 * overlaps with the requested time window.
 *
 * @param {Array} tableIds - array of table ObjectId or string
 * @param {Date|string|number} timeSlot - requested start time
 * @param {number} durationMinutes
 * @param {string} excludeReservationId - optional reservation id to ignore
 * @returns {Promise<boolean>} true if overlap found
 */
exports.checkTableOverlap = async (tableIds, timeSlot, durationMinutes, excludeReservationId) => {
  const requestedStart = new Date(timeSlot);
  const requestedEnd = new Date(requestedStart.getTime() + (durationMinutes || 90) * 60000);

  const query = {
    tables: { $in: tableIds },
    status: { $in: ["confirmed", "seated"] }
  };

  if (excludeReservationId) query._id = { $ne: excludeReservationId };

  const existing = await Reservation.find(query).lean();

  for (const r of existing) {
    const existingStart = new Date(r.timeSlot);
    const existingEnd = new Date(existingStart.getTime() + (r.durationMinutes || 90) * 60000);

    if (existingStart < requestedEnd && requestedStart < existingEnd) {
      return true;
    }
  }

  return false;
};
