// src/pages/ViewOrdersByShopPage.jsx

import React, { useEffect, useState } from "react";
import { getAllShopsWithSeries } from "../../api/shopService";
import {
  getOrdersByShopAndSeries,
  getOrderMetadataByShop,
} from "../../api/orderService";

function ViewOrdersByShopPage() {
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [seriesOptions, setSeriesOptions] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState("");
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [orderMetadata, setOrderMetadata] = useState([]);
  const [loading, setLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  // 🔄 Fetch shops and their series on mount
  useEffect(() => {
    const fetchShopsWithSeries = async () => {
      try {
        const data = await getAllShopsWithSeries();
        setShops(data);
      } catch (err) {
        console.error("❌ Failed to fetch shops:", err.message);
        alert("Failed to load shop and series data.");
      }
    };
    fetchShopsWithSeries();
  }, []);

  // 🧩 When a shop is selected, update available series
  useEffect(() => {
    if (!selectedShopId) {
      setSeriesOptions([]);
      setSelectedSeries("");
      setOrders([]);
      setOrderMetadata([]);
      return;
    }

    const shop = shops.find((s) => s.shop_id === parseInt(selectedShopId));
    setSeriesOptions(shop?.series_list || []);
    setSelectedSeries("");
    setOrders([]);
    setOrderMetadata([]);
  }, [selectedShopId, shops]);

  // 📦 Fetch order data and metadata when series is selected
  useEffect(() => {
    const fetchOrders = async () => {
      if (!selectedShopId || !selectedSeries) return;
      setLoading(true);
      try {
        const [orderRows, metaRows] = await Promise.all([
          getOrdersByShopAndSeries(selectedShopId, selectedSeries),
          getOrderMetadataByShop(selectedShopId),
        ]);
        setOrders(orderRows);
        setOrderMetadata(metaRows);
      } catch (error) {
        console.error("❌ Failed to fetch orders:", error.message);
        alert("Failed to fetch order data.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [selectedSeries, selectedShopId]);

  // 🔍 Filter orders by product number
  useEffect(() => {
    const filtered = productSearch
      ? orders.filter((entry) =>
          entry.product_number.toLowerCase().includes(productSearch.toLowerCase())
        )
      : orders;
    setFilteredOrders(filtered);
  }, [productSearch, orders]);

  const currentOrder = orderMetadata.find(
    (meta) => meta.series_name === selectedSeries
  );

  // 📤 Export to CSV via backend
  const exportToCSV = async () => {
    try {
      const response = await fetch(
        `/api/export/orders/${selectedShopId}/${encodeURIComponent(selectedSeries)}`
      );
      if (!response.ok) throw new Error("Failed to export CSV");

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `orders_shop${selectedShopId}_${selectedSeries}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("❌ Export error:", err.message);
      alert("Failed to export CSV. Please try again.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">📦 View Orders by Shop & Series</h1>

      {/* 🔘 Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block mb-1 font-medium">Select Shop</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
          >
            <option value="">-- Select Shop --</option>
            {shops.map((shop) => (
              <option key={shop.shop_id} value={shop.shop_id}>
                {shop.shop_number}
              </option>
            ))}
          </select>
        </div>

        {seriesOptions.length > 0 && (
          <div>
            <label className="block mb-1 font-medium">Select Series</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedSeries}
              onChange={(e) => setSelectedSeries(e.target.value)}
            >
              <option value="">-- Select Series --</option>
              {seriesOptions.map((series) => (
                <option key={series.series_id} value={series.series_name}>
                  {series.series_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {orders.length > 0 && (
          <div>
            <label className="block mb-1 font-medium">Search Product</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="e.g. P-1"
            />
          </div>
        )}
      </div>

      {/* 📄 Order Metadata */}
      {currentOrder && (
        <div className="mb-4 p-4 bg-gray-50 border rounded">
          <p><strong>Order Number:</strong> {currentOrder.order_number}</p>
          <p><strong>Order Date:</strong> {new Date(currentOrder.order_date).toLocaleDateString()}</p>
        </div>
      )}

      {/* 📤 CSV Export Button */}
      {filteredOrders.length > 0 && (
        <div className="mb-4 text-right">
          <button
            onClick={exportToCSV}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded"
          >
            📤 Export to CSV
          </button>
        </div>
      )}

      {/* 📊 Orders Table */}
      {loading ? (
        <p className="text-gray-500">Loading orders...</p>
      ) : filteredOrders.length > 0 ? (
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 border">Product Number</th>
                <th className="px-3 py-2 border">Color</th>
                <th className="px-3 py-2 border">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((entry, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border">{entry.product_number}</td>
                  <td className="px-3 py-2 border">{entry.color}</td>
                  <td className="px-3 py-2 border text-center">{entry.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selectedSeries ? (
        <p className="text-gray-500">No orders found for this series.</p>
      ) : null}
    </div>
  );
}

export default ViewOrdersByShopPage;
