const timing = require("../config/timing");

exports.getTiming = (req, res) => {
  res.json({
    reservationLeadTimeMinutes: timing.reservationLeadTimeMinutes,
    seatingBufferMinutes: timing.seatingBufferMinutes,
    noShowGraceMinutes: timing.noShowGraceMinutes
  });
};