/**
 * Local-first backup service — user-scoped JSON snapshots on disk.
 */

import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { getBackupsDir } from './dataPaths';

export interface BackupMeta {
  id: string;
  label: string;
  createdAt: string;
  keyCount: number;
  sizeBytes: number;
}

export interface BackupSnapshot {
  meta: BackupMeta;
  entries: Record<string, string>;
}

const BACKUP_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeBackupId(id: string): string | null {
  const trimmed = id.trim();
  return BACKUP_ID_PATTERN.test(trimmed) ? trimmed : null;
}

function scopeHash(scope: string): string {
  return createHash('sha256').update(scope).digest('hex').slice(0, 32);
}

function scopedBackupDir(scope: string): string {
  const dir = path.join(getBackupsDir(), 'users', scopeHash(scope));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function backupPath(scope: string, id: string): string | null {
  const safeId = normalizeBackupId(id);
  if (!safeId) return null;
  return path.join(scopedBackupDir(scope), `${safeId}.json`);
}

function safeLabel(label: string): string {
  return label.trim().slice(0, 80) || 'snapshot';
}

function readMetasFromDir(dir: string): BackupMeta[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const metas: BackupMeta[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const parsed = JSON.parse(raw) as BackupSnapshot;
      if (parsed.meta?.id) metas.push(parsed.meta);
    } catch {
      /* skip corrupt files */
    }
  }
  return metas;
}

export function createBackup(scope: string, entries: Record<string, string>, label = 'manual'): BackupMeta {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const payload: BackupSnapshot = {
    meta: {
      id,
      label: safeLabel(label),
      createdAt,
      keyCount: Object.keys(entries).length,
      sizeBytes: JSON.stringify(entries).length,
    },
    entries,
  };
  fs.writeFileSync(backupPath(scope, id)!, JSON.stringify(payload, null, 2), 'utf8');
  return payload.meta;
}

/**
 * With a scope, return only that user's backups. Without a scope, aggregate
 * metadata solely for the public health/doctor count; no restore path can use
 * this aggregate view and no user identifier is exposed.
 */
export function listBackups(scope?: string): BackupMeta[] {
  let metas: BackupMeta[] = [];
  if (scope) {
    metas = readMetasFromDir(scopedBackupDir(scope));
  } else {
    const root = getBackupsDir();
    // Legacy pre-separation snapshots in the root are counted for diagnostics.
    metas.push(...readMetasFromDir(root));
    const usersDir = path.join(root, 'users');
    if (fs.existsSync(usersDir)) {
      for (const entry of fs.readdirSync(usersDir, { withFileTypes: true })) {
        if (entry.isDirectory()) metas.push(...readMetasFromDir(path.join(usersDir, entry.name)));
      }
    }
  }
  return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadBackup(scope: string, id: string): BackupSnapshot | null {
  const file = backupPath(scope, id);
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as BackupSnapshot;
  } catch {
    return null;
  }
}

export function deleteBackup(scope: string, id: string): boolean {
  const file = backupPath(scope, id);
  if (!file || !fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

export function backupsPresent(scope?: string): boolean {
  return listBackups(scope).length > 0;
}
