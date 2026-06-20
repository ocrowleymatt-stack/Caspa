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

// Keep auth durable across popup/redirect round-trips and Safari reloads.
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('Firebase auth persistence setup failed:', error);
});

// FORCED FIX: Explicitly nullify tenantId to escape the invalid-tenant-id error loop.
// Some SDK versions or environments might persist this or pick it up from env vars automatically.
if ((auth as any).tenantId) {
  console.log(`Clearing existing tenant ID: ${(auth as any).tenantId}`);
  (auth as any).tenantId = null;
} else {
  console.log('Initial auth.tenantId is null/undefined as expected.');
}

// Support for multi-tenancy - DISABLED COMPLETELY to fix auth/invalid-tenant-id
// const tenantId = (import.meta as any).env.VITE_FIREBASE_TENANT_ID;
// if (tenantId && tenantId !== 'undefined' && tenantId !== 'null' && typeof tenantId === 'string' && tenantId.trim() !== '') {
//   auth.tenantId = tenantId.trim();
//   console.log(`Firebase Tenant ID set to: ${tenantId}`);
// }

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

const isAppleWebKit = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod|Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
};

function normaliseAuthError(error: any): Error {
  const code = error?.code || '';
  const message = error?.message || String(error);

  if (code === 'auth/unauthorized-domain') {
    return new Error(
      'Google sign-in is blocked because this domain is not authorised in Firebase Authentication. Add caspa.ocrowley.com to Firebase Auth > Settings > Authorised domains, and make sure the Google OAuth client allows https://caspa.ocrowley.com as a JavaScript origin.'
    );
  }

  if (code === 'auth/operation-not-allowed') {
    return new Error('Google sign-in is not enabled for this Firebase project. Enable Google under Firebase Authentication > Sign-in method.');
  }

  if (code === 'auth/popup-blocked') {
    return new Error('The browser blocked the Google sign-in popup. Caspa will try redirect sign-in instead.');
  }

  return new Error(message);
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

export async function loginWithGoogle() {
  console.log('Attempting Google Login... Auth Tenant ID:', (auth as any).tenantId);
  try {
    if ((auth as any).tenantId) {
      (auth as any).tenantId = null;
    }

    // Safari/iOS are much less reliable with popup auth. Use redirect there first.
    if (isAppleWebKit()) {
      console.log('Apple WebKit browser detected; using redirect sign-in.');
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
        console.log('Access token successfully retrieved and cached from popup.');
      }
      return await handleUserSync(result.user);
    } catch (popupError: any) {
      const fallbackCodes = new Set([
        'auth/popup-blocked',
        'auth/cancelled-popup-request',
        'auth/cancelled-interactive-request',
        'auth/popup-closed-by-user',
      ]);

      if (fallbackCodes.has(popupError.code)) {
        console.log('Popup failed or was cancelled; falling back to redirect...', popupError.code);
        await signInWithRedirect(auth, googleProvider);
        return null;
      }

      throw popupError;
    }
  } catch (error) {
    const normalised = normaliseAuthError(error);
    console.error('Sign in error:', normalised);
    throw normalised;
  }
}

export async function handleRedirectLogin() {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
        console.log('Access token successfully retrieved and cached from redirect result.');
      }
      return await handleUserSync(result.user);
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
