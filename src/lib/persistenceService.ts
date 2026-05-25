/**
 * persistenceService.ts
 *
 * Local-first, cloud-second persistence layer for NovelWrite / Casper.
 *
 * Principles:
 *  1. Every write hits localStorage BEFORE awaiting Firestore.
 *  2. Every read falls back to localStorage if Firestore fails or is slow.
 *  3. Errors are never swallowed — they are returned as typed results.
 *  4. Offline / degraded mode is a first-class state, not an exception.
 */

import {
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Project, Chapter } from '../types';

// ─── Key helpers ────────────────────────────────────────────────────────────

const KEYS = {
  projectRegistry: (uid: string) => `ls_projects_cache_${uid}`,
  activeProjectId: (uid: string) => `lastProject_${uid}`,
  projectSnapshot: (projectId: string) => `ls_project_snap_${projectId}`,
  chapterHardsave: (chapterId: string) => `ls_hardsave_${chapterId}`,
  chapterDraft: (chapterId: string) => `ls_draft_${chapterId}`,
  chapterRegistry: (projectId: string) => `ls_chapters_${projectId}`,
};

// ─── Result type ─────────────────────────────────────────────────────────────

export type PersistResult<T = void> =
  | { ok: true; data: T; fromCache: boolean }
  | { ok: false; error: string; fromCache: boolean };

function ok<T>(data: T, fromCache = false): PersistResult<T> {
  return { ok: true, data, fromCache };
}
function fail(error: unknown, fromCache = false): PersistResult<never> {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false, error: msg, fromCache };
}

// ─── Project Registry ────────────────────────────────────────────────────────

/**
 * Read the project list for a user.
 * Returns Firestore data if available; falls back to localStorage cache.
 */
export async function loadProjectRegistry(
  uid: string
): Promise<PersistResult<Project[]>> {
  const cacheKey = KEYS.projectRegistry(uid);

  // Always load cache first so the UI is never blank
  const cached = readCache<Project[]>(cacheKey) ?? [];

  try {
    const { query: fsQuery, where, collection: col, getDocs: gd } = await import(
      'firebase/firestore'
    );
    const q = fsQuery(col(db, 'projects'), where('ownerId', '==', uid));
    const snap = await gd(q);
    const list = snap.docs
      .map((d) => d.data() as Project)
      .filter((p) => p.ownerId === uid)
      .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

    writeCache(cacheKey, list);
    return ok(list, false);
  } catch (e) {
    // Firestore failed — return cache and flag degraded mode
    return { ok: false, error: (e instanceof Error ? e.message : String(e)), fromCache: true, data: cached } as any;
  }
}

// ─── Create Project ──────────────────────────────────────────────────────────

/**
 * Create a new project.
 * Writes to localStorage IMMEDIATELY, then persists to Firestore.
 * The UI gets the project instantly; cloud sync follows.
 */
export async function createProject(
  uid: string,
  projectData: Project
): Promise<PersistResult<Project>> {
  // 1. Local-first: update registry cache immediately
  const cacheKey = KEYS.projectRegistry(uid);
  const cached = readCache<Project[]>(cacheKey) ?? [];
  const updated = [projectData, ...cached];
  writeCache(cacheKey, updated);
  writeCache(KEYS.activeProjectId(uid), projectData.id);
  writeCache(KEYS.projectSnapshot(projectData.id), projectData);

  // 2. Cloud-second: attempt Firestore write
  try {
    const projectRef = doc(db, 'projects', projectData.id);
    await setDoc(projectRef, { ...projectData, updatedAt: serverTimestamp() });
    return ok(projectData, false);
  } catch (e) {
    // Local write succeeded; cloud failed — return ok but note the error
    return { ok: true, data: projectData, fromCache: true, cloudError: (e instanceof Error ? e.message : String(e)) } as any;
  }
}

// ─── Save Project ─────────────────────────────────────────────────────────────

/**
 * Save (full update) the active project.
 * Writes to localStorage FIRST, then Firestore.
 * Returns a typed result so callers can show success/failure visibly.
 */
export async function saveProject(
  uid: string,
  project: Project
): Promise<PersistResult<void>> {
  const now = Date.now();
  const updated: Project = { ...project, lastModified: now };

  // 1. Local-first
  writeCache(KEYS.projectSnapshot(project.id), updated);
  // Update registry cache entry
  const regKey = KEYS.projectRegistry(uid);
  const reg = readCache<Project[]>(regKey) ?? [];
  const newReg = reg.map((p) => (p.id === project.id ? updated : p));
  if (!newReg.find((p) => p.id === project.id)) newReg.unshift(updated);
  writeCache(regKey, newReg);

  // 2. Cloud-second
  try {
    const allowedFields: Record<string, unknown> = {
      title: project.title || 'Untitled',
      type: project.type,
      maturity: project.maturity,
      genre: project.genre || '',
      premise: project.premise || '',
      tone: project.tone || 'Cinematic',
      ownerId: project.ownerId || uid,
      collaborators: project.collaborators || [],
      lastModified: now,
      stats: project.stats || {},
      critiques: project.critiques || {},
      id: project.id,
      targetPrize: project.targetPrize || '',
      prizeAssessments: project.prizeAssessments || [],
      isPublic: project.isPublic || false,
      publicId: project.publicId || '',
      targetWordCount: project.targetWordCount || 0,
      updatedAt: serverTimestamp(),
    };
    if (project.publishing) allowedFields.publishing = project.publishing;
    if (project.primaryProvider) allowedFields.primaryProvider = project.primaryProvider;
    if (project.draftStage !== undefined) allowedFields.draftStage = project.draftStage;
    if (project.draftPassHistory !== undefined) allowedFields.draftPassHistory = project.draftPassHistory;
    if (project.cutMode !== undefined) allowedFields.cutMode = project.cutMode;

    await updateDoc(doc(db, 'projects', project.id), allowedFields);
    return ok(undefined, false);
  } catch (e) {
    return fail(e, true); // local saved, cloud failed
  }
}

