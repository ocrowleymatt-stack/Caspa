/**
 * Persistent JSON job store — survives server restarts
 */

import fs from 'fs';
import type { CaspaJobRecord } from '../types/gold';
import { getJobsFilePath } from './dataPaths';

interface JobStoreFile {
  version: 1;
  jobs: CaspaJobRecord[];
  savedAt: string;
}

function readStore(): Map<string, CaspaJobRecord> {
  const filePath = getJobsFilePath();
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

function writeStore(jobs: Map<string, CaspaJobRecord>): void {
  const filePath = getJobsFilePath();
  const payload: JobStoreFile = {
    version: 1,
    jobs: [...jobs.values()],
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
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
