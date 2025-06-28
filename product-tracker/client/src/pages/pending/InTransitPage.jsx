// client/src/pages/pending/InTransitPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { getAllShopsWithSeries } from "../../api/shopService";
import { getInTransit }           from "../../api/pendingOrdersService";

// Badge for “In Transit” status
const InTransitBadge = () => (
  <span className="text-xs font-semibold px-2 py-1 rounded bg-yellow-100 text-yellow-800">
    In Transit
  </span>
);

export default function InTransitPage() {
  const [shops, setShops]           = useState([]);
  const [shopId, setShopId]         = useState("all");
  const [seriesName, setSeriesName] = useState("all");
  const [rows, setRows]             = useState([]);
  const [viewMode, setViewMode]     = useState("order"); // "order" | "product"
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading]       = useState(false);

  // Load shops & series
  useEffect(() => {
    getAllShopsWithSeries().then(setShops).catch(console.error);
  }, []);

  // Fetch “in transit” data when filters change
  useEffect(() => {
    if (!shops.length) return;
    setLoading(true);

    const fetchTagged = async (id, name) => {
      const data = await getInTransit(id, name);
      return (data || []).map(r => ({
        receive_number:      r.receive_number,
        dispatch_date:       r.dispatch_date,
        eta_date:            r.eta_date,
        transport_mode:      r.transport_mode,
        no_of_cartons:       r.notes,
        product_number:      r.product_number,
        color:               r.color,
        in_transit_quantity: r.in_transit_quantity,
        shop_id:             id,
        series_name:         name,
      }));
    };

    (async () => {
      let all = [];
      const targetShops =
        shopId === "all"
          ? shops
          : shops.filter(s => s.shop_id === Number(shopId));

      for (let shop of targetShops) {
        const seriesList =
          seriesName === "all"
            ? shop.series_list
            : shop.series_list.filter(sr => sr.series_name === seriesName);
        for (let sr of seriesList) {
          all = all.concat(await fetchTagged(shop.shop_id, sr.series_name));
        }
      }

      setRows(all);
      setLoading(false);
    })();
  }, [shops, shopId, seriesName]);

  // Filter + total
  const filtered = rows.filter(r =>
    r.product_number.toLowerCase().includes(searchText.toLowerCase()) ||
    r.color.toLowerCase().includes(searchText.toLowerCase())
  );
  const totalQty = filtered.reduce((sum, r) => sum + r.in_transit_quantity, 0);

  // Group by product
  const groupedByProduct = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      if (!map[r.product_number]) {
        map[r.product_number] = {
          product_number: r.product_number,
          rows: []
        };
      }
      map[r.product_number].rows.push(r);
    });
    return Object.values(map);
  }, [filtered]);

  // Group by order
  const groupedByOrder = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      if (!map[r.receive_number]) {
        map[r.receive_number] = {
          receive_number: r.receive_number,
          dispatch_date:  r.dispatch_date,
          eta_date:       r.eta_date,
          transport_mode: r.transport_mode,
          no_of_cartons:  r.no_of_cartons,
          shop_id:        r.shop_id,
          series_name:    r.series_name,
          rows:           [],
        };
      }
      map[r.receive_number].rows.push(r);
    });
    return Object.values(map);
  }, [filtered]);

  // Helpers
  const lookupShopNumber = id =>
    shops.find(s => s.shop_id === id)?.shop_number || id;
  const buildImageUrl = (shopId, seriesName, prodNum) => {
    const shop = shops.find(s => s.shop_id === shopId);
    const sr   = shop?.series_list.find(x => x.series_name === seriesName);
    return `/images/shop-${shopId}/series-${sr?.series_id}/${prodNum}`;
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
        🚚 Goods In Transit
      </h2>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          className="border px-3 py-2 rounded"
          value={shopId}
          onChange={e => setShopId(e.target.value)}
        >
          <option value="all">All Shops</option>
          {shops.map(s => (
            <option key={s.shop_id} value={s.shop_id}>
              {s.shop_number}
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
          {["order", "product"].map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-4 py-2 rounded border ${
                viewMode === m
                  ? "bg-blue-600 text-white"
                  : "bg-white text-blue-600"
              }`}
            >
              Group by {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Total */}
      <p className="font-semibold mb-6">Total In Transit: {totalQty}</p>

      {/* Content */}
      {loading ? (
        <p>Loading…</p>
      ) : viewMode === "product" ? (
        /* — Group by PRODUCT: 2 cards per row, no scroll wrapper — */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {groupedByProduct.map(entry => {
            const colTotals = entry.rows.reduce((acc, r) => {
              const c = r.color.trim().toUpperCase();
              acc[c] = (acc[c] || 0) + r.in_transit_quantity;
              return acc;
            }, {});
            const shipments = entry.rows.reduce((acc, r) => {
              if (!acc[r.receive_number]) acc[r.receive_number] = [];
              acc[r.receive_number].push(r);
              return acc;
            }, {});

            return (
              <div
                key={entry.product_number}
                className="border rounded-lg bg-white shadow-sm overflow-hidden"
              >
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
                  <h3 className="text-center text-lg font-medium">
                    {entry.product_number}
                  </h3>
                  <div className="text-center italic text-sm mb-2">
                    {Object.entries(colTotals)
                      .map(([c, q]) => `${c}: ${q}`)
                      .join(" · ")}
                  </div>

                  {/* TABLE NOW FITS CARD WIDTH */}
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-2 py-1 text-left">Shipment#</th>
                        <th className="border px-2 py-1 text-left">Dispatch</th>
                        <th className="border px-2 py-1 text-left">ETA</th>
                        <th className="border px-2 py-1 text-left">Mode</th>
                        <th className="border px-2 py-1 text-left">Color</th>
                        <th className="border px-2 py-1 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(shipments).map(
                        ([shipNo, recs]) =>
                          recs.map((r, idx) => (
                            <tr key={`${shipNo}-${r.color}`}>
                              <td className="border px-2 py-1">
                                {idx === 0 ? shipNo : ""}
                              </td>
                              <td className="border px-2 py-1">
                                {idx === 0 ? recs[0].dispatch_date : ""}
                              </td>
                              <td className="border px-2 py-1">
                                {idx === 0 ? recs[0].eta_date : ""}
                              </td>
                              <td className="border px-2 py-1">
                                {idx === 0 ? recs[0].transport_mode : ""}
                              </td>
                              <td className="border px-2 py-1">
                                {r.color.trim().toUpperCase()}
                              </td>
                              <td className="border px-2 py-1 text-right">
                                {r.in_transit_quantity}
                              </td>
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
      ) : (
        /* — Group by ORDER (unchanged) — */
        <div className="space-y-6">
          {[...groupedByOrder]
            .sort((a, b) => b.receive_number.localeCompare(a.receive_number))
            .map(order => (
              <div
                key={order.receive_number}
                className="border rounded-lg bg-white shadow-md p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">
                        {order.receive_number}
                      </span>
                      <InTransitBadge />
                    </div>
                    <div>📅 Dispatched: {order.dispatch_date}</div>
                    <div>⌛ ETA: {order.eta_date}</div>
                    <div>🚚 Mode: {order.transport_mode}</div>
                    <div>📦 No of Cartons: {order.no_of_cartons}</div>
                    <div>🏬 Shop: {lookupShopNumber(order.shop_id)}</div>
                    <div>📦 Series: {order.series_name}</div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
                  {Object.values(
                    order.rows.reduce((m, r) => {
                      m[r.product_number] ??= {
                        shop_id:        r.shop_id,
                        series_name:    r.series_name,
                        product_number: r.product_number,
                        rows:           []
                      };
                      m[r.product_number].rows.push(r);
                      return m;
                    }, {})
                  ).map(prod => {
                    const colorTotals = prod.rows.reduce((acc, r) => {
                      const c = r.color.trim().toUpperCase();
                      acc[c] = (acc[c] || 0) + r.in_transit_quantity;
                      return acc;
                    }, {});
                    return (
                      <div
                        key={prod.product_number}
                        className="border rounded bg-gray-50 shadow-sm overflow-hidden"
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
                        <div className="p-2">
                          <div className="text-center font-medium mb-1">
                            {prod.product_number}
                          </div>
                          <table className="table-fixed w-full text-xs border-collapse">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border px-1 py-1">Color</th>
                                <th className="border px-1 py-1 text-right">
                                  Qty
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
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
