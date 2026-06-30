/**
 * Caspa Project Shelf — local project registry from browser storage
 */

import type { CommissionState } from '../types/commission';
import type { ProjectBriefLike } from './commissionService';
import { getProjectKey } from './researchLibraryService';
import { loadLibrary } from './researchLibraryService';
import { loadPromises } from './promiseRegistryService';
import { loadBlueprint } from './psychologyEngineService';

export interface ShelfProject {
  key: string;
  title: string;
  mode: string;
  idea: string;
  updatedAt: string;
  wordCount: number;
  chapterCount: number;
  viabilityScore: number | null;
  researchCount: number;
  promiseCount: number;
  hasPsychology: boolean;
  phase: string;
  isActive: boolean;
}

const SHELF_KEY = 'caspa.shelf';
const BRIEF_KEY = 'caspa.currentBrief';
const COMMISSION_KEY = 'caspa.commission';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadCommissionState(): CommissionState | null {
  return safeParse<CommissionState | null>(localStorage.getItem(COMMISSION_KEY), null);
}

function discoverProjectKeys(): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith('caspa.')) continue;
    const researchMatch = k.match(/^caspa\.research\.(.+)$/);
    const promiseMatch = k.match(/^caspa\.promises\.(.+)$/);
    const psychMatch = k.match(/^caspa\.psychology\.(.+)$/);
    if (researchMatch) keys.add(researchMatch[1]);
    if (promiseMatch) keys.add(promiseMatch[1]);
    if (psychMatch) keys.add(psychMatch[1]);
  }
  return keys;
}

function briefFromStorage(): ProjectBriefLike | null {
  return safeParse<ProjectBriefLike | null>(localStorage.getItem(BRIEF_KEY), null);
}

function buildShelfEntry(
  key: string,
  brief: ProjectBriefLike | null,
  commission: CommissionState | null,
  isActive: boolean
): ShelfProject {
  const title = brief?.title || key.replace(/-/g, ' ');
  const mode = brief?.mode || 'novel';
  const idea = brief?.idea || '';
  const wordCount =
    commission?.chapters?.reduce(
      (sum, c) => sum + (c.content?.split(/\s+/).filter(Boolean).length || 0),
      0
    ) ||
    (localStorage.getItem('caspa.whitePage') || '').trim().split(/\s+/).filter(Boolean).length;

  return {
    key,
    title,
    mode,
    idea,
    updatedAt: brief?.createdAt || new Date().toISOString(),
    wordCount,
    chapterCount: commission?.chapters?.length || 0,
    viabilityScore: commission?.diagnosis?.viabilityScore ?? null,
    researchCount: loadLibrary(key).length,
    promiseCount: loadPromises(key).length,
    hasPsychology: Boolean(loadBlueprint(key)),
    phase: commission?.phase || 'idle',
    isActive,
  };
}

export function loadShelf(): ShelfProject[] {
  const activeBrief = briefFromStorage();
  const activeKey = activeBrief ? getProjectKey(activeBrief) : null;
  const commission = loadCommissionState();
  const keys = discoverProjectKeys();
  if (activeKey) keys.add(activeKey);

  const entries: ShelfProject[] = [];

  keys.forEach((key) => {
    const isActive = key === activeKey;
    const brief = isActive ? activeBrief : null;
    const comm = isActive ? commission : null;
    entries.push(buildShelfEntry(key, brief, comm, isActive));
  });

  if (entries.length === 0 && activeBrief && activeKey) {
    entries.push(buildShelfEntry(activeKey, activeBrief, commission, true));
  }

  return entries.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function recordProjectSnapshot(brief: ProjectBriefLike): void {
  const key = getProjectKey(brief);
  const shelf = safeParse<Record<string, { brief: ProjectBriefLike; savedAt: string }>>(
    localStorage.getItem(SHELF_KEY),
    {}
  );
  shelf[key] = { brief, savedAt: new Date().toISOString() };
  localStorage.setItem(SHELF_KEY, JSON.stringify(shelf));
}

export function loadSavedBrief(key: string): ProjectBriefLike | null {
  const shelf = safeParse<Record<string, { brief: ProjectBriefLike; savedAt: string }>>(
    localStorage.getItem(SHELF_KEY),
    {}
  );
  return shelf[key]?.brief || null;
}
