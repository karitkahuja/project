// src/services/seriesColorService.js

import { API_URL } from "../constants";

// Get colors of a series
export async function getSeriesColors(seriesId) {
  const response = await fetch(`${API_URL}/series-colors/${seriesId}`);
  if (!response.ok) throw new Error("Failed to fetch series colors");
  return await response.json();
}

// Set (add or replace) colors of a series
export async function setSeriesColors(seriesId, colors) {
  const response = await fetch(`${API_URL}/series-colors/${seriesId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ colors }),
  });

  if (!response.ok) throw new Error("Failed to update series colors");
  return await response.json();
}
