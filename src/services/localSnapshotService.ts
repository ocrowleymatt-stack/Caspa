/**
 * Client-side Caspa active-user snapshot helpers.
 */

import { isWorkspaceDataKey } from './userDatabaseService';

export function collectLocalSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && isWorkspaceDataKey(key)) snapshot[key] = localStorage.getItem(key) || '';
  }
  return snapshot;
}

export function applyLocalSnapshot(entries: Record<string, string>): number {
  let applied = 0;
  for (const [key, value] of Object.entries(entries)) {
    if (!isWorkspaceDataKey(key)) continue;
    localStorage.setItem(key, value);
    applied += 1;
  }
  return applied;
}

export function snapshotKeyCount(): number {
  return Object.keys(collectLocalSnapshot()).length;
}
