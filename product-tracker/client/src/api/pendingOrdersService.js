// client/src/api/pendingOrdersService.js
import { API_BASE_URL } from "../constants";

const BASE = `${API_BASE_URL}/api/orders`;

export async function getManufacturing(shopId, seriesName) {
  const res = await fetch(`${BASE}/manufacturing/${shopId}/${seriesName}`);
  if (!res.ok) throw new Error(`Failed to load manufacturing: ${res.statusText}`);
  return res.json();
}

export async function getInTransit(shopId, seriesName) {
  const res = await fetch(`${BASE}/in-transit/${shopId}/${seriesName}`);
  if (!res.ok) throw new Error(`Failed to load in-transit: ${res.statusText}`);
  return res.json();
}

export async function getTotalPending(shopId, seriesName) {
  const res = await fetch(`${BASE}/total-pending/${shopId}/${seriesName}`);
  if (!res.ok) throw new Error(`Failed to load total-pending: ${res.statusText}`);
  return res.json();
}
