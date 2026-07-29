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

function backupPath(id: string): string {
  return path.join(getBackupsDir(), `${id}.json`);
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
  fs.writeFileSync(backupPath(id), JSON.stringify(payload, null, 2), 'utf8');
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
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as BackupSnapshot;
  } catch {
    return null;
  }
}

export function deleteBackup(id: string): boolean {
  const file = backupPath(id);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

export function backupsPresent(): boolean {
  return fs.existsSync(getBackupsDir()) && listBackups().length > 0;
}
