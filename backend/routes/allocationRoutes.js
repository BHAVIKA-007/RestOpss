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

// Allocate → waiter + manager
router.post("/allocate", auth, isWaiter, allocateTable);

router.post("/waiting/join", auth, joinWaitlist);

// Free → waiter + manager
router.post("/free", auth, isWaiter, freeTable);

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
