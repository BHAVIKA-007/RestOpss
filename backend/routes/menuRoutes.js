const express = require("express");
const router = express.Router();

const {
  createMenuItem,
  getManagerMenu,
  updateMenuItem,
  deleteMenuItem,
  getCustomerMenu
} = require("../controllers/menuController");
const { auth, isManagerOrOwnerOfRestaurant } = require("../middleware/auth");

router.post("/", auth, isManagerOrOwnerOfRestaurant, createMenuItem);
router.get("/", auth, isManagerOrOwnerOfRestaurant, getManagerMenu);
router.patch("/:id", auth, isManagerOrOwnerOfRestaurant, updateMenuItem);
router.delete("/:id", auth, isManagerOrOwnerOfRestaurant, deleteMenuItem);
router.get("/:restaurantId", auth, getCustomerMenu);

module.exports = router;
