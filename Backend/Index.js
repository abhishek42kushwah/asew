require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Main Route
app.get("/", (req, res) => {
  res.send("ERP Backend is running");
});

// Import Models & Routes
const { createItemMasterSheet } = require("./src/models/ItemMaster.model");
const { createCustomerSheet } = require("./src/models/customer.model");
const { createSaveSheet } = require("./src/models/save.model");
const { createResponseSheet } = require("./src/models/response.model");


const itemRoutes = require("./src/routes/item.routes");
const customerRoutes = require("./src/routes/customer.routes");
const saveRoutes = require("./src/routes/save.routes");
const responseRoutes = require("./src/routes/response.routes");

// Routes registration

app.use("/api/item", itemRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/save", saveRoutes);
app.use("/api/response", responseRoutes);
const fs = require("fs");
if (fs.existsSync("uploads")) {
  app.use("/uploads", express.static("uploads"));
}

// Initialize Database Tables
Promise.all([
  createItemMasterSheet(),
  createCustomerSheet(),
  createSaveSheet(),
  createResponseSheet(),
])
  .then(() => {
    console.log("Database synchronization complete");
  })
  .catch((err) => console.error("Database synchronization failed:", err));

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
