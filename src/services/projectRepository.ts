import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

export interface ProjectState {
  brief?: Record<string, unknown>;
  manuscript?: string;
  chapters?: unknown[];
  research?: unknown[];
  tools?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  projectKey: string;
  title: string;
  mode: string;
  revision: number;
  checksum: string;
  state: ProjectState;
  createdAt: string;
  updatedAt: string;
}

let pool: Pool | null = null;

function databasePool(): Pool {
  if (!pool) {
    const connectionString = process.env.CASPA_DATABASE_URL;
    if (!connectionString) throw new Error('CASPA_DATABASE_URL is required for server-first project storage');
    pool = new Pool({ connectionString, max: Number(process.env.CASPA_DB_POOL_SIZE || 10) });
  }
  return pool;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function projectChecksum(state: ProjectState): string {
  return createHash('sha256').update(stable(state)).digest('hex');
}

export async function ensureProjectSchema(): Promise<void> {
  await databasePool().query(`
    CREATE TABLE IF NOT EXISTS caspa_projects (
      id uuid PRIMARY KEY,
      user_id text NOT NULL,
      project_key text NOT NULL,
      title text NOT NULL,
      mode text NOT NULL,
      current_revision integer NOT NULL DEFAULT 1,
      checksum text NOT NULL,
      state jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, project_key)
    );
    CREATE INDEX IF NOT EXISTS caspa_projects_user_updated_idx ON caspa_projects(user_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS caspa_project_revisions (
      project_id uuid NOT NULL REFERENCES caspa_projects(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      revision integer NOT NULL,
      checksum text NOT NULL,
      state jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, revision)
    );
    CREATE INDEX IF NOT EXISTS caspa_revisions_user_project_idx ON caspa_project_revisions(user_id, project_id, revision DESC);
    CREATE TABLE IF NOT EXISTS caspa_users (
      id text PRIMARY KEY,
      email text NOT NULL DEFAULT '',
      display_name text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS caspa_jobs (
      id uuid PRIMARY KEY,
      user_id text NOT NULL,
      project_id uuid REFERENCES caspa_projects(id) ON DELETE SET NULL,
      type text NOT NULL,
      status text NOT NULL,
      progress integer NOT NULL DEFAULT 0,
      stage text,
      idempotency_key text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS caspa_jobs_user_updated_idx ON caspa_jobs(user_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS caspa_job_events (
      id bigserial PRIMARY KEY,
      job_id uuid NOT NULL REFERENCES caspa_jobs(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      event_type text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS caspa_job_events_job_idx ON caspa_job_events(job_id, id DESC);
    CREATE TABLE IF NOT EXISTS caspa_artefacts (
      id uuid PRIMARY KEY,
      user_id text NOT NULL,
      project_id uuid REFERENCES caspa_projects(id) ON DELETE SET NULL,
      job_id uuid REFERENCES caspa_jobs(id) ON DELETE SET NULL,
      kind text NOT NULL,
      storage_path text NOT NULL,
      checksum text NOT NULL,
      size_bytes bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS caspa_artefacts_user_project_idx ON caspa_artefacts(user_id, project_id, created_at DESC);
  `);
}

function mapProject(row: any): ProjectRecord {
  return {
    id: row.id,
    userId: row.user_id,
    projectKey: row.project_key,
    title: row.title,
    mode: row.mode,
    revision: row.current_revision,
    checksum: row.checksum,
    state: row.state,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listProjects(userId: string): Promise<ProjectRecord[]> {
  const result = await databasePool().query('SELECT * FROM caspa_projects WHERE user_id=$1 ORDER BY updated_at DESC', [userId]);
  return result.rows.map(mapProject);
}

export async function getProject(userId: string, id: string): Promise<ProjectRecord | null> {
  const result = await databasePool().query('SELECT * FROM caspa_projects WHERE user_id=$1 AND id=$2', [userId, id]);
  return result.rowCount ? mapProject(result.rows[0]) : null;
}

export async function createProject(userId: string, input: { projectKey: string; title: string; mode: string; state: ProjectState }): Promise<ProjectRecord> {
  const id = randomUUID();
  const checksum = projectChecksum(input.state);
  return databasePool().connect().then(async (client) => {
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO caspa_projects(id,user_id,project_key,title,mode,checksum,state)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, userId, input.projectKey, input.title, input.mode, checksum, input.state],
      );
      await client.query(
        'INSERT INTO caspa_project_revisions(project_id,user_id,revision,checksum,state) VALUES($1,$2,1,$3,$4)',
        [id, userId, checksum, input.state],
      );
      await client.query('COMMIT');
      return mapProject(inserted.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}

async function updateWithin(client: PoolClient, userId: string, id: string, expectedRevision: number, state: ProjectState, title?: string, mode?: string): Promise<ProjectRecord | null> {
  const checksum = projectChecksum(state);
  const current = await client.query(
    'SELECT * FROM caspa_projects WHERE user_id=$1 AND id=$2 FOR UPDATE',
    [userId, id],
  );
  if (!current.rowCount || current.rows[0].current_revision !== expectedRevision) return null;
  if (
    current.rows[0].checksum === checksum
    && (!title || current.rows[0].title === title)
    && (!mode || current.rows[0].mode === mode)
  ) return mapProject(current.rows[0]);
  const updated = await client.query(
    `UPDATE caspa_projects SET state=$1, checksum=$2, title=COALESCE($3,title), mode=COALESCE($4,mode),
       current_revision=current_revision+1, updated_at=now()
     WHERE user_id=$5 AND id=$6 AND current_revision=$7 RETURNING *`,
    [state, checksum, title || null, mode || null, userId, id, expectedRevision],
  );
  if (!updated.rowCount) return null;
  const project = mapProject(updated.rows[0]);
  await client.query(
    'INSERT INTO caspa_project_revisions(project_id,user_id,revision,checksum,state) VALUES($1,$2,$3,$4,$5)',
    [id, userId, project.revision, checksum, state],
  );
  return project;
}

export async function updateProject(userId: string, id: string, expectedRevision: number, state: ProjectState, title?: string, mode?: string): Promise<ProjectRecord | null> {
  const client = await databasePool().connect();
  try {
    await client.query('BEGIN');
    const project = await updateWithin(client, userId, id, expectedRevision, state, title, mode);
    if (!project) await client.query('ROLLBACK'); else await client.query('COMMIT');
    return project;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listRevisions(userId: string, id: string): Promise<Array<{ revision: number; checksum: string; createdAt: string }>> {
  const result = await databasePool().query(
    'SELECT revision,checksum,created_at FROM caspa_project_revisions WHERE user_id=$1 AND project_id=$2 ORDER BY revision DESC',
    [userId, id],
  );
  return result.rows.map((row) => ({ revision: row.revision, checksum: row.checksum, createdAt: new Date(row.created_at).toISOString() }));
}

export async function restoreRevision(userId: string, id: string, revision: number): Promise<ProjectRecord | null> {
  const client = await databasePool().connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT current_revision FROM caspa_projects WHERE user_id=$1 AND id=$2 FOR UPDATE', [userId, id]);
    const source = await client.query('SELECT state FROM caspa_project_revisions WHERE user_id=$1 AND project_id=$2 AND revision=$3', [userId, id, revision]);
    if (!current.rowCount || !source.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }
    const restored = await updateWithin(client, userId, id, current.rows[0].current_revision, source.rows[0].state);
    await client.query('COMMIT');
    return restored;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
