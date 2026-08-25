const express = require("express");
const router = express.Router();

const { registerRestaurant, getMyRestaurant, getMyRestaurants, assignManager, replaceManager, removeManager } = require("../controllers/restaurantController");
const { auth } = require("../middleware/auth");

router.post("/", auth, registerRestaurant);
router.get("/my", auth, getMyRestaurants);
router.get("/me", auth, getMyRestaurants);
router.post("/:id/assign-manager", auth, assignManager);
router.patch("/:id/manager", auth, replaceManager);
router.delete("/:id/manager", auth, removeManager);

module.exports = router;
