// client/src/pages/stock/StockPage.jsx

import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../constants";
import { getAllShopsWithSeries } from "../../api/shopService";
import Loading from "../../components/Loading";

const IMAGE_EXTENSIONS = ["jpg", "png", "jpeg", "webp", "gif"];

function ProductImage({ shopId, seriesId, productNumber }) {
  const [extIndex, setExtIndex] = useState(0);
  const ext = IMAGE_EXTENSIONS[extIndex];
  const src = ext
    ? `/images/shop-${shopId}/series-${seriesId}/${productNumber}.${ext}`
    : "/images/default-product.jpg";

  return (
    <img
      src={src}
      alt={productNumber}
      className="w-full h-32 object-contain mb-2"
      onError={(e) => {
        if (extIndex < IMAGE_EXTENSIONS.length - 1) {
          setExtIndex(extIndex + 1);
        } else {
          e.target.onerror = null;
          e.target.src = "/images/default-product.jpg";
        }
      }}
    />
  );
}

export default function StockPage() {
  // Filters & data
  const [shops, setShops] = useState([]);
  const [shopFilter, setShopFilter] = useState("");
  const [seriesOptions, setSeriesOptions] = useState([]);
  const [seriesFilter, setSeriesFilter] = useState("");
  const [stockData, setStockData] = useState([]);
  const [searchText, setSearchText] = useState("");

  // Loading / error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 1) Load shops + their series
  useEffect(() => {
    getAllShopsWithSeries()
      .then((data) => {
        setShops(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch shops:", err);
        setError("Could not load shop list.");
      });
  }, []);

  // 2) When shop changes, update series dropdown
  useEffect(() => {
    if (!shopFilter) {
      setSeriesOptions([]);
      setSeriesFilter("");
    } else {
      const shop = shops.find((s) => String(s.shop_id) === shopFilter);
      const list = Array.isArray(shop?.series_list) ? shop.series_list : [];
      setSeriesOptions(list);
      setSeriesFilter("");
    }
  }, [shopFilter, shops]);

  // 3) Fetch stock-on-hand whenever filters change
  useEffect(() => {
    const fetchStock = async () => {
      setLoading(true);
      setError("");
      try {
        const shopSeg = shopFilter || "all";
        const seriesSeg = seriesFilter || "all";
        const res = await fetch(
          `${API_BASE_URL}/api/stock/${shopSeg}/${encodeURIComponent(
            seriesSeg
          )}`
        );
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setStockData(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("❌ Failed to fetch stock:", e);
        setError("Could not load stock data.");
        setStockData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, [shopFilter, seriesFilter]);

  if (loading) return <Loading />;
  if (error) return <p className="text-red-600 p-6">{error}</p>;

  // Apply text search
  const filtered = searchText
    ? stockData.filter((r) =>
        r.product_number
          .toLowerCase()
          .includes(searchText.toLowerCase())
      )
    : stockData;

  // Unique, sorted product numbers
  const products = Array.from(
    new Set(filtered.map((r) => r.product_number))
  ).sort((a, b) => {
    const na = parseInt(a.split("-")[1], 10) || 0;
    const nb = parseInt(b.split("-")[1], 10) || 0;
    return na - nb;
  });

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">📊 Stock</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        {/* Shop selector */}
        <div>
          <label className="block text-sm font-medium mb-1">Shop</label>
          <select
            className="border rounded px-3 py-2"
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
          >
            <option value="">All Shops</option>
            {shops.map((s) => (
              <option key={s.shop_id} value={s.shop_id}>
                Shop {s.shop_number}
              </option>
            ))}
          </select>
        </div>

        {/* Series selector */}
        <div>
          <label className="block text-sm font-medium mb-1">Series</label>
          <select
            className="border rounded px-3 py-2"
            value={seriesFilter}
            onChange={(e) => setSeriesFilter(e.target.value)}
            disabled={!seriesOptions.length}
          >
            <option value="">All Series</option>
            {seriesOptions.map((sr) => (
              <option key={sr.series_id} value={sr.series_name}>
                {sr.series_name}
              </option>
            ))}
          </select>
        </div>

        {/* Search box */}
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            placeholder="Search product"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((prod) => {
          const rows = filtered.filter((r) => r.product_number === prod);
          const totals = rows.reduce((acc, { color, stock_on_hand }) => {
            acc[color] = (acc[color] || 0) + (stock_on_hand || 0);
            return acc;
          }, {});
          const sumQty = Object.values(totals).reduce((a, b) => a + b, 0);
          const imgShopId = rows[0]?.shop_id;
          const imgSeriesId = rows[0]?.series_id;

          return (
            <div
              key={prod}
              className="border rounded-lg bg-white shadow-sm p-4 text-center"
            >
              <ProductImage
                shopId={imgShopId}
                seriesId={imgSeriesId}
                productNumber={prod}
              />
              <h3 className="font-medium mb-2">{prod}</h3>

              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1 text-left">Color</th>
                    <th className="border px-2 py-1 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totals).map(([color, qty]) => (
                    <tr key={color}>
                      <td className="border px-2 py-1 text-left">{color}</td>
                      <td className="border px-2 py-1 text-right">{qty}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100">
                    <td className="border px-2 py-1 font-semibold">
                      Total
                    </td>
                    <td className="border px-2 py-1 text-right font-semibold">
                      {sumQty}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}

        {products.length === 0 && (
          <p className="col-span-full text-center text-gray-600">
            No stock data found.
          </p>
        )}
      </div>
    </div>
  );
}
