// server/routes/received.js

const express = require("express");
const router  = express.Router();

/**
 * GET /api/received/next-number
 * Returns the next receive_number in the format RCV-0001, RCV-0002, etc.
 */
router.get("/next-number", (req, res) => {
  const db = req.db;
  db.get(
    `SELECT receive_number
       FROM received_meta
      ORDER BY receive_number DESC
      LIMIT 1`,
    (err, row) => {
      if (err) {
        console.error("❌ Could not fetch last receive_number:", err.message);
        return res.status(500).json({ error: "Failed to fetch next number" });
      }
      let next;
      if (row && row.receive_number) {
        const [prefix, num] = row.receive_number.split("-");
        const nextNum = parseInt(num, 10) + 1;
        next = `${prefix}-${String(nextNum).padStart(4, "0")}`;
      } else {
        next = "RCV-0001";
      }
      res.json({ nextReceiveNumber: next });
    }
  );
});

/**
 * POST /api/received
 * Create a new received shipment: metadata + line items.
 */
router.post("/", (req, res) => {
  const {
    receive_number,
    shop_id,
    series_name,
    actual_arrival_date,   // required
    dispatch_date,
    estimated_arrival_date,
    mode_of_transport,
    notes,
    lines                  // array of { product_number, color, quantity }
  } = req.body;

  if (
    !receive_number ||
    !shop_id ||
    !series_name ||
    !actual_arrival_date ||
    !Array.isArray(lines)
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const db = req.db;
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // 1) Insert shipment metadata
    const metaStmt = db.prepare(`
      INSERT INTO received_meta
        (receive_number, shop_id, series_name,
         dispatch_date, estimated_arrival_date,
         mode_of_transport, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    metaStmt.run(
      receive_number,
      shop_id,
      series_name,
      dispatch_date || null,
      estimated_arrival_date || null,
      mode_of_transport || null,
      notes || null
    );
    metaStmt.finalize((errMeta) => {
      if (errMeta) {
        db.run("ROLLBACK");
        console.error("❌ Could not save received_meta:", errMeta.message);
        return res.status(500).json({ error: "Could not save metadata" });
      }

      // 2) Insert each line into received_colors using a blank order_number if none provided
      const lineStmt = db.prepare(`
        INSERT INTO received_colors
          (receive_number, order_number, shop_id,
           series_name, product_number, color,
           quantity, actual_arrival_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const { product_number, color, quantity } of lines) {
        if (!product_number || typeof quantity !== "number") {
          continue; // skip invalid lines
        }
        lineStmt.run(
          receive_number,
          "",                 // placeholder when no order_number
          shop_id,
          series_name,
          product_number,
          color,
          quantity,
          actual_arrival_date
        );
      }
      lineStmt.finalize((errLines) => {
        if (errLines) {
          db.run("ROLLBACK");
          console.error("❌ Could not save received_colors:", errLines.message);
          return res.status(500).json({ error: "Could not save line items" });
        }

        // 3) Commit transaction
        db.run("COMMIT", (errCommit) => {
          if (errCommit) {
            console.error("❌ Commit failed:", errCommit.message);
            return res.status(500).json({ error: "Transaction failed" });
          }
          res.json({ success: true, receive_number });
        });
      });
    });
  });
});

/**
 * GET /api/received/received-entries/:shopId/:seriesName
 * List all received lines + their metadata (including series_id).
 */
