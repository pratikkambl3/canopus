/* ================================================================
   CANOPUS — Firebase Initialisation
   All credentials are read from environment variables.
   Fill in .env.local with your Firebase project config.
   ================================================================ */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Returns true when all env vars are present */
export function isFirebaseConfigured() {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}

// Only initialise Firebase when credentials are available
let app, db, storage, auth;

if (isFirebaseConfigured()) {
  app     = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db      = getFirestore(app);
  storage = getStorage(app);
  auth    = getAuth(app);
}

export { db, storage, auth };
