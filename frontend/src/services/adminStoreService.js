/* ================================================================
   CANOPUS — Admin Store Service
   Protected client for Admin Product & Order Management.
   ================================================================ */

import { getToken } from './authService';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Update album product settings (price, description, enabled)
 */
export async function updateProduct(id, data) {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

/**
 * Trigger one-time album ZIP generation from existing tracks
 */
export async function generateProductZip(id) {
  const res = await fetch(`${API_BASE}/products/${id}/generate-zip`, {
    method: 'POST',
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

/**
 * Upload a custom digital album ZIP
 */
export async function uploadProductZip(id, file) {
  const formData = new FormData();
  formData.append('productZipFile', file);

  const res = await fetch(`${API_BASE}/products/${id}/upload-zip`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData,
  });
  return handleResponse(res);
}

/**
 * Delete product ZIP file
 */
export async function deleteProductZip(id) {
  const res = await fetch(`${API_BASE}/products/${id}/zip`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

/**
 * List all customer orders
 */
export async function getOrders(status = 'ALL') {
  const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_BASE}/orders${query}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

/**
 * Approve customer payment, generate tokens, and email download links
 */
export async function approveOrder(id) {
  const res = await fetch(`${API_BASE}/orders/${id}/approve`, {
    method: 'POST',
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

/**
 * Reject customer order with a reason
 */
export async function rejectOrder(id, reason) {
  const res = await fetch(`${API_BASE}/orders/${id}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ reason }),
  });
  return handleResponse(res);
}

/**
 * Resend download links email to customer
 */
export async function resendOrderEmail(id) {
  const res = await fetch(`${API_BASE}/orders/${id}/resend-email`, {
    method: 'POST',
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

/**
 * Fetch global preview duration settings
 */
export async function getPreviewSettings() {
  const res = await fetch(`${API_BASE}/products/settings/preview`);
  return handleResponse(res);
}

/**
 * Update global preview duration settings
 */
export async function updatePreviewSettings(previewDurationSeconds) {
  const res = await fetch(`${API_BASE}/products/settings/preview`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ previewDurationSeconds }),
  });
  return handleResponse(res);
}

