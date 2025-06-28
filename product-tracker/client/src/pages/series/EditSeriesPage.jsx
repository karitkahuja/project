// client/src/pages/series/EditSeriesPage.jsx

import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getSeriesById, updateSeries } from "../../api/seriesService";
import { getAllShops } from "../../api/shopService";
import Loading from "../../components/Loading";

export default function EditSeriesPage() {
  const [searchParams] = useSearchParams();
  const seriesId       = searchParams.get("id");
  const navigate       = useNavigate();

  // --- Local state ---
  const [loading, setLoading]       = useState(true);
  const [message, setMessage]       = useState("");
  const [isError, setIsError]       = useState(false);

  const [shopList, setShopList]     = useState([]);
  const [seriesData, setSeriesData] = useState(null);

  const [seriesName, setSeriesName] = useState("");
  const [unit, setUnit]             = useState("piece");
  const [isGeneric, setIsGeneric]   = useState(false);
  const [colors, setColors]         = useState([""]);

  // ------------------------------------
  // 1) Load initial series + shop data
  // ------------------------------------
  useEffect(() => {
    async function fetchData() {
      try {
        const [series, shops] = await Promise.all([
          getSeriesById(seriesId),
          getAllShops(),
        ]);
        setShopList(shops);

        // Populate form fields
        setSeriesData(series);
        setSeriesName(series.series_name || "");
        setUnit(series.unit || "piece");
        setIsGeneric(series.is_generic || false);

        // If non-generic, we expect series.colors to be an array
        if (series.is_generic) {
          setColors([]); // no series-level colors
        } else {
          // If there are existing colors, use them; otherwise at least one blank
          setColors(
            Array.isArray(series.colors) && series.colors.length > 0
              ? series.colors
              : [""]
          );
        }
      } catch (err) {
        console.error("❌ Failed to load series or shops:", err);
        setMessage("❌ Could not load series data or shops.");
        setIsError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [seriesId]);

  // --------------------------------------------------------------------
  // 2) Whenever "Generic" toggles, clear/restore the colors & unit fields
  // --------------------------------------------------------------------
  useEffect(() => {
    if (isGeneric) {
      // Switching *to* generic: clear any existing colors
      setColors([]);
      // Optionally clear unit (or leave as-is if you want to preserve it)
      setUnit("");
    } else {
      // Switching back to non-generic: ensure at least one blank color field
      if (colors.length === 0) {
        setColors([""]);
      }
      // If unit was cleared previously, set default
      if (!unit) {
        setUnit("piece");
      }
    }
  }, [isGeneric]);

  // ------------------------------------
  // 3) Helpers for managing color fields
  // ------------------------------------
  const handleColorChange = (idx, value) => {
    setColors((prev) => prev.map((c, i) => (i === idx ? value : c)));
  };
  const addColorField = () => setColors((prev) => [...prev, ""]);
  const removeColorField = (idx) =>
    setColors((prev) => prev.filter((_, i) => i !== idx));

  // --------------------------
  // 4) Form submission handler
  // --------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    // Trim out blank color entries
    const trimmedColors = colors.map((c) => c.trim()).filter((c) => c !== "");

    // 4a) Client-side validation
    if (!seriesName.trim()) {
      setMessage("⚠️ Series name is required.");
      setIsError(true);
      return;
    }
    if (!isGeneric && trimmedColors.length === 0) {
      setMessage("⚠️ At least one color is required for a non-generic series.");
      setIsError(true);
      return;
    }
    if (!isGeneric && !unit) {
      setMessage("⚠️ Unit is required for a non-generic series.");
      setIsError(true);
      return;
    }
    // For generic, we allow unit to be blank (series-level unit not strictly required),
    // but your server currently expects some "unit" value; if so, you can leave unit empty
    // or default to "piece" here.

    // 4b) Build payload
    const payload = {
      series_name: seriesName.trim(),
      is_generic:  isGeneric,
      unit:        isGeneric ? null : unit,
      colors:      isGeneric ? [] : trimmedColors,
      // Note: we do *not* send shop_id since the series’ shop is locked
    };

    try {
      await updateSeries(seriesId, payload);
      alert("✅ Series updated successfully!");
      // Once updated, go back to the shops view (or stay on series list)
      navigate("/view-shops");
    } catch (err) {
      console.error("❌ Update failed:", err);
      // Try parsing JSON error from the server if it came that way
      let serverMsg = err.message;
      try {
        serverMsg = JSON.parse(err.message).error || serverMsg;
      } catch {}
      setMessage(`❌ Update failed: ${serverMsg}`);
      setIsError(true);
    }
  };

  // ------------------------------
  // 5) While loading, show spinner
  // ------------------------------
  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loading />
      </div>
    );
  }

  // If seriesData is still null (e.g. failed to load), show a fallback
  if (!seriesData) {
    return (
      <div className="p-6 text-red-600">
        <p>⚠️ Unable to load series data.</p>
      </div>
    );
  }

  // -------------------------
  // 6) Render the edit form
  // -------------------------
  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">✏️ Edit Series</h1>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            isError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Shop Number (locked) */}
        <div>
          <label className="block font-medium mb-1 text-gray-700">
            Shop Number (locked)
          </label>
          <input
            type="text"
            value={
              shopList.find((s) => s.id === seriesData.shop_id)?.shop_number ||
              seriesData.shop_id
            }
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-100"
          />
        </div>

        {/* Series Name */}
        <div>
          <label className="block font-medium mb-1">Series Name *</label>
          <input
            type="text"
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
            required
            className="w-full border px-3 py-2 rounded"
            placeholder="e.g. P-Series"
          />
        </div>

        {/* Generic Toggle */}
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="isGeneric"
            checked={isGeneric}
            onChange={(e) => setIsGeneric(e.target.checked)}
          />
          <label htmlFor="isGeneric" className="font-medium">
            This is a <strong>Generic Series</strong>
          </label>
        </div>

        {/* Unit Selector */}
        <div>
          <label className="block font-medium mb-1">Unit *</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={isGeneric}
            className={`w-full px-3 py-2 border rounded ${
              isGeneric ? "bg-gray-100" : "bg-white"
            }`}
            required={!isGeneric}
          >
            <option value="piece">Per Piece</option>
            <option value="dozen">Per Dozen</option>
            <option value="set">Per Set</option>
            <option value="pair">Per Pair</option>
          </select>
        </div>

        {/* Color Inputs (only when not generic) */}
        {!isGeneric && (
          <div>
            <label className="block font-medium mb-1">Colors *</label>
            {colors.map((color, idx) => (
              <div key={idx} className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={color}
                  onChange={(e) => handleColorChange(idx, e.target.value)}
                  placeholder={`Color ${idx + 1}`}
                  className="flex-1 border px-3 py-2 rounded"
                  required
                />
                {colors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveColor(idx)}
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addColorField}
              className="text-sm text-blue-600 hover:underline"
            >
              + Add another color
            </button>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded"
        >
          Update Series
        </button>
      </form>
    </div>
  );
}
