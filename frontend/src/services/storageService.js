/* ================================================================
   CANOPUS — Storage Service
   File upload helpers using the self-hosted Express backend.
   Files are sent as multipart/form-data and stored in Docker volume.
   ================================================================ */

import { getToken } from './authService';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Upload a file with XHR so we can report progress.
 * @param {File}   file
 * @param {string} fieldName   'audioFile' | 'artworkFile'
 * @param {string} trackId     Used to namespace the filename on the server
 * @param {(pct: number) => void} onProgress
 * @returns {Promise<string>} The URL returned in the track object
 */
export function uploadFile(file, fieldName, trackId, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append(fieldName, file);
    formData.append('id', trackId);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          // The backend returns the full track object; extract the relevant URL
          const data = JSON.parse(xhr.responseText);
          const url = fieldName === 'audioFile' ? data.audioUrl : data.artworkUrl;
          resolve(url);
        } catch {
          resolve(null);
        }
      } else {
        try {
          const { error } = JSON.parse(xhr.responseText);
          reject(new Error(error || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted.')));

    const token = getToken();
    xhr.open('POST', `${API_BASE}/tracks`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

/**
 * Build a FormData object ready for POST /api/tracks or PUT /api/tracks/:id.
 * This is the primary interface used by AddRecordForm — it sends everything
 * in a single multipart request rather than separate upload calls.
 */
export function buildTrackFormData(formFields, audioFile, artworkFile) {
  const fd = new FormData();
  Object.entries(formFields).forEach(([k, v]) => {
    fd.append(k, v !== undefined && v !== null ? String(v) : '');
  });
  if (audioFile)   fd.append('audioFile',   audioFile);
  if (artworkFile) fd.append('artworkFile', artworkFile);
  return fd;
}
