const express = require("express");
const router = express.Router();

const { registerRestaurant, getPublicRestaurants, getPublicRestaurant, getMyRestaurant, getMyRestaurants, assignManager, replaceManager, removeManager, updateSettings, getMaxCapacity } = require("../controllers/restaurantController");
const { auth, isManagerOrOwnerOfRestaurant } = require("../middleware/auth");
const { getTiming } = require("../controllers/timingController");

router.get("/config/timing", getTiming);
router.post("/", auth, registerRestaurant);
router.get("/", getPublicRestaurants);
router.get("/my", auth, getMyRestaurants);
router.get("/me", auth, getMyRestaurants);
router.post("/:id/assign-manager", auth, assignManager);
router.patch("/:id/manager", auth, replaceManager);
router.delete("/:id/manager", auth, removeManager);
router.patch("/:id/settings", auth, isManagerOrOwnerOfRestaurant, updateSettings);
router.get("/:id/max-capacity", getMaxCapacity);
router.get("/:id", getPublicRestaurant);

module.exports = router;
