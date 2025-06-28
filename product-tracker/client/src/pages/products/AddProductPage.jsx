// E:\Website\product-tracker\client\src\pages\products\AddProductPage.jsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { getAllShopsWithSeries } from "../../api/shopService";
import { uploadProductImage } from "../../api/imageService";

const AddProductPage = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [productNumber, setProductNumber] = useState("");
  const [unit, setUnit] = useState("piece");
  const [pricePerPiece, setPricePerPiece] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [colors, setColors] = useState([""]); // NEW

  useEffect(() => {
    async function loadShops() {
      try {
        const data = await getAllShopsWithSeries();
        setShops(data);
      } catch (err) {
        console.error("❌ Failed to load shops:", err);
      }
    }
    loadShops();
  }, []);

  useEffect(() => {
    const shop = shops.find((s) => s.shop_id === parseInt(selectedShopId));
    setSeriesList(shop?.series_list || []);
    setSelectedSeriesId("");
    setProductNumber("");
    setSelectedSeries(null);
    setColors([""]); // Reset colors on shop change
  }, [selectedShopId, shops]);

  useEffect(() => {
    async function fetchNextProductNumber() {
      if (!selectedShopId || !selectedSeriesId) return;

      try {
        const res = await axios.get(`http://localhost:5000/api/products/next-number`, {
          params: {
            shop_id: selectedShopId,
            series_id: selectedSeriesId,
          },
        });

        if (res.data?.next_product_number) {
          setProductNumber(res.data.next_product_number);
        } else {
          console.warn("⚠️ next_product_number not returned:", res.data);
        }
      } catch (err) {
        console.error("❌ Failed to fetch next product number:", err.message);
      }
    }

    const series = seriesList.find((s) => s.series_id === parseInt(selectedSeriesId));
    setSelectedSeries(series || null);

    // Reset colors when series changes
    if (series?.is_generic) {
      setColors([""]);
    } else {
      setColors([]); // non-generic → no colors input
    }

    fetchNextProductNumber();
  }, [selectedSeriesId, selectedShopId, seriesList]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      alert("❌ Please upload a valid image file.");
    }
  };

  const handleColorChange = (index, value) => {
    setColors((prev) => prev.map((c, i) => (i === index ? value : c)));
  };

  const addColorField = () => setColors((prev) => [...prev, ""]);

  const removeColorField = (index) => {
    setColors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!image || !selectedShopId || !selectedSeriesId || !productNumber) {
      alert("❌ All required fields must be filled.");
      return;
    }

    if (selectedSeries?.is_generic && colors.some((c) => c.trim() === "")) {
      alert("❌ Please fill all color fields.");
      return;
    }

    const ext = image.name.split(".").pop();
    const finalImageName = `${productNumber}.${ext}`;

    const formData = new FormData();
    formData.append("image", image, finalImageName);
    formData.append("shopId", selectedShopId);
    formData.append("seriesId", selectedSeriesId);

    const productData = {
      product_number: productNumber,
      price_per_piece: parseFloat(pricePerPiece || 0),
      description,
      unit,
      shop_id: parseInt(selectedShopId),
      series_id: parseInt(selectedSeriesId),
      image_filename: finalImageName,
      product_colors: selectedSeries?.is_generic
        ? colors.map((c) => c.trim()).filter((c) => c !== "")
        : [],
    };

    try {
      await uploadProductImage(formData);
      await axios.post("http://localhost:5000/api/products", productData);
      alert("✅ Product added successfully");
      navigate("/view-products");
    } catch (err) {
      console.error("❌ Failed to add product:", err.message);
      alert("❌ Product could not be added.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Add New Product</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Shop Dropdown */}
        <div>
          <label className="font-semibold">Select Shop *</label>
          <select
            className="w-full mt-1 border px-3 py-2 rounded"
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
            required
          >
            <option value="">-- Select Shop --</option>
            {shops.map((shop) => (
              <option key={shop.shop_id} value={shop.shop_id}>
                {shop.shop_number}
              </option>
            ))}
          </select>
        </div>

        {/* Series Dropdown */}
        <div>
          <label className="font-semibold">Select Series *</label>
          <select
            className="w-full mt-1 border px-3 py-2 rounded"
            value={selectedSeriesId}
            onChange={(e) => setSelectedSeriesId(e.target.value)}
            required
          >
            <option value="">-- Select Series --</option>
            {seriesList.map((series) => (
              <option key={series.series_id} value={series.series_id}>
                {series.series_name}
              </option>
            ))}
          </select>
        </div>

        {/* Product Number */}
        <div>
          <label className="font-semibold">Product Number *</label>
          <input
            type="text"
            value={productNumber}
            readOnly
            className="w-full mt-1 border px-3 py-2 rounded bg-gray-100"
          />
        </div>

        {/* Unit (Only for Generic) */}
        {selectedSeries?.is_generic ? (
          <div>
            <label className="font-semibold">Unit *</label>
            <select
              className="w-full mt-1 border px-3 py-2 rounded"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
            >
              <option value="piece">Per Piece</option>
              <option value="dozen">Per Dozen</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="font-semibold">Unit</label>
            <input
              type="text"
              value={unit}
              disabled
              className="w-full mt-1 border px-3 py-2 rounded bg-gray-100"
            />
          </div>
        )}

        {/* Colors (Only for Generic) */}
        {selectedSeries?.is_generic && (
          <div>
            <label className="font-semibold">Colors *</label>
            {colors.map((color, idx) => (
              <div key={idx} className="flex space-x-2 mb-2">
                <input
                  type="text"
                  className="flex-1 border px-3 py-2 rounded"
                  value={color}
                  onChange={(e) => handleColorChange(idx, e.target.value)}
                  required
                />
                {colors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeColorField(idx)}
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
              className="text-blue-600 hover:underline text-sm"
            >
              + Add another color
            </button>
          </div>
        )}

        {/* Price */}
        <div>
          <label className="font-semibold">Price per Piece</label>
          <input
            type="number"
            step="0.01"
            className="w-full mt-1 border px-3 py-2 rounded"
            value={pricePerPiece}
            onChange={(e) => setPricePerPiece(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className="font-semibold">Description</label>
          <textarea
            className="w-full mt-1 border px-3 py-2 rounded"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Image Upload */}
        <div>
          <label className="font-semibold">Upload Product Image *</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full mt-1"
            required
          />
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="mt-2 w-32 h-32 object-cover border rounded"
            />
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Add Product
        </button>
      </form>
    </div>
  );
};

export default AddProductPage;
