/**
 * Caspa local-first Firestore compatibility layer.
 *
 * It implements just enough of the Firestore client API used by this codebase,
 * backed by browser localStorage and mirrored to the self-hosted Express server
 * at /api/local/db. This removes Firestore quota/rules/login failures while
 * preserving the existing App.tsx data flow.
 */

export interface LocalDocRef { path: string; id: string; type: 'doc'; }
export interface LocalCollectionRef { path: string; id: string; type: 'collection'; }
export interface LocalQuery { collection: LocalCollectionRef; constraints: any[]; type: 'query'; }

export const db = { type: 'local-firestore', name: 'caspa-local-db' } as const;

const STORE_KEY = 'caspa_local_firestore_v1';
const SERVER_SYNC_KEY = 'caspa_local_server_sync_enabled_v1';

type DocMap = Record<string, any>;

type Listener = {
  target: LocalDocRef | LocalCollectionRef | LocalQuery;
  next: (snap: any) => void;
  error?: (err: unknown) => void;
};

let docs: DocMap = {};
let serverLoaded = false;
const listeners = new Set<Listener>();
let persistTimer: number | null = null;

function hasWindow() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function normalise(parts: Array<string | number | undefined | null>): string {
  return parts.filter(p => p !== undefined && p !== null && String(p).trim() !== '').map(p => String(p).replace(/^\/+|\/+$/g, '')).join('/');
}

function loadLocal(): DocMap {
  if (!hasWindow()) return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Caspa local store: failed to parse local cache', e);
    return {};
  }
}

docs = loadLocal();

function saveLocal() {
  if (!hasWindow()) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(docs));
  } catch (e) {
    console.warn('Caspa local store: localStorage write failed', e);
  }
}

function serverSyncEnabled() {
  if (!hasWindow()) return false;
  const saved = localStorage.getItem(SERVER_SYNC_KEY);
  return saved === null ? true : saved === 'true';
}

async function loadServerOnce() {
  if (!hasWindow() || serverLoaded || !serverSyncEnabled()) return;
  serverLoaded = true;
  try {
    const res = await fetch('/api/local/db', { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const body = await res.json();
    if (body?.docs && typeof body.docs === 'object') {
      docs = { ...body.docs, ...docs };
      saveLocal();
      fireAll();
    }
  } catch (e) {
    console.info('Caspa local store: server mirror unavailable, using browser storage only.');
  }
}

function queuePersist() {
  saveLocal();
  if (!hasWindow() || !serverSyncEnabled()) return;
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(async () => {
    try {
      await fetch('/api/local/db', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docs }),
      });
    } catch (e) {
      console.info('Caspa local store: server mirror write failed; browser copy is still safe.');
    }
  }, 250);
}

function idFromPath(path: string): string {
  return path.split('/').filter(Boolean).pop() || path;
}

function isDirectChild(path: string, collectionPath: string) {
  const prefix = `${collectionPath}/`;
  if (!path.startsWith(prefix)) return false;
  return !path.slice(prefix.length).includes('/');
}

function docSnap(ref: LocalDocRef) {
  const data = docs[ref.path];
  return {
    id: ref.id,
    ref,
    metadata: { hasPendingWrites: false, fromCache: true },
    exists: () => data !== undefined,
    data: () => data,
  };
}

function applyWhere(item: any, constraint: any): boolean {
  if (!constraint) return true;
  if (constraint.type === 'or') return constraint.constraints.some((c: any) => applyWhere(item, c));
  if (constraint.type !== 'where') return true;

  const actual = item?.[constraint.field];
  switch (constraint.op) {
    case '==': return actual === constraint.value;
    case '!=': return actual !== constraint.value;
    case 'array-contains': return Array.isArray(actual) && actual.includes(constraint.value);
    case 'in': return Array.isArray(constraint.value) && constraint.value.includes(actual);
    default: return true;
  }
}

