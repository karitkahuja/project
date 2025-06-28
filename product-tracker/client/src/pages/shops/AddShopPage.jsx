// E:/Website/product-tracker/client/src/pages/shops/AddShopPage.jsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createShop } from "../../api/shopService";

const AddShopPage = () => {
  const [shopNumber, setShopNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmed = shopNumber.trim();
    if (!trimmed) {
      setError("⚠️ Please enter a valid Shop Number.");
      return;
    }

    try {
      setLoading(true);
      await createShop({ shop_number: trimmed });
      alert("✅ Shop created successfully!");
      navigate("/view-shops");
    } catch (err) {
      console.error("❌ Error creating shop:", err.message);
      setError("❌ Failed to create shop. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Add New Shop</h1>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block font-medium mb-1">Shop Number *</label>
          <input
            type="text"
            value={shopNumber}
            onChange={(e) => setShopNumber(e.target.value)}
            placeholder="e.g. 4544A"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring focus:ring-blue-200"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 rounded-md font-semibold text-white ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Saving..." : "Add Shop"}
        </button>
      </form>
    </div>
  );
};

export default AddShopPage;
