// server/routes/pendingOrders.js

const express = require("express");
const router  = express.Router();

/**
 * GET /api/orders/manufacturing/:shopId/:seriesName
 * — All ordered minus ALL dispatched (in-transit + delivered)
 */
router.get("/manufacturing/:shopId/:seriesName", (req, res) => {
  const { shopId, seriesName } = req.params;
  const db = req.db;

  const sql = `
    SELECT
      oc.order_number,
      om.order_date,
      oc.product_number,
      oc.color,
      oc.quantity                             AS ordered_quantity,
      COALESCE(ship.shipped_qty, 0)           AS shipped_quantity,
      oc.quantity
        - COALESCE(ship.shipped_qty, 0)       AS manufacturing_quantity
    FROM order_colors AS oc
    JOIN orders_meta AS om
      ON om.order_number = oc.order_number

    /* sum up every dispatched piece, regardless of whether it’s marked complete */
    LEFT JOIN (
      SELECT
        rc.order_number,
        rc.product_number,
        LOWER(rc.color)   AS color,
        SUM(rc.quantity)  AS shipped_qty
      FROM received_meta rm
      JOIN received_colors rc
        ON rc.receive_number = rm.receive_number
      WHERE rm.shop_id       = ?
        AND rm.series_name   = ?
        AND rm.dispatch_date IS NOT NULL
      GROUP BY
        rc.order_number,
        rc.product_number,
        LOWER(rc.color)
    ) AS ship
      ON ship.order_number   = oc.order_number
     AND ship.product_number = oc.product_number
     AND LOWER(oc.color)      = ship.color

    WHERE
      oc.shop_id       = ?
      AND oc.series_name = ?
      AND om.status      = 'pending'
      /* only show rows where there’s still work to do */
      AND oc.quantity - COALESCE(ship.shipped_qty, 0) > 0

    ORDER BY
      CAST(
        SUBSTR(oc.order_number,
               INSTR(oc.order_number, '-') + 1)
        AS INTEGER
      ) ASC
  `;

  db.all(
    sql,
    [
      shopId, seriesName,    // for the subquery
      shopId, seriesName     // for the outer WHERE
    ],
    (err, rows) => {
      if (err) {
        console.error("❌ Manufacturing fetch error:", err);
        return res
          .status(500)
          .json({ error: "Failed to fetch manufacturing data" });
      }
      res.json(rows);
    }
  );
});

/**
 * GET /api/orders/in-transit/:shopId/:seriesName
 * — Everything dispatched but not yet marked completed
 */
router.get("/in-transit/:shopId/:seriesName", (req, res) => {
  const { shopId, seriesName } = req.params;
  const db = req.db;

  const sql = `
    SELECT
      rm.receive_number,
      rm.dispatch_date,
      rm.estimated_arrival_date AS eta_date,
      rm.mode_of_transport      AS transport_mode,
      rm.notes,
      rc.product_number,
      rc.color,
      SUM(rc.quantity)          AS in_transit_quantity
    FROM received_meta AS rm
    JOIN received_colors AS rc
      ON rc.receive_number = rm.receive_number
    WHERE rm.shop_id           = ?
      AND rm.series_name       = ?
      AND rm.dispatch_date IS NOT NULL
      AND rm.is_completed    = 0
    GROUP BY
      rm.receive_number,
      rm.dispatch_date,
      rm.estimated_arrival_date,
      rm.mode_of_transport,
      rm.notes,
      rc.product_number,
      rc.color
    ORDER BY
      rm.dispatch_date ASC
  `;

  db.all(sql, [shopId, seriesName], (err, rows) => {
    if (err) {
      console.error("❌ In-Transit fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch in-transit data" });
    }
    res.json(rows);
  });
});

/**
 * GET /api/orders/total-pending/:shopId/:seriesName
 * — All ordered minus all FIFO allocations, excluding zeros
 */
router.get("/total-pending/:shopId/:seriesName", (req, res) => {
  const { shopId, seriesName } = req.params;
  const db = req.db;

  const sql = `
    SELECT
      oc.order_number,
      om.order_date,
      oc.product_number,
      oc.color,
      oc.quantity                   AS ordered_quantity,
      COALESCE(SUM(oa.quantity), 0) AS received_quantity,
      oc.quantity
        - COALESCE(SUM(oa.quantity), 0) AS pending_quantity
    FROM order_colors AS oc
    JOIN orders_meta AS om
      ON om.order_number = oc.order_number
    LEFT JOIN order_allocations AS oa
      ON oa.order_number   = oc.order_number
     AND oa.product_number = oc.product_number
     AND LOWER(oa.color)   = LOWER(oc.color)
    WHERE oc.shop_id       = ?
      AND oc.series_name   = ?
    GROUP BY
      oc.order_number,
      om.order_date,
      oc.product_number,
      oc.color,
      oc.quantity
    HAVING pending_quantity != 0
    ORDER BY
      CAST(
        SUBSTR(oc.order_number,
               INSTR(oc.order_number, '-') + 1)
        AS INTEGER
      ) ASC
  `;

  db.all(sql, [shopId, seriesName], (err, rows) => {
    if (err) {
      console.error("❌ Total-Pending fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch total pending data" });
    }
    res.json(rows);
  });
});

module.exports = router;
