const express = require("express");
const router = express.Router();

const { registerUser, loginUser, getMe } = require("../controllers/userController");
const { auth } = require("../middleware/auth");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", auth, getMe);

module.exports = router;
