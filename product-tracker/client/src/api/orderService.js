// src/api/orderService.js

import { API_BASE_URL } from "../constants";

/**
 * Get the next available order number.
 *   GET /api/orders/next-order-number
 */
export async function getNextOrderNumber() {
  const res = await fetch(`${API_BASE_URL}/api/orders/next-order-number`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch next order number: ${err}`);
  }
  const { nextOrderNumber } = await res.json();
  return nextOrderNumber;
}

/**
 * Create a new order.
 *   POST /api/orders
 *
 * Payload shape:
 * {
 *   shop_id:    <number>,
 *   series_name:<string>,
 *   products: [
 *     {
 *       productNumber: "<string>",
 *       quantities: { "<COLOR>": <qty>, … }
 *     },
 *     …
 *   ]
 * }
 */
export async function createOrder(orderData) {
  const res = await fetch(`${API_BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderData),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create order: ${err}`);
  }
  return await res.json();
}

/**
 * Save received quantities for a specific order.
 *   POST /api/received
 */
export async function saveReceivedQuantities(receivedData) {
  const res = await fetch(`${API_BASE_URL}/api/received`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(receivedData),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to save received quantities: ${err}`);
  }
  return await res.json();
}

/**
 * Get aggregated colour totals by product for a given shop & series.
 *   GET /api/orders/:shopId/:seriesName
 */
export async function getOrdersByShopAndSeries(shopId, seriesName) {
  const res = await fetch(
    `${API_BASE_URL}/api/orders/${shopId}/${encodeURIComponent(seriesName)}`
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch orders: ${err}`);
  }
  return await res.json();
}

/**
 * Get metadata (order_number, series_name, order_date) for a given shop.
 *   GET /api/orders/meta/:shopId
 */
export async function getOrderMetadataByShop(shopId) {
  const res = await fetch(`${API_BASE_URL}/api/orders/meta/${shopId}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch order metadata: ${err}`);
  }
  return await res.json();
}

/**
 * Get full order-colour breakdown for a specific shop.
 *   GET /api/orders/details/:shopId
 */
export async function getOrderDetailsByShop(shopId) {
  const url = `${API_BASE_URL}/api/orders/details/${shopId}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch order details for shop ${shopId}: ${err}`);
  }
  return await res.json();
}

/**
 * Get full order-colour breakdown for ALL shops.
 *   GET /api/orders/details
 */
export async function getAllOrderDetails() {
  const res = await fetch(`${API_BASE_URL}/api/orders/details`);
  if (!res.ok) {
    throw new Error("Failed to fetch all order details");
  }
  return await res.json();
}

/**
 * Get a single order’s full breakdown by its order number.
 *   GET /api/orders/by-order/:orderNumber
 */
export async function getOrderByNumber(orderNumber) {
  const res = await fetch(
    `${API_BASE_URL}/api/orders/by-order/${encodeURIComponent(orderNumber)}`
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch order ${orderNumber}: ${err}`);
  }
  return await res.json();
}

// Alias for EditOrderForm.jsx to import getOrderForEdit
export const getOrderForEdit = getOrderByNumber;

/**
 * Update (overwrite) an existing order’s shop_id, series_name, and colour lines.
 *   PUT /api/orders/:orderNumber
 */
export async function updateOrder(orderNumber, payload) {
  const res = await fetch(
    `${API_BASE_URL}/api/orders/${encodeURIComponent(orderNumber)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update order ${orderNumber}: ${err}`);
  }
  return await res.json();
}

/**
 * Get a list of all orders (order_number + order_date).
 */
export async function getAllOrders() {
  const metaRes = await fetch(`${API_BASE_URL}/api/orders/metadata`);
  if (!metaRes.ok) {
    const err = await metaRes.text();
    throw new Error(`Failed to fetch orders metadata: ${err}`);
  }
  const metas = await metaRes.json();

  const orders = [];
  for (const { order_number } of metas) {
    const detailRes = await fetch(
      `${API_BASE_URL}/api/orders/by-order/${encodeURIComponent(order_number)}`
    );
    if (!detailRes.ok) continue;
    const detail = await detailRes.json();
    orders.push({
      order_number,
      order_date: detail.order_date,
    });
  }
  return orders;
}

/**
 * Delete an order by its order_number.
 */
export async function deleteOrderByNumber(orderNumber) {
  const res = await fetch(
    `${API_BASE_URL}/api/orders/${encodeURIComponent(orderNumber)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete order ${orderNumber}: ${err}`);
  }
  return await res.json();
}
