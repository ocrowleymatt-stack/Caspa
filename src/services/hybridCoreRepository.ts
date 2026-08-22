import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';

let pool: Pool | null = null;

function database(): Pool {
  if (!pool) {
    const connectionString = process.env.CASPA_DATABASE_URL;
    if (!connectionString) throw new Error('CASPA_DATABASE_URL is required');
    pool = new Pool({ connectionString, max: Number(process.env.CASPA_DB_POOL_SIZE || 10) });
  }
  return pool;
}

export interface ManuscriptVersion {
  id: string;
  projectId: string;
  revision: number;
  name: string;
  trigger: string;
  content: string;
  checksum: string;
  wordCount: number;
  chapterCount: number;
  sourceVersionId: string | null;
  createdAt: string;
}

function words(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function chapters(content: string): number {
  const explicit = (content.match(/^#{1,3}\s+chapter\s+\d+\b[^\n]*/gim) || []).length;
  if (explicit) return explicit;
  return Math.max(1, (content.match(/^#\s+[^#\n]+/gm) || []).length);
}

export function manuscriptMetrics(content: string): { wordCount: number; chapterCount: number } {
  return { wordCount: words(content), chapterCount: chapters(content) };
}

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function mapVersion(row: any): ManuscriptVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    revision: row.revision,
    name: row.name,
    trigger: row.trigger,
    content: row.content,
    checksum: row.checksum,
    wordCount: Number(row.word_count),
    chapterCount: Number(row.chapter_count),
    sourceVersionId: row.source_version_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function ensureHybridCoreSchema(): Promise<void> {
  await database().query(`
    CREATE TABLE IF NOT EXISTS caspa_manuscript_versions (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES caspa_projects(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      revision integer NOT NULL,
      name text NOT NULL,
      trigger text NOT NULL,
      content text NOT NULL,
      checksum text NOT NULL,
      word_count integer NOT NULL,
      chapter_count integer NOT NULL,
      source_version_id uuid REFERENCES caspa_manuscript_versions(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(project_id, revision)
    );
    CREATE INDEX IF NOT EXISTS caspa_manuscript_versions_owner_idx
      ON caspa_manuscript_versions(user_id, project_id, revision DESC);
    CREATE TABLE IF NOT EXISTS caspa_draft_previews (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES caspa_projects(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      source_version_id uuid REFERENCES caspa_manuscript_versions(id) ON DELETE SET NULL,
      status text NOT NULL CHECK(status IN ('previewed','accepted','rejected','stale')),
      mode text NOT NULL,
      chapter_title text NOT NULL,
      content text NOT NULL,
      grounding jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      handled_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS caspa_draft_previews_owner_idx
      ON caspa_draft_previews(user_id, project_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS caspa_project_audit_events (
      id bigserial PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES caspa_projects(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      event_type text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS caspa_project_audit_owner_idx
      ON caspa_project_audit_events(user_id, project_id, id DESC);
    CREATE TABLE IF NOT EXISTS caspa_diagnoses (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES caspa_projects(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      version_id uuid REFERENCES caspa_manuscript_versions(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'complete',
      summary text NOT NULL,
      findings jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS caspa_diagnoses_owner_idx
      ON caspa_diagnoses(user_id, project_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS caspa_export_preflights (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES caspa_projects(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      version_id uuid NOT NULL REFERENCES caspa_manuscript_versions(id) ON DELETE CASCADE,
      passed boolean NOT NULL,
      checks jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS caspa_rebuild_plans (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL REFERENCES caspa_projects(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      source_version_id uuid REFERENCES caspa_manuscript_versions(id) ON DELETE SET NULL,
      status text NOT NULL CHECK(status IN ('analyzed','planned','committed','abandoned')),
      analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
      changes jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS caspa_rebuild_plans_owner_idx
      ON caspa_rebuild_plans(user_id, project_id, created_at DESC);
  `);
}

export async function getOwnedProject(userId: string, projectId: string): Promise<any | null> {
  const result = await database().query('SELECT * FROM caspa_projects WHERE id=$1 AND user_id=$2', [projectId, userId]);
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { id: row.id, title: row.title, mode: row.mode, state: row.state };
}

async function ownedProject(userId: string, projectId: string): Promise<boolean> {
  const result = await database().query('SELECT 1 FROM caspa_projects WHERE id=$1 AND user_id=$2', [projectId, userId]);
  return Boolean(result.rowCount);
}

export async function listManuscriptVersions(userId: string, projectId: string): Promise<ManuscriptVersion[]> {
  if (!(await ownedProject(userId, projectId))) return [];
  const result = await database().query(
    'SELECT * FROM caspa_manuscript_versions WHERE user_id=$1 AND project_id=$2 ORDER BY revision DESC',
    [userId, projectId],
  );
  return result.rows.map(mapVersion);
}

export async function createManuscriptVersion(userId: string, projectId: string, input: {
  name: string; trigger: string; content: string; sourceVersionId?: string | null;
}): Promise<ManuscriptVersion | null> {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    const owner = await client.query(
      'SELECT id FROM caspa_projects WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [projectId, userId],
    );
    if (!owner.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    const next = await client.query(
      'SELECT COALESCE(MAX(revision),0)+1 AS revision FROM caspa_manuscript_versions WHERE project_id=$1',
      [projectId],
    );
    const id = randomUUID();
    const created = await client.query(
      `INSERT INTO caspa_manuscript_versions
       (id,project_id,user_id,revision,name,trigger,content,checksum,word_count,chapter_count,source_version_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, projectId, userId, Number(next.rows[0].revision), input.name, input.trigger, input.content,
        checksum(input.content), words(input.content), chapters(input.content), input.sourceVersionId || null],
    );
    await client.query(
      'INSERT INTO caspa_project_audit_events(project_id,user_id,event_type,payload) VALUES($1,$2,$3,$4)',
      [projectId, userId, 'manuscript.version.created', { versionId: id, trigger: input.trigger, name: input.name }],
    );
    await client.query('COMMIT');
    return mapVersion(created.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createDraftPreview(userId: string, projectId: string, input: {
  sourceVersionId?: string | null; mode: string; chapterTitle: string; content: string; grounding?: Record<string, unknown>;
}): Promise<any | null> {
  if (!(await ownedProject(userId, projectId))) return null;
  await database().query(
    "UPDATE caspa_draft_previews SET status='stale',handled_at=now() WHERE user_id=$1 AND project_id=$2 AND status='previewed'",
    [userId, projectId],
  );
  const id = randomUUID();
  const result = await database().query(
    `INSERT INTO caspa_draft_previews(id,project_id,user_id,source_version_id,status,mode,chapter_title,content,grounding)
     VALUES($1,$2,$3,$4,'previewed',$5,$6,$7,$8) RETURNING *`,
    [id, projectId, userId, input.sourceVersionId || null, input.mode, input.chapterTitle, input.content, input.grounding || {}],
  );
  await database().query(
    'INSERT INTO caspa_project_audit_events(project_id,user_id,event_type,payload) VALUES($1,$2,$3,$4)',
    [projectId, userId, 'draft.preview.created', { previewId: id, mode: input.mode, chapterTitle: input.chapterTitle }],
  );
  return result.rows[0];
}

export async function latestDraftPreview(userId: string, projectId: string): Promise<any | null> {
  const result = await database().query(
    'SELECT * FROM caspa_draft_previews WHERE user_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT 1',
    [userId, projectId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { id: row.id, projectId: row.project_id, sourceVersionId: row.source_version_id, status: row.status, mode: row.mode, chapterTitle: row.chapter_title, content: row.content, grounding: row.grounding, createdAt: new Date(row.created_at).toISOString() };
}

export async function rejectDraftPreview(userId: string, previewId: string): Promise<boolean> {
  const result = await database().query(
    "UPDATE caspa_draft_previews SET status='rejected',handled_at=now() WHERE id=$1 AND user_id=$2 AND status='previewed' RETURNING project_id",
    [previewId, userId],
  );
  if (!result.rowCount) return false;
  await database().query(
    'INSERT INTO caspa_project_audit_events(project_id,user_id,event_type,payload) VALUES($1,$2,$3,$4)',
    [result.rows[0].project_id, userId, 'draft.preview.rejected', { previewId }],
  );
  return true;
}

export async function acceptDraftPreview(userId: string, previewId: string): Promise<ManuscriptVersion | null> {
  const preview = await database().query(
    "UPDATE caspa_draft_previews SET status='accepted',handled_at=now() WHERE id=$1 AND user_id=$2 AND status='previewed' RETURNING *",
    [previewId, userId],
  );
  if (!preview.rowCount) return null;
  const row = preview.rows[0];
  const source = row.source_version_id
    ? await database().query('SELECT content FROM caspa_manuscript_versions WHERE id=$1 AND user_id=$2', [row.source_version_id, userId])
    : null;
  const previous = String(source?.rows?.[0]?.content || '');
  const content = row.mode === 'replace' ? row.content : `${previous}${previous.trim() ? '\n\n---\n\n' : ''}# ${row.chapter_title}\n\n${row.content}`;
  try {
    const version = await createManuscriptVersion(userId, row.project_id, {
      name: `Accepted draft · ${row.chapter_title}`,
      trigger: 'draft-accepted',
      content,
      sourceVersionId: row.source_version_id,
    });
    if (!version) throw new Error('Draft project is unavailable');
    return version;
  } catch (error) {
    await database().query("UPDATE caspa_draft_previews SET status='previewed',handled_at=NULL WHERE id=$1 AND user_id=$2 AND status='accepted'", [previewId, userId]);
    throw error;
  }
}

export async function saveDiagnosis(userId: string, projectId: string, input: {
  versionId?: string | null; summary: string; findings: any[];
}): Promise<any | null> {
  if (!(await ownedProject(userId, projectId))) return null;
  const id = randomUUID();
  const result = await database().query(
    `INSERT INTO caspa_diagnoses(id,project_id,user_id,version_id,summary,findings)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, projectId, userId, input.versionId || null, input.summary, JSON.stringify(input.findings)],
  );
  await database().query(
    'INSERT INTO caspa_project_audit_events(project_id,user_id,event_type,payload) VALUES($1,$2,$3,$4)',
    [projectId, userId, 'workshop.diagnosis.completed', { diagnosisId: id, findingCount: input.findings.length }],
  );
  return result.rows[0];
}

export async function latestDiagnosis(userId: string, projectId: string): Promise<any | null> {
  const result = await database().query(
    'SELECT * FROM caspa_diagnoses WHERE user_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT 1',
    [userId, projectId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { id: row.id, versionId: row.version_id, summary: row.summary, findings: row.findings, createdAt: new Date(row.created_at).toISOString() };
}

export async function runExportPreflight(userId: string, projectId: string): Promise<any | null> {
  const project = await getOwnedProject(userId, projectId);
  const versions = await listManuscriptVersions(userId, projectId);
  if (!project || !versions[0]) return null;
  const version = versions[0];
  const checks = [
    { id: 'content', label: 'Manuscript content', passed: version.wordCount >= 500, detail: `${version.wordCount.toLocaleString()} words` },
    { id: 'structure', label: 'Document structure', passed: version.chapterCount >= 1, detail: `${version.chapterCount} chapter/section heading${version.chapterCount === 1 ? '' : 's'}` },
    { id: 'title', label: 'Project title', passed: Boolean(String(project.title || '').trim()), detail: project.title },
    { id: 'version', label: 'Immutable checkpoint', passed: Boolean(version.checksum), detail: `Version ${version.revision} · ${version.checksum.slice(0, 12)}` },
  ];
  const passed = checks.every((check) => check.passed);
  const id = randomUUID();
  const saved = await database().query(
    'INSERT INTO caspa_export_preflights(id,project_id,user_id,version_id,passed,checks) VALUES($1,$2,$3,$4,$5,$6) RETURNING created_at',
    [id, projectId, userId, version.id, passed, JSON.stringify(checks)],
  );
  return { id, projectId, versionId: version.id, passed, checks, createdAt: new Date(saved.rows[0].created_at).toISOString() };
}

export async function exportableManuscript(userId: string, projectId: string): Promise<{ title: string; version: ManuscriptVersion } | null> {
  const project = await getOwnedProject(userId, projectId);
  const versions = await listManuscriptVersions(userId, projectId);
  if (!project || !versions[0]) return null;
  const allowed = await database().query(
    `SELECT 1 FROM caspa_export_preflights WHERE user_id=$1 AND project_id=$2 AND version_id=$3 AND passed=true
     ORDER BY created_at DESC LIMIT 1`,
    [userId, projectId, versions[0].id],
  );
  return allowed.rowCount ? { title: project.title, version: versions[0] } : null;
}

export async function getAuditEvents(userId: string, projectId: string): Promise<any[]> {
  if (!(await ownedProject(userId, projectId))) return [];
  const result = await database().query(
    'SELECT id,event_type,payload,created_at FROM caspa_project_audit_events WHERE user_id=$1 AND project_id=$2 ORDER BY id DESC LIMIT 200',
    [userId, projectId],
  );
  return result.rows.map((row) => ({ id: String(row.id), type: row.event_type, payload: row.payload, createdAt: new Date(row.created_at).toISOString() }));
}

function manuscriptFromLegacyState(state: any): string {
  return String(
    state?.commission?.artefact
      || state?.manuscript
      || state?.manuscriptSource
      || state?.whitePage
      || '',
  ).trim();
}

/** Copy legacy project manuscripts into immutable v2 history without changing legacy state. */
export async function migrateOwnedProjects(userId: string): Promise<{ imported: number; skipped: number; empty: number }> {
  const projects = await database().query('SELECT id,title,state FROM caspa_projects WHERE user_id=$1 ORDER BY created_at', [userId]);
  let imported = 0;
  let skipped = 0;
  let empty = 0;
  for (const project of projects.rows) {
    const legacyChapterCount = Array.isArray(project.state?.commission?.chapters)
      ? project.state.commission.chapters.length
      : 0;
    const exists = await database().query(
      'SELECT id,content,word_count,chapter_count FROM caspa_manuscript_versions WHERE project_id=$1 ORDER BY revision',
      [project.id],
    );
    if (exists.rowCount) {
      for (const version of exists.rows) {
        const correctedWords = words(version.content);
        const correctedChapters = legacyChapterCount || chapters(version.content);
        if (Number(version.word_count) !== correctedWords || Number(version.chapter_count) !== correctedChapters) {
          await database().query(
            'UPDATE caspa_manuscript_versions SET word_count=$1,chapter_count=$2 WHERE id=$3 AND user_id=$4',
            [correctedWords, correctedChapters, version.id, userId],
          );
        }
      }
      skipped += 1;
      continue;
    }
    const content = manuscriptFromLegacyState(project.state);
    if (!content) { empty += 1; continue; }
    const created = await createManuscriptVersion(userId, project.id, {
      name: 'Imported legacy manuscript',
      trigger: 'legacy-migration',
      content,
    });
    if (created) imported += 1;
  }
  return { imported, skipped, empty };
}

function mapRebuild(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceVersionId: row.source_version_id,
    status: row.status,
    analysis: row.analysis,
    changes: row.changes,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function saveRebuildPlan(userId: string, projectId: string, input: {
  sourceVersionId?: string | null;
  status: 'analyzed' | 'planned';
  analysis: Record<string, unknown>;
  changes: unknown[];
}): Promise<any | null> {
  if (!(await ownedProject(userId, projectId))) return null;
  await database().query(
    "UPDATE caspa_rebuild_plans SET status='abandoned', updated_at=now() WHERE user_id=$1 AND project_id=$2 AND status IN ('analyzed','planned')",
    [userId, projectId],
  );
  const id = randomUUID();
  const result = await database().query(
    `INSERT INTO caspa_rebuild_plans(id,project_id,user_id,source_version_id,status,analysis,changes)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, projectId, userId, input.sourceVersionId || null, input.status, JSON.stringify(input.analysis), JSON.stringify(input.changes)],
  );
  await database().query(
    'INSERT INTO caspa_project_audit_events(project_id,user_id,event_type,payload) VALUES($1,$2,$3,$4)',
    [projectId, userId, `rebuild.${input.status}`, { planId: id, changeCount: input.changes.length }],
  );
  return mapRebuild(result.rows[0]);
}

export async function latestRebuildPlan(userId: string, projectId: string): Promise<any | null> {
  const result = await database().query(
    "SELECT * FROM caspa_rebuild_plans WHERE user_id=$1 AND project_id=$2 AND status IN ('analyzed','planned') ORDER BY created_at DESC LIMIT 1",
    [userId, projectId],
  );
  return result.rowCount ? mapRebuild(result.rows[0]) : null;
}

export async function updateRebuildChange(userId: string, planId: string, changeId: string, status: 'accepted' | 'rejected'): Promise<any | null> {
  const result = await database().query(
    "SELECT * FROM caspa_rebuild_plans WHERE id=$1 AND user_id=$2 AND status IN ('analyzed','planned')",
    [planId, userId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  const changes = Array.isArray(row.changes) ? row.changes : [];
  const next = changes.map((change: any) => change.id === changeId ? { ...change, status } : change);
  if (!next.some((change: any) => change.id === changeId)) return null;
  const updated = await database().query(
    'UPDATE caspa_rebuild_plans SET changes=$1, updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING *',
    [JSON.stringify(next), planId, userId],
  );
  await database().query(
    'INSERT INTO caspa_project_audit_events(project_id,user_id,event_type,payload) VALUES($1,$2,$3,$4)',
    [row.project_id, userId, `rebuild.change.${status}`, { planId, changeId }],
  );
  return mapRebuild(updated.rows[0]);
}

export async function markRebuildCommitted(userId: string, planId: string): Promise<void> {
  await database().query(
    "UPDATE caspa_rebuild_plans SET status='committed', updated_at=now() WHERE id=$1 AND user_id=$2",
    [planId, userId],
  );
}

export function summarizeVersion(version: ManuscriptVersion | null) {
  if (!version) return null;
  return {
    id: version.id,
    revision: version.revision,
    name: version.name,
    trigger: version.trigger,
    wordCount: version.wordCount,
    chapterCount: version.chapterCount,
    checksum: version.checksum,
    createdAt: version.createdAt,
  };
}

export async function workspaceSnapshot(userId: string, projectId: string): Promise<any | null> {
  const project = await getOwnedProject(userId, projectId);
  if (!project) return null;
  const versions = await listManuscriptVersions(userId, projectId);
  const latest = versions[0] || null;
  const [preview, diagnosis, rebuild] = await Promise.all([
    latestDraftPreview(userId, projectId),
    latestDiagnosis(userId, projectId),
    latestRebuildPlan(userId, projectId),
  ]);
  const projectRow = await database().query(
    'SELECT current_revision, updated_at FROM caspa_projects WHERE id=$1 AND user_id=$2',
    [projectId, userId],
  );
  return {
    project: {
      id: project.id,
      title: project.title,
      mode: project.mode,
      revision: Number(projectRow.rows[0]?.current_revision || 1),
      updatedAt: projectRow.rows[0]?.updated_at ? new Date(projectRow.rows[0].updated_at).toISOString() : null,
    },
    latestVersion: summarizeVersion(latest),
    preview: preview ? { id: preview.id, status: preview.status, chapterTitle: preview.chapterTitle } : null,
    diagnosis: diagnosis ? { id: diagnosis.id, summary: diagnosis.summary, findingCount: Array.isArray(diagnosis.findings) ? diagnosis.findings.length : 0 } : null,
    rebuild: rebuild ? { id: rebuild.id, status: rebuild.status, pending: (rebuild.changes || []).filter((change: any) => change.status === 'pending').length } : null,
    lastSave: latest?.createdAt || projectRow.rows[0]?.updated_at || null,
  };
}
