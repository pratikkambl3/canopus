/* ================================================================
   CANOPUS — Store Service
   Public client for Products and Customer Orders.
   ================================================================ */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch all enabled products for the digital store
 */
export async function getProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    return await handleResponse(res);
  } catch (err) {
    console.warn('[Store] getProducts failed:', err.message);
    return [];
  }
}

/**
 * Fetch a single product by ID
 */
export async function getProduct(id) {
  try {
    const res = await fetch(`${API_BASE}/products/${id}`);
    if (res.status === 404) return null;
    return await handleResponse(res);
  } catch (err) {
    console.warn('[Store] getProduct failed:', err.message);
    return null;
  }
}

/**
 * Submit checkout order with payment reference (UTR)
 */
export async function createOrder(orderData) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  return handleResponse(res);
}

/**
 * Fetch order confirmation details by ID
 */
export async function getOrder(id) {
  try {
    const res = await fetch(`${API_BASE}/orders/${id}`);
    if (res.status === 404) return null;
    return await handleResponse(res);
  } catch (err) {
    console.warn('[Store] getOrder failed:', err.message);
    return null;
  }
}
