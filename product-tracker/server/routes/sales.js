// server/routes/sales.js

const express = require("express");
const router  = express.Router();

/**
 * Helper: compute an ISO‐style week ID (YYYY-WW) for a given date string,
 * with weeks Monday–Sunday.
 */
function getWeekId(dateStr) {
  const d = new Date(dateStr);
  // shift to Thursday in current week
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNumber = 1 + Math.round(
    (target - firstThursday) / (7 * 24 * 60 * 60 * 1000)
  );
  return `${target.getUTCFullYear()}-${String(weekNumber).padStart(2, "0")}`;
}

/**
 * Helper: get current stock for a given shop+series+product+color
 * by reading from stock_on_hand.
 */
function getCurrentStock(db, shop_id, series_name, product_number, color) {
  return new Promise((resolve, reject) => {
    db.get(
      `
        SELECT stock_quantity AS total
          FROM stock_on_hand
         WHERE shop_id        = ?
           AND series_name    = ?
           AND product_number = ?
           AND lower(color)   = lower(?)
      `,
      [shop_id, series_name, product_number, color],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.total : 0);
      }
    );
  });
}

/**
 * ----------------------------------------------------------------------
 * New: GET /api/sales?shop_id=…&series_name=…
 * List all sales entries for a shop+series (query parameters).
 */
router.get("/", (req, res) => {
  const db = req.db;
  const { shop_id, series_name } = req.query;
  if (!shop_id || !series_name) {
    return res.status(400).json({ error: "shop_id and series_name are required" });
  }

  const sql = `
    SELECT id, sale_date, shop_id, series_name,
           product_number, color, quantity, unit_price, created_at
      FROM sales
     WHERE shop_id     = ?
       AND series_name = ?
     ORDER BY sale_date DESC, id DESC
  `;
  db.all(sql, [shop_id, series_name], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch sales:", err.message);
      return res.status(500).json({ error: "Failed to fetch sales" });
    }
    res.json(rows);
  });
});

/**
 * New: GET /api/sales/closed-weeks?shop_id=…&series_name=…
 * Return an array of week_id values already closed (query parameters).
 */
router.get("/closed-weeks", (req, res) => {
  const db = req.db;
  const { shop_id, series_name } = req.query;
  if (!shop_id || !series_name) {
    return res.status(400).json({ error: "shop_id and series_name are required" });
  }

  const sql = `
    SELECT week_id
      FROM closed_weeks
     WHERE shop_id     = ?
       AND series_name = ?
  `;
  db.all(sql, [shop_id, series_name], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch closed weeks:", err.message);
      return res.status(500).json({ error: "Failed to fetch closed weeks" });
    }
    res.json(rows.map(r => r.week_id));
  });
});

/**
 * GET /api/sales/:shopId/:seriesName
 * List all sales entries for a shop+series (parameterized).
 * Kept for backward compatibility if you still use it elsewhere.
 */
router.get("/:shopId/:seriesName", (req, res) => {
  const db = req.db;
  const { shopId, seriesName } = req.params;

  const sql = `
    SELECT id, sale_date, shop_id, series_name,
           product_number, color, quantity, unit_price, created_at
      FROM sales
     WHERE shop_id     = ?
       AND series_name = ?
     ORDER BY sale_date DESC, id DESC
  `;
  db.all(sql, [shopId, seriesName], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch sales:", err.message);
      return res.status(500).json({ error: "Failed to fetch sales" });
    }
    res.json(rows);
  });
});

/**
 * POST /api/sales/close-week
 * Mark a given shop/series/week as closed.
 * Body: { shop_id, series_name, week_id }
 */
