const express = require("express");
const router = express.Router();

const {
  createReservation,
  suggestCombination,
  confirmReservation,
  approveReservation,
  rejectReservation,
  getMyReservations,
  cancelReservation,
  seatReservation,
  completeReservation,
  markNoShow
} = require("../controllers/reservationController");

const { auth, isManager, isWaiter } = require("../middleware/auth");

const allowHostOrWaiter = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role === "host") return next();
  return isWaiter(req, res, next);
};

const allowManagerOrHost = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role === "host") return next();
  return isManager(req, res, next);
};

router.post("/", auth, createReservation);

router.get("/suggest-combination", auth, suggestCombination);

router.patch("/:id/confirm", auth, confirmReservation);

router.patch("/:id/approve", auth, allowManagerOrHost, approveReservation);

router.patch("/:id/reject", auth, allowManagerOrHost, rejectReservation);

router.get("/my", auth, getMyReservations);

router.patch("/:id/cancel", auth, cancelReservation);

router.patch("/:id/seat", auth, allowHostOrWaiter, seatReservation);

router.patch("/:id/complete", auth, allowHostOrWaiter, completeReservation);

router.patch("/:id/no-show", auth, allowHostOrWaiter, markNoShow);

module.exports = router;
