// client/src/pages/received/ViewReceivedPage.jsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../constants";
import { getAllShopsWithSeries } from "../../api/shopService";

export default function ViewReceivedPage() {
  const [shops, setShops] = useState([]);
  const [selectedShopNumber, setSelectedShopNumber] = useState("");
  const [seriesOptions, setSeriesOptions] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState("");
  const [receivedData, setReceivedData] = useState([]);
  const [viewMode, setViewMode] = useState("order"); // "order" or "product"
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // 1️⃣ Load shops + series on mount
  useEffect(() => {
    getAllShopsWithSeries().then(setShops).catch(console.error);
  }, []);

  // 2️⃣ Update series dropdown when shop changes
  useEffect(() => {
    if (!selectedShopNumber) {
      setSeriesOptions([]);
      setSelectedSeries("");
      return;
    }
    const shop = shops.find((s) => s.shop_number === selectedShopNumber);
    setSeriesOptions(shop?.series_list.map((s) => s.series_name) || []);
    setSelectedSeries("");
  }, [selectedShopNumber, shops]);

  // 3️⃣ Fetch received entries whenever shop or series filters change
  useEffect(() => {
    fetchReceivedData();
  }, [selectedShopNumber, selectedSeries]);

  async function fetchReceivedData() {
    setLoading(true);
    try {
      let route = "/api/received/received-entries/all/all";
      if (selectedShopNumber) {
        const shop = shops.find((s) => s.shop_number === selectedShopNumber);
        const shopId = shop?.shop_id ?? "all";
        const seriesName = selectedSeries || "all";
        route = `/api/received/received-entries/${shopId}/${encodeURIComponent(
          seriesName
        )}`;
      }
      const res = await fetch(API_BASE_URL + route);
      if (!res.ok) throw new Error(await res.text());
      setReceivedData(await res.json());
    } catch (err) {
      console.error("❌ Failed to fetch received data:", err);
      setReceivedData([]);
    } finally {
      setLoading(false);
    }
  }

  // 4️⃣ Mark a receive_number as completed
  async function markAsReceived(rcvNumber) {
    if (!window.confirm(`Mark ${rcvNumber} as received?`)) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/received/mark-completed/${rcvNumber}`,
        { method: "PATCH" }
      );
      if (!res.ok) throw new Error(await res.text());
      fetchReceivedData();
    } catch (err) {
      console.error("❌ Error marking as received:", err);
      alert("Failed to mark as received.");
    }
  }

  // 5️⃣ Text search
  const filtered = receivedData.filter((r) => {
    const t = searchText.toLowerCase();
    return (
      r.product_number.toLowerCase().includes(t) ||
      r.receive_number.toLowerCase().includes(t) ||
      r.series_name.toLowerCase().includes(t)
    );
  });

  // 6️⃣ Group by order
  function groupByOrder() {
    const map = {};
    filtered.forEach((row) => {
      if (!map[row.receive_number]) {
        map[row.receive_number] = { ...row, products: {} };
      }
      const entry = map[row.receive_number];
      if (!entry.products[row.product_number]) {
        entry.products[row.product_number] = {
          product_number: row.product_number,
          shop_id:        row.shop_id,
          series_id:      row.series_id,
          series_name:    row.series_name,
          colors:         {}
        };
      }
      entry.products[row.product_number].colors[row.color] = row.quantity;
    });
    return Object.values(map).sort((a, b) =>
      b.receive_number.localeCompare(a.receive_number, undefined, {
        numeric: true,
      })
    );
  }

  // 7️⃣ Group by product (unchanged)
  function groupByProduct() {
    const map = {};
    filtered.forEach((r) => {
      if (!map[r.product_number]) {
        map[r.product_number] = { ...r, deliveries: [] };
      }
      map[r.product_number].deliveries.push(r);
    });
    return Object.values(map).sort((a, b) =>
      a.product_number.localeCompare(b.product_number, undefined, {
        numeric: true,
      })
    );
  }

  // 8️⃣ Image fallback
  function handleImgError(e) {
    e.target.onerror = null;
    const src = e.target.src;
    if (src.match(/\.jpe?g$/i)) {
      e.target.src = src.replace(/\.jpe?g$/i, ".png");
    } else {
      e.target.src = "/images/default-product.jpg";
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📦 Received Orders</h1>

      {/* Filters & Toggle */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4">
          <select
            value={selectedShopNumber}
            onChange={(e) => setSelectedShopNumber(e.target.value)}
            className="border px-3 py-2 rounded"
          >
            <option value="">All Shops</option>
            {shops.map((s) => (
              <option key={s.shop_id} value={s.shop_number}>
                Shop {s.shop_number}
              </option>
            ))}
          </select>
          <select
            value={selectedSeries}
            onChange={(e) => setSelectedSeries(e.target.value)}
            className="border px-3 py-2 rounded"
            disabled={!seriesOptions.length}
          >
            <option value="">All Series</option>
            {seriesOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search receive / product / series"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="border px-3 py-2 rounded flex-1 min-w-[240px]"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("order")}
            className={`px-4 py-2 rounded border ${
              viewMode === "order"
                ? "bg-blue-600 text-white"
                : "bg-white text-blue-600"
            }`}
          >
            Group by Order
          </button>
          <button
            onClick={() => setViewMode("product")}
            className={`px-4 py-2 rounded border ${
              viewMode === "product"
                ? "bg-blue-600 text-white"
                : "bg-white text-blue-600"
            }`}
          >
            Group by Product
          </button>
        </div>
      </div>

      {/* Add Received Order */}
      <div className="flex justify-end mb-6">
        <button
          onClick={() => navigate("/add-received-order")}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          + Add Received Order
        </button>
      </div>

      {/* Loading */}
      {loading && <p>Loading…</p>}

      {/* ─── Group by ORDER ─────────────────────────────────────────── */}
      {!loading && viewMode === "order" && (
        <div className="space-y-8">
          {groupByOrder().map((entry) => {
            const shopObj = shops.find((s) => s.shop_id === entry.shop_id);
            const shopNumber = shopObj?.shop_number ?? entry.shop_id;

            return (
              <div
                key={entry.receive_number}
                className="border rounded-lg p-6 bg-white shadow"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="font-semibold text-lg">
                      📦 {entry.receive_number}{" "}
                      <span
                        className={`ml-2 px-2 py-1 rounded-full text-xs ${
                          entry.status
                            ? "bg-green-200 text-green-800"
                            : "bg-yellow-200 text-yellow-800"
                        }`}
                      >
                        {entry.status ? "✅ Received" : "⚪ Pending"}
                      </span>
                    </h2>
                    <p className="text-sm text-gray-600">
                      🚚 Dispatch: {entry.dispatch_date || "-"} &nbsp;|&nbsp;
                      ⏱ ETA: {entry.estimated_arrival_date || "-"} &nbsp;|&nbsp;
                      🚩 Mode: {entry.mode_of_transport || "-"}
                    </p>
                    <p className="text-sm text-gray-600">
                      📅 Arrival: {entry.actual_arrival_date || "-"} &nbsp;|&nbsp;
                      🏪 Shop: {shopNumber} &nbsp;|&nbsp; Series:{" "}
                      {entry.series_name}
                    </p>
                    {entry.notes != null && (
                      <p className="text-sm text-gray-600 mt-1">
                        📦 No. of cartons: {entry.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm">
                    {!entry.status && (
                      <button
                        onClick={() => markAsReceived(entry.receive_number)}
                        className="text-blue-600 hover:underline"
                      >
                        Mark as Received
                      </button>
                    )}
                    {!entry.status && (
                      <button
                        onClick={() =>
                          navigate(`/edit-received-order/${entry.receive_number}`)
                        }
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Products Table Grid */}
                <div className="grid sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Object.values(entry.products).map((prod) => (
                    <div
                      key={prod.product_number}
                      className="bg-gray-50 border rounded p-3 overflow-hidden"
                    >
                      <img
                        src={`/images/shop-${prod.shop_id}/series-${prod.series_id}/${prod.product_number}.jpg`}
                        alt={prod.product_number}
                        className="w-full h-32 object-contain mb-2"
                        onError={handleImgError}
                      />
                      <div className="font-medium mb-1 text-center">
                        {prod.product_number}
                      </div>
                      <table className="table-fixed w-full text-xs border-collapse">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border px-1 py-1 text-left">Color</th>
                            <th className="border px-1 py-1 text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(prod.colors).map(([c, q]) => (
                            <tr key={c}>
                              <td className="border px-1 py-1">{c}</td>
                              <td className="border px-1 py-1 text-right">{q}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Group by PRODUCT (unchanged) ──────────────────────────── */}
      {!loading && viewMode === "product" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {groupByProduct().map((prod) => {
            const totals = prod.deliveries.reduce((sum, d) => {
              const clr = d.color.toLowerCase();
              sum[clr] = (sum[clr] || 0) + d.quantity;
              return sum;
            }, {});
            const batches = [];
            prod.deliveries.forEach((d) => {
              let batch = batches.find((b) => b.receive_number === d.receive_number);
              if (!batch) {
                batch = { receive_number: d.receive_number, date: d.actual_arrival_date, rows: [] };
                batches.push(batch);
              }
              batch.rows.push(d);
            });

            return (
              <div
                key={prod.product_number}
                className="border rounded-lg bg-white shadow-sm overflow-hidden"
              >
                <img
                  src={`/images/shop-${prod.shop_id}/series-${prod.series_id}/${prod.product_number}.jpg`}
                  alt={prod.product_number}
                  className="w-full h-32 object-contain"
                  onError={handleImgError}
                />
                <div className="p-4">
                  <h3 className="text-center font-medium mb-2">
                    {prod.product_number}
                  </h3>
                  <p className="text-center text-sm text-gray-600 mb-4">
                    {Object.entries(totals)
                      .map(([color, qty]) => `${color}: ${qty}`)
                      .join(", ")}
                  </p>
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-1 text-left">Batch</th>
                        <th className="px-2 py-1 text-left">Date</th>
                        <th className="px-2 py-1 text-left">Color</th>
                        <th className="px-2 py-1 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((b) =>
                        b.rows.map((r, idx) => (
                          <tr key={`${r.receive_number}-${idx}`}>
                            {idx === 0 && (
                              <td rowSpan={b.rows.length} className="px-2 py-1 align-top">
                                {b.receive_number}
                              </td>
                            )}
                            {idx === 0 && (
                              <td rowSpan={b.rows.length} className="px-2 py-1 align-top">
                                {b.date}
                              </td>
                            )}
                            <td className="px-2 py-1">{r.color}</td>
                            <td className="px-2 py-1 text-right">{r.quantity}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No entries */}
      {!loading && filtered.length === 0 && (
        <p className="text-gray-600 mt-6">No entries found.</p>
      )}
    </div>
  );
}
