/**
 * Unattended per-user Dropbox / Google Drive knowledge ingestion.
 *
 * Long-lived refresh credentials never leave the server after OAuth callback.
 * The complete connection store is AES-256-GCM encrypted at rest and tied to
 * the authenticated Atlas scope that initiated OAuth. Provider cursors are
 * persisted so an idle account does not need a full inventory scan each tick.
 */
import fs from 'fs';
import path from 'path';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { getDataDir } from './dataPaths';
import { syncCloudKnowledge, type CloudSyncResult } from './cloudKnowledgeIngestionService';

export type AutopilotProvider = 'dropbox' | 'gdrive';

type ConnectionRecord = {
  scope: string;
  provider: AutopilotProvider;
  enabled: boolean;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
  cursor?: string;
  initialComplete: boolean;
  remaining: number;
  lastScanAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  failureCount: number;
  connectedAt: string;
};

type PendingOAuth = {
  state: string;
  scope: string;
  provider: AutopilotProvider;
  verifier: string;
  clientId: string;
  redirectUri: string;
  createdAt: number;
};

type StorePayload = {
  version: 1;
  connections: ConnectionRecord[];
  pending: PendingOAuth[];
};

type EncryptedEnvelope = {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
};

export type PublicCloudConnectionStatus = {
  provider: AutopilotProvider;
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  initialComplete: boolean;
  remaining: number;
  lastScanAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  failureCount: number;
  cursorReady: boolean;
};

const OAUTH_TTL_MS = 15 * 60_000;
const SYNC_INTERVAL_MS = Math.max(60_000, Number(process.env.KNOWLEDGE_SYNC_INTERVAL_MS || 5 * 60_000));
const SYNC_BATCH = Math.max(1, Math.min(30, Number(process.env.KNOWLEDGE_SYNC_BATCH || 8)));
const activeRuns = new Set<string>();
let schedulerStarted = false;

function knowledgeDir(): string {
  const dir = path.join(getDataDir(), 'knowledge');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function storePath(): string {
  return path.join(knowledgeDir(), 'cloud-connections.enc.json');
}

function encryptionKey(): Buffer {
  const configured = String(process.env.CLOUD_TOKEN_ENCRYPTION_KEY || '').trim();
  if (!configured) {
    throw new Error('CLOUD_TOKEN_ENCRYPTION_KEY is not configured on the Atlas server');
  }
  return createHash('sha256').update(configured).digest();
}

function emptyStore(): StorePayload {
  return { version: 1, connections: [], pending: [] };
}

function encrypt(payload: StorePayload): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function decrypt(envelope: EncryptedEnvelope): StorePayload {
  if (envelope?.version !== 1 || envelope?.algorithm !== 'aes-256-gcm') {
    throw new Error('Unsupported cloud connection store format');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const clear = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  const parsed = JSON.parse(clear) as StorePayload;
  return {
    version: 1,
    connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    pending: Array.isArray(parsed.pending) ? parsed.pending : [],
  };
}

function readStore(): StorePayload {
  if (!fs.existsSync(storePath())) return emptyStore();
  const raw = fs.readFileSync(storePath(), 'utf8');
  if (!raw.trim()) return emptyStore();
  return decrypt(JSON.parse(raw) as EncryptedEnvelope);
}

function writeStore(payload: StorePayload): void {
  payload.pending = payload.pending.filter((row) => Date.now() - row.createdAt < OAUTH_TTL_MS);
  const target = storePath();
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(encrypt(payload)), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, target);
  try { fs.chmodSync(target, 0o600); } catch { /* Windows/dev compatibility */ }
}

function connectionKey(scope: string, provider: AutopilotProvider): string {
  return `${scope}::${provider}`;
}

function configuredClientId(provider: AutopilotProvider): string {
  if (provider === 'dropbox') {
    return String(
      process.env.DROPBOX_APP_KEY ||
      process.env.VITE_DROPBOX_APP_KEY ||
      '',
    ).trim();
  }
  return String(
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    '',
  ).trim();
}

function googleClientSecret(): string {
  return String(
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    '',
  ).trim();
}

function publicBase(origin?: string): string {
  return String(process.env.ATLAS_PUBLIC_URL || origin || 'https://caspa.ocrowley.com').replace(/\/$/, '');
}

function callbackUri(provider: AutopilotProvider, origin?: string): string {
  return `${publicBase(origin)}/api/caspa/knowledge/cloud/oauth/callback/${provider}`;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function challenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

async function fetchJson(url: string, init: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(90_000) });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const detail = data?.error_description || data?.error?.summary || data?.error || data?.raw || response.statusText;
    throw new Error(`${response.status} ${String(detail).slice(0, 700)}`);
  }
  return data;
}

