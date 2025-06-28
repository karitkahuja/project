// server/routes/orders.js

const express  = require("express");
const sqlite3  = require("sqlite3").verbose();
const path     = require("path");
const router   = express.Router();

// Connect to SQLite
const db = new sqlite3.Database(
  path.join(__dirname, "..", "productDB.sqlite"),
  (err) => {
    if (err) console.error("❌ DB connection failed (orders):", err.message);
    else      console.log("✅ Connected to DB (orders route)");
  }
);

// Helper to generate the next order number (e.g. "VVI-42")
const generateOrderNumber = (cb) => {
  db.get(`SELECT MAX(id) AS last_id FROM orders_meta`, (err, row) => {
    if (err) return cb(null);
    const nextId = (row?.last_id || 0) + 1;
    cb(`VVI-${nextId}`, nextId);
  });
};

/**
 * NEW: GET /api/orders/next-order-number
 * Returns the next available order number (e.g. "VVI-42").
 */
router.get("/next-order-number", (_req, res) => {
  generateOrderNumber((orderNumber) => {
    if (!orderNumber) {
      return res.status(500).json({ error: "Failed to generate next order number." });
    }
    res.json({ nextOrderNumber: orderNumber });
  });
});

/**
 * 1) GET /api/orders/details
 *    – One row per product‐color per order, with ordered, received & pending quantities.
 */
