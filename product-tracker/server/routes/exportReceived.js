// server/routes/exportReceived.js

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { generateCSV } = require("../utils/csvExporter");

const router = express.Router();

// 🎯 Connect to SQLite DB
const db = new sqlite3.Database(
  path.join(__dirname, "..", "productDB.sqlite"),
  (err) => {
    if (err) {
      console.error("❌ Failed to connect to DB (exportReceived route):", err.message);
    } else {
      console.log("✅ Connected to DB (exportReceived route)");
    }
  }
);

/**
 * @route GET /api/export/received/:shopId/:seriesName
 * @desc Export all received lines for a specific shop & series as CSV
 */
router.get("/received/:shopId/:seriesName", (req, res) => {
  const { shopId, seriesName } = req.params;

  const exportQuery = `
    SELECT 
      order_number,
      product_number,
      color,
      quantity,
      received_date
    FROM received_colors
    WHERE shop_id = ? AND series_name = ?
    ORDER BY received_date ASC, product_number ASC
  `;

  db.all(exportQuery, [shopId, seriesName], (err, rows) => {
    if (err) {
      console.error("❌ SQL error in received export:", err.message);
      return res.status(500).json({ error: "Failed to fetch received data." });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No received entries found to export." });
    }

    try {
      const fields = [
        { label: "Order Number", value: "order_number" },
        { label: "Product Number", value: "product_number" },
        { label: "Color", value: "color" },
        { label: "Quantity", value: "quantity" },
        { label: "Received Date", value: "received_date" },
      ];

      const csv = generateCSV(rows, fields);
      const filename = `received_shop${shopId}_${seriesName}_${Date.now()}.csv`;

      res.header("Content-Type", "text/csv");
      res.attachment(filename);
      return res.send(csv);
    } catch (err) {
      console.error("❌ CSV parse error:", err.message);
      return res.status(500).json({ error: "Failed to generate CSV." });
    }
  });
});

module.exports = router;
