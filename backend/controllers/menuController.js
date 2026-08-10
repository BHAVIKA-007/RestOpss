const mongoose = require("mongoose");
const MenuItem = require("../models/MenuItem");

const handleDuplicateMenuItemError = (res, err) => {
  if (err?.code === 11000) {
    return res.status(400).json({ message: "Menu item with this name already exists for this restaurant" });
  }

  return res.status(500).json({ message: err.message });
};

exports.createMenuItem = async (req, res) => {
  try {
    const { name, description, price, category, isAvailable } = req.body;

    if (!req.user?.restaurantId) {
      return res.status(400).json({ message: "You must own a restaurant first" });
    }

    if (price === undefined || price === null) {
      return res.status(400).json({ message: "Price is required" });
    }

    if (price < 0) {
      return res.status(400).json({ message: "Price must be greater than or equal to 0" });
    }

    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }

    const menuItem = await MenuItem.create({
      name,
      description,
      price,
      category,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      restaurantId: req.user.restaurantId
    });

    return res.status(201).json({ message: "Menu item created", menuItem });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    return handleDuplicateMenuItemError(res, err);
  }
};

exports.getManagerMenu = async (req, res) => {
  try {
    const menuItems = await MenuItem.find({ restaurantId: req.user.restaurantId }).sort({ createdAt: 1 });
    return res.json(menuItems);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const existingItem = await MenuItem.findById(req.params.id);

    if (!existingItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    if (existingItem.restaurantId.toString() !== req.user.restaurantId?.toString()) {
      return res.status(403).json({ message: "You can only update items from your own restaurant" });
    }

    const { name, description, price, category, isAvailable } = req.body;

    if (price !== undefined && price !== null && price < 0) {
      return res.status(400).json({ message: "Price must be greater than or equal to 0" });
    }

    if (category === "") {
      return res.status(400).json({ message: "Category is required" });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (category !== undefined) updateData.category = category;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

    const menuItem = await MenuItem.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    return res.json({ message: "Menu item updated", menuItem });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    return handleDuplicateMenuItemError(res, err);
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    if (menuItem.restaurantId.toString() !== req.user.restaurantId?.toString()) {
      return res.status(403).json({ message: "You can only delete items from your own restaurant" });
    }

    await MenuItem.findByIdAndDelete(req.params.id);

    return res.json({ message: "Menu item deleted" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getCustomerMenu = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurantId" });
    }

    const menuItems = await MenuItem.find({
      restaurantId,
      isAvailable: true
    }).sort({ category: 1, name: 1 });

    return res.json(menuItems);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