router.get("/details", (req, res) => {
  const sql = `
    SELECT 
      s.shop_number,
      s.id           AS shop_id,
      om.order_number,
      om.order_date,
      om.series_name,
      sr.id          AS series_id,
      oc.product_number,
      oc.color,

      -- Total ever ordered = original oc.quantity + sum of completed receipts
      (oc.quantity + IFNULL(SUM(rc.quantity),0))    AS ordered_quantity,

      -- Total received so far (completed only)
      IFNULL(SUM(rc.quantity), 0)                   AS received_quantity,

      -- Still pending in this order
      oc.quantity                                   AS pending_quantity

    FROM shops s
      JOIN orders_meta om 
        ON om.shop_id = s.id
      LEFT JOIN series sr 
        ON sr.shop_id = s.id
       AND sr.series_name = om.series_name
      JOIN order_colors oc 
        ON oc.order_number = om.order_number
      LEFT JOIN received_colors rc 
        ON rc.product_number = oc.product_number
       AND rc.color          = oc.color
       AND rc.is_completed   = 1

    GROUP BY 
      s.shop_number, s.id, om.order_number, om.order_date, om.series_name,
      sr.id, oc.product_number, oc.color

    ORDER BY om.order_date DESC, om.order_number
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("❌ SQL error (details-all):", err.message);
      return res.status(500).json({ error: "Failed to fetch all orders." });
    }
    res.json(rows);
  });
});

/**
 * 2) GET /api/orders/details/:shopNumber
 *    – Same as above, filtered by shop_number.
 */
router.get("/details/:shopNumber", (req, res) => {
  const { shopNumber } = req.params;
  const sql = `
    SELECT 
      s.shop_number,
      s.id           AS shop_id,
      om.order_number,
      om.order_date,
      om.series_name,
      sr.id          AS series_id,
      oc.product_number,
      oc.color,
      (oc.quantity + IFNULL(SUM(rc.quantity),0))    AS ordered_quantity,
      IFNULL(SUM(rc.quantity), 0)                   AS received_quantity,
      oc.quantity                                   AS pending_quantity

    FROM shops s
      JOIN orders_meta om 
        ON om.shop_id = s.id
      LEFT JOIN series sr 
        ON sr.shop_id = s.id
       AND sr.series_name = om.series_name
      JOIN order_colors oc 
        ON oc.order_number = om.order_number
      LEFT JOIN received_colors rc 
        ON rc.product_number = oc.product_number
       AND rc.color          = oc.color
       AND rc.is_completed   = 1

    WHERE s.shop_number = ?

    GROUP BY 
      s.shop_number, s.id, om.order_number, om.order_date, om.series_name,
      sr.id, oc.product_number, oc.color

    ORDER BY om.order_date DESC, oc.product_number
  `;
  db.all(sql, [shopNumber], (err, rows) => {
    if (err) {
      console.error("❌ SQL error (details-shop):", err.message);
      return res.status(500).json({ error: "Failed to fetch orders." });
    }
    res.json(rows);
  });
});

/**
 * 3) GET /api/orders/by-order/:orderNumber
 *    – One order’s full colour breakdown (shop_id, shop_number, series_name, series_id, order_date, product lines).
 */
router.get("/by-order/:orderNumber", (req, res) => {
  const { orderNumber } = req.params;
  const sql = `
    SELECT
      s.id            AS shop_id,
      s.shop_number,
      om.series_name,
      om.order_date,
      sr.id           AS series_id,         -- ← added series_id
      oc.product_number,
      oc.color,
      oc.quantity
    FROM orders_meta om
      JOIN shops s 
        ON s.id = om.shop_id
      LEFT JOIN series sr                   -- ← join to fetch sr.id
        ON sr.shop_id      = om.shop_id
       AND sr.series_name  = om.series_name
      JOIN order_colors oc 
        ON oc.order_number = om.order_number
    WHERE LOWER(om.order_number) = LOWER(?)
    ORDER BY oc.product_number, oc.color
  `;
  db.all(sql, [orderNumber], (err, rows) => {
    if (err) {
      console.error("❌ SQL error (by-order):", err.message);
      return res.status(500).json({ error: "Failed to load order." });
    }
    if (!rows.length) return res.json([]); // return empty array if not found

    const result = {
      shop_id:     rows[0].shop_id,
      shop_number: rows[0].shop_number,
      series_name: rows[0].series_name,
      series_id:   rows[0].series_id,       // ← include series_id here
      order_date:  rows[0].order_date,
      products:    [],
    };
    const grouped = {};
    rows.forEach((r) => {
      if (!grouped[r.product_number]) {
        grouped[r.product_number] = {
          productNumber: r.product_number,
          quantities:    {}
        };
      }
      grouped[r.product_number].quantities[r.color] = r.quantity;
    });
    result.products = Object.values(grouped);
    res.json(result);
  });
});

/**
 * 4) GET /api/orders/meta/:shopId
 *    – Returns just order_number, series_name, order_date for a given shop.
 */
router.get("/meta/:shopId", (req, res) => {
  db.all(
    `SELECT order_number, series_name, order_date
     FROM orders_meta 
     WHERE shop_id = ?
     ORDER BY id DESC`,
    [req.params.shopId],
    (err, rows) => {
      if (err) {
        console.error("❌ SQL error (meta-shop):", err.message);
        return res.status(500).json({ error: "Failed to fetch metadata." });
      }
      res.json(rows);
    }
  );
});

/**
 * 5) GET /api/orders/:shopId/:seriesName
 *    – Aggregated totals by color for “group by product” in the Orders page.
 */
router.get("/:shopId/:seriesName", (req, res) => {
  const { shopId, seriesName } = req.params;
  const sql = `
    SELECT 
      oc.product_number,
      oc.color,
      SUM(oc.quantity) AS total_quantity
    FROM orders_meta om
      JOIN order_colors oc 
        ON om.order_number = oc.order_number
    WHERE om.shop_id = ? AND om.series_name = ?
    GROUP BY oc.product_number, oc.color
    ORDER BY oc.product_number, oc.color
  `;
  db.all(sql, [shopId, seriesName], (err, rows) => {
    if (err) {
      console.error("❌ SQL error (shop-series):", err.message);
      return res.status(500).json({ error: "Failed to fetch orders." });
    }
    res.json(rows);
  });
});

/**
 * 6) POST /api/orders
 *    – Create a new order (inserts into orders_meta + order_colors).
 */
router.post("/", (req, res) => {
  const { shop_id, series_name, products } = req.body;
  if (
    !shop_id ||
    !series_name ||
    !Array.isArray(products) ||
    !products.length
  ) {
    return res.status(400).json({ error: "Invalid payload." });
  }

  generateOrderNumber((orderNumber, orderId) => {
    if (!orderNumber) {
      return res.status(500).json({ error: "Failed to generate order number." });
    }
    const orderDate = new Date().toISOString().slice(0, 10);

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      // Insert into orders_meta
      db.run(
        `INSERT INTO orders_meta (id, order_number, shop_id, series_name, order_date)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, orderNumber, shop_id, series_name, orderDate]
      );

      // Insert into order_colors
      const insColor = db.prepare(`
        INSERT INTO order_colors
          (order_number, shop_id, series_name, product_number, color, quantity, order_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const { productNumber, quantities } of products) {
        for (const [color, qtyRaw] of Object.entries(quantities)) {
          const q = parseInt(qtyRaw) || 0;
          if (q > 0) {
            insColor.run(
              orderNumber,
              shop_id,
              series_name,
              productNumber,
              color,
              q,
              orderId
            );
          }
        }
      }
      insColor.finalize();

      // Commit transaction
      db.run("COMMIT", (err) => {
        if (err) {
          db.run("ROLLBACK");
          console.error("❌ Failed to save order:", err.message);
          return res.status(500).json({ error: "Failed to save order." });
        }
        res.json({ success: true, order_number: orderNumber });
      });
    });
  });
});
/**
 * 7) PUT /api/orders/:orderNumber
 *    – Overwrite an existing order’s shop_id, series_name, and its colour lines.
 */
router.put("/:orderNumber", (req, res) => {
  const { orderNumber } = req.params;
  const { shop_id: newShopId, series_id: newSeriesId, products } = req.body;

  if (
    !orderNumber ||
    !newShopId ||
    !newSeriesId ||
    !Array.isArray(products)
  ) {
    return res.status(400).json({ error: "Invalid payload." });
  }

  db.serialize(() => {
    // ← START TRANSACTION so COMMIT/ROLLBACK will work
    db.run("BEGIN TRANSACTION");

    // 7a) Verify the order exists and get its orderId
    db.get(
      `SELECT id AS orderId FROM orders_meta WHERE LOWER(order_number) = LOWER(?)`,
      [orderNumber],
      (err, metaRow) => {
        if (err) {
          console.error("❌ SQL error (select orders_meta):", err.message);
          db.run("ROLLBACK");
          return res.status(500).json({ error: "Database error." });
        }
        if (!metaRow) {
          db.run("ROLLBACK");
          return res.status(404).json({ error: "Order not found." });
        }

        const orderId = metaRow.orderId;

        // 7b) Look up the new series_name from series_id
        db.get(
          `SELECT series_name FROM series WHERE id = ?`,
          [newSeriesId],
          (seriesErr, seriesRow) => {
            if (seriesErr) {
              console.error("❌ SQL error (fetch series):", seriesErr.message);
              db.run("ROLLBACK");
              return res.status(500).json({ error: "Failed to fetch series." });
            }
            if (!seriesRow) {
              db.run("ROLLBACK");
              return res.status(400).json({ error: "Invalid series_id." });
            }

            const newSeriesName = seriesRow.series_name;

            // 7c) Update orders_meta → set shop_id & series_name
            db.run(
              `UPDATE orders_meta
                 SET shop_id = ?,
                     series_name = ?
               WHERE LOWER(order_number) = LOWER(?)`,
              [newShopId, newSeriesName, orderNumber],
              function (updErr) {
                if (updErr) {
                  console.error(
                    "❌ SQL error (update orders_meta):",
                    updErr.message
                  );
                  db.run("ROLLBACK");
                  return res
                    .status(500)
                    .json({ error: "Failed to update order metadata." });
                }
                if (this.changes === 0) {
                  db.run("ROLLBACK");
                  return res
                    .status(404)
                    .json({ error: "Order not found for update." });
                }

                // 7d) Delete existing order_colors for that order
                db.run(
                  `DELETE FROM order_colors WHERE LOWER(order_number) = LOWER(?)`,
                  [orderNumber],
                  (delErr) => {
                    if (delErr) {
                      console.error(
                        "❌ SQL error (delete order_colors):",
                        delErr.message
                      );
                      db.run("ROLLBACK");
                      return res
                        .status(500)
                        .json({ error: "Failed to clear old colours." });
                    }

                    // 7e) Insert new order_colors lines
                    const insColor = db.prepare(`
                      INSERT INTO order_colors
                        (order_number, shop_id, series_name, product_number, color, quantity, order_id)
                      VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);
                    for (const { productNumber, quantities } of products) {
                      for (const [color, qtyRaw] of Object.entries(quantities)) {
                        const q = parseInt(qtyRaw) || 0;
                        if (q > 0) {
                          insColor.run(
                            orderNumber,
                            newShopId,
                            newSeriesName,
                            productNumber,
                            color,
                            q,
                            orderId
                          );
                        }
                      }
                    }
                    insColor.finalize();

                    // 7f) Commit transaction
                    db.run("COMMIT", (commitErr) => {
                      if (commitErr) {
                        console.error(
                          "❌ Failed to commit order update:",
                          commitErr.message
                        );
                        db.run("ROLLBACK");
                        return res
                          .status(500)
                          .json({ error: "Failed to save updated order." });
                      }
                      return res.json({
                        success: true,
                        order_number: orderNumber,
                      });
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

/**
 * 8) DELETE /api/orders/:orderNumber
 *    – Remove an order completely (from orders_meta + order_colors).
 */
router.delete("/:orderNumber", (req, res) => {
  const { orderNumber } = req.params;
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // 8a) Verify existence
    db.get(
      `SELECT id FROM orders_meta WHERE LOWER(order_number) = LOWER(?)`,
      [orderNumber],
      (err, row) => {
        if (err || !row) {
          db.run("ROLLBACK");
          return res.status(404).json({ error: "Order not found." });
        }

        // 8b) Delete all order_colors for that order
        db.run(
          `DELETE FROM order_colors WHERE LOWER(order_number) = LOWER(?)`,
          [orderNumber],
          function (delErr) {
            if (delErr) {
              console.error(
                "❌ SQL error (delete order_colors):",
                delErr.message
              );
              db.run("ROLLBACK");
              return res
                .status(500)
                .json({ error: "Failed to delete order colours." });
            }

            // 8c) Delete the orders_meta row
            db.run(
              `DELETE FROM orders_meta WHERE LOWER(order_number) = LOWER(?)`,
              [orderNumber],
              function (delMetaErr) {
                if (delMetaErr) {
                  console.error(
                    "❌ SQL error (delete orders_meta):",
                    delMetaErr.message
                  );
                  db.run("ROLLBACK");
                  return res.status(500).json({ error: "Failed to delete order." });
                }

                db.run("COMMIT", (commitErr) => {
                  if (commitErr) {
                    console.error(
                      "❌ Commit failed (delete order):",
                      commitErr.message
                    );
                    db.run("ROLLBACK");
                    return res
                      .status(500)
                      .json({ error: "Failed to finalize delete." });
                  }
                  return res.json({
                    success: true,
                    deleted_order: orderNumber,
                  });
                });
              }
            );
          }
        );
      }
    );
  });
});

