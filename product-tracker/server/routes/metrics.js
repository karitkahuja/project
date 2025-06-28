// server/routes/metrics.js

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const router = express.Router();

// 🎯 Connect to SQLite
const db = new sqlite3.Database(
  path.join(__dirname, "..", "productDB.sqlite"),
  (err) => {
    if (err) console.error("❌ DB error (metrics):", err.message);
    else console.log("✅ Connected to DB (metrics route)");
  }
);

/**
 * GET /api/metrics
 * Returns summary dashboard metrics
 */
router.get("/", (req, res) => {
  const metrics = {};

  db.serialize(() => {
    // 1️⃣ Total shops
    db.get(`SELECT COUNT(*) AS total_shops FROM shops`, (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      metrics.totalShops = row.total_shops;

      // 2️⃣ Total series
      db.get(`SELECT COUNT(*) AS total_series FROM series`, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        metrics.totalSeries = row.total_series;

        // 3️⃣ Total products
        db.get(`SELECT COUNT(*) AS total_products FROM products`, (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          metrics.totalProducts = row.total_products;

          // 4️⃣ Total orders (unique order numbers)
          db.get(`SELECT COUNT(DISTINCT order_number) AS total_orders FROM orders_meta`, (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            metrics.totalOrders = row.total_orders;

            // 5️⃣ Total Ordered Quantity
            db.get(`SELECT SUM(quantity) AS total_ordered FROM order_colors`, (err, row) => {
              if (err) return res.status(500).json({ error: err.message });
              metrics.totalOrdered = row.total_ordered || 0;

              // 6️⃣ Total Received Quantity
              db.get(`SELECT SUM(quantity) AS total_received FROM received_colors`, (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                metrics.totalReceived = row.total_received || 0;

                // 7️⃣ Completion Percentage
                const { totalOrdered, totalReceived } = metrics;
                metrics.completionPercentage =
                  totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

                // 8️⃣ Pending = Ordered - Received
                metrics.pendingTotal = totalOrdered - totalReceived;

                // 9️⃣ Top 5 Pending Products (color-agnostic)
                const topPendingQuery = `
                  SELECT 
                    o.product_number,
                    o.color,
                    SUM(o.quantity) AS ordered,
                    IFNULL(SUM(r.quantity), 0) AS received,
                    (SUM(o.quantity) - IFNULL(SUM(r.quantity), 0)) AS pending
                  FROM order_colors o
                  LEFT JOIN received_colors r
                    ON o.product_number = r.product_number AND o.color = r.color
                  GROUP BY o.product_number, o.color
                  HAVING pending > 0
                  ORDER BY pending DESC
                  LIMIT 5
                `;

                db.all(topPendingQuery, [], (err, rows) => {
                  if (err) return res.status(500).json({ error: err.message });
                  metrics.topPendingProducts = rows || [];

                  // ✅ Final Response
                  res.json(metrics);
                });
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;
