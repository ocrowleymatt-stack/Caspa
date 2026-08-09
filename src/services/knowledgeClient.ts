import { getAuth } from 'firebase/auth';
import { getActiveUserDatabaseScope, getDeviceBackupScope } from './userDatabaseService';

export interface KnowledgeStatus {
  sources: number;
  aliases: number;
  duplicates: number;
  chunks: number;
  vectorChunks: number;
  lexicalChunks: number;
  transcribedMedia: number;
  failures: number;
  embeddingModel: string;
}

export interface CloudAutopilotStatus {
  provider: 'dropbox' | 'gdrive';
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
}

async function authHeaders(): Promise<Record<string, string>> {
  const scope = getActiveUserDatabaseScope();
  if (scope && scope !== 'local-guest') {
    const current = getAuth().currentUser;
    if (!current) throw new Error('Your signed-in Atlas session is unavailable. Sign in again.');
    return { Authorization: `Bearer ${await current.getIdToken()}` };
  }
  return { 'X-Caspa-Local-Scope': getDeviceBackupScope() };
}

async function readJson(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Knowledge API failed (${response.status})`);
  }
  return data.data;
}

export async function getKnowledgeStatus(): Promise<KnowledgeStatus> {
  const response = await fetch('/api/caspa/knowledge/status', { headers: await authHeaders() });
  return readJson(response);
}

export async function getCloudAutopilotStatusClient(): Promise<CloudAutopilotStatus[]> {
  const response = await fetch('/api/caspa/knowledge/cloud/status', { headers: await authHeaders() });
  const data = await readJson(response);
  return data.connections || [];
}

export async function startCloudAutopilotOAuth(provider: 'dropbox' | 'gdrive'): Promise<string> {
  const response = await fetch('/api/caspa/knowledge/cloud/oauth/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ provider }),
  });
  const data = await readJson(response);
  if (!data.authorizationUrl) throw new Error('Cloud authorisation URL was not returned.');
  return data.authorizationUrl;
}

export async function runCloudAutopilotNow(provider: 'dropbox' | 'gdrive'): Promise<any> {
  const response = await fetch('/api/caspa/knowledge/cloud/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ provider }),
  });
  return readJson(response);
}

export async function disconnectCloudAutopilotClient(provider: 'dropbox' | 'gdrive'): Promise<CloudAutopilotStatus[]> {
  const response = await fetch(`/api/caspa/knowledge/cloud/${provider}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  const data = await readJson(response);
  return data.connections || [];
}

// Legacy session-token manual sync kept for compatibility with older surfaces.
export async function syncCloudKnowledgeClient(
  provider: 'dropbox' | 'gdrive',
  accessToken: string,
  maxFiles = 8,
): Promise<any> {
  const response = await fetch('/api/caspa/knowledge/cloud/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cloud-Access-Token': accessToken,
      ...(await authHeaders()),
    },
    body: JSON.stringify({ provider, maxFiles }),
  });
  return readJson(response);
}

export async function searchKnowledgeClient(query: string, topK = 12): Promise<any[]> {
  const response = await fetch('/api/caspa/knowledge/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ query, topK }),
  });
  const data = await readJson(response);
  return data.results || [];
}

export async function getKnowledgeContext(query: string, maxChars = 12000): Promise<any> {
  const response = await fetch('/api/caspa/knowledge/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ query, maxChars }),
  });
  return readJson(response);
}

export async function reindexKnowledge(maxChunks = 500): Promise<any> {
  const response = await fetch('/api/caspa/knowledge/reindex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ maxChunks }),
  });
  return readJson(response);
}

export async function ingestKnowledgeText(name: string, text: string, mimeType = 'text/plain', fileId?: string): Promise<any> {
  const response = await fetch('/api/caspa/knowledge/ingest/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ name, text, mimeType, fileId }),
  });
  return readJson(response);
}


export async function ingestKnowledgeFile(file: File, fileId?: string): Promise<any> {
  const form = new FormData();
  form.append('file', file, file.name);
  if (fileId) form.append('fileId', fileId);
  const response = await fetch('/api/caspa/knowledge/ingest/file', {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  });
  return readJson(response);
}
