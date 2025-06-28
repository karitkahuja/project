// E:\Website\product-tracker\client\src\pages\products\EditProductPage.jsx

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAllSeries } from "../../api/seriesService";
import { getProductById, updateProduct } from "../../api/productService";
import { uploadProductImage } from "../../api/imageService";

const EditProductPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [formData, setFormData] = useState({
    product_number: "",
    price_per_piece: "",
    description: "",
    unit: "piece",
  });
  const [isActive, setIsActive] = useState(1);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [keepCurrentImage, setKeepCurrentImage] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productData, series] = await Promise.all([
          getProductById(productId),
          getAllSeries(),
        ]);
        setProduct(productData);
        setSeriesList(series);

        const seriesMatch = series.find((s) => s.id == productData.series_id);
        if (!seriesMatch) {
          console.error("❌ No matching series found for series_id:", productData.series_id);
          setError("Series not found for the selected product.");
          return;
        }

        setSelectedSeries(seriesMatch);
        setIsActive(productData.is_active || 0);

        setFormData({
          product_number: productData.product_number,
          price_per_piece: productData.price_per_piece || "",
          description: productData.description || "",
          unit: productData.unit || seriesMatch.unit || "piece",
        });
      } catch (err) {
        console.error("❌ Failed to load product or series:", err.message);
        setError("Failed to load product. Please try again.");
      }
    };

    loadData();
  }, [productId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setKeepCurrentImage(false);
    } else {
      alert("❌ Please upload a valid image.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await updateProduct(productId, {
        ...formData,
        series_id: product.series_id,
        is_active: isActive,
      });

      if (!keepCurrentImage && imageFile) {
        const uploadData = new FormData();
        uploadData.append("image", imageFile);
        uploadData.append("product_number", formData.product_number);
        uploadData.append("series_id", product.series_id);
        uploadData.append("shopId", product.shop_id);
        await uploadProductImage(uploadData);
      }

      alert("✅ Product updated successfully!");
      navigate("/view-products");
    } catch (err) {
      console.error("❌ Failed to update product:", err.message);
      alert("Update failed. Please try again.");
    }
  };

  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!product || !selectedSeries) return <p className="p-4">Loading...</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">✏️ Edit Product</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Product Number */}
        <div>
          <label className="block font-medium mb-1">Product Number *</label>
          <input
            type="text"
            name="product_number"
            value={formData.product_number}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            required
          />
        </div>

        {/* Price */}
        <div>
          <label className="block font-medium mb-1">Price Per Piece *</label>
          <input
            type="number"
            name="price_per_piece"
            value={formData.price_per_piece}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            required
            min="0"
            step="0.01"
          />
        </div>

        {/* Unit (only if series is generic) */}
        {selectedSeries.is_generic && (
          <div>
            <label className="block font-medium mb-1">Unit *</label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="piece">Per Piece</option>
              <option value="dozen">Per Dozen</option>
            </select>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block font-medium mb-1">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block font-medium mb-1">Status *</label>
          <select
            value={isActive}
            onChange={(e) => setIsActive(parseInt(e.target.value))}
            className="w-full border px-3 py-2 rounded"
          >
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>
        </div>

        {/* Existing Image */}
        {product.image_filename && (
          <div>
            <p className="text-sm mb-1">Current Image:</p>
            <img
              src={`/images/shop-${product.shop_id}/series-${product.series_id}/${product.image_filename}`}
              alt="Current Product"
              className="w-48 h-auto border rounded mb-3"
            />
          </div>
        )}

        {/* Checkbox to keep image */}
        <div className="mb-2">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={keepCurrentImage}
              onChange={() => setKeepCurrentImage(!keepCurrentImage)}
              className="mr-2"
            />
            Keep current image
          </label>
        </div>

        {/* Upload New Image */}
        {!keepCurrentImage && (
          <div>
            <label className="block font-medium mb-1">Upload New Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full"
            />
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="mt-3 w-32 h-32 object-cover border rounded"
              />
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-md"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
};

export default EditProductPage;
