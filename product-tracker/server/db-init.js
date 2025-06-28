// server/db-init.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./productDB.sqlite');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_number TEXT UNIQUE,
    series TEXT,
    description TEXT,
    price_per_piece REAL,
    image_filename TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    order_type TEXT CHECK(order_type IN ('ordered', 'received')),
    golden_qty_dozen INTEGER,
    silver_qty_dozen INTEGER,
    order_date TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id)
  )`);
});

db.close();
console.log('✅ Database initialized.');
