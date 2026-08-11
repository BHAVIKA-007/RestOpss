const express = require("express");
const router = express.Router();

const { saveFloorLayout, getFloorLayout } = require("../controllers/floorLayoutController");
const { auth, isManager } = require("../middleware/auth");

router.post("/", auth, isManager, saveFloorLayout);
router.get("/", auth, getFloorLayout);

module.exports = router;
