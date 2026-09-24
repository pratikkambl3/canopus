/* ================================================================
   CANOPUS — Auth Service
   JWT-based authentication against the self-hosted Express backend.
   Token is stored in localStorage under the key 'canopus_token'.
   ================================================================ */

const TOKEN_KEY = 'canopus_token';
const API_BASE  = import.meta.env.VITE_API_URL || '/api';

/* ── Token helpers ── */

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function isTokenExpired(token) {
  try {
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(atob(payloadB64));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/* ── Public API ── */

/**
 * Sign in with email + password.
 * Stores JWT in localStorage on success.
 */
export async function signIn(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || 'Login failed.');
  }

  const { token } = await res.json();
  setToken(token);

  // Decode the JWT payload (no signature verification needed — server already did that)
  // and notify all auth listeners so AdminPage transitions immediately without a refresh.
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    _notifyListeners({ email: payload.email, role: payload.role });
  } catch {
    _notifyListeners({ email, role: 'admin' });
  }

  return token;
}

/**
 * Sign out — removes token from localStorage.
 * Also notifies the backend (fire-and-forget).
 */
export async function signOut() {
  const token = getToken();
  clearToken();
  if (token) {
    fetch(`${API_BASE}/auth/logout`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  // Notify any auth listeners
  _notifyListeners(null);
}

/* ── Auth state listeners (replaces onAuthStateChanged) ── */

const _listeners = new Set();

export function onAuthChange(callback) {
  _listeners.add(callback);

  // Immediately invoke with current state
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    callback(null);
  } else {
    // Verify token with the backend (async, non-blocking)
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.ok) return res.json();
        clearToken();
        return null;
      })
      .then(user => callback(user))
      .catch(() => {
        clearToken();
        callback(null);
      });
  }

  // Return unsubscribe function (mirrors Firebase API)
  return () => _listeners.delete(callback);
}

function _notifyListeners(user) {
  _listeners.forEach(cb => cb(user));
}
