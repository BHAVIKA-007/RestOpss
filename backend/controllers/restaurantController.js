const Restaurant = require("../models/Restaurant");
const User = require("../models/User");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.registerRestaurant = async (req, res) => {
  try {
    const { name, address, phone, cuisine } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Restaurant name is required" });
    }

    const restaurant = await Restaurant.create({
      name,
      address,
      phone,
      cuisine: Array.isArray(cuisine) ? cuisine : [],
      owner: req.user._id
    });

    // Change user role to owner
    req.user.role = "owner";
    await req.user.save();

    res.status(201).json({ message: "Restaurant created", restaurant });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicRestaurants = async (req, res) => {
  try {
    const { cuisine, search } = req.query;
    const filter = {};

    if (cuisine) {
      filter.cuisine = { $regex: `^${escapeRegex(cuisine)}$`, $options: "i" };
    }

    if (search) {
      filter.name = { $regex: escapeRegex(search), $options: "i" };
    }

    const restaurants = await Restaurant.find(filter).select("_id name address phone cuisine");
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).select("_id name address phone cuisine");

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(restaurant);
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.status(500).json({ message: err.message });
  }
};

exports.getMyRestaurant = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ owner: req.user._id }).populate("manager");
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ owner: req.user._id }).populate("manager");
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.assignManager = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Only owner can assign manager
    if (restaurant.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only restaurant owner can assign manager" });
    }

    if (restaurant.manager) return res.status(400).json({ message: "A manager is already assigned; use the replace route" });
    const managerUser = await User.findById(userId);
    if (!managerUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is already a manager of another restaurant
    if (managerUser.role === "manager" || managerUser.managedRestaurantId) {
      return res.status(400).json({ message: "This user is already a manager of another restaurant" });
    }

    managerUser.role = "manager";
    managerUser.restaurantId = restaurant._id;
    managerUser.managedRestaurantId = restaurant._id;
    await managerUser.save();

    restaurant.manager = managerUser._id;
    await restaurant.save();

    res.json({ message: "Manager assigned successfully", restaurant });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.replaceManager = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
    if (restaurant.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Only restaurant owner can replace manager" });
    const manager = await User.findById(userId);
    if (!manager) return res.status(404).json({ message: "User not found" });
    if (manager.role === "manager" && manager.restaurantId?.toString() !== restaurant._id.toString()) return res.status(400).json({ message: "This user is already a manager of another restaurant" });
    if (restaurant.manager && restaurant.manager.toString() !== manager._id.toString()) await User.findByIdAndUpdate(restaurant.manager, { role: "customer", restaurantId: null, managedRestaurantId: null });
    manager.role = "manager";
    manager.restaurantId = restaurant._id;
    manager.managedRestaurantId = restaurant._id;
    restaurant.manager = manager._id;
    await manager.save();
    await restaurant.save();
    res.json({ message: "Manager replaced successfully", restaurant });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.removeManager = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Only owner can remove manager
    if (restaurant.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only restaurant owner can remove manager" });
    }

    if (!restaurant.manager) {
      return res.status(400).json({ message: "No manager assigned to this restaurant" });
    }

    const manager = await User.findById(restaurant.manager);
    if (manager) {
      manager.role = "customer";
      manager.restaurantId = null;
      manager.managedRestaurantId = null;
      await manager.save();
    }

    restaurant.manager = null;
    await restaurant.save();

    res.json({ message: "Manager removed successfully", restaurant });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
