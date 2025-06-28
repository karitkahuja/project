// src/components/ProductCard.jsx

import React from "react";

const ProductCard = ({ product }) => {
  const imageUrl = `/images/shop-${product.shop_id}/series-${product.series_id}/${product.product_number}.jpg`;

  return (
    <div className="border rounded-lg p-4 flex flex-col items-center shadow-md hover:shadow-lg transition">
      <img
        src={imageUrl}
        alt={product.product_number}
        className="w-32 h-32 object-cover mb-3"
        onError={(e) => {
          e.target.src = "/images/default-product.jpg"; // fallback image
        }}
      />
      <div className="font-semibold text-center">{product.product_number}</div>
    </div>
  );
};

export default ProductCard;
