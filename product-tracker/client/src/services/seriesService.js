// src/services/seriesService.js
import apiClient from "@/api/apiClient";

export const getSeriesList = async () => {
  const response = await apiClient.get("/series");
  return response.data;
};

export const getSeriesByShopId = async (shopId) => {
  const response = await apiClient.get(`/series/shop/${shopId}`);
  return response.data;
};
