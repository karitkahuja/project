// src/services/productService.js
import apiClient from "@/api/apiClient";

export const getAllProducts = async () => {
  const response = await apiClient.get("/products");
  return response.data;
};

export const getProductById = async (id) => {
  const response = await apiClient.get(`/products/${id}`);
  return response.data;
};

export const createProduct = async (productData) => {
  const response = await apiClient.post("/products", productData);
  return response.data;
};
