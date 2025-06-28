// client/src/pages/sales/SalesPage.jsx

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Loading from "../../components/Loading";
import { API_BASE_URL } from "../../constants";
import { getAllShopsWithSeries } from "../../api/shopService";
import { getProductsByShopAndSeries } from "../../api/productService";

// Calculate ISO week string "YYYY-WW"
function getWeekId(dateStr) {
  const d = new Date(dateStr);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNo = 1 + Math.round((target - firstThu) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-${String(weekNo).padStart(2, "0")}`;
}

// Try multiple image extensions before falling back
const IMAGE_EXTENSIONS = ["jpg", "png", "jpeg", "webp", "gif"];
function ProductImage({ shopId, seriesId, productNumber, alt, className }) {
  const [idx, setIdx] = useState(0);
  const ext = IMAGE_EXTENSIONS[idx];
  const src = ext
    ? `/images/shop-${shopId}/series-${seriesId}/${productNumber}.${ext}`
    : "/images/default-product.jpg";

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        if (idx < IMAGE_EXTENSIONS.length - 1) {
          setIdx(idx + 1);
        } else {
          e.target.onerror = null;
          e.target.src = "/images/default-product.jpg";
        }
      }}
    />
  );
}

export default function WeeklySalesPage() {
  const navigate = useNavigate();

  // — Lookups —
  const [shops, setShops] = useState([]);
  const [shopFilter, setShopFilter] = useState("");
  const [seriesList, setSeriesList] = useState([]);
  const [seriesFilter, setSeriesFilter] = useState("");

  // — Products & Stock —
  const [products, setProducts] = useState([]);
  const [stockData, setStockData] = useState([]);

  // — Weekly-meta & items —
  const [metaId, setMetaId] = useState(null);
  const [isClosed, setIsClosed] = useState(false);
  const [items, setItems] = useState([]);

  // — UI state —
  const [selections, setSelections] = useState({});
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load shops on mount
  useEffect(() => {
    setLoading(true);
    getAllShopsWithSeries()
      .then((data) => setShops(Array.isArray(data) ? data : []))
      .catch(() => setError("Could not load shops."))
      .finally(() => setLoading(false));
  }, []);

  // When shop changes → reset everything downstream
  useEffect(() => {
    setSeriesFilter("");
    setSeriesList([]);
    setProducts([]);
    setStockData([]);
    setMetaId(null);
    setIsClosed(false);
    setItems([]);
    setSelections({});

    const shop = shops.find((s) => String(s.shop_id) === shopFilter);
    if (shop?.series_list) {
      setSeriesList(shop.series_list);
    }
  }, [shopFilter, shops]);

  // When shop/series/date change → init or fetch that week’s meta, then load items, products, stock
  useEffect(() => {
    if (!shopFilter || !seriesFilter || !saleDate) return;

    const shopId = Number(shopFilter);
    const weekId = getWeekId(saleDate);
    setLoading(true);
    setError("");

    // 1) Create or fetch weekly-meta
    fetch(`${API_BASE_URL}/api/weekly-sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, series_name: seriesFilter, week_id: weekId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to init weekly sales");
        return res.json();
      })
      .then((meta) => {
        setMetaId(meta.id);
        setIsClosed(Boolean(meta.is_closed));
        // 2) Load existing items
        return fetch(`${API_BASE_URL}/api/weekly-sales/${meta.id}/items`);
      })
      .then((res) => (res.ok ? res.json() : Promise.reject("Failed to fetch items")))
      .then((arr) => {
        setItems(Array.isArray(arr) ? arr : []);
        // Prefill selections
        const sel = {};
        arr.forEach(({ id, product_number, color, quantity }) => {
          sel[product_number] = sel[product_number] || {};
          sel[product_number][color] = { qty: String(quantity), id };
        });
        setSelections(sel);
      })
      .catch((err) => setError(err.message || "Error initializing sales"))
      .finally(() => setLoading(false));

    // 3) Fetch product list (now includes generic series)
    getProductsByShopAndSeries(shopId, seriesFilter)
      .then((arr) => {
        arr.sort((a, b) =>
          parseInt(a.product_number.split("-")[1] || "0", 10) -
          parseInt(b.product_number.split("-")[1] || "0", 10)
        );
        setProducts(arr);
      })
      .catch(() => setProducts([]));

    // 4) Fetch current stock
    fetch(`${API_BASE_URL}/api/stock/${shopId}/${encodeURIComponent(seriesFilter)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((js) => setStockData(Array.isArray(js) ? js : []))
      .catch(() => setStockData([]));
  }, [shopFilter, seriesFilter, saleDate]);

  // Build stock lookup map
  const stockMap = useMemo(() => {
    const m = {};
    stockData.forEach((r) => {
      m[r.product_number] = m[r.product_number] || {};
      m[r.product_number][r.color] = r.stock_on_hand;
    });
    return m;
  }, [stockData]);

  // Toggle product row
  const toggleProduct = (prodNum) => {
    setSelections((prev) => {
      if (prev[prodNum]) {
        const { [prodNum]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [prodNum]: {} };
    });
  };

  // Update a quantity cell
  const updateQty = (prodNum, color, value) => {
    setSelections((prev) => ({
      ...prev,
      [prodNum]: {
        ...prev[prodNum],
        [color]: {
          qty: value,
          id: prev[prodNum]?.[color]?.id || null,
        },
      },
    }));
  };

  // Save all lines
  const handleSave = async () => {
    if (!metaId) return;
    setLoading(true);
    try {
      for (const [prodNum, colorMap] of Object.entries(selections)) {
        for (const [color, { qty, id }] of Object.entries(colorMap)) {
          const qtyNum = Number(qty);
          if (!qtyNum) continue;
          const avail = stockMap[prodNum]?.[color] || 0;
          if (qtyNum > avail) {
            throw new Error(`Cannot sell ${qtyNum} of ${prodNum} (${color}), only ${avail} in stock.`);
          }
          const baseUrl = `${API_BASE_URL}/api/weekly-sales/${metaId}/items`;
          if (id) {
            const resp = await fetch(`${baseUrl}/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ quantity: qtyNum }),
            });
            if (!resp.ok) throw new Error("Failed to update line");
          } else {
            const resp = await fetch(baseUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ product_number: prodNum, color, quantity: qtyNum }),
            });
            if (!resp.ok) throw new Error("Failed to add line");
          }
        }
      }

      // Refresh items and stock
      const freshItems = await fetch(`${API_BASE_URL}/api/weekly-sales/${metaId}/items`).then((r) => r.json());
      setItems(freshItems);
      const newSel = {};
      freshItems.forEach(({ id, product_number, color, quantity }) => {
        newSel[product_number] = newSel[product_number] || {};
        newSel[product_number][color] = { qty: String(quantity), id };
      });
      setSelections(newSel);

      const rows = await fetch(`${API_BASE_URL}/api/stock/${shopFilter}/${encodeURIComponent(seriesFilter)}`).then((r) => r.json());
      setStockData(Array.isArray(rows) ? rows : []);

      alert("Saved weekly sales successfully!");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Close the week
  const handleClose = async () => {
    if (!metaId || isClosed) return;
    if (!window.confirm("Close this week? No further edits allowed.")) return;

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/weekly-sales/${metaId}/close`, {
        method: "POST",
      });
      if (!resp.ok) throw new Error("Failed to close week");
      setIsClosed(true);
      alert("Week closed — edits are now locked.");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <p className="text-red-600 p-6">{error}</p>;

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">💰 Weekly Sales</h1>
        <div className="space-x-2">
          <button
            onClick={() => navigate("/sales")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            View Sales History
          </button>
          <button
            onClick={handleClose}
            disabled={!metaId || isClosed}
            className={`px-4 py-2 rounded ${
              isClosed
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {isClosed ? "Week Closed" : "Close Week"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block mb-1 font-medium">Shop</label>
          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            disabled={isClosed}
          >
            <option value="">-- Select Shop --</option>
            {shops.map((s) => (
              <option key={s.shop_id} value={s.shop_id}>
                Shop {s.shop_number}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Series</label>
          <select
            value={seriesFilter}
            onChange={(e) => setSeriesFilter(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            disabled={isClosed || !seriesList.length}
          >
            <option value="">-- Select Series --</option>
            {seriesList.map((sr) => (
              <option key={sr.series_id} value={sr.series_name}>
                {sr.series_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Sale Date</label>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            disabled={isClosed}
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-6">
        {products.map((prod) => {
          const availMap = stockMap[prod.product_number] || {};
          const colors = Object.keys(availMap);
          const totalAvail = colors.reduce((sum, c) => sum + availMap[c], 0);
          const selected = Boolean(selections[prod.product_number]);
          const canSelect = totalAvail > 0 && !isClosed;

          return (
            <div
              key={prod.product_number}
              className="border rounded-lg p-4 flex flex-col items-center"
            >
              <ProductImage
                shopId={shopFilter}
                seriesId={prod.series_id}
                productNumber={prod.product_number}
                alt={prod.product_number}
                className="w-32 h-32 object-contain mb-2"
              />
              <div className="font-medium mb-1">{prod.product_number}</div>

              <button
                onClick={() => toggleProduct(prod.product_number)}
                disabled={!canSelect}
                className={`text-xs mb-3 ${
                  canSelect ? "text-blue-600 hover:underline" : "text-gray-400 cursor-not-allowed"
                }`}
              >
                {selected ? "Remove" : "Add"}
              </button>

              {selected &&
                colors.map((color) => {
                  const avail = availMap[color] || 0;
                  const qty = selections[prod.product_number]?.[color]?.qty || "";
                  return (
                    <div key={color} className="w-full space-y-2 mb-2">
                      <div className="flex justify-between text-xs">
                        <span>{color}</span>
                        <span>Avail: {avail}</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={avail}
                        placeholder="Qty"
                        value={qty}
                        onChange={(e) => updateQty(prod.product_number, color, e.target.value)}
                        disabled={isClosed}
                        className="w-full text-xs border rounded px-2 py-1"
                      />
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="text-center">
        <button
          onClick={handleSave}
          disabled={
            isClosed ||
            !Object.values(selections).some((cm) =>
              Object.values(cm).some((c) => Number(c.qty) > 0)
            )
          }
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg text-lg"
        >
          Save Weekly Sales
        </button>
      </div>
    </div>
  );
}
