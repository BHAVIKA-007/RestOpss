const express = require("express");
const router = express.Router();

const {
  createTable,
  getTables,
  getTable,
  updateTable,
  deleteTable
} = require("../controllers/tableController");



// Admin creates & deletes tables
const { auth, isManagerOrOwnerOfRestaurant } = require("../middleware/auth");

router.post("/", auth, isManagerOrOwnerOfRestaurant, createTable);
router.patch("/:id", auth, isManagerOrOwnerOfRestaurant, updateTable);
router.delete("/:id", auth, isManagerOrOwnerOfRestaurant, deleteTable);
router.get("/", auth, getTables);
router.get("/:id", auth, getTable);


module.exports = router;
