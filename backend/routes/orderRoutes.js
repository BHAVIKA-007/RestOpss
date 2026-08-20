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
const {
  createCustomerOrder,
  getMyOrders,
  getMyOrder
} = require("../controllers/customerOrderController");

// Create order → Manager + Waiter
router.post("/", auth, isManagerOrWaiter, createOrder);

router.post("/mine", auth, createCustomerOrder);
router.get("/mine", auth, getMyOrders);
router.get("/mine/:id", auth, getMyOrder);

// Get all orders → Manager + Waiter + Chef
router.get("/", auth, isManagerWaiterChef, getOrders);

// Get single order → Manager + Waiter + Chef
router.get("/:id", auth, isManagerWaiterChef, getOrder);

// Update order status → Manager + Waiter + Chef
router.patch("/:id", auth, isManagerWaiterChef, updateStatus);

module.exports = router;
