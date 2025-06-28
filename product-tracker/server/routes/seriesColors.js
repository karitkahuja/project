// server/routes/seriesColors.js

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const router = express.Router();

const db = new sqlite3.Database("./productDB.sqlite");

// Get colors for a series
router.get("/:seriesId", (req, res) => {
  const { seriesId } = req.params;
  db.all("SELECT id, color_name FROM series_colors WHERE series_id = ?", [seriesId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add or replace colors for a series
router.post("/:seriesId", (req, res) => {
  const { seriesId } = req.params;
  const { colors } = req.body;

  db.serialize(() => {
    db.run("DELETE FROM series_colors WHERE series_id = ?", [seriesId], (delErr) => {
      if (delErr) return res.status(500).json({ error: delErr.message });

      const stmt = db.prepare("INSERT INTO series_colors (series_id, color_name) VALUES (?, ?)");
      for (const color of colors) {
        stmt.run(seriesId, color);
      }
      stmt.finalize();
      res.json({ success: true });
    });
  });
});

module.exports = router;
