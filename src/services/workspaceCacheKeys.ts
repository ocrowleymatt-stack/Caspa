export const ACTIVE_HYBRID_PROJECT_KEY = 'caspa.activeHybridProject';
export const AUTHENTIK_OWNER_KEY = 'atlas.authentikUid';

export const SENSITIVE_CACHE_PREFIXES = [
  'caspa.whitePage.',
  'caspa.manuscriptSource.',
  'caspa.commission.',
  'caspa.studioCanon.',
  'caspa.research.',
  'caspa.psychology.',
  'caspa.currentBrief.',
] as const;

export function cacheOwnerScope(): string {
  if (typeof localStorage === 'undefined') return 'anon';
  return String(localStorage.getItem(AUTHENTIK_OWNER_KEY) || 'anon').trim() || 'anon';
}

export function bindAuthentikCacheOwner(uid: string): void {
  if (typeof localStorage === 'undefined') return;
  const next = String(uid || '').trim();
  if (!next) return;
  const previous = String(localStorage.getItem(AUTHENTIK_OWNER_KEY) || '').trim();
  if (previous && previous !== next) clearSensitiveProjectCaches();
  localStorage.setItem(AUTHENTIK_OWNER_KEY, next);
}

export function clearAuthentikCacheOwner(): void {
  if (typeof localStorage === 'undefined') return;
  clearSensitiveProjectCaches();
  localStorage.removeItem(AUTHENTIK_OWNER_KEY);
}

export function scopedCacheKey(
  base: 'caspa.whitePage' | 'caspa.manuscriptSource' | 'caspa.commission' | 'caspa.studioCanon' | 'caspa.research' | 'caspa.psychology' | 'caspa.currentBrief',
  projectId: string,
  owner = cacheOwnerScope(),
): string {
  return `${base}.${owner}.${projectId}`;
}

export function isSensitiveProjectCacheKey(key: string): boolean {
  return key === ACTIVE_HYBRID_PROJECT_KEY || SENSITIVE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function clearSensitiveProjectCaches(): void {
  if (typeof localStorage === 'undefined') return;
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && isSensitiveProjectCacheKey(key)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}
