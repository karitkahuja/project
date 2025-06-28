// E:\Website\product-tracker\client\src\pages\DeleteReceivedOrderPage.jsx

import React, { useEffect, useState } from "react";

function DeleteReceivedOrderPage() {
  const [orderNumbers, setOrderNumbers] = useState([]);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState("");
  const [receivedData, setReceivedData] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/orders/metadata")
      .then((res) => res.json())
      .then((data) => {
        const unique = [...new Set(data.map((row) => row.order_number))];
        setOrderNumbers(unique);
      })
      .catch((err) => console.error("❌ Failed to load orders:", err));
  }, []);

  useEffect(() => {
    if (!selectedOrderNumber) return;

    fetch(`/api/received-quantities/by-order/${selectedOrderNumber}`)
      .then((res) => res.json())
      .then((data) => setReceivedData(data))
      .catch((err) => {
        console.error("❌ Failed to fetch received data:", err);
        setStatus("❌ Failed to fetch received data.");
      });
  }, [selectedOrderNumber]);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete all received entries for order ${selectedOrderNumber}?`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/received-quantities/${selectedOrderNumber}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete received data");
      setStatus("✅ Received data deleted.");
      setReceivedData([]);
    } catch (err) {
      console.error("❌ Delete failed:", err.message);
      setStatus("❌ Failed to delete received data.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">🗑️ Delete Received Order</h1>

      <div className="mb-4">
        <label className="block font-medium mb-1">Select Order Number</label>
        <select
          value={selectedOrderNumber}
          onChange={(e) => setSelectedOrderNumber(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="">-- Select Order --</option>
          {orderNumbers.map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
      </div>

      {receivedData.length > 0 && (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border">Product</th>
                  <th className="px-4 py-2 border">Color</th>
                  <th className="px-4 py-2 border">Qty</th>
                  <th className="px-4 py-2 border">Received Date</th>
                </tr>
              </thead>
              <tbody>
                {receivedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border">{row.product_number}</td>
                    <td className="px-4 py-2 border text-center">{row.color}</td>
                    <td className="px-4 py-2 border text-center">{row.quantity}</td>
                    <td className="px-4 py-2 border text-sm text-gray-700 text-center">
                      {new Date(row.received_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleDelete}
            className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
          >
            Delete Received Entries
          </button>
        </>
      )}

      {status && <p className="mt-4 text-blue-600">{status}</p>}
    </div>
  );
}

export default DeleteReceivedOrderPage;
