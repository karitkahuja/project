import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAllShopsWithSeries } from "../../api/shopService";

export default function ViewSeriesPage() {
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAllShopsWithSeries()
      .then(data => setShops(data))
      .catch(err => {
        console.error("❌ Failed to fetch shops:", err);
        setError("Failed to load shops.");
      })
      .finally(() => setLoading(false));
  }, []);

  // find shop object
  const selectedShop = shops.find(s => s.shop_id === Number(selectedShopId));

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow space-y-6">
      <h1 className="text-2xl font-bold">📚 View Series by Shop</h1>

      {/* Shop selector */}
      <div>
        <label className="block mb-1">Select Shop</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={selectedShopId}
          onChange={e => setSelectedShopId(e.target.value)}
        >
          <option value="">-- All Shops --</option>
          {shops.map(shop => (
            <option key={shop.shop_id} value={shop.shop_id}>
              {shop.shop_number}
            </option>
          ))}
        </select>
      </div>

      {/* Series list */}
      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : selectedShop ? (
        <>
          <h2 className="text-lg font-semibold">
            Series in {selectedShop.shop_number}
          </h2>
          {selectedShop.series_list.length === 0 ? (
            <p>No series found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border">Series Name</th>
                    <th className="px-4 py-2 border">Colors</th>
                    <th className="px-4 py-2 border">Generic</th>
                    <th className="px-4 py-2 border">Unit</th>
                    <th className="px-4 py-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedShop.series_list.map(series => (
                    <tr key={series.series_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border">
                        {series.series_name}
                      </td>
                      <td className="px-4 py-2 border">
                        {series.is_generic
                          ? "—"
                          : (series.colors?.length
                              ? series.colors.join(", ")
                              : "—")}
                      </td>
                      <td className="px-4 py-2 border">
                        {series.is_generic ? "✅" : "❌"}
                      </td>
                      <td className="px-4 py-2 border">
                        {series.unit || "—"}
                      </td>
                      <td className="px-4 py-2 border space-x-4">
                        <Link
                          to={`/edit-series?id=${series.series_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </Link>
                        <Link
                          to={`/view-products?shopId=${selectedShopId}&seriesId=${series.series_id}`}
                          className="text-green-600 hover:underline"
                        >
                          View Products
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p>
          {shops.length === 0
            ? "No shops available."
            : "Please select a shop."}
        </p>
      )}
    </div>
  );
}
