const express = require("express");
const router = express.Router();

const { registerRestaurant, getMyRestaurant, getMyRestaurants, assignManager, removeManager } = require("../controllers/restaurantController");
const { auth, isOwner, isOwnerOrManager } = require("../middleware/auth");

router.post("/", auth, registerRestaurant);
router.get("/me", auth, isOwnerOrManager, getMyRestaurant);
router.get("/owner/all", auth, isOwner, getMyRestaurants);
router.post("/assign-manager", auth, isOwner, assignManager);
router.post("/remove-manager", auth, isOwner, removeManager);

module.exports = router;
