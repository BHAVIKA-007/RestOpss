const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const Table = require("../models/Table");
const MenuItem = require("../models/MenuItem");
const UserModel = require("../models/User");
const Reservation = require("../models/Reservation");

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

exports.isManagerOrOwnerOfRestaurant = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    let restaurantId = req.params.restaurantId || req.body?.restaurantId || req.query.restaurantId;
    if (!restaurantId && req.params.id) {
      let Model = MenuItem;
      if (req.baseUrl.includes("table")) Model = Table;
      if (req.baseUrl.includes("staff")) Model = UserModel;
      if (req.baseUrl.includes("reservation")) Model = Reservation;
      const resource = await Model.findById(req.params.id).select("restaurantId");
      if (resource) restaurantId = resource.restaurantId;
    }
    if (!restaurantId && req.user.role === "manager") restaurantId = req.user.restaurantId;
    if (!restaurantId) return res.status(400).json({ message: "restaurantId is required for owners" });
    const restaurant = await Restaurant.findById(restaurantId).select("owner");
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
    const isOwner = req.user.role === "owner" && restaurant.owner.equals(req.user._id);
    const isManager = req.user.role === "manager" && req.user.restaurantId?.toString() === restaurantId.toString();
    if (!isOwner && !isManager) return res.status(403).json({ message: "Only the restaurant owner or manager can perform this action" });
    req.restaurantId = restaurant._id;
    next();
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

exports.isManagerHostOrOwnerOfRestaurant = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const isStaffScopedRole = req.user.role === "manager" || req.user.role === "host";
    const restaurantId = isStaffScopedRole ? req.user.restaurantId : req.query.restaurantId;

    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId query parameter is required for owners" });
    }

    if (!mongoose.Types.ObjectId.isValid(restaurantId.toString())) {
      return res.status(400).json({ message: "Invalid restaurantId" });
    }

    const restaurant = await Restaurant.findById(restaurantId).select("owner");
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    const isOwner = req.user.role === "owner" && restaurant.owner.equals(req.user._id);
    const isManagerOrHost = isStaffScopedRole && req.user.restaurantId?.toString() === restaurant._id.toString();
    if (!isOwner && !isManagerOrHost) {
      return res.status(403).json({ message: "Only the restaurant owner, manager, or host can view reservations" });
    }

    req.restaurantId = restaurant._id;
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
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




