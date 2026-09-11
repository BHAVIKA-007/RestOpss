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
      user: { id: user._id, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword }
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== "string" || !currentPassword) {
      return res.status(400).json({ message: "Current password is required" });
    }

    if (typeof newPassword !== "string" || !newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    return res.json({ message: "Password changed successfully", mustChangePassword: false });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Unable to change password" });
  }
};

// GET CURRENT LOGGED IN USER
exports.getMe = async (req, res) => {
  return res.json(req.user); // auth middleware injects user
};

// LOOK UP USER BY EMAIL
exports.lookupUser = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email }).select("_id name email role");
    if (!user) {
      return res.status(404).json({ message: "No user found with that email" });
    }

    return res.json(user);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server Error" });
  }
};
