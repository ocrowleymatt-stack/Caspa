import { getActiveUserDatabaseScope } from './userDatabaseService';

const CLOUD_SESSION_BASES = [
  'caspa_google_drive_access_token',
  'caspa_google_drive_expected_uid',
  'caspa_dropbox_access_token',
  'caspa_dropbox_access_token_expires',
  'caspa_dropbox_pkce_verifier',
  'caspa_dropbox_oauth_state',
  'caspa_dropbox_redirect_uri',
] as const;

function sessionAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function getCloudCredentialScope(): string | null {
  if (typeof window === 'undefined') return null;
  return getActiveUserDatabaseScope();
}

function encodeScope(scope: string): string {
  return encodeURIComponent(scope);
}

export function cloudSessionKey(base: string, scope = getCloudCredentialScope()): string | null {
  if (!scope) return null;
  return `${base}::${encodeScope(scope)}`;
}

export function getScopedCloudSessionItem(base: string): string | null {
  if (!sessionAvailable()) return null;
  const key = cloudSessionKey(base);
  return key ? window.sessionStorage.getItem(key) : null;
}

export function setScopedCloudSessionItem(base: string, value: string): void {
  if (!sessionAvailable()) return;
  const key = cloudSessionKey(base);
  if (!key) throw new Error('Atlas user scope is not mounted for this cloud connection.');
  window.sessionStorage.setItem(key, value);
}

export function removeScopedCloudSessionItem(base: string, scope = getCloudCredentialScope()): void {
  if (!sessionAvailable() || !scope) return;
  const key = cloudSessionKey(base, scope);
  if (key) window.sessionStorage.removeItem(key);
}

/**
 * Destroy all session-only cloud credentials for one Atlas user.
 * This intentionally leaves global public app configuration (for example the
 * Dropbox app key) intact because it is not a user's credential.
 */
export function clearCloudCredentialsForScope(scope = getCloudCredentialScope()): void {
  if (!sessionAvailable() || !scope) return;
  for (const base of CLOUD_SESSION_BASES) removeScopedCloudSessionItem(base, scope);
}
