const express = require("express");
const router = express.Router();

const { auth, isManagerWaiterChef } = require("../middleware/auth");
const {
  getKitchenOrders,
  updateKitchenStatus
} = require("../controllers/kitchenController");

// View kitchen orders → Manager + Chef + Waiter (optional waiter)
router.get("/", auth, isManagerWaiterChef, getKitchenOrders);

// Update from kitchen → Manager + Chef
router.patch("/:id", auth, isManagerWaiterChef, updateKitchenStatus);

module.exports = router;
