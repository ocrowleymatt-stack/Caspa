import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
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

/**
 * Handle the result of a signInWithRedirect call on page load.
 * Called once during app initialization to complete redirect-based auth flows.
 */
export async function handleRedirectLogin() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      const user = result.user;
      const userRef = doc(db, 'users', user.uid);
      const userData = {
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        lastLoginAt: Date.now()
      };
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, { ...userData, createdAt: Date.now() });
        } else {
          await setDoc(userRef, userData, { merge: true });
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
      }
    }
  } catch (e) {
    console.error('Redirect login error:', e);
  }
}

export async function loginWithGoogle() {
  console.log('Attempting Google Login... Auth Tenant ID:', (auth as any).tenantId);
  try {
    // One last check before calling the popup
    if ((auth as any).tenantId) {
      console.warn('Tenant ID was found during login attempt! Force clearing again.');
      (auth as any).tenantId = null;
    }

    let result;
    try {
      result = await signInWithPopup(auth, googleProvider);
    } catch (popupError: any) {
      // Fall back to redirect if popup is blocked by the browser
      if (popupError?.code === 'auth/popup-blocked' || popupError?.code === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, googleProvider);
        return null; // page will reload after redirect
      }
      throw popupError;
    }

    const user = result.user;
    
    // Store user data
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
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

export async function logout() {
  await signOut(auth);
}
