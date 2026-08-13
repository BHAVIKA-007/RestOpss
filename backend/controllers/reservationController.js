const Reservation = require("../models/Reservation");
const Table = require("../models/Table");
const reservationService = require("../services/reservationService");

const LOCK_DURATION_MS = 10 * 60 * 1000;
const NO_SHOW_GRACE_MINUTES = 15;

exports.createReservation = async (req, res) => {
  try {
    const { restaurantId, tableIds, partySize, timeSlot, durationMinutes } = req.body;

    if (!Array.isArray(tableIds) || tableIds.length === 0) {
      return res.status(400).json({ message: "tableIds must be a non-empty array" });
    }

    // load tables
    const tables = await Table.find({ _id: { $in: tableIds } });
    if (tables.length !== tableIds.length) {
      return res.status(400).json({ message: "One or more tables not found" });
    }

    // ensure all tables belong to the requested restaurant
    for (const t of tables) {
      if (t.restaurantId.toString() !== restaurantId) {
        return res.status(400).json({ message: "All tables must belong to the provided restaurantId" });
      }
    }

    // capacity check
    const combinedCapacity = tables.reduce((s, t) => s + (t.capacity || 0), 0);
    if (!partySize || partySize < 1 || partySize > combinedCapacity) {
      return res.status(400).json({ message: "partySize must be >=1 and not exceed combined table capacity" });
    }

    const dur = durationMinutes || 90;

    // overlap check against confirmed/seated reservations
    const overlap = await reservationService.checkTableOverlap(tableIds, timeSlot, dur);
    if (overlap) return res.status(409).json({ message: "One or more selected tables are already reserved for that time" });

    const lockExpiresAt = new Date(Date.now() + LOCK_DURATION_MS);

    const reservation = await Reservation.create({
      restaurantId,
      customer: req.user._id,
      tables: tableIds,
      partySize,
      timeSlot,
      durationMinutes: dur,
      status: "locked",
      lockExpiresAt
    });

    res.status(201).json({ message: "Reservation created", _id: reservation._id, lockExpiresAt: reservation.lockExpiresAt });
  } catch (err) {
    if (err?.name === "ValidationError") return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

exports.confirmReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    if (reservation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the reserving customer can confirm this reservation" });
    }

    if (reservation.status !== "locked") return res.status(400).json({ message: "Reservation is not in locked state" });

    if (!reservation.lockExpiresAt || reservation.lockExpiresAt.getTime() < Date.now()) {
      return res.status(410).json({ message: "Reservation lock expired; please create a new reservation" });
    }

    // re-check overlap excluding this reservation
    const overlap = await reservationService.checkTableOverlap(reservation.tables, reservation.timeSlot, reservation.durationMinutes, reservation._id);
    if (overlap) return res.status(409).json({ message: "One or more selected tables are already reserved for that time" });

    reservation.status = "confirmed";
    reservation.lockExpiresAt = null;
    await reservation.save();

    res.json({ message: "Reservation confirmed", reservation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({ customer: req.user._id }).sort({ createdAt: -1 });
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.cancelReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    const isCustomer = reservation.customer.toString() === req.user._id.toString();
    const isManagerOrHostOfRestaurant = req.user.restaurantId && req.user.restaurantId.toString() === reservation.restaurantId.toString() && (req.user.role === "manager" || req.user.role === "host");

    if (!isCustomer && !isManagerOrHostOfRestaurant) return res.status(403).json({ message: "Not authorized to cancel this reservation" });

    if (["completed", "cancelled", "no_show"].includes(reservation.status)) {
      return res.status(400).json({ message: "Cannot cancel a reservation that is already completed, cancelled or marked no-show" });
    }

    reservation.status = "cancelled";
    await reservation.save();

    res.json({ message: "Reservation cancelled", reservation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Helper to ensure acting staff belongs to same restaurant
const ensureSameRestaurant = (req, reservation) => {
  if (!req.user.restaurantId) return false;
  return req.user.restaurantId.toString() === reservation.restaurantId.toString();
};

exports.seatReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    if (!ensureSameRestaurant(req, reservation)) return res.status(403).json({ message: "Cannot operate on reservations for another restaurant" });

    if (reservation.status !== "confirmed") return res.status(400).json({ message: "Only confirmed reservations can be seated" });

    reservation.status = "seated";
    await reservation.save();

    // mark tables occupied
    const tables = await Table.find({ _id: { $in: reservation.tables } });
    await Promise.all(tables.map(async (t) => {
      t.status = "occupied";
      await t.save();
    }));

    res.json({ message: "Reservation seated", reservation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.completeReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    if (!ensureSameRestaurant(req, reservation)) return res.status(403).json({ message: "Cannot operate on reservations for another restaurant" });

    if (reservation.status !== "seated") return res.status(400).json({ message: "Only seated reservations can be completed" });

    reservation.status = "completed";
    await reservation.save();

    // free tables
    const tables = await Table.find({ _id: { $in: reservation.tables } });
    await Promise.all(tables.map(async (t) => {
      t.status = "available";
      t.currentOrder = null;
      await t.save();
    }));

    res.json({ message: "Reservation completed", reservation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markNoShow = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    if (!ensureSameRestaurant(req, reservation)) return res.status(403).json({ message: "Cannot operate on reservations for another restaurant" });

    if (reservation.status !== "confirmed") return res.status(400).json({ message: "Only confirmed reservations can be marked no-show" });

    const allowedAt = new Date(new Date(reservation.timeSlot).getTime() + NO_SHOW_GRACE_MINUTES * 60000);
    if (Date.now() < allowedAt.getTime()) {
      return res.status(400).json({ message: `Cannot mark no-show before ${NO_SHOW_GRACE_MINUTES} minutes after the reservation time` });
    }

    reservation.status = "no_show";
    await reservation.save();

    // free tables
    const tables = await Table.find({ _id: { $in: reservation.tables } });
    await Promise.all(tables.map(async (t) => {
      t.status = "available";
      t.currentOrder = null;
      await t.save();
    }));

    res.json({ message: "Reservation marked as no-show", reservation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
