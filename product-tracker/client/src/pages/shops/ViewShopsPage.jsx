// src/pages/shops/ViewShopsPage.jsx

import React, { useEffect, useState } from "react";
import { getAllShopsWithSeries } from "../../api/shopService";
import { Link } from "react-router-dom";

const ViewShopsPage = () => {
  const [shops, setShops] = useState([]);
  const [expandedShopId, setExpandedShopId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const data = await getAllShopsWithSeries();
        setShops(data);
      } catch (err) {
        console.error("❌ Failed to fetch shops:", err.message);
        setError("❌ Failed to load shops. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchShops();
  }, []);

  const toggleExpand = (shopId) => {
    setExpandedShopId((prev) => (prev === shopId ? null : shopId));
  };

  const filteredShops = shops.filter((shop) =>
    shop.shop_number.toLowerCase().includes(searchText.toLowerCase())
  );

  const downloadCSV = (shopId, seriesList) => {
    const rows = [["Series Name", "Product Number"]];
    seriesList.forEach((series) => {
      series.products?.forEach((product) => {
        rows.push([series.series_name, product.product_number]);
      });
    });

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `shop_${shopId}_products.csv`;
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-md shadow space-y-6">
      {/* Title and Add Shop Button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">🏬 View Shops</h1>
        <Link
          to="/add-shop"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow"
        >
          ➕ Add Shop
        </Link>
      </div>

      {/* 🔍 Search */}
      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search by shop number..."
        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring focus:ring-blue-200"
      />

      {/* 🔄 Loading/Error */}
      {loading && <p className="text-gray-500">Loading shops...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {/* 🏪 Shop List */}
      {!loading && filteredShops.length === 0 ? (
        <p className="text-gray-600">No shops found.</p>
      ) : (
        <div className="space-y-4">
          {filteredShops.map((shop) => (
            <div
              key={shop.shop_id}
              className="border border-gray-300 rounded p-4 bg-gray-50 shadow-sm"
            >
              {/* Header */}
              <div className="flex justify-between items-center cursor-pointer">
                <div onClick={() => toggleExpand(shop.shop_id)}>
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    {shop.shop_number}
                    {!shop.is_active && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                        Inactive
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-600">Shop ID: {shop.shop_id}</p>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <button
                    onClick={() => downloadCSV(shop.shop_id, shop.series_list)}
                    className="text-blue-600 hover:underline"
                    title="Download product CSV"
                  >
                    ⬇️ CSV
                  </button>
                  <Link
                    to={`/add-series?shopId=${shop.shop_id}`}
                    className="text-green-600 hover:underline"
                    title="Add Series"
                  >
                    ➕ Add Series
                  </Link>
                  <Link
                    to={`/edit-shop?id=${shop.shop_id}`}
                    className="text-yellow-600 hover:underline"
                    title="Edit Shop"
                  >
                    ✏️ Edit
                  </Link>
                </div>
              </div>

              {/* Series Section */}
              {expandedShopId === shop.shop_id && (
                <div className="mt-4 space-y-3">
                  {shop.series_list.map((series) => (
                    <div
                      key={series.series_id}
                      className="bg-white border rounded p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">🧬 {series.series_name}</p>
                          <p className="text-sm text-gray-500">
                            Series ID: {series.series_id} — {series.products?.length || 0} Products
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <Link
                            to={`/edit-series?id=${series.series_id}`}
                            className="text-yellow-600 text-sm hover:underline"
                          >
                            ✏️ Edit
                          </Link>
                          <Link
                            to={`/view-products?shopId=${shop.shop_id}&series=${series.series_name}`}
                            className="text-blue-600 text-sm hover:underline"
                          >
                            👁 View Products
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewShopsPage;
