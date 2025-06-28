// src/pages/orders/ViewOrdersPage.jsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import {
  getOrderDetailsByShop,
  getAllOrderDetails,
} from "../../api/orderService";
import { getAllShopsWithSeries } from "../../api/shopService";

export default function ViewOrdersPage() {
  const [shops, setShops] = useState([]);
  const [selectedShopNumber, setSelectedShopNumber] = useState("");
  const [orders, setOrders] = useState([]);
  const [viewMode, setViewMode] = useState("order"); // "order" or "product"
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Load shops + their series ONCE
  useEffect(() => {
    getAllShopsWithSeries()
      .then(data => setShops(data || []))
      .catch(err => {
        console.error("Failed to fetch shops:", err);
        alert("Unable to load shop list.");
      });
  }, []);

  // Re-fetch orders whenever shop filter changes
  useEffect(() => {
    fetchOrders();
  }, [selectedShopNumber]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const data = selectedShopNumber
        ? await getOrderDetailsByShop(selectedShopNumber)
        : await getAllOrderDetails();
      setOrders(data || []);
    } catch (err) {
      console.error("Failed to load orders:", err);
      alert("Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  const normalizeColor = c => c.trim().toUpperCase();

  // Apply search filter
  const filtered = orders.filter(r => {
    const t = searchText.trim().toLowerCase();
    return (
      r.product_number.toLowerCase().includes(t) ||
      r.order_number.toLowerCase().includes(t) ||
      r.series_name.toLowerCase().includes(t)
    );
  });

  // Grouping logic
  const groupBy = rows => {
    if (viewMode === "product") {
      // ─── Group by Product ─────────────────────────────────────────────
      const map = {};
      rows.forEach(r => {
        const {
          product_number, shop_id, series_id, series_name,
          order_number, order_date, color, pending_quantity
        } = r;
        const col = normalizeColor(color);
        if (!map[product_number]) {
          map[product_number] = { product_number, shop_id, series_id, series_name, rows: [] };
        }
        map[product_number].rows.push({
          order_number, order_date, color: col, quantity: pending_quantity
        });
      });
      return Object.values(map).sort((a, b) =>
        a.product_number.localeCompare(b.product_number, undefined, {
          numeric: true, sensitivity: "base"
        })
      );
    } else {
      // ─── Group by Order ─────────────────────────────────────────────────
      const map = {};
      rows.forEach(r => {
        const {
          order_number, order_date, shop_number, series_name,
          status, shop_id, series_id, product_number, color, pending_quantity
        } = r;
        const col = normalizeColor(color);
        if (!map[order_number]) {
          map[order_number] = {
            order_number,
            order_date,
            shop_number,
            series_name,
            status: status || "pending",
            shop_id,
            series_id,
            products: {}
          };
        }
        const pm = map[order_number].products;
        if (!pm[product_number]) {
          pm[product_number] = { product_number, shop_id, series_id, series_name, colors: {} };
        }
        pm[product_number].colors[col] =
          (pm[product_number].colors[col] || 0) + pending_quantity;
      });
      return Object.values(map);
    }
  };

  // Export a single order card to PDF
  const exportPdf = async orderNumber => {
    const el = document.getElementById(`order-card-${orderNumber}`);
    if (!el) return alert("Order card not found for export.");
    try {
      const canvas = await html2canvas(el);
      const img    = canvas.toDataURL("image/png");
      const pdf    = new jsPDF("p", "pt", "a4");
      const w      = pdf.internal.pageSize.getWidth();
      const h      = (canvas.height * w) / canvas.width;
      pdf.addImage(img, "PNG", 0, 0, w, h);
      pdf.save(`${orderNumber}.pdf`);
    } catch (err) {
      console.error("Export PDF failed:", err);
      alert("Failed to export PDF.");
    }
  };

  // Image lookup helper
  const buildImageUrl = (shopId, seriesId, prod) =>
    `/images/shop-${shopId}/series-${seriesId}/${prod}`;

  const groups = groupBy(filtered);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📦 Orders</h1>
        <button
          onClick={() => navigate("/add-order")}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          + Add Order
        </button>
      </div>

      {/* Filters & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <select
          value={selectedShopNumber}
          onChange={e => setSelectedShopNumber(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="">All Shops</option>
          {shops.map(s => (
            <option key={s.shop_id} value={s.shop_number}>
              {s.shop_number}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search product / order / series"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="border px-3 py-2 rounded flex-1 min-w-[200px]"
        />

        <div className="flex gap-2 ml-auto">
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

      {/* Content */}
      {loading ? (
        <p>Loading…</p>

      ) : viewMode === "product" ? (
        // ─── Group by Product ───────────────────────────────────────────
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {groups.map(entry => {
            // color totals
            const colorTotals = entry.rows.reduce((a, r) => {
              a[r.color] = (a[r.color] || 0) + r.quantity;
              return a;
            }, {});
            // group rows by order for the nested table
            const orderGroups = [];
            entry.rows.forEach(r => {
              const last = orderGroups[orderGroups.length - 1];
              if (!last || last.order_number !== r.order_number) {
                orderGroups.push({ order_number: r.order_number, order_date: r.order_date, rows: [r] });
              } else {
                last.rows.push(r);
              }
            });
            // resolve seriesId by name
            const shopObj = shops.find(s => s.shop_id === entry.shop_id);
            const match   = shopObj?.series_list.find(sr => sr.series_name === entry.series_name);
            const seriesId= match ? match.series_id : entry.series_id;

            return (
              <div key={entry.product_number} className="border rounded-lg bg-white shadow-sm overflow-hidden">
                <img
                  src={`${buildImageUrl(entry.shop_id, seriesId, entry.product_number)}.jpg`}
                  alt={entry.product_number}
                  onError={e => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `${buildImageUrl(entry.shop_id, seriesId, entry.product_number)}.png`;
                  }}
                  className="w-full h-32 object-contain bg-gray-100"
                />
                <div className="p-4">
                  <h3 className="text-center text-lg font-medium mb-2">
                    {entry.product_number}
                  </h3>
                  <div className="text-center italic text-sm text-gray-700 mb-4">
                    {Object.entries(colorTotals).map(([c,q])=>`${c}: ${q}`).join(" · ")}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table-fixed w-full text-xs border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-1 py-1">Order</th>
                          <th className="border px-1 py-1">Date</th>
                          <th className="border px-1 py-1">Color</th>
                          <th className="border px-1 py-1 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderGroups.map(grp =>
                          grp.rows.map((r, i) => (
                            <tr key={`${grp.order_number}-${r.color}`}>
                              {i === 0 && (
                                <td rowSpan={grp.rows.length} className="border px-1 py-1 align-top">
                                  {grp.order_number}
                                </td>
                              )}
                              {i === 0 && (
                                <td rowSpan={grp.rows.length} className="border px-1 py-1 align-top">
                                  {grp.order_date}
                                </td>
                              )}
                              <td className="border px-1 py-1">{r.color}</td>
                              <td className="border px-1 py-1 text-right">{r.quantity}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        // ─── Group by Order ─────────────────────────────────────────────
        <div className="space-y-6">
          {groups
            .sort((a,b) => {
              const da = new Date(a.order_date), db = new Date(b.order_date);
              if (db - da) return db - da;
              const na = parseInt(a.order_number.split("-")[1],10)||0;
              const nb = parseInt(b.order_number.split("-")[1],10)||0;
              return nb - na;
            })
            .map(entry => {
              // resolve series by name
              const shopObj = shops.find(s => s.shop_id === entry.shop_id);
              const match   = shopObj?.series_list.find(sr => sr.series_name === entry.series_name);
              const finalSeriesName = match?.series_name || entry.series_name;
              const finalSeriesId   = match?.series_id   || entry.series_id;

              return (
                <div
                  key={entry.order_number}
                  id={`order-card-${entry.order_number}`}
                  className="border rounded-lg bg-white shadow-md p-4"
                >
                  {/* header */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{entry.order_number}</span>
                      </div>
                      <div>📅 {entry.order_date}</div>
                      <div>🏪 Shop: {entry.shop_number}</div>
                      <div>📦 Series: {finalSeriesName}</div>
                    </div>
                    <div className="flex gap-4 text-sm mt-2">
                      <button
                        onClick={() => exportPdf(entry.order_number)}
                        className="text-blue-600 hover:underline"
                      >
                        📄 Export
                      </button>
                      <button
                        onClick={() => navigate(`/edit-order/${entry.order_number}`)}
                        disabled={entry.status?.toLowerCase() === "delivered"}
                        className={`${
                          entry.status?.toLowerCase() === "delivered"
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-blue-600 hover:underline"
                        }`}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>

                  {/* products grid */}
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
                    {Object.values(entry.products).map(prod => {
                      // re-resolve series for each product
                      const shop2 = shops.find(s => s.shop_id === prod.shop_id);
                      const m2    = shop2?.series_list.find(sr => sr.series_name === entry.series_name);
                      const prodSeriesId = m2?.series_id || prod.series_id;

                      return (
                        <div
                          key={prod.product_number}
                          className="border rounded-lg bg-gray-50 shadow-sm overflow-hidden"
                        >
                          <img
                            src={`/images/shop-${prod.shop_id}/series-${prodSeriesId}/${prod.product_number}.jpg`}
                            alt={prod.product_number}
                            onError={e => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = `/images/shop-${prod.shop_id}/series-${prodSeriesId}/${prod.product_number}.png`;
                            }}
                            className="w-full h-32 object-contain bg-white"
                          />
                          <div className="p-4">
                            <h3 className="text-center font-medium mb-2">
                              {prod.product_number}
                            </h3>
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
