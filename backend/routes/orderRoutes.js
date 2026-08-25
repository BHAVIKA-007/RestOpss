const express = require("express");
const router = express.Router();

const {
  createOrder,
  getOrders,
  getOrder,
  updateStatus,
  pickupOrder,
  deliverOrder
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
const { confirmReceived } = require("../controllers/customerOrderController");

// Create order → Manager + Waiter
router.post("/", auth, isManagerOrWaiter, createOrder);

router.post("/mine", auth, createCustomerOrder);
router.get("/mine", auth, getMyOrders);
router.get("/mine/:id", auth, getMyOrder);
router.patch("/mine/:id/confirm-received", auth, confirmReceived);

// Get all orders → Manager + Waiter + Chef
router.get("/", auth, isManagerWaiterChef, getOrders);

// Get single order → Manager + Waiter + Chef
router.get("/:id", auth, isManagerWaiterChef, getOrder);

// Update order status → Manager + Waiter + Chef
router.patch("/:id", auth, isManagerWaiterChef, updateStatus);
router.patch("/:id/pickup", auth, isManagerOrWaiter, pickupOrder);
router.patch("/:id/deliver", auth, isManagerOrWaiter, deliverOrder);

module.exports = router;
