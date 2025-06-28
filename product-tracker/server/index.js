// server/index.js

// Polyfill deprecated util._extend to use Object.assign instead
const util = require("util");
util._extend = Object.assign;

require("dotenv").config(); // Load environment variables from .env

const express  = require("express");
const cors     = require("cors");
const helmet   = require("helmet");
const morgan   = require("morgan");
const sqlite3  = require("sqlite3").verbose();
const path     = require("path");

const app = express();

// Load PORT and DB_PATH from environment (with sensible defaults)
const PORT    = process.env.PORT || 5000;
const DB_PATH = path.resolve(__dirname, "productDB.sqlite");

// ----------------------------------
// Global Middleware
// ----------------------------------
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

// Disable caching for API routes in development
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// ----------------------------------
// Database Connection
// ----------------------------------
const db = new sqlite3.Database(DB_PATH, err => {
  if (err) {
    console.error("❌ Failed to connect to SQLite database:", err.message);
  } else {
    console.log(`✅ Connected to SQLite database at ${DB_PATH}`);
  }
});

// Attach the DB handle to every request
app.use((req, _, next) => {
  req.db = db;
  next();
});

// ----------------------------------
// Route Imports
// ----------------------------------
const seriesRoutes          = require("./routes/series");
const shopsRoutes           = require("./routes/shops");
const shopsWithSeriesRoutes = require("./routes/shopsWithSeries");
const productsRoutes        = require("./routes/products");
const imageRoutes           = require("./routes/images");
const ordersRoutes          = require("./routes/orders");
const pendingOrdersRoutes   = require("./routes/pendingOrders");
const receivedRoutes        = require("./routes/received");
const stockRoutes           = require("./routes/stock");
// Removed old line‐item sales routes in favor of weekly‐sales endpoints
const weeklySalesRoutes     = require("./routes/weekly-sales");
const metricsRoutes         = require("./routes/metrics");
const exportRoutes          = require("./routes/export");
const exportReceivedRoutes  = require("./routes/exportReceived");
const deleteOrderRoutes     = require("./routes/deleteOrder");

// ----------------------------------
// Route Registration
// ----------------------------------
app.use("/api/series",            seriesRoutes);
app.use("/api/shops",             shopsRoutes);
app.use("/api/shops-with-series", shopsWithSeriesRoutes);
app.use("/api/products",          productsRoutes);
app.use("/api/product-image",     imageRoutes);

app.use("/api/orders",            ordersRoutes);
// Pending‐orders endpoints (FIFO logic) are mounted under the same base
app.use("/api/orders",            pendingOrdersRoutes);

app.use("/api/received",          receivedRoutes);
app.use("/api/stock",             stockRoutes);
// Mount new weekly‐sales endpoints
app.use("/api/weekly-sales",      weeklySalesRoutes);

app.use("/api/metrics",           metricsRoutes);
app.use("/api/export",            exportRoutes);
app.use("/api/export",            exportReceivedRoutes);
app.use("/api/delete-order",      deleteOrderRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("🚀 Server is running successfully!");
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});