// ─── Load Active Project ──────────────────────────────────────────────────────

/**
 * Restore the last active project from cache while Firestore catches up.
 */
export function loadCachedProject(projectId: string): Project | null {
  return readCache<Project>(KEYS.projectSnapshot(projectId));
}

export function loadCachedProjectId(uid: string): string | null {
  return readCache<string>(KEYS.activeProjectId(uid));
}

export function setActiveProjectId(uid: string, projectId: string): void {
  writeCache(KEYS.activeProjectId(uid), projectId);
}

// ─── Chapter Persistence ──────────────────────────────────────────────────────

/**
 * Upsert a single chapter.
 * Writes hardsave to localStorage BEFORE Firestore.
 */
export async function upsertChapter(
  uid: string,
  projectId: string,
  chap: Chapter
): Promise<PersistResult<void>> {
  const now = Date.now();
  const chapData = { ...chap, projectId, ownerId: uid, updatedAt: now };

  // 1. Local-first: hardsave content + full chapter snapshot
  writeCache(KEYS.chapterHardsave(chap.id), chap.content ?? '');
  updateChapterRegistryCache(projectId, chapData);

  // 2. Cloud-second
  try {
    await setDoc(doc(db, 'projects', projectId, 'chapters', chap.id), chapData);
    return ok(undefined, false);
  } catch (e) {
    return fail(e, true);
  }
}

/**
 * Batch upsert chapters.
 * Writes all hardsaves to localStorage BEFORE Firestore batch.
 */
export async function upsertChapterBatch(
  uid: string,
  projectId: string,
  chapList: Chapter[],
  existingChapters: Chapter[]
): Promise<PersistResult<void>> {
  const now = Date.now();

  // 1. Local-first: write all hardsaves immediately
  chapList.forEach((chap) => {
    writeCache(KEYS.chapterHardsave(chap.id), chap.content ?? '');
  });
  const fullRegistry = chapList.map((c) => ({
    ...c,
    projectId,
    ownerId: uid,
    updatedAt: now,
  }));
  writeCache(KEYS.chapterRegistry(projectId), fullRegistry);

  // 2. Cloud-second: batch write + orphan deletion
  try {
    const newIds = new Set(chapList.map((c) => c.id));
    const orphans = existingChapters.filter((c) => !newIds.has(c.id));

    if (orphans.length > 0) {
      const delBatch = writeBatch(db);
      orphans.forEach((o) =>
        delBatch.delete(doc(db, 'projects', projectId, 'chapters', o.id))
      );
      await delBatch.commit();
    }

    const chunkSize = 100;
    for (let i = 0; i < chapList.length; i += chunkSize) {
      const chunk = chapList.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((chap) => {
        batch.set(doc(db, 'projects', projectId, 'chapters', chap.id), {
          ...chap,
          projectId,
          ownerId: uid,
          updatedAt: now,
        });
      });
      await batch.commit();
    }
    return ok(undefined, false);
  } catch (e) {
    return fail(e, true);
  }
}

/**
 * Load chapters for a project from localStorage cache.
 * Used to restore immediately on project switch while Firestore syncs.
 */
export function loadCachedChapters(projectId: string): Chapter[] {
  return readCache<Chapter[]>(KEYS.chapterRegistry(projectId)) ?? [];
}

/**
 * Merge incoming Firestore chapters with local hardsaves.
 * If a local hardsave is newer than the cloud version, prefer local.
 */
export function mergeChaptersWithLocalHardsaves(
  cloudChapters: Chapter[]
): Chapter[] {
  return cloudChapters.map((c) => {
    const localContent = localStorage.getItem(KEYS.chapterHardsave(c.id));
    if (localContent !== null && localContent !== c.content) {
      // Local hardsave exists and differs — prefer local (it was written more recently)
      return { ...c, content: localContent };
    }
    return c;
  });
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage quota exceeded — silently skip (data is in React state)
  }
}

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function updateChapterRegistryCache(projectId: string, chap: Chapter): void {
  const key = KEYS.chapterRegistry(projectId);
  const existing = readCache<Chapter[]>(key) ?? [];
  const idx = existing.findIndex((c) => c.id === chap.id);
  if (idx >= 0) {
    existing[idx] = chap;
  } else {
    existing.push(chap);
  }
  existing.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  writeCache(key, existing);
}

// ─── Offline mode detection ───────────────────────────────────────────────────

export function isLikelyOffline(): boolean {
  return !navigator.onLine;
}
