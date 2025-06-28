// client/src/api/receivedService.js

const BASE = "/api/received";

export async function getNextReceiveNumber() {
  const res = await fetch(`${BASE}/next-number`);
  if (!res.ok) throw new Error("Failed to fetch next receive number");
  const { nextReceiveNumber } = await res.json();
  return nextReceiveNumber;
}

export async function getPendingItems(shopId, seriesName) {
  const res = await fetch(
    `${BASE}/pending/${shopId}/${encodeURIComponent(seriesName)}`
  );
  if (!res.ok) throw new Error("Failed to load pending items");
  return res.json();
}

export async function createReceive(payload) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || "Failed to save received order");
  }
  return res.json();
}

/**
 * PUT /api/received/:receiveNumber
 * Update an existing received shipment.
 * @param {string} receiveNumber
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function updateReceive(receiveNumber, payload) {
  const res = await fetch(`${BASE}/${receiveNumber}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || "Failed to update received order");
  }
  return res.json();
}

/**
 * GET a list of all received-order lines (bills), including unit and price.
 * @returns {Promise<Array<{
 *   order_number: string,
 *   received_date: string,
 *   product_number: string,
 *   color: string,
 *   quantity: number,
 *   unit: string,
 *   price: number
 * }>>}
 */
export async function getReceivedBills() {
  const res = await fetch(`${BASE}/bills`);
  if (!res.ok) throw new Error("Failed to load received bills");
  return res.json();
}
