/* ================================================================
   CANOPUS — Character Service & Hook
   Manages character artwork settings, upload, gallery, and dynamic hook.
   ================================================================ */

import { useState, useEffect } from 'react';
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
 * Fetch active character settings (Home URL, About URL, Shuffle Mode, Gallery)
 */
export async function getCharacterSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings/character`);
    return await handleResponse(res);
  } catch (err) {
    console.warn('[CharacterService] getCharacterSettings failed:', err.message);
    return {
      homeCharacterUrl: '/canopus-portrait.png',
      aboutCharacterUrl: '/canopus-portrait.png',
      shuffleMode: false,
      gallery: ['/canopus-portrait.png'],
    };
  }
}

/**
 * Update character settings (active home/about URLs or shuffle mode) — admin only
 */
export async function updateCharacterSettings(data) {
  const res = await fetch(`${API_BASE}/settings/character`, {
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
 * Upload a new character image file — admin only
 * @param {File} file - Image file
 * @param {string} target - 'home' | 'about' | 'both' | 'gallery'
 */
export async function uploadCharacterImage(file, target = 'both') {
  const formData = new FormData();
  formData.append('characterImage', file);
  formData.append('target', target);

  const res = await fetch(`${API_BASE}/settings/character/upload`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse(res);
}

/**
 * Reset home/about character to default portrait — admin only
 * @param {string} target - 'home' | 'about' | 'both'
 */
export async function resetCharacterSettings(target = 'both') {
  const res = await fetch(`${API_BASE}/settings/character/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ target }),
  });
  return handleResponse(res);
}

/**
 * Delete a custom character image from gallery and disk — admin only
 * @param {string} url - Image URL to delete
 */
export async function deleteCharacterImage(url) {
  const res = await fetch(`${API_BASE}/settings/character/gallery`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ url }),
  });
  return handleResponse(res);
}

/**
 * Custom React Hook to load and display the appropriate character image.
 * If shuffle mode is enabled, picks a random character from the gallery.
 * Otherwise, loads the page-specific character (home vs about).
 *
 * @param {'home' | 'about'} page
 */
export function useCharacterImage(page = 'home') {
  const [characterUrl, setCharacterUrl] = useState('/canopus-portrait.png');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getCharacterSettings()
      .then(settings => {
        if (!isMounted || !settings) return;

        if (settings.shuffleMode && Array.isArray(settings.gallery) && settings.gallery.length > 0) {
          // Shuffle mode: pick a random image from the gallery
          const randomIndex = Math.floor(Math.random() * settings.gallery.length);
          const chosen = settings.gallery[randomIndex] || '/canopus-portrait.png';
          setCharacterUrl(chosen);
        } else {
          const targetUrl = page === 'home' ? settings.homeCharacterUrl : settings.aboutCharacterUrl;
          setCharacterUrl(targetUrl || '/canopus-portrait.png');
        }
      })
      .catch(() => {
        if (isMounted) setCharacterUrl('/canopus-portrait.png');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page]);

  return { characterUrl, setCharacterUrl, loading };
}
