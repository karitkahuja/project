// client/src/api/productService.js

import axios from "axios";
import { API_BASE_URL } from "../constants";

// Get all products
export async function getAllProducts() {
  const response = await axios.get(`${API_BASE_URL}/api/products`);
  return response.data;
}

// Get product by ID
export async function getProductById(id) {
  const response = await axios.get(`${API_BASE_URL}/api/products/${id}`);
  return response.data;
}

// Update product details
export async function updateProduct(id, updatedData) {
  // If FormData, do multipart/form-data
  if (updatedData instanceof FormData) {
    const response = await axios.put(
      `${API_BASE_URL}/api/products/${id}`,
      updatedData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  } 
  
  // Otherwise JSON
  const response = await axios.put(
    `${API_BASE_URL}/api/products/${id}`,
    updatedData
  );
  return response.data;
}

// Get all products for a given shop + series (used by SalesPage)
export async function getProductsByShopAndSeries(shopId, seriesName) {
  const response = await axios.get(
    `${API_BASE_URL}/api/products/shop/${shopId}/series/${encodeURIComponent(seriesName)}`
  );
  return response.data;
}
