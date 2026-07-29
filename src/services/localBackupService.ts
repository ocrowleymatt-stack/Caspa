/**
 * Local-first backup service — JSON snapshots on disk
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
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

function backupPath(id: string): string | null {
  const safeId = normalizeBackupId(id);
  if (!safeId) return null;
  return path.join(getBackupsDir(), `${safeId}.json`);
}

function safeLabel(label: string): string {
  return label.trim().slice(0, 80) || 'snapshot';
}

export function createBackup(entries: Record<string, string>, label = 'manual'): BackupMeta {
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
  fs.writeFileSync(backupPath(id)!, JSON.stringify(payload, null, 2), 'utf8');
  return payload.meta;
}

export function listBackups(): BackupMeta[] {
  const dir = getBackupsDir();
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

  return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadBackup(id: string): BackupSnapshot | null {
  const file = backupPath(id);
  if (!file) return null;
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as BackupSnapshot;
  } catch {
    return null;
  }
}

export function deleteBackup(id: string): boolean {
  const file = backupPath(id);
  if (!file) return false;
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

export function backupsPresent(): boolean {
  return fs.existsSync(getBackupsDir()) && listBackups().length > 0;
}
