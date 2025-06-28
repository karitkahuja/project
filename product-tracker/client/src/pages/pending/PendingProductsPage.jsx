// client/src/pages/pending/PendingProductsPage.jsx

import React, { useState, useEffect, useMemo } from "react";
import { getAllShopsWithSeries }         from "../../api/shopService";
import { getTotalPending, getInTransit } from "../../api/pendingOrdersService";

export default function PendingProductsPage() {
  const [shops, setShops]               = useState([]);
  const [shopId, setShopId]             = useState("");
  const [seriesName, setSeriesName]     = useState("");
  const [pendingRows, setPendingRows]   = useState([]);
  const [inTransitRows, setInTransitRows] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [searchText, setSearchText]     = useState("");

  // 1️⃣ Load shops & series
  useEffect(() => {
    getAllShopsWithSeries()
      .then(setShops)
      .catch(console.error);
  }, []);

  // 2️⃣ Fetch data when shop/series change
  useEffect(() => {
    if (!shopId || !seriesName) return;
    setLoading(true);
    Promise.all([
      getTotalPending(shopId, seriesName),
      getInTransit(shopId, seriesName),
    ])
      .then(([pending, inTransit]) => {
        setPendingRows(pending);
        setInTransitRows(inTransit);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [shopId, seriesName]);

  // 3️⃣ Build list of distinct products
  const products = useMemo(() => {
    return Array.from(
      new Set(pendingRows.map(r => r.product_number))
    ).sort();
  }, [pendingRows]);

  // 4️⃣ Group by product → per-color stats + totals
  const productGroups = useMemo(() => {
    return products.map(prod => {
      const map = {};
      // accumulate pending
      pendingRows
        .filter(r => r.product_number === prod)
        .forEach(r => {
          const c = r.color.trim().toUpperCase();
          map[c] = map[c] || { color: c, pending: 0, transit: 0 };
          map[c].pending += r.pending_quantity;
        });
      // accumulate in-transit
      inTransitRows
        .filter(r => r.product_number === prod)
        .forEach(r => {
          const c = r.color.trim().toUpperCase();
          map[c] = map[c] || { color: c, pending: 0, transit: 0 };
          map[c].transit += r.in_transit_quantity;
        });
      const rows = Object.values(map);
      const totals = {
        pending: rows.reduce((sum, r) => sum + r.pending, 0),
        transit: rows.reduce((sum, r) => sum + r.transit, 0),
      };
      return { product: prod, rows, totals };
    });
  }, [products, pendingRows, inTransitRows]);

  // 5️⃣ Filter by search text
  const filteredGroups = useMemo(() => {
    const txt = searchText.toLowerCase();
    return productGroups.filter(group =>
      group.product.toLowerCase().includes(txt) ||
      group.rows.some(r => r.color.toLowerCase().includes(txt))
    );
  }, [searchText, productGroups]);

  // 6️⃣ Image URL builder
  const buildImageUrl = (shopId, series, prod) => {
    const shop = shops.find(s => s.shop_id === Number(shopId));
    const sr   = shop?.series_list.find(x => x.series_name === series);
    return `/images/shop-${shopId}/series-${sr?.series_id}/${prod}`;
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">
        📊 Pending vs. In-Transit by Product
      </h2>

      {/* ─── Filters + Search ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          className="border px-3 py-2 rounded"
          value={shopId}
          onChange={e => {
            setShopId(e.target.value);
            setSeriesName("");
          }}
        >
          <option value="">Select Shop…</option>
          {shops.map(s => (
            <option key={s.shop_id} value={s.shop_id}>
              Shop {s.shop_number}
            </option>
          ))}
        </select>

        <select
          className="border px-3 py-2 rounded flex-1 min-w-[200px]"
          value={seriesName}
          onChange={e => setSeriesName(e.target.value)}
          disabled={!shopId}
        >
          <option value="">Select Series…</option>
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
          placeholder="Search product or color…"
          className="border px-3 py-2 rounded flex-1 min-w-[200px]"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
      </div>

      {/* ─── Status Messages or Grid ───────────────────────────── */}
      {loading ? (
        <p>Loading data…</p>
      ) : !shopId || !seriesName ? (
        <p className="text-gray-500">
          Please select both a shop and series above.
        </p>
      ) : filteredGroups.length === 0 ? (
        <p className="text-gray-500">
          No pending products found for this series / search.
        </p>
      ) : (
        /* ─── Grid of Product Cards ───────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredGroups.map(group => (
            <div
              key={group.product}
              className="border rounded-lg bg-white shadow-sm overflow-hidden"
            >
              {/* Image */}
              <div className="p-4 flex justify-center">
                <img
                  src={`${buildImageUrl(
                    shopId,
                    seriesName,
                    group.product
                  )}.jpg`}
                  onError={e => {
                    if (!e.currentTarget.src.endsWith(".png")) {
                      e.currentTarget.src = `${buildImageUrl(
                        shopId,
                        seriesName,
                        group.product
                      )}.png`;
                    }
                  }}
                  alt={group.product}
                  className="w-48 h-48 object-contain bg-gray-100 rounded"
                />
              </div>

              {/* Header */}
              <div className="px-4 pb-2">
                <h3 className="text-lg font-medium">{group.product}</h3>
              </div>

              {/* Table */}
              <div className="overflow-x-auto px-4 pb-4">
                <table className="min-w-full table-auto text-sm border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-1 border text-left">Color</th>
                      <th className="px-2 py-1 border text-right">Pending</th>
                      <th className="px-2 py-1 border text-right">In-Transit</th>
                      <th className="px-2 py-1 border text-right">
                        Under Manufacture
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {group.rows.map(r => {
                      const under = r.pending - r.transit;
                      return (
                        <tr key={r.color}>
                          <td className="px-2 py-1 border">{r.color}</td>
                          <td className="px-2 py-1 border text-right text-blue-600">
                            {r.pending}
                          </td>
                          <td className="px-2 py-1 border text-right text-yellow-600">
                            {r.transit}
                          </td>
                          <td className="px-2 py-1 border text-right text-purple-600">
                            {under}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Totals row */}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-2 py-1 border">Total</td>
                      <td className="px-2 py-1 border text-right text-blue-600">
                        {group.totals.pending}
                      </td>
                      <td className="px-2 py-1 border text-right text-yellow-600">
                        {group.totals.transit}
                      </td>
                      <td className="px-2 py-1 border text-right text-purple-600">
                        {group.totals.pending - group.totals.transit}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
