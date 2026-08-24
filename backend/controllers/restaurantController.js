const Restaurant = require("../models/Restaurant");
const User = require("../models/User");

exports.registerRestaurant = async (req, res) => {
  try {
    const { name, address, phone } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Restaurant name is required" });
    }

    const restaurant = await Restaurant.create({
      name,
      address,
      phone,
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

exports.getMyRestaurant = async (req, res) => {
  try {
    let restaurant;
    
    // If owner, get owned restaurant; if manager, get managed restaurant
    if (req.user.role === "owner") {
      restaurant = await Restaurant.findOne({ owner: req.user._id }).populate("manager");
    } else if (req.user.role === "manager") {
      restaurant = await Restaurant.findOne({ _id: req.user.managedRestaurantId }).populate("manager");
    } else {
      return res.status(403).json({ message: "Only owner or manager can view restaurant" });
    }
    
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(restaurant);
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
    const { restaurantId, managerId } = req.body;

    if (!restaurantId || !managerId) {
      return res.status(400).json({ message: "restaurantId and managerId are required" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Only owner can assign manager
    if (restaurant.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only restaurant owner can assign manager" });
    }

    const managerUser = await User.findById(managerId);
    if (!managerUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is already a manager of another restaurant
    if (managerUser.managedRestaurantId) {
      return res.status(400).json({ message: "This user is already a manager of another restaurant" });
    }

    // If restaurant already has a manager, remove old manager
    if (restaurant.manager) {
      const oldManager = await User.findById(restaurant.manager);
      if (oldManager) {
        oldManager.managedRestaurantId = null;
        oldManager.role = "customer";
        await oldManager.save();
      }
    }

    // Assign new manager
    managerUser.role = "manager";
    managerUser.restaurantId = restaurantId;
    managerUser.managedRestaurantId = restaurantId;
    await managerUser.save();

    restaurant.manager = managerId;
    await restaurant.save();

    res.json({ message: "Manager assigned successfully", restaurant });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.removeManager = async (req, res) => {
  try {
    const { restaurantId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
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
