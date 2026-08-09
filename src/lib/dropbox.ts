import type { BackupPayload } from './googleDrive';
import {
  getScopedCloudSessionItem,
  removeScopedCloudSessionItem,
  setScopedCloudSessionItem,
} from '../services/cloudCredentialScope';

const DROPBOX_ACCESS_TOKEN_KEY = 'caspa_dropbox_access_token';
const DROPBOX_ACCESS_TOKEN_EXPIRES_KEY = 'caspa_dropbox_access_token_expires';
const DROPBOX_APP_KEY_STORAGE = 'caspa_dropbox_app_key';
const DROPBOX_PKCE_VERIFIER_KEY = 'caspa_dropbox_pkce_verifier';
const DROPBOX_OAUTH_STATE_KEY = 'caspa_dropbox_oauth_state';
const DROPBOX_REDIRECT_URI_KEY = 'caspa_dropbox_redirect_uri';

export interface DropboxBackupFile {
  id: string;
  name: string;
  pathLower: string;
  modifiedTime: string;
}

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function getConfiguredAppKey(): string {
  const envKey = String((import.meta as any).env?.VITE_DROPBOX_APP_KEY || '').trim();
  if (envKey) return envKey;

  if (typeof window !== 'undefined') {
    return String(window.localStorage.getItem(DROPBOX_APP_KEY_STORAGE) || '').trim();
  }

  return '';
}

