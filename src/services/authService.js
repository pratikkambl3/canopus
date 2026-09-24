/* ================================================================
   CANOPUS — Auth Service
   Firebase email/password authentication for the admin panel.
   ================================================================ */

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';

export async function signIn(email, password) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured.');
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  if (!isFirebaseConfigured()) return;
  return firebaseSignOut(auth);
}

/**
 * Subscribe to auth state changes.
 * @param {(user: import('firebase/auth').User | null) => void} callback
 * @returns unsubscribe function
 */
export function onAuthChange(callback) {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
