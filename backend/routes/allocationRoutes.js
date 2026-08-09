const express = require("express");
const router = express.Router();

const {
  allocateTable,
  freeTable,
  getWaitingQueue,
  managerOverride
} = require("../controllers/allocationController");

const { auth, isManager, isWaiter } = require("../middleware/auth");

// Allocate → waiter + manager
router.post("/allocate", auth, isWaiter, allocateTable);

// Free → waiter + manager
router.post("/free", auth, isWaiter, freeTable);

// Waiting queue → manager only
router.get("/waiting", auth, isManager, getWaitingQueue);

// Manager override (big groups / combine tables)
router.post("/override", auth, isManager, managerOverride);

module.exports = router;
