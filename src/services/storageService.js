/* ================================================================
   CANOPUS — Storage Service
   Handles audio + artwork uploads to Firebase Storage.
   ================================================================ */

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, isFirebaseConfigured } from './firebase';

/**
 * Upload a file to Firebase Storage with progress reporting.
 * @param {File} file
 * @param {string} path  e.g. 'audio/track-01.mp3'
 * @param {(pct: number) => void} onProgress
 * @returns {Promise<string>} download URL
 */
export function uploadFile(file, path, onProgress = () => {}) {
  if (!isFirebaseConfigured()) {
    return Promise.reject(new Error('Firebase Storage is not configured.'));
  }
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      snapshot => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(Math.round(pct));
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export async function uploadAudio(trackId, file, onProgress) {
  return uploadFile(file, `audio/${trackId}.mp3`, onProgress);
}

export async function uploadArtwork(trackId, file, onProgress) {
  const ext = file.name.split('.').pop() || 'jpg';
  return uploadFile(file, `artwork/${trackId}.${ext}`, onProgress);
}