function getRedirectUri(): string {
  const configured = String((import.meta as any).env?.VITE_DROPBOX_REDIRECT_URI || '').trim();
  if (configured) return configured;
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/`;
}

function getOrAskForAppKey(): string {
  let key = getConfiguredAppKey();
  if (key) return key;

  if (typeof window === 'undefined') {
    throw new Error('Dropbox App key is not configured.');
  }

  const entered = window.prompt(
    'Paste the Dropbox App key once. Atlas will remember it in this browser. No app secret is required.'
  );

  key = String(entered || '').trim();
  if (!key) {
    throw new Error('Dropbox connection cancelled: no App key was supplied.');
  }

  window.localStorage.setItem(DROPBOX_APP_KEY_STORAGE, key);
  return key;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomUrlSafeString(byteLength = 48): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function getDropboxAccessToken(): string | null {
  if (!storageAvailable()) return null;

  const token = getScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_KEY);
  const expiresAt = Number(getScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_EXPIRES_KEY) || '0');

  if (!token) return null;
  if (expiresAt && Date.now() >= expiresAt) {
    disconnectDropbox();
    return null;
  }

  return token;
}

function cacheDropboxAccessToken(token: string, expiresInSeconds?: number) {
  if (!storageAvailable()) return;
  setScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_KEY, token);
  if (expiresInSeconds) {
    // Renew a little early so a backup is not started with a token about to expire.
    const expiresAt = Date.now() + Math.max(30, expiresInSeconds - 60) * 1000;
    setScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_EXPIRES_KEY, String(expiresAt));
  } else {
    removeScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_EXPIRES_KEY);
  }
}

export function disconnectDropbox() {
  if (!storageAvailable()) return;
  removeScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_KEY);
  removeScopedCloudSessionItem(DROPBOX_ACCESS_TOKEN_EXPIRES_KEY);
}

export async function connectDropbox(): Promise<void> {
  if (typeof window === 'undefined') return;

  const appKey = getOrAskForAppKey();
  const redirectUri = getRedirectUri();
  const verifier = randomUrlSafeString(64);
  const challenge = await createCodeChallenge(verifier);
  const state = `caspa_dropbox_${randomUrlSafeString(24)}`;

  setScopedCloudSessionItem(DROPBOX_PKCE_VERIFIER_KEY, verifier);
  setScopedCloudSessionItem(DROPBOX_OAUTH_STATE_KEY, state);
  setScopedCloudSessionItem(DROPBOX_REDIRECT_URI_KEY, redirectUri);

  const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', appKey);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('token_access_type', 'online');
  authUrl.searchParams.set('state', state);

  window.location.assign(authUrl.toString());
}

function cleanDropboxCallbackParams() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  ['code', 'state', 'error', 'error_description'].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export async function handleDropboxOAuthRedirect(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const url = new URL(window.location.href);
  const returnedState = url.searchParams.get('state');
  const expectedState = getScopedCloudSessionItem(DROPBOX_OAUTH_STATE_KEY);

  // Ignore unrelated OAuth callbacks.
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    return false;
  }

  const error = url.searchParams.get('error');
  if (error) {
    const description = url.searchParams.get('error_description') || error;
    cleanDropboxCallbackParams();
    throw new Error(`Dropbox authorisation failed: ${description}`);
  }

  const code = url.searchParams.get('code');
  const verifier = getScopedCloudSessionItem(DROPBOX_PKCE_VERIFIER_KEY);
  const redirectUri = getScopedCloudSessionItem(DROPBOX_REDIRECT_URI_KEY) || getRedirectUri();
  const appKey = getConfiguredAppKey();

  if (!code || !verifier || !appKey) {
    cleanDropboxCallbackParams();
    throw new Error('Dropbox returned to Atlas, but the saved PKCE login state was incomplete. Please connect again.');
  }

  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: appKey,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    cleanDropboxCallbackParams();
    throw new Error(payload.error_description || payload.error || `Dropbox token exchange failed (${response.status}).`);
  }

  cacheDropboxAccessToken(payload.access_token, Number(payload.expires_in || 0));
  removeScopedCloudSessionItem(DROPBOX_PKCE_VERIFIER_KEY);
  removeScopedCloudSessionItem(DROPBOX_OAUTH_STATE_KEY);
  removeScopedCloudSessionItem(DROPBOX_REDIRECT_URI_KEY);
  cleanDropboxCallbackParams();
  return true;
}

function requireDropboxToken(): string {
  const token = getDropboxAccessToken();
  if (!token) {
    throw new Error('Dropbox is not connected.');
  }
  return token;
}

async function throwDropboxError(response: Response, prefix: string): Promise<never> {
  const text = await response.text();
  if (response.status === 401) {
    disconnectDropbox();
    throw new Error('Dropbox session expired. Connect Dropbox again.');
  }
  throw new Error(`${prefix}: ${response.status} ${response.statusText}${text ? ` (${text})` : ''}`);
}

export async function listDropboxBackups(): Promise<DropboxBackupFile[]> {
  const token = requireDropboxToken();
  const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: '',
      recursive: false,
      include_deleted: false,
      include_non_downloadable_files: false,
      limit: 100,
    }),
  });

  if (!response.ok) {
    return throwDropboxError(response, 'Failed to list Dropbox backups');
  }

  const data = await response.json();
  return (data.entries || [])
    .filter((entry: any) => entry['.tag'] === 'file' && /^Caspa_Restore_.*\.json$/i.test(entry.name || ''))
    .map((entry: any) => ({
      id: entry.id,
      name: entry.name,
      pathLower: entry.path_lower,
      modifiedTime: entry.server_modified || entry.client_modified || new Date().toISOString(),
    }))
    .sort((a: DropboxBackupFile, b: DropboxBackupFile) => b.modifiedTime.localeCompare(a.modifiedTime));
}

export async function uploadDropboxBackup(
  projectTitle: string,
  _projectId: string,
  payload: BackupPayload
): Promise<void> {
  const token = requireDropboxToken();
  const cleanTitle = projectTitle.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Untitled';
  const path = `/Caspa_Restore_${cleanTitle}.json`;

  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'overwrite',
        autorename: false,
        mute: true,
        strict_conflict: false,
      }),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return throwDropboxError(response, 'Failed to upload Dropbox backup');
  }
}

export async function downloadDropboxBackup(pathLower: string): Promise<any> {
  const token = requireDropboxToken();
  const response = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: pathLower }),
    },
  });

  if (!response.ok) {
    return throwDropboxError(response, 'Failed to download Dropbox backup');
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Dropbox backup downloaded, but it is not valid JSON.');
  }
}
