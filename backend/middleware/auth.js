const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).send("Unauthorized: Token missing");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).send("Unauthorized: User not found");
    }

    next();
  } catch (err) {
    return res.status(401).send("Unauthorized: Invalid token");
  }
};

exports.isOwnerOrManager = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  if (req.user.role === "owner" || req.user.role === "manager") {
    return next();
  }

  return res.status(403).json({ message: "Only owner or manager can perform this action" });
};

exports.isOwner = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  if (req.user.role !== "owner") {
    return res.status(403).json({ message: "Only owner can perform this action" });
  }

  next();
};

exports.isManager = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  if (req.user.role !== "manager") {
    return res.status(403).json({ message: "Only manager can perform this action" });
  }

  next();
};

exports.isManagerOrWaiter = (req, res, next) => {
  if (req.user.role === "manager" || req.user.role === "waiter") return next();
  return res.status(403).json({ message: "Only manager or waiter allowed" });
};

exports.isManagerWaiterChef = (req, res, next) => {
  const allowed = ["manager", "waiter", "chef"];
  if (allowed.includes(req.user.role)) return next();
  return res.status(403).json({ message: "Access denied" });
};

exports.isCashierOrManager = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  if (req.user.role === "cashier" || req.user.role === "manager") {
    return next();
  }

  return res.status(403).json({
    message: "Only cashier or manager can handle billing"
  });
};


exports.isWaiter = (req, res, next) => {
  try {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Allow waiter + manager (manager should always have higher power)
    if (req.user.role === "waiter" || req.user.role === "manager") {
      return next();
    }

    return res.status(403).json({ message: "Access restricted to waiters" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.isHost = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  if (req.user.role !== "host") {
    return res.status(403).json({ message: "Only host can perform this action" });
  }

  next();
};

exports.isManagerOrHost = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  if (req.user.role === "manager" || req.user.role === "host") {
    return next();
  }

  return res.status(403).json({ message: "Only manager or host allowed" });
};




