/**
 * User-scoped browser database boundary.
 *
 * Caspa has a large legacy surface that reads/writes stable localStorage keys such
 * as caspa.currentBrief, caspa.shelf and ls_*. Rewriting every service would be
 * fragile. Instead, this module treats those keys as the active mounted database:
 * before a user changes, the active database is packed into that user's private
 * namespace; the active keys are then cleared and the next user's namespace is
 * mounted before the UI renders.
 */

import { scheduleServerProjectSync } from './serverProjectSync';
import { clearAuthentikCacheOwner, clearSensitiveProjectCaches, isSensitiveProjectCacheKey } from './workspaceCacheKeys';

const ACTIVE_SCOPE_KEY = 'atlas.activeUserDb';
const USER_DB_PREFIX = 'atlas.userdb.';
const DEVICE_SCOPE_KEY = 'atlas.deviceBackupScope';

const GLOBAL_KEYS = new Set([
  'caspa.localGuest',
]);

export function isWorkspaceDataKey(key: string): boolean {
  if (GLOBAL_KEYS.has(key)) return false;
  return key.startsWith('caspa.') || key.startsWith('ls_') || key === 'currentUserEmail';
}

function safeScope(uid: string): string {
  const clean = String(uid || '').trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
  if (!clean) throw new Error('A valid user id is required for the Caspa database');
  return clean;
}

function dbKey(scope: string): string {
  return `${USER_DB_PREFIX}${safeScope(scope)}`;
}

export function collectActiveWorkspaceEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !isWorkspaceDataKey(key) || isSensitiveProjectCacheKey(key)) continue;
    entries[key] = localStorage.getItem(key) || '';
  }
  return entries;
}

function clearActiveWorkspace(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && isWorkspaceDataKey(key)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

function readUserDatabase(scope: string): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(dbKey(scope)) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isWorkspaceDataKey(key) && typeof value === 'string' && !isSensitiveProjectCacheKey(key)) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function writeUserDatabase(scope: string, entries: Record<string, string>): void {
  try {
    localStorage.setItem(dbKey(scope), JSON.stringify(entries));
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') throw error;
    const compact = { ...entries };
    delete compact['caspa.shelf'];
    localStorage.setItem(dbKey(scope), JSON.stringify(compact));
  }
}

function mountEntries(entries: Record<string, string>): void {
  for (const [key, value] of Object.entries(entries)) {
    if (isWorkspaceDataKey(key) && !isSensitiveProjectCacheKey(key)) localStorage.setItem(key, value);
  }
}

export function persistActiveUserDatabase(): void {
  const scope = localStorage.getItem(ACTIVE_SCOPE_KEY);
  if (!scope) return;
  writeUserDatabase(scope, collectActiveWorkspaceEntries());
  scheduleServerProjectSync();
}

/**
 * Mount a user's database before their React workspace is created.
 * Existing unscoped legacy data is migrated to the first user who opens the
 * upgraded app, so the upgrade does not discard the current owner's work.
 */
export function activateUserDatabase(uid: string): void {
  const target = safeScope(uid);
  const current = localStorage.getItem(ACTIVE_SCOPE_KEY);
  if (current === target) return;

  const activeEntries = collectActiveWorkspaceEntries();
  if (current) {
    writeUserDatabase(current, activeEntries);
  } else if (Object.keys(activeEntries).length > 0 && !localStorage.getItem(dbKey(target))) {
    // One-time migration from the old global database.
    writeUserDatabase(target, activeEntries);
  }

  clearActiveWorkspace();
  mountEntries(readUserDatabase(target));
  localStorage.setItem(ACTIVE_SCOPE_KEY, target);
  scheduleServerProjectSync(100);
}

/** Save the current user's work and unmount all workspace keys on sign-out. */
export function deactivateUserDatabase(uid?: string): void {
  const current = localStorage.getItem(ACTIVE_SCOPE_KEY);
  if (!current) {
    clearAuthentikCacheOwner();
    clearActiveWorkspace();
    return;
  }
  if (!uid || safeScope(uid) === current) {
    writeUserDatabase(current, collectActiveWorkspaceEntries());
    clearAuthentikCacheOwner();
    clearActiveWorkspace();
    localStorage.removeItem(ACTIVE_SCOPE_KEY);
  }
}

export function getActiveUserDatabaseScope(): string | null {
  return localStorage.getItem(ACTIVE_SCOPE_KEY);
}

/** Stable anonymous scope for server backups made in Continue Locally mode. */
export function getDeviceBackupScope(): string {
  let value = localStorage.getItem(DEVICE_SCOPE_KEY);
  if (value && /^[a-zA-Z0-9._-]{12,180}$/.test(value)) return value;
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  value = `device-${random}`;
  localStorage.setItem(DEVICE_SCOPE_KEY, value);
  return value;
}
