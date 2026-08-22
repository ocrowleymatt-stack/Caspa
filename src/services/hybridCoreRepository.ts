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
  `);
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
    const exists = await database().query(
      'SELECT id,content,word_count,chapter_count FROM caspa_manuscript_versions WHERE project_id=$1 ORDER BY revision',
      [project.id],
    );
    if (exists.rowCount) {
      for (const version of exists.rows) {
        const correctedWords = words(version.content);
        const correctedChapters = chapters(version.content);
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
