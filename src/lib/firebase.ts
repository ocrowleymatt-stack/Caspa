import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestoreUtils';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Connection test as required by instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection validated.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission-denied')) {
      // This is actually "success" in terms of connectivity if we have no permissions
      console.log('Firebase connectivity verified (Permission Denied as expected).');
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

testConnection();

export async function loginWithGoogle() {
  try {
    let result;
    try {
      result = await signInWithPopup(auth, googleProvider);
    } catch (popupError: any) {
      // Fallback to redirect if popup is blocked
      if (popupError?.code === 'auth/popup-blocked' || popupError?.code === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, googleProvider);
        return null; // Redirect will handle the rest
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

export async function handleRedirectLogin() {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    const user = result.user;
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef).catch(() => null);
      const userData = {
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        lastLoginAt: Date.now()
      };
      if (!userSnap || !userSnap.exists()) {
        await setDoc(userRef, { ...userData, createdAt: Date.now() });
      } else {
        await setDoc(userRef, userData, { merge: true });
      }
    }
    return user;
  } catch (error) {
    console.error('Redirect sign-in error:', error);
    return null;
  }
}

export async function logout() {
  await signOut(auth);
}
