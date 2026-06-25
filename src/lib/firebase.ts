import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestoreUtils';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
auth.useDeviceLanguage();

// Keep auth durable across popup/redirect round-trips and Safari reloads.
const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('Firebase auth persistence setup failed:', error);
});

// FORCED FIX: Explicitly nullify tenantId to escape the invalid-tenant-id error loop.
// Some SDK versions or environments might persist this or pick it up from env vars automatically.
function clearTenantId() {
  if ((auth as any).tenantId) {
    console.log(`Clearing existing tenant ID: ${(auth as any).tenantId}`);
    (auth as any).tenantId = null;
  }
}
clearTenantId();

// Support for multi-tenancy - DISABLED COMPLETELY to fix auth/invalid-tenant-id
// const tenantId = (import.meta as any).env.VITE_FIREBASE_TENANT_ID;
// if (tenantId && tenantId !== 'undefined' && tenantId !== 'null' && typeof tenantId === 'string' && tenantId.trim() !== '') {
//   auth.tenantId = tenantId.trim();
//   console.log(`Firebase Tenant ID set to: ${tenantId}`);
// }

// Plain Google login provider: keep sign-in simple and reliable.
// Do not request Drive here. Extra OAuth scopes can break login when the OAuth consent screen/origins are not fully configured.
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Separate Drive provider for a future explicit "Connect Google Drive" action.
export const googleDriveProvider = new GoogleAuthProvider();
googleDriveProvider.addScope('profile');
googleDriveProvider.addScope('email');
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleDriveProvider.setCustomParameters({
  prompt: 'select_account consent',
});

const isAppleWebKit = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod|Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
};

function normaliseAuthError(error: any): Error {
  const code = error?.code || '';
  const rawMessage = error?.message || String(error);

  if (code === 'auth/unauthorized-domain') {
    return new Error(
      'Google sign-in is blocked because this domain is not authorised in Firebase Authentication. Add localhost, 127.0.0.1, caspa.ocrowley.com and novelwrite-27763.firebaseapp.com under Firebase Authentication > Settings > Authorised domains. Also make sure the Google OAuth client allows https://caspa.ocrowley.com and http://localhost:3000 as JavaScript origins.'
    );
  }

  if (code === 'auth/operation-not-allowed') {
    return new Error('Google sign-in is not enabled for this Firebase project. Enable Google under Firebase Authentication > Sign-in method.');
  }

  if (code === 'auth/popup-blocked') {
    return new Error('The browser blocked the Google sign-in popup. Caspa is switching to redirect sign-in.');
  }

  if (code === 'auth/popup-closed-by-user') {
    return new Error('Google sign-in was cancelled because the popup was closed before completion.');
  }

  if (code === 'auth/invalid-api-key') {
    return new Error('Firebase rejected the API key. Check firebase-applet-config.json against the Firebase web app configuration.');
  }

  if (code === 'auth/invalid-tenant-id') {
    return new Error('Firebase is still receiving an invalid tenant id. Clear VITE_FIREBASE_TENANT_ID from the environment and rebuild.');
  }

  if (code === 'auth/network-request-failed') {
    return new Error('Google sign-in could not reach Firebase/Google. Check network, content blockers and Safari privacy settings.');
  }

  return new Error(code ? `${code}: ${rawMessage}` : rawMessage);
}

// In-memory access token cache for Google APIs as required by Workspace Integration skill
let cachedAccessToken: string | null = null;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem('ls_gdrive_connected', 'true');
  } else {
    localStorage.removeItem('ls_gdrive_connected');
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Connection test as required by instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection (Firestore) validated.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission-denied')) {
      console.log('Firebase connectivity verified (Permission Denied as expected).');
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
    }
  }
}

testConnection();

async function completeGoogleResult(result: any, cacheDriveToken = false) {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (cacheDriveToken && credential?.accessToken) {
    setCachedAccessToken(credential.accessToken);
    console.log('Google Drive access token successfully retrieved and cached.');
  }
  return await handleUserSync(result.user);
}

async function startRedirect(provider: GoogleAuthProvider) {
  await authPersistenceReady;
  clearTenantId();
  await signInWithRedirect(auth, provider);
  return null;
}

export async function loginWithGoogle() {
  console.log('Attempting Google Login... Auth Tenant ID:', (auth as any).tenantId);
  try {
    await authPersistenceReady;
    clearTenantId();

    // Safari/iOS are much less reliable with popup auth. Use redirect there first.
    if (isAppleWebKit()) {
      console.log('Apple WebKit browser detected; using redirect sign-in.');
      return await startRedirect(googleProvider);
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      return await completeGoogleResult(result, false);
    } catch (popupError: any) {
      if (popupError?.code === 'auth/popup-closed-by-user') {
        // User intentionally closed the popup: do not force redirect fallback.
        throw popupError;
      }

      const fallbackCodes = new Set([
        'auth/popup-blocked',
        'auth/cancelled-popup-request',
        'auth/cancelled-interactive-request',
        'auth/redirect-cancelled-by-user',
        'auth/network-request-failed',
      ]);

      if (fallbackCodes.has(popupError.code)) {
        console.log('Popup failed due to browser constraints; falling back to redirect...', popupError.code);
        return await startRedirect(googleProvider);
      }

      throw popupError;
    }
  } catch (error) {
    const normalised = normaliseAuthError(error);
    console.error('Sign in error:', normalised);
    throw normalised;
  }
}

export async function connectGoogleDrive() {
  console.log('Attempting Google Drive connection...');
  try {
    await authPersistenceReady;
    clearTenantId();

    if (isAppleWebKit()) {
      return await startRedirect(googleDriveProvider);
    }

    const result = await signInWithPopup(auth, googleDriveProvider);
    return await completeGoogleResult(result, true);
  } catch (error) {
    const normalised = normaliseAuthError(error);
    console.error('Google Drive connection error:', normalised);
    throw normalised;
  }
}

export async function handleRedirectLogin() {
  try {
    await authPersistenceReady;
    clearTenantId();
    const result = await getRedirectResult(auth);
    if (result) {
      // Login redirects use simple auth scopes. Drive connection can be re-run explicitly if needed.
      return await completeGoogleResult(result, false);
    }
    return null;
  } catch (error) {
    const normalised = normaliseAuthError(error);
    console.error('Redirect result error:', normalised);
    throw normalised;
  }
}

async function handleUserSync(user: any) {
  if (user) {
    const userRef = doc(db, 'users', user.uid);
    let userSnap;
    try {
      userSnap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      throw error;
    }

    const userData = {
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      lastLoginAt: Date.now(),
    };

    try {
      if (!userSnap || !userSnap.exists()) {
        await setDoc(userRef, {
          ...userData,
          createdAt: Date.now(),
        });
      } else {
        await setDoc(userRef, userData, { merge: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  }
  return user;
}

export async function logout() {
  await signOut(auth);
}

export async function loginAnonymously() {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error('Anonymous sign in error:', error);
    throw error;
  }
}
