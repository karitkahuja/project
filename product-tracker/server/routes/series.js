// server/routes/series.js

const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();

const path = require("path");
const DB_PATH = path.resolve(__dirname, "..", "productDB.sqlite");

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ Error connecting to database:", err.message);
  } else {
    console.log("✅ Connected to database (inside series route)");
  }
});

// ------------------------------------------
// GET all series (along with shop_number)
// ------------------------------------------
router.get("/", (req, res) => {
  const query = `
    SELECT 
      s.id,
      s.series_name,
      s.colors,
      s.shop_id,
      sh.shop_number,
      s.unit,
      s.is_generic
    FROM series s
    LEFT JOIN shops sh ON s.shop_id = sh.id
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch series:", err.message);
      return res.status(500).json({ error: "Failed to fetch series" });
    }

    const formattedRows = rows.map((row) => ({
      ...row,
      colors: JSON.parse(row.colors || "[]"),
      is_generic: row.is_generic === 1,
    }));

    res.json(formattedRows);
  });
});

// ------------------------------------------
// GET a single series by ID
// ------------------------------------------
router.get("/:id", (req, res) => {
  const seriesId = req.params.id;

  const query = `
    SELECT
      id,
      series_name,
      colors,
      shop_id,
      unit,
      is_generic
    FROM series
    WHERE id = ?
  `;

  db.get(query, [seriesId], (err, row) => {
    if (err) {
      console.error("❌ Failed to fetch series by ID:", err.message);
      return res.status(500).json({ error: "Failed to fetch series" });
    }
    if (!row) {
      return res.status(404).json({ error: "Series not found" });
    }

    res.json({
      ...row,
      colors: JSON.parse(row.colors || "[]"),
      is_generic: row.is_generic === 1,
    });
  });
});

// ------------------------------------------
// POST: Create a new series
// ------------------------------------------
router.post("/", (req, res) => {
  const {
    series_name,
    colors,
    shop_id,
    unit = "piece",
    is_generic = false,
  } = req.body;

  // Only require colors when is_generic = false
  if (
    !series_name ||
    !shop_id ||
    (!is_generic && (!Array.isArray(colors) || colors.length === 0))
  ) {
    return res
      .status(400)
      .json({ error: "Missing required fields or invalid data." });
  }

  const query = `
    INSERT INTO series (series_name, colors, shop_id, unit, is_generic)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      series_name,
      JSON.stringify(is_generic ? [] : colors),
      shop_id,
      unit,
      is_generic ? 1 : 0,
    ],
    function (err) {
      if (err) {
        console.error("❌ Failed to insert new series:", err.message);
        return res.status(500).json({ error: "Failed to insert series" });
      }

      res.status(201).json({
        message: "✅ Series created successfully",
        series: {
          id: this.lastID,
          series_name,
          colors: is_generic ? [] : colors,
          shop_id,
          unit,
          is_generic,
        },
      });
    }
  );
});

// ------------------------------------------
// PUT: Update an existing series
// ------------------------------------------
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { series_name, colors, unit = "piece", is_generic = false } = req.body;

  // Only require colors when is_generic = false
  if (
    !series_name ||
    (!is_generic && (!Array.isArray(colors) || colors.length === 0))
  ) {
    return res
      .status(400)
      .json({ error: "Missing required fields or invalid data." });
  }

  const query = `
    UPDATE series
    SET
      series_name = ?,
      colors      = ?,
      unit        = ?,
      is_generic  = ?
    WHERE id = ?
  `;

  db.run(
    query,
    [
      series_name,
      JSON.stringify(is_generic ? [] : colors),
      unit,
      is_generic ? 1 : 0,
      id,
    ],
    function (err) {
      if (err) {
        console.error("❌ Failed to update series:", err.message);
        return res.status(500).json({ error: "Failed to update series" });
      }

      res.json({
        message: "✅ Series updated successfully",
        updated: this.changes,
      });
    }
  );
});

module.exports = router;
