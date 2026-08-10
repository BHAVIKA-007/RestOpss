const express = require("express");
const router = express.Router();

const {
  createMenuItem,
  getManagerMenu,
  updateMenuItem,
  deleteMenuItem,
  getCustomerMenu
} = require("../controllers/menuController");
const { auth, isManager } = require("../middleware/auth");

router.post("/", auth, isManager, createMenuItem);
router.get("/", auth, isManager, getManagerMenu);
router.patch("/:id", auth, isManager, updateMenuItem);
router.delete("/:id", auth, isManager, deleteMenuItem);
router.get("/:restaurantId", auth, getCustomerMenu);

module.exports = router;
