/**
 * Client-side Caspa localStorage snapshot helpers
 */

const CASPA_PREFIX = 'caspa.';

export function collectLocalSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CASPA_PREFIX)) {
      snapshot[key] = localStorage.getItem(key) || '';
    }
  }
  return snapshot;
}

export function applyLocalSnapshot(entries: Record<string, string>): number {
  let applied = 0;
  for (const [key, value] of Object.entries(entries)) {
    if (!key.startsWith(CASPA_PREFIX)) continue;
    localStorage.setItem(key, value);
    applied += 1;
  }
  return applied;
}

export function snapshotKeyCount(): number {
  return Object.keys(collectLocalSnapshot()).length;
}
