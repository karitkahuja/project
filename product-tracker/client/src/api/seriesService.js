// src/api/seriesService.js

import { API_BASE_URL } from "../constants";

/**
 * Fetch all series from all shops
 * @returns {Promise<Array>}
 */
export async function getAllSeries() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/series`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch series: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("❌ getAllSeries Error:", error.message);
    throw error;
  }
}

/**
 * Create a new series
 * @param {{ series_name: string, colors: string[], shop_id: number }} seriesData
 * @returns {Promise<Object>}
 */
export async function createSeries(seriesData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/series`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seriesData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create series: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ createSeries Error:", error.message);
    throw error;
  }
}

/**
 * Get a specific series by its ID
 * @param {number|string} seriesId
 * @returns {Promise<Object>}
 */
export async function getSeriesById(seriesId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/series/${seriesId}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch series details: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ getSeriesById Error:", error.message);
    throw error;
  }
}

/**
 * Update a specific series
 * @param {number|string} seriesId
 * @param {{ series_name?: string, colors?: string[] }} updatedData
 * @returns {Promise<Object>}
 */
export async function updateSeries(seriesId, updatedData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/series/${seriesId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update series: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ updateSeries Error:", error.message);
    throw error;
  }
}
