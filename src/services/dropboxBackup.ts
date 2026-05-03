import { Chapter, Character, Project } from '../types';

const DROPBOX_UPLOAD_URL = 'https://content.dropboxapi.com/2/files/upload';
const DEFAULT_ROOT = '/ShakespeareBackups';

function getDropboxToken(): string | undefined {
  return (import.meta as any)?.env?.VITE_DROPBOX_TOKEN || (import.meta as any)?.env?.DROPBOX_TOKEN;
}

function safeName(value = 'untitled'): string {
  return String(value)
    .replace(/[^a-zA-Z0-9._ -]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'untitled';
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function uploadTextToDropbox(path: string, content: string) {
  const token = getDropboxToken();
  if (!token) {
    console.warn('Dropbox backup skipped: VITE_DROPBOX_TOKEN is not configured.');
    return { ok: false, skipped: true, reason: 'DROPBOX_TOKEN_MISSING', path };
  }

  if (content.length > 4_900_000) {
    content = content.slice(0, 4_900_000) + '\n\n[TRUNCATED_FOR_DROPBOX_TEXT_BACKUP_LIMIT]';
  }

  const response = await fetch(DROPBOX_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'add',
        autorename: true,
        mute: true,
        strict_conflict: false
      }),
      'Content-Type': 'application/octet-stream'
    },
    body: content
  });

  const text = await response.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch {}

  if (!response.ok) {
    console.warn('Dropbox backup failed:', data);
    return { ok: false, skipped: false, reason: 'DROPBOX_UPLOAD_FAILED', status: response.status, path, data };
  }

  return { ok: true, skipped: false, path, data };
}

export async function backupChapterToDropbox(args: {
  project: Project;
  chapterTitle: string;
  content: string;
  score?: any;
}) {
  const root = (import.meta as any)?.env?.VITE_DROPBOX_BACKUP_ROOT || DEFAULT_ROOT;
  const projectName = safeName(args.project.title || args.project.id || 'project');
  const chapterName = safeName(args.chapterTitle || 'chapter');
  const stamp = timestamp();

  const body = `# ${args.chapterTitle}\n\nProject: ${args.project.title}\nProject ID: ${args.project.id}\nBackup Time: ${new Date().toISOString()}\n\n${args.score ? `Score:\n${JSON.stringify(args.score, null, 2)}\n\n` : ''}${args.content}`;

  return uploadTextToDropbox(`${root}/${projectName}/chapters/${stamp}_${chapterName}.md`, body);
}

export async function backupProjectSnapshotToDropbox(args: {
  project: Project;
  chapters?: Chapter[];
  characters?: Character[];
  reason?: string;
  extra?: any;
}) {
  const root = (import.meta as any)?.env?.VITE_DROPBOX_BACKUP_ROOT || DEFAULT_ROOT;
  const projectName = safeName(args.project.title || args.project.id || 'project');
  const stamp = timestamp();

  const snapshot = {
    backup_type: 'shakespeare_project_snapshot',
    reason: args.reason || 'automatic',
    created_at: new Date().toISOString(),
    project: args.project,
    chapters: args.chapters || (args.project as any).chapters || [],
    characters: args.characters || (args.project as any).characters || [],
    extra: args.extra || null
  };

  return uploadTextToDropbox(
    `${root}/${projectName}/snapshots/${stamp}_project_snapshot.json`,
    JSON.stringify(snapshot, null, 2)
  );
}

export async function backupEmergencyToDropbox(args: {
  project?: Partial<Project>;
  label: string;
  payload: any;
}) {
  const root = (import.meta as any)?.env?.VITE_DROPBOX_BACKUP_ROOT || DEFAULT_ROOT;
  const projectName = safeName(args.project?.title || args.project?.id || 'emergency');
  const stamp = timestamp();

  return uploadTextToDropbox(
    `${root}/${projectName}/emergency/${stamp}_${safeName(args.label)}.json`,
    JSON.stringify({ created_at: new Date().toISOString(), ...args }, null, 2)
  );
}