router.post("/close-week", (req, res) => {
  const db = req.db;
  const { shop_id, series_name, week_id } = req.body;

  if (!shop_id || !series_name || !week_id) {
    return res
      .status(400)
      .json({ error: "shop_id, series_name and week_id are required" });
  }

  const sql = `
    INSERT OR IGNORE INTO closed_weeks
      (shop_id, series_name, week_id)
    VALUES (?, ?, ?)
  `;
  db.run(sql, [shop_id, series_name, week_id], function(err) {
    if (err) {
      console.error("❌ Failed to close week:", err.message);
      return res.status(500).json({ error: "Could not close week" });
    }
    res.sendStatus(204);
  });
});

/**
 * POST /api/sales
 * Create a new sales entry: verify week open, check + decrement stock_on_hand.
 */
router.post("/", async (req, res) => {
  const {
    sale_date,
    shop_id,
    series_name,
    product_number,
    color,
    quantity,
    unit_price
  } = req.body;

  // Basic validation
  if (
    !sale_date ||
    !shop_id ||
    !series_name ||
    !product_number ||
    !color ||
    typeof quantity !== "number"
  ) {
    return res.status(400).json({ error: "Missing required sale fields" });
  }

  // Determine weekId and check if it's closed
  const weekId = getWeekId(sale_date);
  try {
    const closed = await new Promise((resolve, reject) => {
      req.db.get(
        `SELECT 1 FROM closed_weeks WHERE shop_id=? AND series_name=? AND week_id=?`,
        [shop_id, series_name, weekId],
        (err, row) => err ? reject(err) : resolve(!!row)
      );
    });
    if (closed) {
      return res
        .status(400)
        .json({ error: `Week ${weekId} is already closed. No further entries allowed.` });
    }
  } catch (err) {
    console.error("❌ Error checking closed weeks:", err);
    return res.status(500).json({ error: "Could not verify week status" });
  }

  // Check available stock
  let available;
  try {
    available = await getCurrentStock(
      req.db,
      shop_id,
      series_name,
      product_number,
      color
    );
  } catch (err) {
    console.error("❌ Stock check failed:", err);
    return res.status(500).json({ error: "Could not verify stock" });
  }
  if (quantity > available) {
    return res.status(400).json({
      error: `Insufficient stock for ${product_number} (${color}). ` +
             `Requested ${quantity}, available ${available}.`
    });
  }

  // Insert the sale record
  const insertSql = `
    INSERT INTO sales
      (sale_date, shop_id, series_name, product_number, color, quantity, unit_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  req.db.run(
    insertSql,
    [
      sale_date,
      shop_id,
      series_name,
      product_number,
      color,
      quantity,
      unit_price || 0
    ],
    function(err) {
      if (err) {
        console.error("❌ Failed to insert sale:", err.message);
        return res.status(500).json({ error: "Could not save sale" });
      }

      // Decrement the stock_on_hand table
      req.db.run(
        `
          UPDATE stock_on_hand
             SET stock_quantity = stock_quantity - ?
           WHERE shop_id        = ?
             AND series_name    = ?
             AND product_number = ?
             AND lower(color)   = lower(?)
        `,
        [quantity, shop_id, series_name, product_number, color],
        err2 => {
          if (err2) {
            console.error("❌ Failed to decrement stock:", err2.message);
          }
          res.json({ id: this.lastID });
        }
      );
    }
  );
});

/**
 * PATCH /api/sales/:id
 * Update an existing sale entry (only if its week is still open),
 * and adjust stock_on_hand by the difference.
 */
router.patch("/:id", (req, res) => {
  const { id } = req.params;
  const { sale_date: newDate, quantity: newQty, unit_price: newPrice } = req.body;
  const db = req.db;

  // 1) Fetch existing sale
  db.get(
    `SELECT shop_id, series_name, product_number, color, sale_date, quantity
       FROM sales
      WHERE id = ?`,
    [id],
    async (err, oldRow) => {
      if (err || !oldRow) {
        return res.status(404).json({ error: "Sale entry not found" });
      }

      // 2) Check week closed for original date
      const origWeek = getWeekId(oldRow.sale_date);
      try {
        const wasClosed = await new Promise((resolve, reject) => {
          db.get(
            `SELECT 1 FROM closed_weeks WHERE shop_id=? AND series_name=? AND week_id=?`,
            [oldRow.shop_id, oldRow.series_name, origWeek],
            (e, r) => e ? reject(e) : resolve(!!r)
          );
        });
        if (wasClosed) {
          return res.status(400).json({ error: `Week ${origWeek} is closed. Cannot edit this sale.` });
        }
      } catch (e) {
        console.error("❌ Closed-week check failed:", e);
        return res.status(500).json({ error: "Could not verify week status" });
      }

      // 3) Build update
      const fields = [], params = [];
      if (newDate) {
        fields.push("sale_date = ?");
        params.push(newDate);
      }
      if (typeof newQty === "number") {
        fields.push("quantity = ?");
        params.push(newQty);
      }
      if (typeof newPrice === "number") {
        fields.push("unit_price = ?");
        params.push(newPrice);
      }
      if (!fields.length) {
        return res.status(400).json({ error: "No fields to update" });
      }
      params.push(id);

      // 4) Execute update
      db.run(
        `UPDATE sales SET ${fields.join(", ")} WHERE id = ?`,
        params,
        function(err2) {
          if (err2) {
            console.error("❌ Failed to update sale:", err2.message);
            return res.status(500).json({ error: "Failed to update sale" });
          }

          // 5) Adjust stock by diff
          if (typeof newQty === "number") {
            const diff = newQty - oldRow.quantity; // positive => more sold
            db.run(
              `
                UPDATE stock_on_hand
                   SET stock_quantity = stock_quantity - ?
                 WHERE shop_id        = ?
                   AND series_name    = ?
                   AND product_number = ?
                   AND lower(color)   = lower(?)
              `,
              [diff, oldRow.shop_id, oldRow.series_name, oldRow.product_number, oldRow.color],
              err3 => {
                if (err3) {
                  console.error("❌ Failed to adjust stock_on_hand:", err3.message);
                }
                res.json({ changes: this.changes });
              }
            );
          } else {
            res.json({ changes: this.changes });
          }
        }
      );
    }
  );
});

/**
 * DELETE /api/sales/:id
 * Remove a sale entry (only if its week is still open),
 * and restore stock_on_hand by the deleted quantity.
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const db = req.db;

  // 1) Fetch sale to delete
  db.get(
    `SELECT shop_id, series_name, product_number, color, sale_date, quantity
       FROM sales
      WHERE id = ?`,
    [id],
    async (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: "Sale entry not found" });
      }

      // 2) Check closed week
      const weekId = getWeekId(row.sale_date);
      try {
        const closed = await new Promise((resolve, reject) => {
          db.get(
            `SELECT 1 FROM closed_weeks WHERE shop_id=? AND series_name=? AND week_id=?`,
            [row.shop_id, row.series_name, weekId],
            (e, r) => e ? reject(e) : resolve(!!r)
          );
        });
        if (closed) {
          return res.status(400).json({ error: `Week ${weekId} is closed. Cannot delete this sale.` });
        }
      } catch (e) {
        console.error("❌ Closed-week check failed:", e);
        return res.status(500).json({ error: "Could not verify week status" });
      }

      // 3) Delete sale
      db.run(`DELETE FROM sales WHERE id = ?`, [id], function(err2) {
        if (err2) {
          console.error("❌ Failed to delete sale:", err2.message);
          return res.status(500).json({ error: "Failed to delete sale" });
        }

        // 4) Restore stock_on_hand
        db.run(
          `
            UPDATE stock_on_hand
               SET stock_quantity = stock_quantity + ?
             WHERE shop_id        = ?
               AND series_name    = ?
               AND product_number = ?
               AND lower(color)   = lower(?)
          `,
          [row.quantity, row.shop_id, row.series_name, row.product_number, row.color],
          err3 => {
            if (err3) {
              console.error("❌ Failed to restore stock_on_hand:", err3.message);
            }
            res.json({ deleted: this.changes });
          }
        );
      });
    }
  );
});

module.exports = router;
