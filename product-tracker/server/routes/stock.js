// server/routes/stock.js

const express = require("express");
const router  = express.Router();

/**
 * GET /api/stock/:shopId/:seriesName
 * Returns current stock‐on‐hand for each shop/series/product/color:
 *   shop_id, series_name, series_id, product_number, color, stock_on_hand
 */
router.get("/:shopId/:seriesName", (req, res) => {
  const db = req.db;
  const { shopId, seriesName } = req.params;

  // Build optional filters
  const clauses = [];
  const params = [];

  if (shopId.toLowerCase() !== "all") {
    clauses.push("soh.shop_id = ?");
    params.push(shopId);
  }
  if (seriesName.toLowerCase() !== "all") {
    clauses.push("soh.series_name = ?");
    params.push(seriesName);
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  // Join stock_on_hand to series table to get series_id,
  // including generic series (s.is_generic = 1)
  const sql = `
    SELECT
      soh.shop_id,
      soh.series_name,
      s.id                 AS series_id,
      soh.product_number,
      soh.color,
      soh.stock_quantity   AS stock_on_hand
    FROM stock_on_hand soh
    LEFT JOIN series s
      ON s.series_name = soh.series_name
     AND (s.shop_id = soh.shop_id OR s.is_generic = 1)
    ${whereSql}
    ORDER BY
      soh.product_number,
      soh.color
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch stock:", err.message);
      return res.status(500).json({ error: "Failed to fetch stock data." });
    }
    res.json(rows);
  });
});

module.exports = router;
