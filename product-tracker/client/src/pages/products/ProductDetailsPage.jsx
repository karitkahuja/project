// client/src/pages/products/ProductDetailsPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProductById } from "../../api/productService";

const ProductDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await getProductById(id);
        setProduct(data);
      } catch (error) {
        console.error("❌ Error loading product:", error.message);
      }
    };
    fetchProduct();
  }, [id]);

  if (!product) {
    return (
      <div className="p-6 text-center text-gray-600">
        Loading product details...
      </div>
    );
  }

  const imageUrl = `/images/shop-${product.shop_id}/series-${product.series_id}/${product.image_filename}`;

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded-md shadow-md">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← Back
      </button>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-shrink-0">
          <img
            src={imageUrl}
            alt={product.product_number}
            className="w-64 h-64 object-contain rounded border"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/images/default-product.jpg";
            }}
          />
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-2">{product.product_number}</h1>
          <p className="text-lg font-semibold text-green-700 mb-1">
            ₹ {product.price_per_piece?.toFixed(2)}
          </p>
          <p className="text-sm text-gray-600">
            Unit: <span className="font-medium">{product.unit}</span>
          </p>
          <p className="text-sm text-gray-600">
            Series: <span className="font-medium">{product.series_name}</span>
          </p>
          <p className="text-sm text-gray-600">
            Shop No:{" "}
            <span className="font-medium">
              {product.shop_number || "Not Available"}
            </span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Status:{" "}
            <span
              className={`font-semibold ${
                product.is_active ? "text-green-600" : "text-red-600"
              }`}
            >
              {product.is_active ? "Active" : "Inactive"}
            </span>
          </p>

          <button
            onClick={() => navigate(`/edit-product/${product.id}`)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            ✏️ Edit Product
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsPage;
