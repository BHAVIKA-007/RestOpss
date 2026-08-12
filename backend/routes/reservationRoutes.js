const express = require("express");
const router = express.Router();

const {
  createReservation,
  confirmReservation,
  getMyReservations,
  cancelReservation,
  seatReservation,
  completeReservation,
  markNoShow
} = require("../controllers/reservationController");

const { auth, isWaiter } = require("../middleware/auth");

// Small middleware that allows host in addition to waiter/manager
const allowHostOrWaiter = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role === "host") return next();
  return isWaiter(req, res, next);
};

// Customer creates a reservation (locks for short time)
router.post("/", auth, createReservation);

// Customer confirms a previously locked reservation
router.patch("/:id/confirm", auth, confirmReservation);

// Get my reservations
router.get("/my", auth, getMyReservations);

// Cancel reservation (customer or manager/host of owning restaurant)
router.patch("/:id/cancel", auth, cancelReservation);

// Seat a confirmed reservation (waiter/manager/host)
router.patch("/:id/seat", auth, allowHostOrWaiter, seatReservation);

// Complete a seated reservation (waiter/manager/host)
router.patch("/:id/complete", auth, allowHostOrWaiter, completeReservation);

// Mark no-show (waiter/manager/host)
router.patch("/:id/no-show", auth, allowHostOrWaiter, markNoShow);

module.exports = router;
