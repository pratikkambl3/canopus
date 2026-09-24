/* ================================================================
   CANOPUS — Tracks Service
   Reads from Firestore when configured, falls back to local data.
   ================================================================ */

import {
  collection, doc, getDocs, getDoc,
  addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { placeholderTracks } from '../data/placeholderTracks';

const COLLECTION = 'tracks';

/* ── Public read ── */

export async function getTracks() {
  if (!isFirebaseConfigured()) {
    return placeholderTracks;
  }
  try {
    const q = query(collection(db, COLLECTION), orderBy('releaseDate', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[CANOPUS] Firestore unavailable, using local data.', err);
    return placeholderTracks;
  }
}

export async function getTrack(id) {
  if (!isFirebaseConfigured()) {
    return placeholderTracks.find(t => t.id === id) || null;
  }
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn('[CANOPUS] getTrack failed.', err);
    return null;
  }
}

/* ── Admin write ── */

export async function addTrack(data) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured.');
  return addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateTrack(id, data) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured.');
  return updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTrack(id) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured.');
  return deleteDoc(doc(db, COLLECTION, id));
}
