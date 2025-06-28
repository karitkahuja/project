// src/api/shopService.js

import { API_BASE_URL } from "../constants";

/**
 * Get all shops
 * @returns {Promise<Array<{ shop_id: number, shop_number: string, is_active: boolean }>>}
 */
export async function getAllShops() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shops`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch shops: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("❌ getAllShops Error:", error.message);
    throw error;
  }
}

/**
 * Get a single shop by ID
 * @param {number|string} shopId
 * @returns {Promise<{ shop_id: number, shop_number: string, is_active: boolean }>}
 */
export async function getShopById(shopId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shops/${shopId}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch shop: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("❌ getShopById Error:", error.message);
    throw error;
  }
}

/**
 * Create a new shop
 * @param {{ shop_number: string }} shopData
 * @returns {Promise<Object>}
 */
export async function createShop(shopData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shopData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create shop: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ createShop Error:", error.message);
    throw error;
  }
}

/**
 * Update an existing shop
 * @param {number|string} shopId
 * @param {{ shop_number?: string, is_active?: boolean }} shopData
 * @returns {Promise<Object>}
 */
export async function updateShop(shopId, shopData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shops/${shopId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shopData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update shop: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ updateShop Error:", error.message);
    throw error;
  }
}

/**
 * Fetch all shops with their associated series
 * @returns {Promise<Array<{
 *   shop_id: number,
 *   shop_number: string,
 *   is_active: boolean,
 *   series_list: Array<{ series_id: number, series_name: string }>
 * }>>}
 */
export async function getAllShopsWithSeries() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/shops-with-series`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch shops with series: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ getAllShopsWithSeries Error:", error.message);
    throw error;
  }
}