export function getCloudAutopilotStatus(scope: string): PublicCloudConnectionStatus[] {
  let store: StorePayload;
  try {
    store = readStore();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (['dropbox', 'gdrive'] as AutopilotProvider[]).map((provider) => ({
      provider,
      configured: Boolean(configuredClientId(provider)) && (provider !== 'gdrive' || Boolean(googleClientSecret())),
      connected: false,
      enabled: false,
      initialComplete: false,
      remaining: 0,
      failureCount: 0,
      cursorReady: false,
      lastError: message,
    }));
  }

  return (['dropbox', 'gdrive'] as AutopilotProvider[]).map((provider) => {
    const row = store.connections.find((item) => item.scope === scope && item.provider === provider);
    return {
      provider,
      configured: Boolean(configuredClientId(provider)) && (provider !== 'gdrive' || Boolean(googleClientSecret())),
      connected: Boolean(row?.refreshToken),
      enabled: Boolean(row?.enabled),
      initialComplete: Boolean(row?.initialComplete),
      remaining: Number(row?.remaining || 0),
      lastScanAt: row?.lastScanAt,
      lastSuccessAt: row?.lastSuccessAt,
      lastError: row?.lastError,
      failureCount: Number(row?.failureCount || 0),
      cursorReady: Boolean(row?.cursor),
    };
  });
}

export function beginCloudOAuth(
  scope: string,
  provider: AutopilotProvider,
  origin?: string,
): { authorizationUrl: string; provider: AutopilotProvider } {
  const clientId = configuredClientId(provider);
  if (!clientId) {
    throw new Error(`${provider === 'dropbox' ? 'Dropbox' : 'Google Drive'} OAuth client is not configured on the Atlas server`);
  }
  if (provider === 'gdrive' && !googleClientSecret()) {
    throw new Error('Google Drive OAuth client secret is not configured on the Atlas server');
  }

  const verifier = base64Url(randomBytes(64));
  const state = base64Url(randomBytes(36));
  const redirectUri = callbackUri(provider, origin);
  const store = readStore();
  store.pending = store.pending.filter((row) => !(row.scope === scope && row.provider === provider));
  store.pending.push({ state, scope, provider, verifier, clientId, redirectUri, createdAt: Date.now() });
  writeStore(store);

  if (provider === 'dropbox') {
    const url = new URL('https://www.dropbox.com/oauth2/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('token_access_type', 'offline');
    url.searchParams.set('code_challenge', challenge(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);
    return { authorizationUrl: url.toString(), provider };
  }

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.readonly');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('code_challenge', challenge(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  return { authorizationUrl: url.toString(), provider };
}

export async function completeCloudOAuth(
  provider: AutopilotProvider,
  state: string,
  code: string,
): Promise<{ scope: string; provider: AutopilotProvider }> {
  if (!state || !code) throw new Error('OAuth callback is missing state or code');
  const store = readStore();
  const pending = store.pending.find((row) => row.state === state && row.provider === provider);
  if (!pending || Date.now() - pending.createdAt >= OAUTH_TTL_MS) {
    throw new Error('Cloud authorisation state is invalid or expired. Start the connection again.');
  }

  let tokenData: any;
  if (provider === 'dropbox') {
    tokenData = await fetchJson('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: pending.clientId,
        redirect_uri: pending.redirectUri,
        code_verifier: pending.verifier,
      }),
    });
  } else {
    tokenData = await fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: pending.clientId,
        client_secret: googleClientSecret(),
        redirect_uri: pending.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: pending.verifier,
      }),
    });
  }

  const accessToken = String(tokenData.access_token || '').trim();
  const refreshToken = String(tokenData.refresh_token || '').trim();
  if (!accessToken || !refreshToken) {
    throw new Error(`${provider === 'dropbox' ? 'Dropbox' : 'Google'} did not return an offline refresh credential`);
  }

  const now = Date.now();
  const existing = store.connections.find((row) => row.scope === pending.scope && row.provider === provider);
  const next: ConnectionRecord = {
    scope: pending.scope,
    provider,
    enabled: true,
    accessToken,
    refreshToken,
    expiresAt: now + Math.max(60, Number(tokenData.expires_in || 3600)) * 1000,
    clientId: pending.clientId,
    cursor: existing?.cursor,
    initialComplete: existing?.initialComplete || false,
    remaining: existing?.remaining || 0,
    lastScanAt: existing?.lastScanAt,
    lastSuccessAt: existing?.lastSuccessAt,
    failureCount: 0,
    connectedAt: new Date().toISOString(),
  };

  store.connections = store.connections.filter((row) => !(row.scope === pending.scope && row.provider === provider));
  store.connections.push(next);
  store.pending = store.pending.filter((row) => row.state !== state);
  writeStore(store);

  queueMicrotask(() => {
    void runCloudConnection(pending.scope, provider).catch((error) => {
      console.warn('[cloud-autopilot] initial sync failed:', error instanceof Error ? error.message : error);
    });
  });

  return { scope: pending.scope, provider };
}

