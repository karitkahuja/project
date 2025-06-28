const express = require('express');
const router = express.Router();

// Middleware: expects req.db as sqlite3.Database
// Tables: weekly_sales_meta, weekly_sales_items, stock_on_hand

/**
 * GET /api/weekly-sales
 * Query params (optional): shop_id, series_name, week_id
 * Lists meta records
 */
router.get('/', (req, res) => {
  const db = req.db;
  const { shop_id, series_name, week_id } = req.query;
  const clauses = [];
  const params = [];
  if (shop_id && shop_id.toLowerCase() !== 'all') {
    clauses.push('shop_id = ?');
    params.push(shop_id);
  }
  if (series_name && series_name.toLowerCase() !== 'all') {
    clauses.push('series_name = ?');
    params.push(series_name);
  }
  if (week_id && week_id.toLowerCase() !== 'all') {
    clauses.push('week_id = ?');
    params.push(week_id);
  }
  let sql = `SELECT id, shop_id, series_name, week_id, is_closed, created_at, closed_at
             FROM weekly_sales_meta`;
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch weekly-sales meta' });
    res.json(rows);
  });
});

/**
 * POST /api/weekly-sales
 * Body: { shop_id, series_name, week_id }
 * Fetches existing meta or creates new one
 */
router.post('/', (req, res) => {
  const db = req.db;
  const { shop_id, series_name, week_id } = req.body;
  if (!shop_id || !series_name || !week_id) {
    return res.status(400).json({ error: 'shop_id, series_name and week_id are required' });
  }

  const selectSql = `SELECT * FROM weekly_sales_meta
                     WHERE shop_id = ? AND series_name = ? AND week_id = ?`;
  db.get(selectSql, [shop_id, series_name, week_id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row) {
      return res.json(row);
    }
    const insertSql = `INSERT INTO weekly_sales_meta
                       (shop_id, series_name, week_id)
                       VALUES (?, ?, ?)`;
    db.run(insertSql, [shop_id, series_name, week_id], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to create weekly-sales meta' });
      db.get(selectSql, [shop_id, series_name, week_id], (e, newRow) => {
        if (e) return res.status(500).json({ error: 'Fetch after insert failed' });
        res.status(201).json(newRow);
      });
    });
  });
});

/**
 * GET /api/weekly-sales/:metaId/items
 * Lists item lines under a week
 */
router.get('/:metaId/items', (req, res) => {
  const db = req.db;
  const { metaId } = req.params;
  const sql = `SELECT id, product_number, color, quantity, unit_price
               FROM weekly_sales_items
               WHERE meta_id = ?
               ORDER BY id ASC`;
  db.all(sql, [metaId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch items' });
    res.json(rows);
  });
});

/**
 * POST /api/weekly-sales/:metaId/items
 * Body: { product_number, color, quantity, unit_price }
 * Adds a new sale-line and decrements stock
 */
router.post('/:metaId/items', (req, res) => {
  const db = req.db;
  const { metaId } = req.params;
  const { product_number, color, quantity, unit_price } = req.body;
  if (!product_number || !color || !quantity) {
    return res.status(400).json({ error: 'product_number, color, and quantity required' });
  }

  db.serialize(() => {
    // Fetch meta
    db.get(`SELECT shop_id, series_name, is_closed FROM weekly_sales_meta WHERE id = ?`, [metaId], (err, meta) => {
      if (err || !meta) return res.status(400).json({ error: 'Invalid metaId' });
      if (meta.is_closed) return res.status(403).json({ error: 'Week is closed' });

      // Adjust stock_on_hand: decrement
      const updStock = `UPDATE stock_on_hand
                        SET stock_quantity = stock_quantity - ?
                        WHERE shop_id = ? AND series_name = ? AND product_number = ? AND color = ?`;
      db.run(updStock, [quantity, meta.shop_id, meta.series_name, product_number, color], function(e) {
        if (e) return res.status(500).json({ error: 'Failed to adjust stock' });

        // Insert item
        const insertItem = `INSERT INTO weekly_sales_items
                            (meta_id, product_number, color, quantity, unit_price)
                            VALUES (?, ?, ?, ?, ?)`;
        db.run(insertItem, [metaId, product_number, color, quantity, unit_price || 0], function(e2) {
          if (e2) return res.status(500).json({ error: 'Failed to insert item' });
          // Return new item
          db.get(`SELECT * FROM weekly_sales_items WHERE id = ?`, [this.lastID], (e3, newItem) => {
            if (e3) return res.status(500).json({ error: 'Fetch after insert failed' });
            res.status(201).json(newItem);
          });
        });
      });
    });
  });
});

