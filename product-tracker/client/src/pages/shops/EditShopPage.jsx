// client/src/pages/shops/EditShopPage.jsx

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getShopById, updateShop } from "../../api/shopService";
import Loading from "../../components/Loading";

export default function EditShopPage() {
  const [searchParams] = useSearchParams();
  const shopId = searchParams.get("id");
  const navigate = useNavigate();

  const [shopNumber, setShopNumber] = useState("");
  const [isActive, setIsActive]       = useState(true);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");

  // Fetch existing shop data
  useEffect(() => {
    if (!shopId) {
      setError("❌ Invalid shop ID.");
      setLoading(false);
      return;
    }

    getShopById(shopId)
      .then(data => {
        setShopNumber(data.shop_number);
        setIsActive(data.is_active === 1);
      })
      .catch(err => {
        console.error("❌ Failed to load shop:", err);
        setError("❌ Could not load shop details.");
      })
      .finally(() => setLoading(false));
  }, [shopId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedNumber = shopNumber.trim();
    if (!trimmedNumber) {
      setError("⚠️ Shop number cannot be empty.");
      return;
    }

    try {
      setSubmitting(true);
      await updateShop(shopId, {
        shop_number: trimmedNumber,
        is_active: isActive ? 1 : 0,
      });
      setSuccess("✅ Shop updated successfully!");
      // Brief pause so user sees confirmation
      setTimeout(() => navigate("/view-shops"), 1000);
    } catch (err) {
      console.error("❌ Update error:", err);
      setError("❌ Failed to update shop. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loading />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6">✏️ Edit Shop</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block font-medium mb-1">
            Shop Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={shopNumber}
            onChange={(e) => setShopNumber(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            disabled={submitting}
            required
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            disabled={submitting}
          />
          <label htmlFor="isActive" className="ml-2 text-gray-700">
            Active (show this shop throughout the app)
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-2 text-white font-semibold rounded transition ${
            submitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
