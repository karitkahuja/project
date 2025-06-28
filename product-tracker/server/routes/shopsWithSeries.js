// server/routes/shopsWithSeries.js

const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database(
  path.join(__dirname, "..", "productDB.sqlite"),
  (err) => {
    if (err) {
      console.error("❌ DB error (shopsWithSeries):", err.message);
    } else {
      console.log("✅ Connected to DB (shopsWithSeries route)");
    }
  }
);

router.get("/", (req, res) => {
  const query = `
    SELECT 
      sh.id AS shop_id,
      sh.shop_number,
      sh.is_active,
      s.id AS series_id,
      s.series_name,
      s.colors,
      s.unit,
      s.is_generic,
      p.id AS product_id,
      p.product_number
    FROM shops sh
    LEFT JOIN series s ON s.shop_id = sh.id
    LEFT JOIN products p ON p.series_id = s.id AND p.shop_id = sh.id
    ORDER BY sh.shop_number, s.series_name, p.product_number
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ Error fetching shops with series/products:", err.message);
      return res.status(500).json({ error: "Failed to fetch shops with series and products" });
    }

    const shopMap = {};

    rows.forEach((row) => {
      // Group by shop
      if (!shopMap[row.shop_id]) {
        shopMap[row.shop_id] = {
          shop_id: row.shop_id,
          shop_number: row.shop_number,
          is_active: row.is_active === 1,
          series_list: [],
        };
      }

      const shop = shopMap[row.shop_id];

      // Find or create series entry
      let series = shop.series_list.find((s) => s.series_id === row.series_id);

      if (!series && row.series_id) {
        series = {
          series_id: row.series_id,
          series_name: row.series_name,
          colors: JSON.parse(row.colors || "[]"),
          unit: row.unit,
          is_generic: row.is_generic === 1,
          products: [],
        };
        shop.series_list.push(series);
      }

      // Add product if present
      if (series && row.product_id) {
        series.products.push({
          id: row.product_id,
          product_number: row.product_number,
        });
      }
    });

    res.json(Object.values(shopMap));
  });
});

module.exports = router;
