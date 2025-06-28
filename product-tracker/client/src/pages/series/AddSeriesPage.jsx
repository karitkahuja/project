// client/src/pages/series/AddSeriesPage.jsx

import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getAllShops } from "../../api/shopService";
import { createSeries } from "../../api/seriesService";

export default function AddSeriesPage() {
  const [searchParams] = useSearchParams();
  // We expect ?shopId=<id> in the URL (uppercase I)
  const shopIdFromURL = searchParams.get("shopId") || "";

  const [seriesName, setSeriesName] = useState("");
  const [shopId, setShopId] = useState(shopIdFromURL);
  const [isGeneric, setIsGeneric] = useState(false);
  const [unit, setUnit] = useState("piece");
  const [colors, setColors] = useState([""]);
  const [shops, setShops] = useState([]);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const navigate = useNavigate();

  // Load all shops once on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getAllShops();
        setShops(data);
      } catch (err) {
        console.error("❌ Could not load shops", err);
        setMessage("❌ Could not load shops.");
        setIsError(true);
      }
    })();
  }, []);

  // Whenever “Generic” toggles, clear or restore colors/unit fields
  useEffect(() => {
    if (isGeneric) {
      // A generic series has no colors at this level
      setColors([]);
      // Unit can remain whatever the user last chose—it’s still valid
    } else {
      // If toggled back to non-generic, ensure at least one blank color field
      if (colors.length === 0) {
        setColors([""]);
      }
      // If unit was cleared previously, set default
      if (!unit) {
        setUnit("piece");
      }
    }
  }, [isGeneric]);

  // Helper to update a specific color text field
  const handleColorChange = (idx, value) => {
    setColors((prev) => prev.map((c, i) => (i === idx ? value : c)));
  };

  // Add a new color input row
  const addColorField = () => setColors((prev) => [...prev, ""]);

  // Remove a color input row by index
  const removeColorField = (idx) =>
    setColors((prev) => prev.filter((_, i) => i !== idx));

  // Clear any existing error message
  const clearError = () => {
    setIsError(false);
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    // 1) Basic client-side validation
    if (!seriesName.trim()) {
      setMessage("⚠️ Series name is required.");
      setIsError(true);
      return;
    }
    if (!shopId) {
      setMessage("⚠️ You must select a shop.");
      setIsError(true);
      return;
    }
    if (!isGeneric && colors.some((c) => !c.trim())) {
      setMessage("⚠️ Please fill in all color fields.");
      setIsError(true);
      return;
    }

    // 2) Build payload exactly as backend now expects
    const payload = {
      series_name: seriesName.trim(),
      shop_id: Number(shopId),       // numeric shop ID (not shop_number)
      is_generic: isGeneric,
      unit: isGeneric ? unit : unit, // always include unit (server no longer rejects missing unit)
      colors: isGeneric ? [] : colors.map((c) => c.trim()),
    };

    try {
      const created = await createSeries(payload);
      // On success, navigate back to /view-shops with this shop expanded
      const newShopId = created.series.shop_id;
      navigate(`/view-shops?expand=${newShopId}`);
    } catch (err) {
      console.error("❌ Error creating series:", err);
      // Try to parse JSON error from server if it was a JSON string
      let serverMsg;
      try {
        serverMsg = JSON.parse(err.message).error;
      } catch {
        serverMsg = err.message;
      }
      setMessage(`❌ Failed to create series: ${serverMsg}`);
      setIsError(true);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-6">➕ Add New Series</h1>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            isError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Series Name */}
        <div>
          <label className="block font-medium mb-1">Series Name *</label>
          <input
            type="text"
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="e.g. P-Series"
            required
          />
        </div>

        {/* Shop Selector */}
        <div>
          <label className="block font-medium mb-1">Select Shop *</label>
          <select
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          >
            <option value="">— Select Shop —</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shop_number}
              </option>
            ))}
          </select>
        </div>

        {/* Generic Series Toggle */}
        <div className="flex items-center space-x-2">
          <input
            id="generic"
            type="checkbox"
            checked={isGeneric}
            onChange={(e) => setIsGeneric(e.target.checked)}
          />
          <label htmlFor="generic" className="font-medium">
            This is a <strong>Generic Series</strong>{" "}
            <span className="text-gray-500">
              (each product defines its own colors/unit)
            </span>
          </label>
        </div>

        {/* Unit Selector: always sent, but disabled when generic */}
        <div>
          <label className="block font-medium mb-1">Unit *</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={isGeneric}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          >
            <option value="piece">Per Piece</option>
            <option value="set">Per Set</option>
            <option value="pair">Per Pair</option>
          </select>
        </div>

        {/* Colors Inputs: only shown when NOT generic */}
        {!isGeneric && (
          <div>
            <label className="block font-medium mb-1">Colors *</label>
            {colors.map((col, idx) => (
              <div key={idx} className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={col}
                  onChange={(e) => handleColorChange(idx, e.target.value)}
                  placeholder={`Color #${idx + 1}`}
                  className="flex-1 border border-gray-300 rounded px-3 py-2"
                  required
                />
                {colors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeColorField(idx)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addColorField}
              className="text-blue-600 hover:underline"
            >
              + Add another color
            </button>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
        >
          Save Series
        </button>
      </form>
    </div>
  );
}
