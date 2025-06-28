// client/src/pages/pending/TotalPendingPage.jsx

import React, { useState, useEffect } from "react";
import { getAllShopsWithSeries } from "../../api/shopService";
import { getTotalPending }       from "../../api/pendingOrdersService";

// “Pending” status badge
const PendingBadge = () => (
  <span className="text-xs font-semibold px-2 py-1 rounded bg-red-100 text-red-800">
    Pending
  </span>
);

export default function TotalPendingPage() {
  const [shops, setShops]           = useState([]);
  const [shopId, setShopId]         = useState("all");
  const [seriesName, setSeriesName] = useState("all");
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [viewMode, setViewMode]     = useState("order"); // "order" | "product"
  const [searchText, setSearchText] = useState("");

  // 1️⃣ Load shops & their series lists
  useEffect(() => {
    getAllShopsWithSeries()
      .then(setShops)
      .catch(console.error);
  }, []);

  // 2️⃣ Fetch “total pending” whenever shopId or seriesName changes
  useEffect(() => {
    if (!shops.length) return;
    setLoading(true);

    (async () => {
      let all = [];
      const targetShops =
        shopId === "all"
          ? shops
          : shops.filter(s => s.shop_id === Number(shopId));

      for (let s of targetShops) {
        const seriesList =
          seriesName === "all"
            ? s.series_list
            : s.series_list.filter(x => x.series_name === seriesName);

        for (let sr of seriesList) {
          const data = await getTotalPending(s.shop_id, sr.series_name);
          all = all.concat(
            (data || []).map(r => ({
              ...r,
              shop_id:     s.shop_id,
              series_name: sr.series_name
            }))
          );
        }
      }

      setRows(all);
      setLoading(false);
    })();
  }, [shops, shopId, seriesName]);

  // 3️⃣ Filter + Totals (for the bar at top)
  const filtered = rows.filter(r =>
    r.product_number.toLowerCase().includes(searchText.toLowerCase()) ||
    r.color        .toLowerCase().includes(searchText.toLowerCase())
  );
  const totals = filtered.reduce(
    (acc, r) => ({
      ordered:  acc.ordered  + r.ordered_quantity,
      received: acc.received + r.received_quantity,
      pending:  acc.pending  + r.pending_quantity
    }),
    { ordered: 0, received: 0, pending: 0 }
  );

  // 4️⃣ Helpers for shop numbering & image URLs
  const lookupShopNumber = id =>
    shops.find(s => s.shop_id === id)?.shop_number || id;

  const buildImageUrl = (shopId, seriesName, prodNum) => {
    const shop = shops.find(s => s.shop_id === shopId);
    const sr   = shop?.series_list.find(x => x.series_name === seriesName);
    return `/images/shop-${shopId}/series-${sr?.series_id}/${prodNum}`;
  };

  // 5️⃣ Grouping

  // a) Group by product
  const groupedByProduct = () => {
    const map = {};
    filtered.forEach(r => {
      if (!map[r.product_number]) {
        map[r.product_number] = { product_number: r.product_number, rows: [] };
      }
      map[r.product_number].rows.push(r);
    });
    return Object.values(map);
  };

  // b) Group by order, sorted numerically by the number after the dash
  const groupedByOrder = () => {
    const map = {};
    filtered.forEach(r => {
      if (!map[r.order_number]) {
        map[r.order_number] = {
          order_number: r.order_number,
          order_date:   r.order_date,
          shop_id:      r.shop_id,
          series_name:  r.series_name,
          rows:         []
        };
      }
      map[r.order_number].rows.push(r);
    });
    return Object.values(map).sort((a, b) => {
      const numA = parseInt(a.order_number.split("-")[1], 10) || 0;
      const numB = parseInt(b.order_number.split("-")[1], 10) || 0;
      return numA - numB;
    });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
        📊 Total Pending
      </h2>

      {/* ─── Filters & View Toggle ───────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          className="border px-3 py-2 rounded"
          value={shopId}
          onChange={e => {
            setShopId(e.target.value);
            setSeriesName("all");
          }}
        >
          <option value="all">All Shops</option>
          {shops.map(s => (
            <option key={s.shop_id} value={s.shop_id}>
              Shop {s.shop_number}
            </option>
          ))}
        </select>

        <select
          className="border px-3 py-2 rounded"
          value={seriesName}
          onChange={e => setSeriesName(e.target.value)}
          disabled={shopId === "all"}
        >
          <option value="all">All Series</option>
          {shops
            .find(s => s.shop_id === Number(shopId))
            ?.series_list.map(sr => (
              <option key={sr.series_id} value={sr.series_name}>
                {sr.series_name}
              </option>
            ))}
        </select>

        <input
          type="text"
          placeholder="Search product / color"
          className="border px-3 py-2 rounded flex-1 min-w-[200px]"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setViewMode("order")}
            className={`px-4 py-2 rounded border ${
              viewMode === "order"
                ? "bg-blue-600 text-white"
                : "bg-white text-blue-600"
            }`}
          >
            Group by order
          </button>
          <button
            onClick={() => setViewMode("product")}
            className={`px-4 py-2 rounded border ${
              viewMode === "product"
                ? "bg-blue-600 text-white"
                : "bg-white text-blue-600"
            }`}
          >
            Group by product
          </button>
        </div>
      </div>

      {/* ─── Totals Bar ───────────────────────── */}
      <div className="bg-gray-50 p-4 rounded mb-6 grid grid-cols-3 gap-4">
        <div><strong>Ordered:</strong>  {totals.ordered}</div>
        <div><strong>Received:</strong> {totals.received}</div>
        <div>
          <strong>Pending:</strong>{" "}
          <span className={totals.pending < 0 ? "text-red-600" : ""}>
            {totals.pending}
          </span>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>

      ) : viewMode === "product" ? (
        /* ─── Group by PRODUCT ───────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {groupedByProduct().map(entry => {
            // Build map of order → its rows
            const ordersMap = {};
            entry.rows.forEach(r => {
              if (!ordersMap[r.order_number]) {
                ordersMap[r.order_number] = {
                  order_number: r.order_number,
                  order_date:   r.order_date,
                  items:        []
                };
              }
              ordersMap[r.order_number].items.push(r);
            });

            // Compute per-color totals and grand total
            const colorTotals = entry.rows.reduce((acc, r) => {
              const c = r.color.trim().toUpperCase();
              acc[c] = (acc[c] || 0) + r.pending_quantity;
              return acc;
            }, {});
            const grandTotal = entry.rows.reduce(
              (sum, r) => sum + r.pending_quantity,
              0
            );

            return (
              <div
                key={entry.product_number}
                className="border rounded-lg bg-white shadow-sm overflow-hidden"
              >
                {/* Product Image */}
                <img
                  src={`${buildImageUrl(
                    entry.rows[0].shop_id,
                    entry.rows[0].series_name,
                    entry.product_number
                  )}.jpg`}
                  onError={e => {
                    if (!e.currentTarget.src.endsWith(".png")) {
                      e.currentTarget.src = `${buildImageUrl(
                        entry.rows[0].shop_id,
                        entry.rows[0].series_name,
                        entry.product_number
                      )}.png`;
                    }
                  }}
                  alt={entry.product_number}
                  className="w-full h-32 object-contain bg-gray-100"
                />

                <div className="p-4">
                  <h3 className="text-center text-lg font-medium mb-2">
                    {entry.product_number}
                  </h3>

                  {/* per‐color summary */}
                  <p className="text-center text-sm mb-4">
                    {Object.entries(colorTotals).map(([color, qty], idx, arr) => (
                      <React.Fragment key={color}>
                        {color}: {qty}{idx < arr.length - 1 && " · "}
                      </React.Fragment>
                    ))}
                  </p>

                  {/* Row‐span table */}
                  <div className="overflow-x-auto">
                    <table className="table-fixed w-full text-xs border-collapse">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-2 py-1">Order</th>
                          <th className="border px-2 py-1">Date</th>
                          <th className="border px-2 py-1">Color</th>
                          <th className="border px-2 py-1 text-right">Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(ordersMap).map(group =>
                          group.items.map((r, idx) => (
                            <tr key={`${group.order_number}-${r.color}`}>
                              {idx === 0 && (
                                <td
                                  className="border px-2 py-1"
                                  rowSpan={group.items.length}
                                >
                                  {group.order_number}
                                </td>
                              )}
                              {idx === 0 && (
                                <td
                                  className="border px-2 py-1"
                                  rowSpan={group.items.length}
                                >
                                  {group.order_date}
                                </td>
                              )}
                              <td className="border px-2 py-1">{r.color}</td>
                              <td className="border px-2 py-1 text-right">
                                {r.pending_quantity}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold border-t">
                          <td className="border px-2 py-1" colSpan={2}>
                            Total
                          </td>
                          <td className="border px-2 py-1"></td>
                          <td className="border px-2 py-1 text-right">
                            {grandTotal}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        /* ─── Group by ORDER ───────────────────────── */
        <div className="space-y-6">
          {groupedByOrder().map(order => (
            <div
              key={order.order_number}
              className="border rounded-lg bg-white shadow-md p-6"
            >
              <div className="space-y-1 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">
                    {order.order_number}
                  </span>
                  <PendingBadge />
                </div>
                <div>📅 {order.order_date}</div>
                <div>🏪 Shop: {lookupShopNumber(order.shop_id)}</div>
                <div>📦 Series: {order.series_name}</div>
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {(() => {
                  const prodMap = {};
                  order.rows.forEach(r => {
                    if (!prodMap[r.product_number]) {
                      prodMap[r.product_number] = { ...r, rows: [] };
                    }
                    prodMap[r.product_number].rows.push(r);
                  });
                  return Object.values(prodMap).map(prod => {
                    const colorTotals = prod.rows.reduce((acc, r) => {
                      const c = r.color.trim().toUpperCase();
                      acc[c] = (acc[c] || 0) + r.pending_quantity;
                      return acc;
                    }, {});

                    return (
                      <div
                        key={prod.product_number}
                        className="border rounded-lg bg-gray-50 shadow-sm overflow-hidden"
                      >
                        <img
                          src={`${buildImageUrl(
                            prod.shop_id,
                            prod.series_name,
                            prod.product_number
                          )}.jpg`}
                          onError={e => {
                            if (!e.currentTarget.src.endsWith(".png")) {
                              e.currentTarget.src = `${buildImageUrl(
                                prod.shop_id,
                                prod.series_name,
                                prod.product_number
                              )}.png`;
                            }
                          }}
                          alt={prod.product_number}
                          className="w-full h-32 object-contain bg-white"
                        />

                        <div className="p-4">
                          <h3 className="text-center font-medium mb-2">
                            {prod.product_number}
                          </h3>
                          <table className="table-fixed w-full text-xs border-collapse">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border px-1 py-1">Color</th>
                                <th className="border px-1 py-1 text-right">
                                  Pending
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(colorTotals).map(([c, q]) => (
                                <tr key={c}>
                                  <td className="border px-1 py-1">{c}</td>
                                  <td className="border px-1 py-1 text-right">
                                    {q}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