export function disconnectCloudAutopilot(scope: string, provider: AutopilotProvider): void {
  const store = readStore();
  store.connections = store.connections.filter((row) => !(row.scope === scope && row.provider === provider));
  store.pending = store.pending.filter((row) => !(row.scope === scope && row.provider === provider));
  writeStore(store);
}

async function refreshAccess(record: ConnectionRecord): Promise<ConnectionRecord> {
  if (record.accessToken && record.expiresAt > Date.now() + 2 * 60_000) return record;

  let data: any;
  if (record.provider === 'dropbox') {
    data = await fetchJson('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: record.refreshToken,
        client_id: record.clientId,
      }),
    });
  } else {
    data = await fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: record.refreshToken,
        client_id: record.clientId,
        client_secret: googleClientSecret(),
      }),
    });
  }

  record.accessToken = String(data.access_token || '').trim();
  if (!record.accessToken) throw new Error('Cloud refresh returned no access token');
  record.expiresAt = Date.now() + Math.max(60, Number(data.expires_in || 3600)) * 1000;
  return record;
}

async function latestCursor(provider: AutopilotProvider, token: string): Promise<string> {
  if (provider === 'dropbox') {
    const data = await fetchJson('https://api.dropboxapi.com/2/files/list_folder/get_latest_cursor', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', recursive: true, include_deleted: true }),
    });
    return String(data.cursor || '');
  }
  const data = await fetchJson('https://www.googleapis.com/drive/v3/changes/startPageToken?supportsAllDrives=true', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  return String(data.startPageToken || '');
}

