import { API_BASE, type ApiResponse } from '../config';
import { getAuthToken } from '../store';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const PUBLIC_AUTH_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

function authHeaders(path: string, extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token && !PUBLIC_AUTH_PATHS.has(path)) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (extra) {
    return { ...headers, ...(extra as Record<string, string>) };
  }
  return headers;
}

export async function apiCall<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(path, options?.headers),
    ...options,
  });

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw new ApiError(`Request failed: ${res.status}`);
    }
    return undefined as T;
  }

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    throw new ApiError(json.error ?? 'Unknown error');
  }
  return json.data as T;
}

export function apiStream(path: string): EventSource {
  const token = getAuthToken();
  const separator = path.includes('?') ? '&' : '?';
  const url = token
    ? `${API_BASE}${path}${separator}token=${encodeURIComponent(token)}`
    : `${API_BASE}${path}`;
  return new EventSource(url);
}

export async function apiDownload(path: string, filename?: string): Promise<void> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    throw new ApiError(`Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function apiPostStream<T>(
  path: string,
  body: unknown,
  onEvent: (data: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(path),
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw new ApiError(`Stream request failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new ApiError('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6)) as T;
          onEvent(data);
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}

export async function getHealth(): Promise<{ status: string; version: string; timestamp: string }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json() as Promise<{ status: string; version: string; timestamp: string }>;
}

export async function getStorageStats() {
  return apiCall<import('../types').StorageStats>('/stats');
}

export async function listBackups() {
  return apiCall<import('../types').BackupInfo[]>('/backups');
}

export async function triggerBackup(label?: string) {
  return apiCall<{ path: string }>('/backup', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export async function restoreBackup(backupName: string) {
  return apiCall<{ restored: string }>('/restore', {
    method: 'POST',
    body: JSON.stringify({ backupName }),
  });
}

export async function getDropboxStatus() {
  return apiCall<{ configured: boolean; token: boolean }>('/dropbox/status');
}

export async function pushDropbox() {
  return apiCall<{ path: string }>('/dropbox/push', { method: 'POST' });
}

export async function pullDropbox() {
  return apiCall<{ path: string; name: string }>('/dropbox/pull', { method: 'POST' });
}

export async function exportData() {
  return apiDownload('/export', 'caspa-export.json');
}

export async function importData(file: File) {
  const form = new FormData();
  form.append('file', file);
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/import`, { method: 'POST', body: form, headers });
  const json = (await res.json()) as ApiResponse<{ imported: boolean }>;
  if (!json.success) {
    throw new ApiError(json.error ?? 'Import failed');
  }
  return json.data;
}
