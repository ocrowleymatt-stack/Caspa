/**
 * Caspa local-first auth shim.
 *
 * The old app expected Firebase Auth. For self-hosted use, Caspa now runs as a
 * single local author account by default. This keeps the rest of the app stable
 * while removing Firebase/Auth as a deployment dependency.
 */

export interface LocalUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId: string | null;
  providerData: Array<{ providerId?: string | null; email?: string | null }>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

type AuthCallback = (user: LocalUser | null) => void;

const USER_KEY = 'caspa_local_user_v1';

function createDefaultUser(): LocalUser {
  return {
    uid: 'local-author',
    email: localStorage.getItem('currentUserEmail') || 'local@caspa.studio',
    displayName: localStorage.getItem('caspaAuthorName') || 'Local Author',
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: [{ providerId: 'local', email: localStorage.getItem('currentUserEmail') || 'local@caspa.studio' }],
    getIdToken: async () => 'local-author-token',
  };
}

function readUser(): LocalUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(USER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...createDefaultUser(),
        ...parsed,
        getIdToken: async () => 'local-author-token',
      };
    }
  } catch (e) {
    console.warn('Caspa local auth: failed to read saved user', e);
  }
  const user = createDefaultUser();
  localStorage.setItem(USER_KEY, JSON.stringify({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
    isAnonymous: user.isAnonymous,
    tenantId: user.tenantId,
    providerData: user.providerData,
  }));
  return user;
}

const listeners = new Set<AuthCallback>();

export const auth: { currentUser: LocalUser | null; tenantId?: string | null } = {
  currentUser: readUser(),
  tenantId: null,
};

function notify() {
  listeners.forEach(cb => cb(auth.currentUser));
}

export function getAuth() {
  return auth;
}

export function onAuthStateChanged(_auth: typeof auth, callback: AuthCallback) {
  listeners.add(callback);
  queueMicrotask(() => callback(auth.currentUser));
  return () => listeners.delete(callback);
}

export async function signInAnonymously(_auth: typeof auth) {
  auth.currentUser = {
    ...createDefaultUser(),
    uid: 'local-guest',
    email: null,
    displayName: 'Guest Author',
    isAnonymous: true,
    providerData: [{ providerId: 'local-anonymous', email: null }],
  };
  localStorage.setItem(USER_KEY, JSON.stringify(auth.currentUser));
  notify();
  return { user: auth.currentUser };
}

export async function signOut(_auth: typeof auth) {
  // Local-first mode keeps a local author active so the app remains usable after
  // a sign-out gesture. This avoids the old Firebase login gate dead-end.
  auth.currentUser = createDefaultUser();
  localStorage.setItem(USER_KEY, JSON.stringify(auth.currentUser));
  notify();
}

export class GoogleAuthProvider {
  addScope(_scope: string) {}
  static credentialFromResult(_result: any) {
    return null;
  }
}

export async function signInWithPopup(_auth: typeof auth, _provider: unknown) {
  auth.currentUser = createDefaultUser();
  localStorage.setItem(USER_KEY, JSON.stringify(auth.currentUser));
  notify();
  return { user: auth.currentUser };
}

export async function signInWithRedirect(_auth: typeof auth, _provider: unknown) {
  return signInWithPopup(_auth, _provider);
}

export async function getRedirectResult(_auth: typeof auth) {
  return null;
}