/**
 * PATCH /api/weekly-sales/:metaId/items/:itemId
 * Body: { quantity?, unit_price? }
 * Adjusts an existing line, updating stock by delta
 */
router.patch('/:metaId/items/:itemId', (req, res) => {
  const db = req.db;
  const { metaId, itemId } = req.params;
  const { quantity, unit_price } = req.body;

  db.serialize(() => {
    // Fetch meta
    db.get(`SELECT shop_id, series_name, is_closed FROM weekly_sales_meta WHERE id = ?`, [metaId], (err, meta) => {
      if (err || !meta) return res.status(400).json({ error: 'Invalid metaId' });
      if (meta.is_closed) return res.status(403).json({ error: 'Week is closed' });

      // Fetch existing item
      db.get(`SELECT product_number, color, quantity AS old_qty FROM weekly_sales_items WHERE id = ? AND meta_id = ?`, [itemId, metaId], (e, item) => {
        if (e || !item) return res.status(400).json({ error: 'Invalid itemId' });

        // Determine delta for stock
        const newQty = (quantity != null ? quantity : item.old_qty);
        const delta = newQty - item.old_qty;

        const updStock = `UPDATE stock_on_hand
                          SET stock_quantity = stock_quantity - ?
                          WHERE shop_id = ? AND series_name = ? AND product_number = ? AND color = ?`;
        db.run(updStock, [delta, meta.shop_id, meta.series_name, item.product_number, item.color], (e2) => {
          if (e2) return res.status(500).json({ error: 'Failed to adjust stock' });

          // Update item
          const fields = [];
          const params = [];
          if (quantity != null) { fields.push('quantity = ?'); params.push(quantity); }
          if (unit_price != null) { fields.push('unit_price = ?'); params.push(unit_price); }
          params.push(itemId);
          const sql = `UPDATE weekly_sales_items SET ${fields.join(', ')} WHERE id = ?`;
          db.run(sql, params, function(e3) {
            if (e3) return res.status(500).json({ error: 'Failed to update item' });
            db.get(`SELECT * FROM weekly_sales_items WHERE id = ?`, [itemId], (e4, updItem) => {
              if (e4) return res.status(500).json({ error: 'Fetch after update failed' });
              res.json(updItem);
            });
          });
        });
      });
    });
  });
});

/**
 * DELETE /api/weekly-sales/:metaId/items/:itemId
 * Restock and remove an item
 */
router.delete('/:metaId/items/:itemId', (req, res) => {
  const db = req.db;
  const { metaId, itemId } = req.params;

  db.serialize(() => {
    // Fetch meta
    db.get(`SELECT shop_id, series_name, is_closed FROM weekly_sales_meta WHERE id = ?`, [metaId], (err, meta) => {
      if (err || !meta) return res.status(400).json({ error: 'Invalid metaId' });
      if (meta.is_closed) return res.status(403).json({ error: 'Week is closed' });

      // Fetch item
      db.get(`SELECT product_number, color, quantity FROM weekly_sales_items WHERE id = ? AND meta_id = ?`, [itemId, metaId], (e, item) => {
        if (e || !item) return res.status(400).json({ error: 'Invalid itemId' });

        // Restock
        const restock = `UPDATE stock_on_hand
                         SET stock_quantity = stock_quantity + ?
                         WHERE shop_id = ? AND series_name = ? AND product_number = ? AND color = ?`;
        db.run(restock, [item.quantity, meta.shop_id, meta.series_name, item.product_number, item.color], (e2) => {
          if (e2) return res.status(500).json({ error: 'Failed to restock' });

          // Delete
          db.run(`DELETE FROM weekly_sales_items WHERE id = ?`, [itemId], function(e3) {
            if (e3) return res.status(500).json({ error: 'Failed to delete item' });
            res.json({ success: true });
          });
        });
      });
    });
  });
});

/**
 * POST /api/weekly-sales/:metaId/close
 * Marks week closed
 */
router.post('/:metaId/close', (req, res) => {
  const db = req.db;
  const { metaId } = req.params;
  const sql = `UPDATE weekly_sales_meta
               SET is_closed = 1, closed_at = datetime('now')
               WHERE id = ?`;
  db.run(sql, [metaId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to close week' });
    res.json({ success: true });
  });
});

module.exports = router;
