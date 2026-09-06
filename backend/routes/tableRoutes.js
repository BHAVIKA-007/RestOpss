const express = require("express");
const router = express.Router();

const {
  createTable,
  getTables,
  getTable,
  getMyTables,
  assignWaiter,
  updateHostTableStatus,
  updateTable,
  deleteTable
} = require("../controllers/tableController");



// Admin creates & deletes tables
const { auth, isWaiterOnly, isManagerOrOwnerOfRestaurant, isManagerOwnerOrHostOfTable } = require("../middleware/auth");

router.post("/", auth, isManagerOrOwnerOfRestaurant, createTable);
router.get("/mine", auth, isWaiterOnly, getMyTables);
router.patch("/:id/assign-waiter", auth, isManagerOrOwnerOfRestaurant, assignWaiter);
router.patch("/:id/status", auth, isManagerOwnerOrHostOfTable, updateHostTableStatus);
router.patch("/:id", auth, isManagerOrOwnerOfRestaurant, updateTable);
router.delete("/:id", auth, isManagerOrOwnerOfRestaurant, deleteTable);
router.get("/", auth, getTables);
router.get("/:id", auth, getTable);


module.exports = router;
