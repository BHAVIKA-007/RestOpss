const reservationLeadTimeMinutes = 30;
const seatingBufferMinutes = 15;
const noShowGraceMinutes = 15;

const RESERVATION_LEAD_TIME_MS = reservationLeadTimeMinutes * 60 * 1000;
const SEATING_BUFFER_MS = seatingBufferMinutes * 60 * 1000;
const NO_SHOW_GRACE_MS = noShowGraceMinutes * 60 * 1000;
const EXPIRY_SWEEP_INTERVAL_MS = 60000;
const EXPIRY_SWEEP_MARGIN_MS = 60000;
const APPROVAL_PENDING_GRACE_MS = 1800000;

module.exports = {
  reservationLeadTimeMinutes,
  seatingBufferMinutes,
  noShowGraceMinutes,
  RESERVATION_LEAD_TIME_MS,
  SEATING_BUFFER_MS,
  NO_SHOW_GRACE_MS,
  EXPIRY_SWEEP_INTERVAL_MS,
  EXPIRY_SWEEP_MARGIN_MS,
  APPROVAL_PENDING_GRACE_MS
};