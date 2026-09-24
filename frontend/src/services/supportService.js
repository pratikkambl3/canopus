/* ================================================================
   CANOPUS — Support Service
   Client for submitting support inquiries and admin management.
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
 * Public: fetch dynamic support & email configuration from backend env
 */
export async function getSupportConfig() {
  try {
    const res = await fetch(`${API_BASE}/support/config`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Submit customer support inquiry
 */
export async function submitSupportQuery(data) {
  const res = await fetch(`${API_BASE}/support`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

/**
 * Admin: list support queries with optional status filter
 */
export async function getSupportQueries(status = 'ALL') {
  const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_BASE}/support${query}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}

/**
 * Admin: update support query status ('Open' | 'In Progress' | 'Resolved')
 */
export async function updateSupportQueryStatus(id, status) {
  const res = await fetch(`${API_BASE}/support/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
}
