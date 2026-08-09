const Restaurant = require("../models/Restaurant");

exports.registerRestaurant = async (req, res) => {
  try {
    const { name, address, phone } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Restaurant name is required" });
    }

    const existingRestaurant = await Restaurant.findOne({ owner: req.user._id });
    if (existingRestaurant) {
      return res.status(400).json({ message: "User already owns a restaurant" });
    }

    const restaurant = await Restaurant.create({
      name,
      address,
      phone,
      owner: req.user._id
    });

    req.user.role = "manager";
    req.user.restaurantId = restaurant._id;
    await req.user.save();

    res.status(201).json({ message: "Restaurant created", restaurant });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
