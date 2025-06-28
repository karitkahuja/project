// server/routes/shops.js

const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();

// Database connection
const db = new sqlite3.Database("./productDB.sqlite", (err) => {
  if (err) {
    console.error("❌ Failed to connect to database:", err.message);
  } else {
    console.log("✅ Connected to database (inside shops route)");
  }
});

// GET all shops
router.get("/", (req, res) => {
  const query = `SELECT * FROM shops`;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch shops:", err.message);
      return res.status(500).json({ error: "Failed to fetch shops" });
    }
    res.json(rows);
  });
});

// GET a single shop by ID
router.get("/:id", (req, res) => {
  const shopId = req.params.id;

  const query = `SELECT id AS shop_id, shop_number, is_active FROM shops WHERE id = ?`;
  db.get(query, [shopId], (err, row) => {
    if (err) {
      console.error("❌ Failed to fetch shop by ID:", err.message);
      return res.status(500).json({ error: "Failed to fetch shop" });
    }

    if (!row) {
      return res.status(404).json({ error: "Shop not found" });
    }

    res.json(row);
  });
});

// UPDATE a shop by ID
router.put("/:id", (req, res) => {
  const shopId = req.params.id;
  const { shop_number, is_active } = req.body;

  if (!shop_number || typeof is_active === "undefined") {
    return res.status(400).json({ error: "Missing shop_number or is_active" });
  }

  const query = `
    UPDATE shops
    SET shop_number = ?, is_active = ?
    WHERE id = ?
  `;

  db.run(query, [shop_number.trim(), is_active ? 1 : 0, shopId], function (err) {
    if (err) {
      console.error("❌ Failed to update shop:", err.message);
      return res.status(500).json({ error: "Failed to update shop" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Shop not found" });
    }

    res.json({ success: true, message: "Shop updated successfully" });
  });
});

// POST a new shop
router.post("/", (req, res) => {
  const { shop_number } = req.body;

  if (!shop_number || typeof shop_number !== "string") {
    return res.status(400).json({ error: "Invalid or missing shop_number" });
  }

  const query = `INSERT INTO shops (shop_number) VALUES (?)`;

  db.run(query, [shop_number.trim()], function (err) {
    if (err) {
      console.error("❌ Failed to create shop:", err.message);
      return res.status(500).json({ error: "Failed to create shop" });
    }

    res.status(201).json({
      success: true,
      message: "Shop created successfully",
      shop_id: this.lastID,
    });
  });
});

module.exports = router;
