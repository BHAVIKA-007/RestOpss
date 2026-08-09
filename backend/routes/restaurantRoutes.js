const express = require("express");
const router = express.Router();

const { registerRestaurant, getMyRestaurant } = require("../controllers/restaurantController");
const { auth, isManager } = require("../middleware/auth");

router.post("/", auth, registerRestaurant);
router.get("/me", auth, isManager, getMyRestaurant);

module.exports = router;