router.get("/received-entries/:shopId/:seriesName", (req, res) => {
  const { shopId, seriesName } = req.params;
  const db = req.db;
  const where = [];
  const params = [];

  if (shopId.toLowerCase() !== "all") {
    where.push("rc.shop_id = ?");
    params.push(shopId);
  }
  if (seriesName.toLowerCase() !== "all") {
    where.push("rc.series_name = ?");
    params.push(seriesName);
  }

  const sql = `
    SELECT
      rc.receive_number,
      rc.actual_arrival_date,
      rm.dispatch_date,
      rm.estimated_arrival_date,
      rm.mode_of_transport,
      rm.notes,
      rm.is_completed       AS status,
      rc.shop_id,
      rc.series_name,
      s.id                   AS series_id,
      rc.order_number,
      rc.product_number,
      rc.color,
      rc.quantity
    FROM received_colors rc
    JOIN received_meta rm
      ON rm.receive_number = rc.receive_number
    LEFT JOIN series s
      ON s.series_name = rc.series_name
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY rc.receive_number DESC, rc.id ASC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ Failed to load entries:", err.message);
      return res.status(500).json({ error: "Failed to load entries" });
    }
    res.json(rows);
  });
});

/**
 * PATCH /api/received/mark-completed/:receiveNumber
 * Mark a shipment received → allocate via FIFO, close orders,
 * then update stock_on_hand.
 */
router.patch("/mark-completed/:receiveNumber", (req, res) => {
  const { receiveNumber } = req.params;
  const db = req.db;

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // 1) Flag metadata completed
    db.run(
      `UPDATE received_meta
         SET is_completed = 1
       WHERE receive_number = ?`,
      [receiveNumber],
      (errMeta) => {
        if (errMeta) {
          db.run("ROLLBACK");
          console.error("❌ Could not update received_meta:", errMeta.message);
          return res.status(500).json({ error: "Mark completed failed" });
        }

        // 2) Flag lines completed & update arrival timestamp
        db.run(
          `UPDATE received_colors
             SET is_completed        = 1,
                 actual_arrival_date = datetime('now')
           WHERE receive_number = ?`,
          [receiveNumber]
        );

        // 3) Fetch received lines for allocation + stock update
        db.all(
          `
            SELECT shop_id, series_name, product_number, color, quantity
              FROM received_colors
             WHERE receive_number = ?
             ORDER BY id ASC
          `,
          [receiveNumber],
          (errRows, recRows) => {
            if (errRows) {
              db.run("ROLLBACK");
              console.error("❌ Allocation lookup failed:", errRows.message);
              return res.status(500).json({ error: "Allocation lookup failed" });
            }

            const recShopId = recRows[0]?.shop_id;
            const recSeries = recRows[0]?.series_name;
            let idx = 0;

            // FIFO allocation recursion
            const allocNext = () => {
              if (idx >= recRows.length) {
                // Close fully fulfilled orders
                db.run(
                  `
                    UPDATE orders_meta
                       SET status    = 'completed',
                           is_closed = 1
                     WHERE order_number IN (
                       SELECT oc.order_number
                         FROM order_colors oc
                         LEFT JOIN (
                           SELECT order_number,
                                  product_number,
                                  color,
                                  SUM(quantity) AS alloc_qty
                             FROM order_allocations
                            GROUP BY order_number, product_number, color
                         ) oa
                           ON oa.order_number   = oc.order_number
                          AND oa.product_number = oc.product_number
                          AND lower(oa.color)   = lower(oc.color)
                        WHERE oc.shop_id     = ?
                          AND oc.series_name = ?
                        GROUP BY oc.order_number
                       HAVING SUM(oc.quantity) - SUM(COALESCE(oa.alloc_qty,0)) <= 0
                     )
                  `,
                  [recShopId, recSeries],
                  (errClose) => {
                    if (errClose) {
                      db.run("ROLLBACK");
                      console.error("❌ Could not close orders:", errClose.message);
                      return res.status(500).json({ error: "Order closing failed" });
                    }

                    // 4) Commit transaction
                    db.run("COMMIT", (commitErr) => {
                      if (commitErr) {
                        console.error("❌ Commit failed:", commitErr.message);
                        return res.status(500).json({ error: "Commit failed" });
                      }

                      // 5) Update stock_on_hand for each received line
                      const stockStmt = db.prepare(`
                        INSERT INTO stock_on_hand
                          (shop_id, series_name, product_number, color, stock_quantity)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(shop_id, series_name, product_number, color)
                        DO UPDATE SET
                          stock_quantity = stock_quantity + excluded.stock_quantity
                      `);
                      for (const { shop_id, series_name, product_number, color, quantity } of recRows) {
                        stockStmt.run(
                          shop_id,
                          series_name,
                          product_number,
                          color,
                          quantity
                        );
                      }
                      stockStmt.finalize((errStock) => {
                        if (errStock) {
                          console.error("❌ Could not update stock_on_hand:", errStock.message);
                          return res.status(500).json({ error: "Stock update failed" });
                        }
                        // All done
                        return res.json({ success: true });
                      });
                    });
                  }
                );
                return;
              }

              // Allocate this one FIFO…
              const { shop_id, series_name, product_number, color, quantity } = recRows[idx];
              let remaining = quantity;

              const allocSql = `
                SELECT oc.order_number,
                       oc.quantity AS ordered_quantity,
                       COALESCE(SUM(oa.quantity),0) AS allocated_qty
                  FROM order_colors oc
                  LEFT JOIN order_allocations oa
                    ON oa.order_number   = oc.order_number
                   AND oa.product_number = oc.product_number
                   AND lower(oa.color)   = lower(oc.color)
                 WHERE oc.shop_id        = ?
                   AND oc.series_name    = ?
                   AND oc.product_number = ?
                   AND lower(oc.color)   = lower(?)
                 GROUP BY oc.order_number
                HAVING ordered_quantity - allocated_qty > 0
                ORDER BY oc.order_number ASC
              `;
              db.all(
                allocSql,
                [shop_id, series_name, product_number, color],
                (errAlloc, orders) => {
                  if (errAlloc) {
                    db.run("ROLLBACK");
                    console.error("❌ Allocation failed:", errAlloc.message);
                    return res.status(500).json({ error: "Allocation failed" });
                  }
                  for (const ord of orders) {
                    if (remaining <= 0) break;
                    const pending = ord.ordered_quantity - ord.allocated_qty;
                    const toAlloc = Math.min(pending, remaining);
                    if (toAlloc > 0) {
                      db.run(
                        `INSERT INTO order_allocations
                           (order_number, receive_number, product_number, color, quantity)
                         VALUES (?, ?, ?, ?, ?)`,
                        [ord.order_number, receiveNumber, product_number, color, toAlloc]
                      );
                      remaining -= toAlloc;
                    }
                  }
                  // Over-delivery goes to last order
                  if (remaining > 0 && orders.length) {
                    const last = orders[orders.length - 1];
                    db.run(
                      `INSERT INTO order_allocations
                         (order_number, receive_number, product_number, color, quantity)
                       VALUES (?, ?, ?, ?, ?)`,
                      [last.order_number, receiveNumber, product_number, color, remaining]
                    );
                  }
                  idx++;
                  allocNext();
                }
              );
            };

            allocNext();
          }
        );
      }
    );
  });
});

/**
 * PUT /api/received/:receiveNumber
 * Update an existing received shipment: metadata + line items.
 */
router.put("/:receiveNumber", (req, res) => {
  const { receiveNumber } = req.params;
  const {
    dispatch_date,
    estimated_arrival_date,
    mode_of_transport,
    notes,
    entries       // array of { order_number, product_number, color, quantity, received_date }
  } = req.body;

  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: "Missing required 'entries' array" });
  }

  const db = req.db;
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // 1) Update metadata
    db.run(
      `UPDATE received_meta
          SET dispatch_date         = ?,
              estimated_arrival_date = ?, 
              mode_of_transport      = ?, 
              notes                  = ?
        WHERE receive_number = ?`,
      [
        dispatch_date || null,
        estimated_arrival_date || null,
        mode_of_transport || null,
        notes || null,
        receiveNumber
      ],
      (errMeta) => {
        if (errMeta) {
          db.run("ROLLBACK");
          console.error("❌ Could not update received_meta:", errMeta.message);
          return res.status(500).json({ error: "Failed to update metadata" });
        }

        // 2) Fetch shop_id & series_name for reinsertion
        db.get(
          `SELECT shop_id, series_name
             FROM received_meta
            WHERE receive_number = ?`,
          [receiveNumber],
          (errGet, metaRow) => {
            if (errGet || !metaRow) {
              db.run("ROLLBACK");
              console.error("❌ Could not fetch metadata for reinsertion:", errGet?.message);
              return res.status(500).json({ error: "Failed to fetch metadata" });
            }

            const { shop_id, series_name } = metaRow;

            // 3) Delete old lines
            db.run(
              `DELETE FROM received_colors
                 WHERE receive_number = ?`,
              [receiveNumber],
              (errDel) => {
                if (errDel) {
                  db.run("ROLLBACK");
                  console.error("❌ Could not delete old received_colors:", errDel.message);
                  return res.status(500).json({ error: "Failed to delete old lines" });
                }

                // 4) Insert new line items
                const lineStmt = db.prepare(`
                  INSERT INTO received_colors
                    (receive_number, order_number,
                     shop_id, series_name,
                     product_number, color,
                     quantity, actual_arrival_date)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);
                for (const e of entries) {
                  const { order_number, product_number, color, quantity, received_date } = e;
                  if (!order_number || !product_number || typeof quantity !== "number") {
                    continue;
                  }
                  lineStmt.run(
                    receiveNumber,
                    order_number,
                    shop_id,
                    series_name,
                    product_number,
                    color,
                    quantity,
                    received_date || null
                  );
                }
                lineStmt.finalize((errLines) => {
                  if (errLines) {
                    db.run("ROLLBACK");
                    console.error("❌ Could not insert new received_colors:", errLines.message);
                    return res.status(500).json({ error: "Failed to insert new lines" });
                  }

                  // 5) Commit transaction
                  db.run("COMMIT", (errCommit) => {
                    if (errCommit) {
                      db.run("ROLLBACK");
                      console.error("❌ Commit failed:", errCommit.message);
                      return res.status(500).json({ error: "Failed to commit update" });
                    }
                    res.json({ success: true });
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
 * GET /api/received/bills
 * Returns a flat list of all received-order line-items with header info:
 *   receive_number, received_date, dispatch_date, mode_of_transport,
 *   supplier (shop_name), product_number, color, quantity, unit, price
 */
router.get("/bills", (req, res) => {
  const db = req.db;
  const sql = `
    SELECT
      rm.receive_number,
      rc.actual_arrival_date   AS received_date,
      rm.dispatch_date,
      rm.mode_of_transport,
      s.shop_name              AS supplier,
      rc.product_number,
      rc.color,
      rc.quantity,
      p.unit,
      p.price_per_piece        AS price
    FROM received_meta rm
    JOIN shops         s   ON rm.shop_id      = s.id
    JOIN received_colors rc ON rc.receive_number = rm.receive_number
    JOIN products      p   ON p.product_number = rc.product_number
    ORDER BY
      rm.receive_number DESC,
      rc.id ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("❌ Failed to load received bills:", err.message);
      return res.status(500).json({ error: "Could not load received bills." });
    }
    res.json(rows);
  });
});

module.exports = router;
