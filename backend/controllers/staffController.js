const User = require("../models/User");

const staffRoles = ["waiter", "chef", "cashier", "host"];

exports.createStaff = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!req.restaurantId) {
      return res.status(400).json({ message: "You must be a manager of a restaurant to create staff" });
    }

    // Prevent creating manager accounts (managers can only create staff)
    if (role === "manager") {
      return res.status(400).json({ message: "Managers cannot create other managers" });
    }

    if (!staffRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid staff role" });
    }

    const normalizedEmail = email?.toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role,
      restaurantId: req.restaurantId
    });

    const createdUser = await User.findById(user._id).select("-password");

    return res.status(201).json({
      message: "Staff created successfully",
      user: createdUser
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ message: "Email already registered" });
    }

    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({ message: err.message });
  }
};

exports.getStaff = async (req, res) => {
  try {
    const staff = await User.find({
      restaurantId: req.restaurantId,
      role: { $in: staffRoles }
    }).select("-password");

    return res.json(staff);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    if (targetUser.restaurantId?.toString() !== req.restaurantId?.toString()) {
      return res.status(403).json({ message: "You can only remove staff from your own restaurant" });
    }

    if (targetUser.role === "customer" || targetUser.role === "manager" || targetUser.role === "owner") {
      return res.status(400).json({ message: "Only staff accounts can be removed" });
    }

    if (!staffRoles.includes(targetUser.role)) {
      return res.status(400).json({ message: "Only staff accounts can be removed" });
    }

    await User.findByIdAndDelete(req.params.id);

    return res.json({ message: "Staff removed successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