function querySnap(target: LocalCollectionRef | LocalQuery) {
  const collectionRef = target.type === 'query' ? target.collection : target;
  const constraints = target.type === 'query' ? target.constraints : [];

  const order = constraints.find((c: any) => c?.type === 'orderBy');
  const wheres = constraints.filter((c: any) => c?.type === 'where' || c?.type === 'or');
  const max = constraints.find((c: any) => c?.type === 'limit')?.count;

  let rows = Object.entries(docs)
    .filter(([path]) => isDirectChild(path, collectionRef.path))
    .map(([path, data]) => ({ path, id: idFromPath(path), data }));

  if (wheres.length) rows = rows.filter(row => wheres.every((w: any) => applyWhere(row.data, w)));
  if (order) {
    rows.sort((a, b) => {
      const av = a.data?.[order.field] ?? 0;
      const bv = b.data?.[order.field] ?? 0;
      const res = av > bv ? 1 : av < bv ? -1 : 0;
      return order.direction === 'desc' ? -res : res;
    });
  }
  if (typeof max === 'number') rows = rows.slice(0, max);

  const snapshots = rows.map(row => ({
    id: row.id,
    ref: doc(db, row.path),
    data: () => row.data,
  }));

  return {
    docs: snapshots,
    empty: snapshots.length === 0,
    size: snapshots.length,
    forEach: (fn: (doc: any) => void) => snapshots.forEach(fn),
  };
}

function fire(listener: Listener) {
  try {
    if (listener.target.type === 'doc') listener.next(docSnap(listener.target));
    else listener.next(querySnap(listener.target as any));
  } catch (e) {
    listener.error?.(e);
  }
}

function fireAll() {
  listeners.forEach(fire);
}

export function getFirestore() {
  return db;
}

export function doc(_dbOrRef: any, ...pathParts: string[]): LocalDocRef {
  const path = pathParts.length === 0 && typeof _dbOrRef === 'string'
    ? normalise([_dbOrRef])
    : normalise(pathParts);
  return { type: 'doc', path, id: idFromPath(path) };
}

export function collection(_dbOrRef: any, ...pathParts: string[]): LocalCollectionRef {
  const path = pathParts.length === 0 && typeof _dbOrRef === 'string'
    ? normalise([_dbOrRef])
    : normalise(pathParts);
  return { type: 'collection', path, id: idFromPath(path) };
}

export function query(collectionRef: LocalCollectionRef, ...constraints: any[]): LocalQuery {
  return { type: 'query', collection: collectionRef, constraints };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function or(...constraints: any[]) {
  return { type: 'or', constraints };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(count: number) {
  return { type: 'limit', count };
}

export function serverTimestamp() {
  return Date.now();
}

export async function getDoc(ref: LocalDocRef) {
  await loadServerOnce();
  return docSnap(ref);
}

export async function getDocFromServer(ref: LocalDocRef) {
  await loadServerOnce();
  return docSnap(ref);
}

export async function getDocs(target: LocalCollectionRef | LocalQuery) {
  await loadServerOnce();
  return querySnap(target);
}

export async function setDoc(ref: LocalDocRef, data: any, options?: { merge?: boolean }) {
  docs[ref.path] = options?.merge && docs[ref.path]
    ? { ...docs[ref.path], ...data }
    : { ...data };
  queuePersist();
  fireAll();
}

export async function updateDoc(ref: LocalDocRef, data: any) {
  docs[ref.path] = { ...(docs[ref.path] || {}), ...data };
  queuePersist();
  fireAll();
}

export async function deleteDoc(ref: LocalDocRef) {
  delete docs[ref.path];
  queuePersist();
  fireAll();
}

export function writeBatch(_db?: any) {
  const operations: Array<() => void> = [];
  return {
    set(ref: LocalDocRef, data: any, options?: { merge?: boolean }) {
      operations.push(() => {
        docs[ref.path] = options?.merge && docs[ref.path]
          ? { ...docs[ref.path], ...data }
          : { ...data };
      });
    },
    update(ref: LocalDocRef, data: any) {
      operations.push(() => { docs[ref.path] = { ...(docs[ref.path] || {}), ...data }; });
    },
    delete(ref: LocalDocRef) {
      operations.push(() => { delete docs[ref.path]; });
    },
    async commit() {
      operations.forEach(op => op());
      queuePersist();
      fireAll();
    },
  };
}

export function onSnapshot(target: LocalDocRef | LocalCollectionRef | LocalQuery, next: (snap: any) => void, error?: (err: unknown) => void) {
  const listener = { target, next, error };
  listeners.add(listener);
  loadServerOnce().finally(() => fire(listener));
  return () => listeners.delete(listener);
}

export function __caspaLocalFirestoreDump() {
  return { ...docs };
}

export async function addDoc(collectionRef: LocalCollectionRef, data: any) {
  const id = `doc_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
  const ref = doc(db, collectionRef.path, id);
  await setDoc(ref, { ...data, id: data?.id || id });
  return ref;
}
