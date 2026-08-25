const express = require("express");
const router = express.Router();

const { saveFloorLayout, getFloorLayout } = require("../controllers/floorLayoutController");
const { auth, isManagerOrOwnerOfRestaurant } = require("../middleware/auth");

router.post("/", auth, isManagerOrOwnerOfRestaurant, saveFloorLayout);
router.get("/", auth, getFloorLayout);

module.exports = router;
