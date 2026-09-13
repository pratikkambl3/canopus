/* ================================================================
   CANOPUS — Records Service
   REST API client for record/album CRUD.
   All calls go through the Express backend → PostgreSQL.
   ================================================================ */

import { getToken } from './authService';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/* ── Helpers ── */

function authHeaders() {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/* ── Public read ── */

export async function getRecords() {
  try {
    const res = await fetch(`${API_BASE}/records`);
    return await handleResponse(res);
  } catch (err) {
    console.warn('[CANOPUS] API unavailable.', err.message);
    return [];
  }
}

export async function getRecord(id) {
  try {
    const res = await fetch(`${API_BASE}/records/${id}`);
    if (res.status === 404) return null;
    return await handleResponse(res);
  } catch (err) {
    console.warn('[CANOPUS] getRecord failed.', err.message);
    return null;
  }
}

/* ── Admin write ── */

export async function addRecord(formData) {
  const res = await fetch(`${API_BASE}/records`, {
    method:  'POST',
    headers: { ...authHeaders() }, // Do NOT set Content-Type — let browser set multipart boundary
    body:    formData,
  });
  return handleResponse(res);
}

export async function updateRecord(id, formData) {
  const res = await fetch(`${API_BASE}/records/${id}`, {
    method:  'PUT',
    headers: { ...authHeaders() },
    body:    formData,
  });
  return handleResponse(res);
}

export async function deleteRecord(id) {
  const res = await fetch(`${API_BASE}/records/${id}`, {
    method:  'DELETE',
    headers: { ...authHeaders() },
  });
  return handleResponse(res);
}
