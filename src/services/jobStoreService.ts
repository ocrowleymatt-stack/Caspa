/**
 * Persistent JSON job store — survives server restarts
 */

import fs from 'fs';
import path from 'path';
import type { CaspaJobRecord } from '../types/gold';
import { getJobsFilePath } from './dataPaths';
import { toJobListRecord, type JobListRecord } from './jobProvenance';

interface JobStoreFile {
  version: 1;
  jobs: CaspaJobRecord[];
  savedAt: string;
}

function readStore(): Map<string, CaspaJobRecord> {
  const filePath = getJobsFilePath();
  const recordsDir = path.join(path.dirname(filePath), 'caspa-job-records');
  if (fs.existsSync(recordsDir)) {
    const map = new Map<string, CaspaJobRecord>();
    for (const name of fs.readdirSync(recordsDir).filter((entry) => entry.endsWith('.json'))) {
      try {
        const job = JSON.parse(fs.readFileSync(path.join(recordsDir, name), 'utf8')) as CaspaJobRecord;
        if (job?.id) map.set(job.id, job);
      } catch (error) {
        console.warn(`[JobStore] Failed to read ${name}:`, error);
      }
    }
    return map;
  }
  if (!fs.existsSync(filePath)) return new Map();

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as JobStoreFile;
    const map = new Map<string, CaspaJobRecord>();
    for (const job of parsed.jobs || []) {
      map.set(job.id, job);
    }
    return map;
  } catch (err) {
    console.warn('[JobStore] Failed to read jobs file, starting fresh:', err);
    return new Map();
  }
}

function atomicWriteJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value), 'utf8');
  fs.renameSync(temporary, filePath);
}

function archiveDir(): string {
  return path.join(path.dirname(getJobsFilePath()), 'caspa-job-archive');
}

function archivePath(id: string): string {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(archiveDir(), `${safe}.json`);
}

function archiveMetaPath(id: string): string {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(archiveDir(), `${safe}.meta.json`);
}

function isLegacyArchiveName(name: string): boolean {
  return name.endsWith('.json') && !name.endsWith('.meta.json');
}

export function migrateLegacyArchiveMeta(): { migrated: number; skipped: number; failed: number } {
  const dir = archiveDir();
  if (!fs.existsSync(dir)) return { migrated: 0, skipped: 0, failed: 0 };
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  for (const name of fs.readdirSync(dir).filter(isLegacyArchiveName)) {
    const stem = name.slice(0, -'.json'.length);
    const fullPath = path.join(dir, name);
    const metaBeside = path.join(dir, `${stem}.meta.json`);
    if (!stem || fs.existsSync(metaBeside)) {
      skipped += 1;
      continue;
    }
    try {
      const before = fs.readFileSync(fullPath);
      const job = JSON.parse(before.toString('utf8')) as CaspaJobRecord;
      if (!job?.id) {
        failed += 1;
        continue;
      }
      writeArchiveMeta(job);
      const after = fs.readFileSync(fullPath);
      if (!before.equals(after)) {
        const error = new Error(`Legacy archive ${name} changed during metadata migration.`);
        (error as Error & { code: string }).code = 'JOB_ARCHIVE_MUTATED';
        throw error;
      }
      migrated += 1;
    } catch (error) {
      if ((error as { code?: string }).code === 'JOB_ARCHIVE_MUTATED') throw error;
      console.warn(`[JobStore] Failed to migrate archive metadata for ${name}:`, error);
      failed += 1;
    }
  }
  return { migrated, skipped, failed };
}

function writeArchiveMeta(job: CaspaJobRecord): void {
  atomicWriteJson(archiveMetaPath(job.id), toJobListRecord(job));
}

function recordPath(id: string): string {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(path.dirname(getJobsFilePath()), 'caspa-job-records', `${safe}.json`);
}

function jobSummary(job: CaspaJobRecord): Omit<CaspaJobRecord, 'input' | 'checkpoint' | 'result'> {
  const { input: _input, checkpoint: _checkpoint, result: _result, ...summary } = job;
  return summary;
}

function writeStore(jobs: Map<string, CaspaJobRecord>): void {
  const filePath = getJobsFilePath();
  const payload: JobStoreFile = {
    version: 1,
    jobs: [...jobs.values()].map(jobSummary),
    savedAt: new Date().toISOString(),
  };
  for (const job of jobs.values()) {
    const file = recordPath(job.id);
    const next = JSON.stringify(job);
    let previous = '';
    try { previous = fs.readFileSync(file, 'utf8'); } catch { /* first write */ }
    if (previous !== next) atomicWriteJson(file, job);
  }
  atomicWriteJson(filePath, payload);
}

export function archiveJobRecord(job: CaspaJobRecord): void {
  atomicWriteJson(archivePath(job.id), job);
  writeArchiveMeta(job);
  try { fs.unlinkSync(recordPath(job.id)); } catch { /* migrated legacy record */ }
}

export function loadArchivedJob(id: string): CaspaJobRecord | null {
  const filePath = archivePath(id);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as CaspaJobRecord;
  } catch (error) {
    console.warn(`[JobStore] Failed to read archived job ${id}:`, error);
    return null;
  }
}

export function persistArchivedJob(job: CaspaJobRecord): CaspaJobRecord {
  archiveJobRecord(job);
  const persisted = loadArchivedJob(job.id);
  if (!persisted || persisted.projectId !== job.projectId || persisted.updatedAt !== job.updatedAt) {
    const error = new Error('Could not persist the archived job assignment.');
    (error as Error & { code: string }).code = 'JOB_BIND_FAILED';
    throw error;
  }
  return persisted;
}

export function listArchivedJobs(): JobListRecord[] {
  migrateLegacyArchiveMeta();
  const dir = archiveDir();
  if (!fs.existsSync(dir)) return [];
  const jobs: JobListRecord[] = [];
  for (const name of fs.readdirSync(dir).filter((entry) => entry.endsWith('.meta.json'))) {
    try {
      const job = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as JobListRecord;
      if (job?.id) jobs.push(job);
    } catch (error) {
      console.warn(`[JobStore] Failed to read archived job meta ${name}:`, error);
    }
  }
  return jobs;
}

let cache: Map<string, CaspaJobRecord> | null = null;

export function loadJobStore(): Map<string, CaspaJobRecord> {
  if (!cache) cache = readStore();
  return cache;
}

export function persistJobStore(jobs: Map<string, CaspaJobRecord>): void {
  cache = jobs;
  writeStore(jobs);
}

export function jobStorePresent(): boolean {
  return fs.existsSync(getJobsFilePath());
}
