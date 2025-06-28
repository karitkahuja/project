// server/routes/products.js

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");

const router = express.Router();
const db = new sqlite3.Database(path.resolve(__dirname, "..", "productDB.sqlite"));
const uploadOnly = multer({ dest: "uploads/" });

// ————————————————————————————————————————————
// GET all products (with images, etc.)
// ————————————————————————————————————————————
router.get("/", (req, res) => {
  const sql = `
    SELECT 
      p.id,
      p.product_number,
      p.description,
      p.price_per_piece,
      p.unit,
      p.is_active,
      p.image_filename,
      s.id    AS series_id,
      s.series_name,
      sh.id   AS shop_id,
      sh.shop_number
    FROM products p
    LEFT JOIN series s ON p.series_id = s.id
    LEFT JOIN shops  sh ON s.shop_id   = sh.id
    ORDER BY s.series_name, p.product_number
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch products:", err);
      return res.status(500).json({ error: "Failed to fetch products" });
    }
    res.json(rows);
  });
});

// ————————————————————————————————————————————
// GET next product number
// ————————————————————————————————————————————
router.get("/next-number", (req, res) => {
  const { shop_id, series_id } = req.query;
  if (!shop_id || !series_id) {
    return res.status(400).json({ error: "Missing shop_id or series_id" });
  }

  db.get(
    `SELECT series_name FROM series WHERE id = ?`,
    [series_id],
    (err, seriesRow) => {
      if (err || !seriesRow) {
        return res.status(500).json({ error: "Failed to fetch series prefix" });
      }
      const prefix = seriesRow.series_name.trim().charAt(0).toUpperCase();
      const pattern = `${prefix}-%`;
      db.get(
        `
        SELECT MAX(
          CAST(SUBSTR(product_number, INSTR(product_number, '-') + 1) AS INTEGER)
        ) AS max_num
        FROM products
        WHERE product_number LIKE ?
        `,
        [pattern],
        (err, row) => {
          if (err) {
            return res.status(500).json({ error: "Failed to generate product number" });
          }
          const nextNum = (row?.max_num || 0) + 1;
          res.json({ next_product_number: `${prefix}-${nextNum}` });
        }
      );
    }
  );
});

// ————————————————————————————————————————————
// GET product by ID
// ————————————————————————————————————————————
router.get("/:id", (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT 
      p.id,
      p.product_number,
      p.description,
      p.price_per_piece,
      p.unit,
      p.is_active,
      p.series_id       AS product_series_id,
      p.image_filename,
      s.id               AS series_id,
      s.series_name,
      sh.id              AS shop_id,
      sh.shop_number
    FROM products p
    LEFT JOIN series s ON p.series_id = s.id
    LEFT JOIN shops  sh ON s.shop_id   = sh.id
    WHERE p.id = ?
  `;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ error: "Failed to fetch product" });
    if (!row) return res.status(404).json({ error: "Product not found" });
    if (!row.series_id && row.product_series_id) row.series_id = row.product_series_id;
    delete row.product_series_id;
    res.json(row);
  });
});

// ————————————————————————————————————————————
// POST add new product
// ————————————————————————————————————————————
router.post("/", express.json(), (req, res) => {
  const {
    product_number,
    price_per_piece,
    description,
    unit,
    shop_id,
    series_id,
    image_filename,
  } = req.body;

  const sql = `
    INSERT INTO products (
      product_number,
      series_id,
      shop_id,
      price_per_piece,
      description,
      unit,
      image_filename,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `;
  db.run(
    sql,
    [
      product_number,
      series_id,
      shop_id,
      price_per_piece,
      description,
      unit,
      image_filename,
    ],
    function (err) {
      if (err) {
        console.error("❌ Failed to insert product:", err);
        return res.status(500).json({ error: "Product insert failed" });
      }
      res.status(201).json({
        message: "✅ Product added successfully",
        product_id: this.lastID,
      });
    }
  );
});

