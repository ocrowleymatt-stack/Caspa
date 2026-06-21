/**
 * Local-first compatibility exports.
 *
 * Caspa no longer requires Firebase/Firestore for self-hosted deployment.
 * Existing app modules still import these names, so this file keeps the public
 * contract while routing storage and auth through the local adapters.
 */

import { auth, signInWithPopup, signInWithRedirect, getRedirectResult, signInAnonymously, signOut, GoogleAuthProvider } from './localAuth';
import { db, doc, getDoc, setDoc } from './localFirestore';

export { auth, db };

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

let cachedAccessToken: string | null = null;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem('ls_gdrive_connected', 'true');
  else localStorage.removeItem('ls_gdrive_connected');
};

export const getCachedAccessToken = (): string | null => cachedAccessToken;

async function handleUserSync(user: any) {
  if (!user) return user;
  try {
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email || '',
      displayName: user.displayName || 'Local Author',
      photoURL: user.photoURL || '',
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
    }, { merge: true });
  } catch (e) {
    console.warn('Caspa local auth sync failed:', e);
  }
  return user;
}

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return handleUserSync(result.user);
}

export async function handleRedirectLogin() {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  return handleUserSync(result.user);
}

export async function logout() {
  await signOut(auth);
}

export async function loginAnonymously() {
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function pingLocalStorage() {
  const ref = doc(db, 'test', 'connection');
  const snap = await getDoc(ref);
  return { ok: true, exists: snap.exists() };
}
