/**
 * Caspa Project Shelf — local project registry, library, and switching
 */

import type { CommissionState } from '../types/commission';
import type { ProjectBriefLike } from './commissionService';
import { getProjectKey } from './researchLibraryService';
import { loadLibrary } from './researchLibraryService';
import { loadPromises } from './promiseRegistryService';
import { loadBlueprint } from './psychologyEngineService';

export type ProjectStatus = 'active' | 'complete';

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
  status: ProjectStatus;
}

export interface ProjectSnapshot {
  brief: ProjectBriefLike;
  whitePage: string;
  manuscriptSource: string;
  commission: CommissionState | null;
  savedAt: string;
  status: ProjectStatus;
}

const SHELF_KEY = 'caspa.shelf';
const BRIEF_KEY = 'caspa.currentBrief';
const COMMISSION_KEY = 'caspa.commission';
const WHITE_PAGE_KEY = 'caspa.whitePage';
const MANUSCRIPT_KEY = 'caspa.manuscriptSource';
const ACTIVE_KEY = 'caspa.activeProjectKey';

const STALE_TITLE_PATTERNS = [
  /^untitled glorious nonsense$/i,
  /^untitled$/i,
  /^new (novel|script|musical|adaptation|gold|chaos)$/i,
];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadShelfIndex(): Record<string, ProjectSnapshot> {
  return safeParse<Record<string, ProjectSnapshot>>(localStorage.getItem(SHELF_KEY), {});
}

function saveShelfIndex(index: Record<string, ProjectSnapshot>): void {
  localStorage.setItem(SHELF_KEY, JSON.stringify(index));
}

function loadCommissionState(): CommissionState | null {
  return safeParse<CommissionState | null>(localStorage.getItem(COMMISSION_KEY), null);
}

function briefFromStorage(): ProjectBriefLike | null {
  return safeParse<ProjectBriefLike | null>(localStorage.getItem(BRIEF_KEY), null);
}

