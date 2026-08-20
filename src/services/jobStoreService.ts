/**
 * Persistent JSON job store — survives server restarts
 */

import fs from 'fs';
import path from 'path';
import type { CaspaJobRecord } from '../types/gold';
import { getJobsFilePath } from './dataPaths';

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

function archivePath(id: string): string {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(path.dirname(getJobsFilePath()), 'caspa-job-archive', `${safe}.json`);
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
