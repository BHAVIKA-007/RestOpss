// server.js
require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const tableRoutes = require("./routes/tableRoutes");
const orderRoutes = require("./routes/orderRoutes");
const kitchenRoutes = require("./routes/kitchenRoutes");
const billingRoutes = require("./routes/billingRoutes");
const allocationRoutes = require("./routes/allocationRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const staffRoutes = require("./routes/staffRoutes");
const menuRoutes = require("./routes/menuRoutes");


const app = express();
app.use(express.json());

// connect to DB
connectDB();

app.use("/api/users", userRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/allocation", allocationRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/menu", menuRoutes);


app.get("/", (req, res) => {
  res.send("Restaurant Management API Running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
