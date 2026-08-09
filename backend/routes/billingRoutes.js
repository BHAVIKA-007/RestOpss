const express = require("express");
const router = express.Router();

const { auth, isCashierOrManager } = require("../middleware/auth");
const { getPendingBills, markPaid } = require("../controllers/billingController");

// Get unpaid completed orders
router.get("/", auth, isCashierOrManager, getPendingBills);

// Pay bill
router.patch("/:id/pay", auth, isCashierOrManager, markPaid);

module.exports = router;
