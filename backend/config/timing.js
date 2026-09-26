const reservationLeadTimeMinutes = 30;
const seatingBufferMinutes = 15;
const noShowGraceMinutes = 15;

const RESERVATION_LEAD_TIME_MS = reservationLeadTimeMinutes * 60 * 1000;
const SEATING_BUFFER_MS = seatingBufferMinutes * 60 * 1000;
const NO_SHOW_GRACE_MS = noShowGraceMinutes * 60 * 1000;

module.exports = {
  reservationLeadTimeMinutes,
  seatingBufferMinutes,
  noShowGraceMinutes,
  RESERVATION_LEAD_TIME_MS,
  SEATING_BUFFER_MS,
  NO_SHOW_GRACE_MS
};