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
const { auth, isManager } = require("../middleware/auth");

router.post("/", auth, isManager, createTable);
router.patch("/:id", auth, isManager, updateTable);
router.delete("/:id", auth, isManager, deleteTable);
router.get("/", auth, getTables);
router.get("/:id", auth, getTable);


module.exports = router;
