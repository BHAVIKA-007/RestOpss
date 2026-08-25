const express = require("express");
const router = express.Router();

const { createStaff, getStaff, deleteStaff } = require("../controllers/staffController");
const { auth, isManagerOrOwnerOfRestaurant } = require("../middleware/auth");

router.post("/", auth, isManagerOrOwnerOfRestaurant, createStaff);
router.get("/", auth, isManagerOrOwnerOfRestaurant, getStaff);
router.delete("/:id", auth, isManagerOrOwnerOfRestaurant, deleteStaff);

module.exports = router;