/**
 * 9) GET /api/orders/ping
 */
router.get("/ping", (_req, res) => {
  res.json({ status: "pong" });
});

/**
 * 10) GET /api/orders/metadata
 *    – Returns a simple list of all order_number values, most recent first.
 */
router.get("/metadata", (_req, res) => {
  db.all(
    `SELECT DISTINCT order_number FROM orders_meta ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error("❌ SQL error (metadata):", err.message);
        return res.status(500).json({ error: "Failed to load order metadata." });
      }
      res.json(rows);
    }
  );
});

/**
 * 12) PATCH /api/orders/normalize-negatives
 *     – Zero out any negative quantities in order_colors & adjust status.
 */
router.patch("/normalize-negatives", async (_req, res) => {
  try {
    // Fetch all lines where quantity < 0
    const negativeLines = await new Promise((resolve, reject) => {
      db.all(
        `
          SELECT order_number, product_number, color, quantity
          FROM order_colors
          WHERE quantity < 0
        `,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    if (!negativeLines.length) {
      return res.json({ message: "✅ No negative quantities to normalize." });
    }

    // Zero them out one by one
    for (const { order_number, product_number, color } of negativeLines) {
      await new Promise((resolve, reject) => {
        db.run(
          `
            UPDATE order_colors
            SET quantity = 0
            WHERE order_number = ?
              AND product_number = ?
              AND color = ?
          `,
          [order_number, product_number, color],
          (err) => (err ? reject(err) : resolve())
        );
      });
    }

    // Fix statuses for all affected orders
    const affectedOrderNumbers = [
      ...new Set(negativeLines.map((ln) => ln.order_number)),
    ];

    for (const ord of affectedOrderNumbers) {
      // Fetch all quantities for that order
      const allQuantities = await new Promise((resolve, reject) => {
        db.all(
          `SELECT quantity FROM order_colors WHERE order_number = ?`,
          [ord],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map((r) => r.quantity));
          }
        );
      });

      let newStatus = "partial";
      if (allQuantities.every((q) => q === 0)) newStatus = "delivered";
      else if (allQuantities.every((q) => q > 0)) newStatus = "pending";

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE orders_meta SET status = ? WHERE order_number = ?`,
          [newStatus, ord],
          (err) => (err ? reject(err) : resolve())
        );
      });
    }

    res.json({
      message: `✅ Normalized ${negativeLines.length} negative quantities.`,
      affectedOrders: affectedOrderNumbers,
    });
  } catch (err) {
    console.error("❌ Failed to normalize negatives:", err.message);
    res.status(500).json({ error: "Failed to normalize negative quantities." });
  }
});

module.exports = router;
