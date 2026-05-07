import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestoreUtils';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// FORCED FIX: Explicitly nullify tenantId to escape the invalid-tenant-id error loop
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

// Connection test as required by instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection (Firestore) validated.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission-denied')) {
      console.log('Firebase connectivity verified (Permission Denied as expected).');
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: client is offline.");
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
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return await handleUserSync(result.user);
    } catch (popupError: any) {
      if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-interactive-request') {
        console.log('Popup blocked or cancelled, falling back to redirect...');
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      throw popupError;
    }
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

export async function handleRedirectLogin() {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      return await handleUserSync(result.user);
    }
    return null;
  } catch (error) {
    console.error('Redirect result error:', error);
    throw error;
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
      lastLoginAt: Date.now()
    };
    
    try {
      if (!userSnap || !userSnap.exists()) {
        await setDoc(userRef, {
          ...userData,
          createdAt: Date.now()
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
