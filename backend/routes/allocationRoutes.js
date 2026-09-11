const express = require("express");
const router = express.Router();

const {
  allocateTable,
  joinWaitlist,
  freeTable,
  getWaitingQueue,
  getWaitingQueueWithPosition,
  respondToWaitlistNotification,
  expireWaitlistEntry,
  managerOverride
} = require("../controllers/allocationController");

const { auth, isManager, isWaiter, isManagerOrHost } = require("../middleware/auth");

const allowAllocationStaff = (req, res, next) => {
  if (["waiter", "manager", "host"].includes(req.user?.role)) return next();
  return res.status(403).json({ message: "Only a waiter, manager, or host can allocate tables" });
};

// Allocate → waiter + manager
router.post("/allocate", auth, allowAllocationStaff, allocateTable);

router.post("/waiting/join", auth, joinWaitlist);

// Free → waiter + manager
router.post("/free", auth, allowAllocationStaff, freeTable);

// Waiting queue → manager or host
router.get("/waiting", auth, isManagerOrHost, getWaitingQueue);

// Waiting queue with position and wait time computed → manager or host
router.get("/waiting/position", auth, isManagerOrHost, getWaitingQueueWithPosition);

// Respond to waitlist notification: accept or decline (customer or host/manager)
router.patch("/waiting/:id/respond", auth, respondToWaitlistNotification);

// Manual expiry check for notified entries (manager only)
router.patch("/waiting/:id/expire-check", auth, isManager, expireWaitlistEntry);

// Manager override (big groups / combine tables)
router.post("/override", auth, isManager, managerOverride);

module.exports = router;