// ————————————————————————————————————————————
// PUT update existing product
// ————————————————————————————————————————————
router.put("/:id", express.json(), (req, res) => {
  const { id } = req.params;
  const {
    product_number,
    price_per_piece,
    description,
    unit,
    series_id,
    is_active,
  } = req.body;

  // first fetch existing for rename logic
  db.get(
    `
    SELECT p.product_number, p.image_filename, s.shop_id
    FROM products p
    LEFT JOIN series s ON p.series_id = s.id
    WHERE p.id = ?
    `,
    [id],
    (err, existing) => {
      if (err || !existing) {
        return res.status(500).json({ error: "Failed to fetch existing product" });
      }

      const oldProductNumber = existing.product_number;
      const oldImageFilename = existing.image_filename;
      const shop_id          = existing.shop_id;

      // update row
      db.run(
        `
        UPDATE products
        SET product_number = ?,
            price_per_piece = ?,
            description = ?,
            unit = ?,
            series_id = ?,
            is_active = ?
        WHERE id = ?
        `,
        [
          product_number,
          price_per_piece,
          description,
          unit,
          series_id,
          is_active,
          id,
        ],
        (err) => {
          if (err) {
            return res.status(500).json({ error: "Failed to update product" });
          }

          // rename image on disk if product_number changed
          if (oldImageFilename && oldProductNumber !== product_number) {
            const imageDir = path.join(
              __dirname,
              "..",
              "..",
              "client",
              "public",
              "images",
              `shop-${shop_id}`,
              `series-${series_id}`
            );
            const ext     = path.extname(oldImageFilename);
            const oldPath = path.join(imageDir, oldImageFilename);
            const newName = `${product_number}${ext}`;
            const newPath = path.join(imageDir, newName);

            try {
              if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                db.run(
                  `UPDATE products SET image_filename = ? WHERE id = ?`,
                  [newName, id]
                );
              }
              // done
              return res.json({ message: "✅ Product updated" });
            } catch {
              return res.json({
                message: "⚠️ Product updated but failed to rename image",
              });
            }
          } else {
            return res.json({ message: "✅ Product updated" });
          }
        }
      );
    }
  );
});

// ————————————————————————————————————————————
// POST upload image
// ————————————————————————————————————————————
router.post("/upload", uploadOnly.single("image"), (req, res) => {
  const { shopId, seriesId } = req.body;
  if (!req.file || !shopId || !seriesId) {
    return res.status(400).json({ error: "Missing image, shopId, or seriesId" });
  }

  const finalName = req.file.originalname;
  const imageDir  = path.join(
    __dirname,
    "..",
    "..",
    "client",
    "public",
    "images",
    `shop-${shopId}`,
    `series-${seriesId}`
  );
  const destPath  = path.join(imageDir, finalName);

  try {
    fs.mkdirSync(imageDir, { recursive: true });
    fs.renameSync(req.file.path, destPath);
    res.json({ message: "✅ Image uploaded", filename: finalName });
  } catch (err) {
    console.error("❌ Image upload error:", err);
    res.status(500).json({ error: "Failed to store image" });
  }
});

/**
 * GET product by number
 */
router.get("/by-number/:productNumber", (req, res) => {
  const { productNumber } = req.params;
  const sql = `
    SELECT 
      p.id,
      p.product_number,
      p.description,
      p.price_per_piece,
      p.unit,
      p.is_active,
      p.series_id       AS product_series_id,
      p.image_filename,
      s.id               AS series_id,
      s.series_name,
      sh.id              AS shop_id,
      sh.shop_number
    FROM products p
    LEFT JOIN series s ON p.series_id = s.id
    LEFT JOIN shops  sh ON s.shop_id   = sh.id
    WHERE p.product_number = ?
  `;
  db.get(sql, [productNumber], (err, row) => {
    if (err) return res.status(500).json({ error: "Failed to fetch product by number" });
    if (!row) return res.status(404).json({ error: "Product not found" });
    if (!row.series_id && row.product_series_id) row.series_id = row.product_series_id;
    delete row.product_series_id;
    res.json(row);
  });
});

// ————————————————————————————————————————————
// NEW: GET products + colors for a shop & series (including generics & JSON fallback)
// ————————————————————————————————————————————
router.get("/shop/:shopId/series/:seriesName", (req, res) => {
  const { shopId, seriesName } = req.params;

  const sql = `
    SELECT
      p.id,
      p.product_number,
      p.series_id,
      p.price_per_piece,
      p.unit,
      sc.color       AS sc_color,
      s.colors       AS s_colors_json
    FROM products p
    JOIN series s
      ON p.series_id    = s.id
     AND s.series_name  = ?
     AND (p.shop_id     = ? OR s.is_generic = 1)
    LEFT JOIN series_colors sc
      ON sc.series_id   = s.id
    WHERE p.is_active = 1
    ORDER BY p.product_number
  `;

  db.all(sql, [seriesName, shopId], (err, rows) => {
    if (err) {
      console.error("❌ Failed to fetch products by shop/series:", err.message);
      return res.status(500).json({ error: "Failed to fetch products" });
    }

    // group and aggregate colors
    const map = {};
    rows.forEach(r => {
      if (!map[r.product_number]) {
        map[r.product_number] = {
          id: r.id,
          product_number: r.product_number,
          series_id: r.series_id,
          price_per_piece: r.price_per_piece,
          unit: r.unit,
          colors: []
        };
      }
      if (r.sc_color) {
        // push from series_colors when available
        map[r.product_number].colors.push(r.sc_color);
      }
    });

    // fallback to JSON array when no series_colors rows
    Object.values(map).forEach(prod => {
      if (prod.colors.length === 0 && prod.series_id) {
        try {
          const js = rows.find(r => r.product_number === prod.product_number).s_colors_json;
          const fallback = js ? JSON.parse(js) : [];
          prod.colors = fallback;
        } catch {
          prod.colors = [];
        }
      }
    });

    res.json(Object.values(map));
  });
});

module.exports = router;
