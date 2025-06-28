// server/routes/export.js

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const router = express.Router();
const { generateCsvResponse } = require("../utils/csvExporter");

// ✅ Connect to DB
const db = new sqlite3.Database(
  path.join(__dirname, "..", "productDB.sqlite"),
  (err) => {
    if (err) {
      console.error("❌ Failed to connect to DB (export route):", err.message);
    } else {
      console.log("✅ Connected to DB (export route)");
    }
  }
);

// ✅ Grouped by Product Export
router.get("/grouped-product/:shopNumber", (req, res) => {
  const { shopNumber } = req.params;

  const query = `
    SELECT 
      oc.product_number,
      oc.color,
      SUM(oc.quantity) AS total_ordered
    FROM shops s
    JOIN orders_meta om ON om.shop_id = s.id
    JOIN order_colors oc ON oc.order_number = om.order_number
    WHERE s.shop_number = ?
    GROUP BY oc.product_number, oc.color
    ORDER BY oc.product_number, oc.color;
  `;

  db.all(query, [shopNumber], (err, rows) => {
    if (err) {
      console.error("❌ SQL error in grouped-product export:", err.message);
      return res.status(500).json({ error: "Failed to fetch product data." });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No product data to export." });
    }

    const fields = [
      { label: "Product Number", value: "product_number" },
      { label: "Color", value: "color" },
      { label: "Total Ordered", value: "total_ordered" },
    ];

    const filename = `products_summary_${shopNumber}_${Date.now()}.csv`;

    generateCsvResponse(res, rows, fields, filename);
  });
});

// ✅ Grouped by Order Export
router.get("/grouped-order/:shopNumber", (req, res) => {
  const { shopNumber } = req.params;

  const query = `
    SELECT 
      om.order_number,
      om.order_date,
      oc.product_number,
      oc.color,
      oc.quantity AS quantity_ordered
    FROM shops s
    JOIN orders_meta om ON om.shop_id = s.id
    JOIN order_colors oc ON oc.order_number = om.order_number
    WHERE s.shop_number = ?
    ORDER BY om.order_number, oc.product_number, oc.color;
  `;

  db.all(query, [shopNumber], (err, rows) => {
    if (err) {
      console.error("❌ SQL error in grouped-order export:", err.message);
      return res.status(500).json({ error: "Failed to fetch order data." });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No order data to export." });
    }

    const fields = [
      { label: "Order Number", value: "order_number" },
      { label: "Order Date", value: "order_date" },
      { label: "Product Number", value: "product_number" },
      { label: "Color", value: "color" },
      { label: "Quantity Ordered", value: "quantity_ordered" },
    ];

    const filename = `orders_summary_${shopNumber}_${Date.now()}.csv`;

    generateCsvResponse(res, rows, fields, filename);
  });
});

module.exports = router;
