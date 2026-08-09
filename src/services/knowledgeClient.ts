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
