// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const connectDB = require("./config/db");
const { initSocket } = require("./services/socketService");
const userRoutes = require("./routes/userRoutes");
const tableRoutes = require("./routes/tableRoutes");
const orderRoutes = require("./routes/orderRoutes");
const kitchenRoutes = require("./routes/kitchenRoutes");
const billingRoutes = require("./routes/billingRoutes");
const allocationRoutes = require("./routes/allocationRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const staffRoutes = require("./routes/staffRoutes");
const menuRoutes = require("./routes/menuRoutes");
const floorLayoutRoutes = require("./routes/floorLayoutRoutes");
const reservationRoutes = require("./routes/reservationRoutes");

const app = express();
const server = http.createServer(app);

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
app.use("/api/floor-layout", floorLayoutRoutes);
app.use("/api/reservations", reservationRoutes);

app.get("/", (req, res) => {
  res.send("Restaurant Management API Running...");
});

initSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
