// src/api/apiClient.js

import axios from "axios";
import { API_BASE_URL } from "@/constants";

// Create an Axios instance with default settings
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds timeout for all requests
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Optional: Attach Authorization header if needed in the future
// apiClient.interceptors.request.use((config) => {
//   const token = localStorage.getItem("authToken");
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// Global response interceptor for logging or error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("❌ API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
