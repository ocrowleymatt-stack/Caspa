// These are sync metadata, not project content, so keep them outside the
// caspa.* workspace namespace that is copied into user recovery snapshots.
const MAP_KEY = 'atlas.caspaServerProjectMap.v1';
const MIGRATION_KEY = 'atlas.caspaServerMigration.v1';
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;

interface ServerMapping { id: string; revision: number; checksum: string }

function mappings(): Record<string, ServerMapping> {
  try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch { return {}; }
}

function shelf(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem('caspa.shelf') || '{}'); } catch { return {}; }
}

async function jsonRequest(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(json?.message || `Project sync failed (${response.status})`), { status: response.status, data: json });
  return json.data;
}

function activeSnapshot(): Record<string, unknown> | null {
  try {
    const brief = JSON.parse(localStorage.getItem('caspa.currentBrief') || 'null');
    if (!brief) return null;
    return {
      brief,
      whitePage: localStorage.getItem('caspa.whitePage') || '',
      manuscriptSource: localStorage.getItem('caspa.manuscriptSource') || '',
      commission: JSON.parse(localStorage.getItem('caspa.commission') || 'null'),
      savedAt: new Date().toISOString(),
      status: 'active',
    };
  } catch { return null; }
}

function projectEntries(): Array<{ projectKey: string; title: string; mode: string; state: Record<string, unknown> }> {
  const entries = shelf();
  const activeKey = localStorage.getItem('caspa.activeProjectKey') || '';
  const active = activeSnapshot();
  if (activeKey && active) entries[activeKey] = active;
  return Object.entries(entries).map(([projectKey, state]: [string, any]) => ({
    projectKey,
    title: String(state?.brief?.title || projectKey),
    mode: String(state?.brief?.mode || 'novel'),
    state,
  }));
}

export async function syncProjectsToServer(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const map = mappings();
    let remoteList: any[] | null = null;
    for (const project of projectEntries()) {
      let link = map[project.projectKey];
      if (!link) {
        try {
          const created = await jsonRequest('/api/projects', { method: 'POST', body: JSON.stringify(project) });
          link = { id: created.id, revision: created.revision, checksum: created.checksum };
        } catch (error: any) {
          if (error?.status !== 409) throw error;
          remoteList ||= (await jsonRequest('/api/projects')).projects || [];
          const existing = remoteList.find((item) => item.projectKey === project.projectKey);
          if (!existing) throw error;
          link = { id: existing.id, revision: existing.revision, checksum: existing.checksum };
        }
      } else {
        try {
          const updated = await jsonRequest(`/api/projects/${encodeURIComponent(link.id)}`, {
            method: 'PATCH', headers: { 'If-Match': `"${link.revision}"` },
            body: JSON.stringify({ state: project.state, title: project.title, mode: project.mode }),
          });
          link = { id: updated.id, revision: updated.revision, checksum: updated.checksum };
        } catch (error: any) {
          if (error?.status !== 409) throw error;
          // Never overwrite a newer server revision. Leave the local recovery
          // copy intact and surface the conflict through migration state.
          localStorage.setItem(MIGRATION_KEY, JSON.stringify({ status: 'conflict', projectKey: project.projectKey, at: new Date().toISOString() }));
          continue;
        }
      }
      map[project.projectKey] = link;
      localStorage.setItem(MAP_KEY, JSON.stringify(map));
    }
    localStorage.setItem(MIGRATION_KEY, JSON.stringify({ status: 'verified', projects: Object.keys(map).length, at: new Date().toISOString() }));
  })().finally(() => { running = null; });
  return running;
}

export function scheduleServerProjectSync(delayMs = 750): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { void syncProjectsToServer().catch((error) => console.warn('[ProjectSync]', error)); }, delayMs);
}

export function projectMigrationState(): Record<string, unknown> | null {
  try { return JSON.parse(localStorage.getItem(MIGRATION_KEY) || 'null'); } catch { return null; }
}
