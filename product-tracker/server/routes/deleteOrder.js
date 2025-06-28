// server/routes/deleteOrder.js

const express = require("express");
const router = express.Router();

/**
 * DELETE /api/orders/:orderNumber
 * Deletes an order and its metadata by order number
 */
router.delete("/:orderNumber", (req, res) => {
  const { orderNumber } = req.params;

  if (!orderNumber) {
    return res.status(400).json({ error: "Order number is required" });
  }

  const db = req.db;

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.run(
      `DELETE FROM order_colors WHERE order_number = ?`,
      [orderNumber],
      function (err) {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: "Failed to delete order lines." });
        }

        db.run(
          `DELETE FROM orders_meta WHERE order_number = ?`,
          [orderNumber],
          function (err) {
            if (err) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: "Failed to delete order metadata." });
            }

            db.run("COMMIT");
            return res.json({ message: `Order ${orderNumber} deleted successfully.` });
          }
        );
      }
    );
  });
});

module.exports = router;
