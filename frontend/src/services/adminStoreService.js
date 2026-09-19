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
 * Upload a custom digital album ZIP with real-time progress callback
 */
export function uploadProductZip(id, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('productZipFile', file);

    xhr.open('POST', `${API_BASE}/products/${id}/upload-zip`);
    const headers = authHeaders();
    if (headers.Authorization) {
      xhr.setRequestHeader('Authorization', headers.Authorization);
    }

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      let json = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch (_) {}

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json);
      } else {
        reject(new Error(json.error || `Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out.'));

    xhr.send(formData);
  });
}

/**
 * Delete a product from the store (storeOnly=true) or permanently (storeOnly=false).
 * storeOnly=true: unpublishes the product and removes its ZIP, keeping the library record intact.
 * storeOnly=false: performs full safe deletion of the record and all associated assets.
 */
export async function deleteProduct(id, storeOnly = false) {
  const url = storeOnly
    ? `${API_BASE}/products/${id}?storeOnly=true`
    : `${API_BASE}/products/${id}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...authHeaders() },
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

/**
 * Get the currently active payment QR slot (1, 2, or 3)
 */
export async function getActiveQrSlot() {
  const res = await fetch(`${API_BASE}/orders/payment-qr/active`);
  return handleResponse(res);
}

/**
 * Switch the active payment QR slot (1, 2, or 3) — admin only
 */
export async function switchQrSlot(slot) {
  const res = await fetch(`${API_BASE}/orders/payment-qr/slot`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ slot }),
  });
  return handleResponse(res);
}

/**
 * Upload a new QR image for the given slot (1–3) — admin only
 */
export function uploadQrImage(slot, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('qrImage', file);

    xhr.open('POST', `${API_BASE}/orders/payment-qr/upload/${slot}`);
    const headers = authHeaders();
    if (headers.Authorization) {
      xhr.setRequestHeader('Authorization', headers.Authorization);
    }

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      let json = {};
      try { json = JSON.parse(xhr.responseText); } catch (_) {}
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json);
      } else {
        reject(new Error(json.error || `Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during QR upload.'));
    xhr.ontimeout = () => reject(new Error('QR upload timed out.'));

    xhr.send(formData);
  });
}

/**
 * Delete / reset QR image for a given slot — admin only
 */
export async function deleteQrImage(slot) {
  const res = await fetch(`${API_BASE}/orders/payment-qr/slot/${slot}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

/**
 * Get QR + pay_now_enabled settings
 */
export async function getQrSettings() {
  const res = await fetch(`${API_BASE}/orders/payment-qr/settings`);
  return handleResponse(res);
}

/**
 * Toggle Pay Now button visibility — admin only
 */
export async function updatePayNowSetting(payNowEnabled) {
  const res = await fetch(`${API_BASE}/orders/payment-qr/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ payNowEnabled }),
  });
  return handleResponse(res);
}
