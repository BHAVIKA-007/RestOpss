// controllers/userController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// REGISTER USER
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already registered" });

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: "customer"
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: { id: user._id, name: user.name, role: user.role }
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

// LOGIN USER
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email/password" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email/password" });

    const token = generateToken(user._id, user.role);

    return res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, role: user.role }
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

// GET CURRENT LOGGED IN USER
exports.getMe = async (req, res) => {
  return res.json(req.user); // auth middleware injects user
};
