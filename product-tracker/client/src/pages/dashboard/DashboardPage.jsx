import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrderDetailsByShop } from "../../api/orderService";

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [normalizationResult, setNormalizationResult] = useState(null);

  const shopId = 4544;

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await getOrderDetailsByShop(shopId);

        const totalOrdered = data.reduce((sum, row) => sum + row.ordered_quantity, 0);
        const totalReceived = data.reduce((sum, row) => sum + row.received_quantity, 0);
        const pendingTotal = data.reduce((sum, row) => sum + row.pending_quantity, 0);

        const topPendingProducts = [...data]
          .filter((row) => row.pending_quantity > 0)
          .sort((a, b) => b.pending_quantity - a.pending_quantity)
          .slice(0, 5)
          .map((row) => ({
            product_number: row.product_number,
            color: row.color,
            pending: row.pending_quantity,
          }));

        setMetrics({
          totalOrdered,
          totalReceived,
          pendingTotal,
          completionPercentage: totalOrdered > 0
            ? Math.round((totalReceived / totalOrdered) * 100)
            : 0,
          topPendingProducts,
        });
      } catch (err) {
        console.error("❌ Metrics error:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [shopId]);

  const normalizeNegatives = async () => {
    if (!window.confirm("⚠️ Are you sure you want to normalize negative quantities? This will set all pending quantities < 0 to zero.")) {
      return;
    }

    try {
      const res = await fetch("/api/orders/normalize-negatives", {
        method: "PATCH",
      });
      const data = await res.json();
      setNormalizationResult(data);
      alert(`✅ ${data.message}`);
    } catch (err) {
      alert("❌ Failed to normalize. Please check server.");
    }
  };

  if (loading) return <div className="p-6 text-gray-600">Loading dashboard...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  const {
    totalOrdered = 0,
    totalReceived = 0,
    pendingTotal = 0,
    completionPercentage = 0,
    topPendingProducts = [],
  } = metrics || {};

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-bold">📊 Dashboard</h1>

      {/* 📦 Ordered vs Received Overview */}
      <section className="bg-white rounded shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Ordered vs Received</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <StatBox label="Ordered" value={totalOrdered} color="blue" />
          <StatBox label="Received" value={totalReceived} color="green" />
          <StatBox label="Pending" value={pendingTotal} color="red" />
        </div>
      </section>

      {/* ✅ Completion Summary */}
      <section className="bg-white rounded shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Completion</h2>
        <div className="text-3xl font-bold text-green-700">{completionPercentage}% Complete</div>
      </section>

      {/* 🚨 Top 5 Pending Products */}
      <section className="bg-white rounded shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Top 5 Pending Products</h2>
        {topPendingProducts.length === 0 ? (
          <p className="text-gray-500">🎉 No pending products!</p>
        ) : (
          <table className="w-full table-auto text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-4 py-2 text-left">Product</th>
                <th className="border px-4 py-2 text-center">Color</th>
                <th className="border px-4 py-2 text-center">Pending Qty</th>
              </tr>
            </thead>
            <tbody>
              {topPendingProducts.map((item, idx) => (
                <tr key={idx}>
                  <td className="border px-4 py-2">{item.product_number}</td>
                  <td className="border px-4 py-2 text-center">{item.color}</td>
                  <td className="border px-4 py-2 text-center font-semibold text-red-600">
                    {item.pending}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 🚀 Quick Actions */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ActionLink to="/add-product" label="➕ Add Product" />
          <ActionLink to="/add-order" label="📦 Add Order" />
          <ActionLink to="/add-series" label="🎨 Add Series" />
          <button
            onClick={normalizeNegatives}
            className="bg-orange-600 text-white rounded p-4 hover:bg-orange-700 font-semibold"
          >
            🧹 Normalize Negative Quantities
          </button>
        </div>

        {normalizationResult && (
          <div className="mt-4 text-sm text-gray-600">
            <strong>{normalizationResult.message}</strong>
            {normalizationResult.affectedOrders?.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-xs">
                {normalizationResult.affectedOrders.map((order) => (
                  <li key={order}>{order}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

/* 🔵 Color map */
const colorMap = {
  blue: "bg-blue-100 text-blue-800",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
};

/* 📊 Stat box */
const StatBox = ({ label, value, color }) => (
  <div className={`${colorMap[color]} p-4 rounded shadow-sm`}>
    <div className="text-sm">{label}</div>
    <div className="text-xl font-semibold">{value}</div>
  </div>
);

/* 🔗 Action link */
const ActionLink = ({ to, label }) => (
  <Link
    to={to}
    className="bg-blue-600 text-white text-center rounded p-4 hover:bg-blue-700 font-semibold"
  >
    {label}
  </Link>
);

export default DashboardPage;
