const express = require("express");
const router = express.Router();

const {
  createOrder,
  getOrders,
  getOrder,
  updateStatus
} = require("../controllers/orderController");

const {
  auth,
  isManagerOrWaiter,
  isManagerWaiterChef
} = require("../middleware/auth");

// Create order → Manager + Waiter
router.post("/", auth, isManagerOrWaiter, createOrder);

// Get all orders → Manager + Waiter + Chef
router.get("/", auth, isManagerWaiterChef, getOrders);

// Get single order → Manager + Waiter + Chef
router.get("/:id", auth, isManagerWaiterChef, getOrder);

// Update order status → Manager + Waiter + Chef
router.patch("/:id", auth, isManagerWaiterChef, updateStatus);

module.exports = router;