async function providerChanged(
  provider: AutopilotProvider,
  token: string,
  cursor: string,
): Promise<{ changed: boolean; safeCursor?: string }> {
  if (!cursor) return { changed: true };
  if (provider === 'dropbox') {
    const data = await fetchJson('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor }),
    });
    const changed = Boolean((data.entries || []).length || data.has_more);
    return { changed, safeCursor: changed ? undefined : String(data.cursor || cursor) };
  }

  const params = new URLSearchParams({
    pageToken: cursor,
    pageSize: '1',
    spaces: 'drive',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    fields: 'changes(fileId,removed),nextPageToken,newStartPageToken',
  });
  const data = await fetchJson(`https://www.googleapis.com/drive/v3/changes?${params}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const changed = Boolean((data.changes || []).length || data.nextPageToken);
  return { changed, safeCursor: changed ? undefined : String(data.newStartPageToken || cursor) };
}

function replaceConnection(store: StorePayload, record: ConnectionRecord): void {
  store.connections = store.connections.filter((row) => !(row.scope === record.scope && row.provider === record.provider));
  store.connections.push(record);
}

async function saveRecord(record: ConnectionRecord): Promise<void> {
  const store = readStore();
  replaceConnection(store, record);
  writeStore(store);
}

export async function runCloudConnection(
  scope: string,
  provider: AutopilotProvider,
): Promise<CloudSyncResult | { unchangedProvider: true }> {
  const key = connectionKey(scope, provider);
  if (activeRuns.has(key)) return { unchangedProvider: true };
  activeRuns.add(key);

  try {
    const store = readStore();
    const record = store.connections.find((row) => row.scope === scope && row.provider === provider);
    if (!record || !record.enabled) throw new Error('Cloud connection is not enabled');
    await refreshAccess(record);
    record.lastScanAt = new Date().toISOString();

    if (record.initialComplete && record.cursor && record.remaining === 0) {
      try {
        const delta = await providerChanged(provider, record.accessToken, record.cursor);
        if (!delta.changed) {
          if (delta.safeCursor) record.cursor = delta.safeCursor;
          record.lastSuccessAt = new Date().toISOString();
          record.lastError = undefined;
          record.failureCount = 0;
          await saveRecord(record);
          return { unchangedProvider: true };
        }
        record.initialComplete = false;
      } catch (error: any) {
        // Invalid/expired provider cursors are recoverable: run a revision-aware
        // inventory once, then mint a fresh cursor when caught up.
        const message = String(error?.message || error);
        if (/409|cursor|pageToken|page token|invalid/i.test(message)) {
          record.cursor = undefined;
          record.initialComplete = false;
        } else {
          throw error;
        }
      }
    }

    const result = await syncCloudKnowledge(scope, provider, record.accessToken, SYNC_BATCH);
    record.remaining = result.remaining;
    record.lastScanAt = new Date().toISOString();
    record.lastSuccessAt = new Date().toISOString();
    record.lastError = undefined;
    record.failureCount = 0;

    if (result.remaining === 0 && !result.inventoryTruncated) {
      record.cursor = await latestCursor(provider, record.accessToken);
      record.initialComplete = Boolean(record.cursor);
    } else {
      record.initialComplete = false;
    }
    await saveRecord(record);
    return result;
  } catch (error: any) {
    try {
      const store = readStore();
      const record = store.connections.find((row) => row.scope === scope && row.provider === provider);
      if (record) {
        record.lastScanAt = new Date().toISOString();
        record.lastError = String(error?.message || error).slice(0, 900);
        record.failureCount = Number(record.failureCount || 0) + 1;
        replaceConnection(store, record);
        writeStore(store);
      }
    } catch { /* preserve original error */ }
    throw error;
  } finally {
    activeRuns.delete(key);
  }
}

export async function runAllCloudConnections(): Promise<void> {
  let rows: ConnectionRecord[] = [];
  try {
    rows = readStore().connections.filter((row) => row.enabled);
  } catch (error) {
    console.warn('[cloud-autopilot] cannot read encrypted connection store:', error instanceof Error ? error.message : error);
    return;
  }
  for (const row of rows) {
    // Serial provider runs keep transcription / ffmpeg pressure bounded on the
    // small Atlas host. Each run itself processes a bounded changed batch.
    try {
      await runCloudConnection(row.scope, row.provider);
    } catch (error) {
      console.warn(`[cloud-autopilot] ${row.provider}/${createHash('sha256').update(row.scope).digest('hex').slice(0, 8)} failed:`, error instanceof Error ? error.message : error);
    }
  }
}

export function startCloudKnowledgeAutopilot(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  if (!process.env.CLOUD_TOKEN_ENCRYPTION_KEY) {
    console.warn('[cloud-autopilot] disabled: CLOUD_TOKEN_ENCRYPTION_KEY is not configured');
    return;
  }
  const run = () => { void runAllCloudConnections(); };
  const timer = setInterval(run, SYNC_INTERVAL_MS);
  timer.unref?.();
  const bootstrap = setTimeout(run, 10_000);
  bootstrap.unref?.();
  console.log(`[cloud-autopilot] scheduler active every ${Math.round(SYNC_INTERVAL_MS / 1000)}s, batch ${SYNC_BATCH}`);
}
