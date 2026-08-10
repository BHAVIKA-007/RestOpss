const express = require("express");
const router = express.Router();

const { createStaff, getStaff, deleteStaff } = require("../controllers/staffController");
const { auth, isManager } = require("../middleware/auth");

router.post("/", auth, isManager, createStaff);
router.get("/", auth, isManager, getStaff);
router.delete("/:id", auth, isManager, deleteStaff);

module.exports = router;
