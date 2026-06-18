import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _googleProvider: GoogleAuthProvider | null = null;
let _db: Firestore | null = null;

if (apiKey) {
  const firebaseConfig = {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'metryxone-ai-a3431.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'metryxone-ai-a3431',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };
  // Guard against HMR re-initialisation (duplicate-app error)
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  _auth = getAuth(app);
  _googleProvider = new GoogleAuthProvider();
  _db = getFirestore(app);
}

export const auth = _auth;
export const googleProvider = _googleProvider;
export const db = _db;
export const isFirebaseConfigured = !!apiKey;

/**
 * Upserts a user profile document in Firestore under `users/{uid}`.
 * Safe to call on every login — uses merge so existing fields are preserved.
 * Never throws; failures are logged but don't break the login flow.
 */
export async function syncProfileToFirestore(
  uid: string,
  profile: {
    email: string;
    fullName?: string;
    profilePicture?: string;
    role?: string;
    provider?: string;
  },
): Promise<void> {
  if (!_db) return;
  try {
    await setDoc(
      doc(_db, 'users', uid),
      {
        ...profile,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn('[Firebase] Failed to sync profile to Firestore:', err);
  }
}
