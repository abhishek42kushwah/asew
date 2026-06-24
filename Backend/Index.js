require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(compression());
app.use(
  cors({
    origin: true, // Allow any origin that makes the request
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
const quotationRoutes = require("./src/routes/quotation.routes");

// Routes registration

app.use("/api/item", itemRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/save", saveRoutes);
app.use("/api/response", responseRoutes);
app.use("/api/quotation", quotationRoutes);
const fs = require("fs");
if (fs.existsSync("uploads")) {
  app.use("/uploads", express.static("uploads"));
}

// Sheet/header bootstrap. Each call hits the Google Sheets API (addSheet +
// header write). On serverless this would run on EVERY cold start, contending
// with the request's own Sheets reads — that burst was making the customer/item
// endpoints take ~50s on a cold instance. The sheets + headers already exist,
// so skip by default and run the one-off migration explicitly only when the
// schema changes: deploy once with RUN_SHEET_MIGRATION=true (or run
// src/config/runSheetMigration.js).
if (process.env.RUN_SHEET_MIGRATION === "true") {
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
} else {
  console.log(
    "Skipping sheet bootstrap (set RUN_SHEET_MIGRATION=true to re-create sheets/headers).",
  );
}

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Global Error Handler]:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "production" ? "An error occurred" : err.stack,
  });
});

module.exports = app;
