// client/src/pages/sales/SalesRecordsPage.jsx

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Loading from "../../components/Loading";
import { API_BASE_URL } from "../../constants";
import { getAllShopsWithSeries } from "../../api/shopService";

// Helper: try multiple image extensions before falling back
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
        if (idx < IMAGE_EXTENSIONS.length - 1) setIdx(idx + 1);
        else {
          e.target.onerror = null;
          e.target.src = "/images/default-product.jpg";
        }
      }}
    />
  );
}

export default function WeeklySalesHistory() {
  const navigate = useNavigate();

  // Filters & lookups
  const [shops, setShops]             = useState([]);
  const [shopFilter, setShopFilter]   = useState("all");
  const [seriesOpts, setSeriesOpts]   = useState([]);
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [searchText, setSearchText]   = useState("");

  // Meta records & item groups
  const [metaRecords, setMetaRecords] = useState([]);
  const [groups, setGroups]           = useState([]); // { meta, items[] }
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  // Compute current week id for edit-button logic
  const currentWeekId = useMemo(() => {
    const d = new Date();
    // YYYY-WW
    const y = d.getUTCFullYear();
    const week = (() => {
      const target = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
      const dayNum = (target.getUTCDay() + 6) % 7;
      target.setUTCDate(target.getUTCDate() - dayNum + 3);
      const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
      return (
        1 +
        Math.round(
          (target.getTime() - firstThu.getTime()) / (7 * 24 * 60 * 60 * 1000)
        )
      );
    })();
    return `${y}-${String(week).padStart(2, "0")}`;
  }, []);

  // Load shops+series
  useEffect(() => {
    getAllShopsWithSeries()
      .then((data) => setShops(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load shops."));
  }, []);

  // Build series dropdown when shopFilter changes
  useEffect(() => {
    if (shopFilter === "all") {
      const all = shops.flatMap((s) => s.series_list || []);
      const unique = Array.from(
        new Map(all.map((x) => [x.series_name, x])).values()
      );
      setSeriesOpts(unique);
    } else {
      const shop = shops.find((s) => String(s.shop_id) === shopFilter);
      setSeriesOpts(shop?.series_list || []);
    }
    setSeriesFilter("all");
  }, [shopFilter, shops]);

  // Fetch weekly-sales meta whenever filters change
  useEffect(() => {
    setLoading(true);
    setError("");
    // build query string
    const params = [];
    if (shopFilter !== "all")   params.push(`shop_id=${shopFilter}`);
    if (seriesFilter !== "all") params.push(`series_name=${encodeURIComponent(seriesFilter)}`);
    const qs = params.length ? `?${params.join("&")}` : "";

    fetch(`${API_BASE_URL}/api/weekly-sales${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((arr) => setMetaRecords(Array.isArray(arr) ? arr : []))
      .catch(() => setError("Could not load weekly sales."))
      .finally(() => setLoading(false));
  }, [shopFilter, seriesFilter]);

  // When metaRecords load, fetch their items
  useEffect(() => {
    if (!metaRecords.length) {
      setGroups([]);
      return;
    }
    setLoading(true);
    Promise.all(
      metaRecords.map((meta) =>
        fetch(`${API_BASE_URL}/api/weekly-sales/${meta.id}/items`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((items) => ({ meta, items: Array.isArray(items) ? items : [] }))
      )
    )
      .then(setGroups)
      .catch(() => setError("Failed to load sales items."))
      .finally(() => setLoading(false));
  }, [metaRecords]);

  if (loading) return <Loading />;
  if (error)   return <p className="text-red-600 p-6">{error}</p>;

  return (
    <div className="space-y-8">
      {/* Filters + Record Sale */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-4">
          <select
            className="border px-3 py-2 rounded"
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
          >
            <option value="all">All Shops</option>
            {shops.map((s) => (
              <option key={s.shop_id} value={s.shop_id}>
                Shop {s.shop_number}
              </option>
            ))}
          </select>
          <select
            className="border px-3 py-2 rounded"
            value={seriesFilter}
            onChange={(e) => setSeriesFilter(e.target.value)}
          >
            <option value="all">All Series</option>
            {seriesOpts.map((sr) => (
              <option key={sr.series_id} value={sr.series_name}>
                {sr.series_name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search product or color…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="border px-3 py-2 rounded flex-1"
          />
        </div>
        <button
          onClick={() => navigate("/add-sales")}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Record Sale
        </button>
      </div>

      {/* Grouped Weekly Cards */}
      {groups.length === 0 ? (
        <p className="text-center text-gray-600">No sales to display.</p>
      ) : (
        groups.map(({ meta, items }) => {
          // apply search filter within this week’s items
          const filteredItems = items.filter((r) => {
            const txt = searchText.toLowerCase();
            return (
              !txt ||
              r.product_number.toLowerCase().includes(txt) ||
              r.color.toLowerCase().includes(txt)
            );
          });
          if (!filteredItems.length) return null;

          // lookup shop number
          const shopNum = shops.find((s) => s.shop_id === meta.shop_id)
            ?.shop_number;
          // build unique product list
          const prods = Array.from(
            new Set(filteredItems.map((r) => r.product_number))
          );
          // determine if this week is editable (only current week & not closed)
          const editable =
            meta.week_id === currentWeekId && meta.is_closed === 0;

          return (
            <div
              key={meta.id}
              className="bg-white rounded-lg shadow-lg p-6"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold">
                    Sales — Week {meta.week_id}
                  </h2>
                  <p className="text-gray-600">
                    Shop: {shopNum} • Series: {meta.series_name}
                  </p>
                </div>
                <div className="space-x-4">
                  <button className="text-blue-600 hover:underline">
                    Export
                  </button>
                  <button
                    onClick={() => editable && navigate("/add-sales")}
                    disabled={!editable}
                    className={`hover:underline ${
                      editable
                        ? "text-green-600"
                        : "text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {prods.map((prodNum) => {
                  // sum quantities by color
                  const byColor = filteredItems
                    .filter((r) => r.product_number === prodNum)
                    .reduce((acc, { color, quantity }) => {
                      acc[color] = (acc[color] || 0) + quantity;
                      return acc;
                    }, {});
                  // image lookup
                  const seriesObj = seriesOpts.find(
                    (s) => s.series_name === meta.series_name
                  );
                  const seriesId = seriesObj?.series_id;

                  return (
                    <div
                      key={prodNum}
                      className="border rounded-lg overflow-hidden"
                    >
                      <ProductImage
                        shopId={meta.shop_id}
                        seriesId={seriesId}
                        productNumber={prodNum}
                        alt={prodNum}
                        className="w-full h-40 object-contain bg-gray-50"
                      />
                      <div className="p-4">
                        <h3 className="text-xl font-medium text-center mb-2">
                          {prodNum}
                        </h3>
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="px-2 py-1 text-left">Color</th>
                              <th className="px-2 py-1 text-right">Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(byColor).map(
                              ([color, qty]) => (
                                <tr key={color}>
                                  <td className="px-2 py-1">{color}</td>
                                  <td className="px-2 py-1 text-right">
                                    {qty}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