function discoverProjectKeys(): Set<string> {
  const keys = new Set<string>();
  const index = loadShelfIndex();
  Object.keys(index).forEach((k) => keys.add(k));

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

function isStaleProject(snapshot: ProjectSnapshot | null, key: string): boolean {
  if (!snapshot) return true;
  const title = snapshot.brief?.title?.trim() || key;
  if (STALE_TITLE_PATTERNS.some((p) => p.test(title))) {
    const words =
      snapshot.commission?.chapters?.reduce(
        (sum, c) => sum + (c.content?.split(/\s+/).filter(Boolean).length || 0),
        0
      ) || snapshot.whitePage.trim().split(/\s+/).filter(Boolean).length;
    if (words < 20) return true;
  }
  return false;
}

function buildShelfEntry(
  key: string,
  snapshot: ProjectSnapshot | null,
  liveBrief: ProjectBriefLike | null,
  liveCommission: CommissionState | null,
  isActive: boolean
): ShelfProject {
  const brief = isActive ? liveBrief : snapshot?.brief || null;
  const commission = isActive ? liveCommission : snapshot?.commission || null;
  const whitePage = isActive
    ? localStorage.getItem(WHITE_PAGE_KEY) || ''
    : snapshot?.whitePage || '';

  const title = brief?.title || key.replace(/-/g, ' ');
  const mode = brief?.mode || 'novel';
  const idea = brief?.idea || '';
  const wordCount =
    commission?.chapters?.reduce(
      (sum, c) => sum + (c.content?.split(/\s+/).filter(Boolean).length || 0),
      0
    ) || whitePage.trim().split(/\s+/).filter(Boolean).length;

  const status: ProjectStatus =
    snapshot?.status || (isActive ? 'active' : 'active');

  return {
    key,
    title,
    mode,
    idea,
    updatedAt: snapshot?.savedAt || (brief as { createdAt?: string })?.createdAt || new Date().toISOString(),
    wordCount,
    chapterCount: commission?.chapters?.length || 0,
    viabilityScore: commission?.diagnosis?.viabilityScore ?? null,
    researchCount: loadLibrary(key).length,
    promiseCount: loadPromises(key).length,
    hasPsychology: Boolean(loadBlueprint(key)),
    phase: commission?.phase || 'idle',
    isActive,
    status: isActive && snapshot?.status !== 'complete' ? 'active' : status,
  };
}

export function loadShelf(): ShelfProject[] {
  const index = loadShelfIndex();
  const activeBrief = briefFromStorage();
  const activeKey = activeBrief ? getProjectKey(activeBrief) : localStorage.getItem(ACTIVE_KEY);
  const commission = loadCommissionState();
  const keys = discoverProjectKeys();
  if (activeKey) keys.add(activeKey);

  const entries: ShelfProject[] = [];

  keys.forEach((key) => {
    const isActive = key === activeKey;
    const snapshot = index[key] || null;
    entries.push(buildShelfEntry(key, snapshot, isActive ? activeBrief : null, isActive ? commission : null, isActive));
  });

  if (entries.length === 0 && activeBrief && activeKey) {
    entries.push(buildShelfEntry(activeKey, index[activeKey] || null, activeBrief, commission, true));
  }

  return entries.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function loadOpenProjects(): ShelfProject[] {
  return loadShelf().filter((p) => p.status === 'active');
}

export function loadLibraryManuscripts(): ShelfProject[] {
  return loadShelf().filter((p) => p.status === 'complete');
}

export function recordProjectSnapshot(brief: ProjectBriefLike): void {
  const key = getProjectKey(brief);
  const index = loadShelfIndex();
  const existing = index[key];
  index[key] = {
    brief,
    whitePage: localStorage.getItem(WHITE_PAGE_KEY) || '',
    manuscriptSource: localStorage.getItem(MANUSCRIPT_KEY) || '',
    commission: loadCommissionState(),
    savedAt: new Date().toISOString(),
    status: existing?.status || 'active',
  };
  saveShelfIndex(index);
  localStorage.setItem(ACTIVE_KEY, key);
}

export function loadSavedBrief(key: string): ProjectBriefLike | null {
  const index = loadShelfIndex();
  return index[key]?.brief || null;
}

export function loadProjectSnapshot(key: string): ProjectSnapshot | null {
  return loadShelfIndex()[key] || null;
}

export function saveCurrentProjectState(): void {
  const brief = briefFromStorage();
  if (!brief) return;
  recordProjectSnapshot(brief);
}

export function switchToProject(key: string): ProjectSnapshot | null {
  const index = loadShelfIndex();
  const snapshot = index[key];
  if (!snapshot) return null;

  saveCurrentProjectState();

  localStorage.setItem(BRIEF_KEY, JSON.stringify(snapshot.brief));
  localStorage.setItem(WHITE_PAGE_KEY, snapshot.whitePage || '');
  localStorage.setItem(MANUSCRIPT_KEY, snapshot.manuscriptSource || '');
  localStorage.setItem(ACTIVE_KEY, key);

  if (snapshot.commission) {
    localStorage.setItem(COMMISSION_KEY, JSON.stringify(snapshot.commission));
  } else {
    localStorage.removeItem(COMMISSION_KEY);
  }

  return snapshot;
}

export function completeProject(key: string): boolean {
  const index = loadShelfIndex();
  const snapshot = index[key];
  if (!snapshot) return false;

  index[key] = {
    ...snapshot,
    status: 'complete',
    savedAt: new Date().toISOString(),
  };
  saveShelfIndex(index);

  const activeKey = localStorage.getItem(ACTIVE_KEY);
  if (activeKey === key) {
    localStorage.removeItem(BRIEF_KEY);
    localStorage.removeItem(WHITE_PAGE_KEY);
    localStorage.removeItem(MANUSCRIPT_KEY);
    localStorage.removeItem(COMMISSION_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  }

  return true;
}

export function reopenProject(key: string): ProjectSnapshot | null {
  const index = loadShelfIndex();
  const snapshot = index[key];
  if (!snapshot) return null;

  index[key] = { ...snapshot, status: 'active', savedAt: new Date().toISOString() };
  saveShelfIndex(index);
  return switchToProject(key);
}

export function pruneStaleProjects(): number {
  const index = loadShelfIndex();
  let removed = 0;
  const activeKey = localStorage.getItem(ACTIVE_KEY);

  Object.keys(index).forEach((key) => {
    if (key === activeKey) return;
    const snap = index[key];
    if (snap.status === 'complete') return;
    if (isStaleProject(snap, key)) {
      delete index[key];
      removed += 1;
    }
  });

  if (removed > 0) saveShelfIndex(index);
  return removed;
}

export function deleteProject(key: string): boolean {
  const index = loadShelfIndex();
  if (!index[key]) return false;
  delete index[key];
  saveShelfIndex(index);

  if (localStorage.getItem(ACTIVE_KEY) === key) {
    localStorage.removeItem(BRIEF_KEY);
    localStorage.removeItem(WHITE_PAGE_KEY);
    localStorage.removeItem(MANUSCRIPT_KEY);
    localStorage.removeItem(COMMISSION_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  }
  return true;
}
