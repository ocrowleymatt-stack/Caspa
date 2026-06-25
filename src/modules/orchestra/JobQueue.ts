import fs from 'fs/promises';
import path from 'path';
import {
  emitEvent,
  generateId,
  getConfig,
  logger,
  type JobStatus,
} from '../../shared';

const JOBS_FILE = 'jobs.json';
const MAX_CONCURRENT = 3;
const DEAD_JOB_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredJob extends JobStatus {
  priority: number;
  payload: unknown;
}

export class JobQueue {
  private jobs: StoredJob[] = [];
  private loaded = false;
  private cancelledIds = new Set<string>();

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    const filePath = path.join(getConfig().dataDir, JOBS_FILE);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.jobs = JSON.parse(content) as StoredJob[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      this.jobs = [];
    }

    const cutoff = Date.now() - DEAD_JOB_AGE_MS;
    const before = this.jobs.length;
    this.jobs = this.jobs.filter((job) => {
      if (job.status !== 'complete' && job.status !== 'failed') {
        return true;
      }
      const updated = new Date(job.updatedAt).getTime();
      return updated >= cutoff;
    });

    if (this.jobs.length !== before) {
      logger.info(`Cleaned ${before - this.jobs.length} dead jobs from queue`);
      await this.persist();
    }

    const now = new Date().toISOString();
    let resetCount = 0;
    for (const job of this.jobs) {
      if (job.status === 'running') {
        job.status = 'queued';
        job.progress = 0;
        job.updatedAt = now;
        resetCount += 1;
      }
    }
    if (resetCount > 0) {
      logger.info(`Reset ${resetCount} interrupted running jobs to queued`);
      await this.persist();
    }

    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const dataDir = getConfig().dataDir;
    await fs.mkdir(dataDir, { recursive: true });
    const filePath = path.join(dataDir, JOBS_FILE);
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(this.jobs, null, 2), 'utf-8');
    await fs.rename(tmpPath, filePath);
  }

  private toStatus(job: StoredJob): JobStatus {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  async enqueue(type: string, payload: unknown, priority = 0): Promise<JobStatus> {
    await this.ensureLoaded();

    const now = new Date().toISOString();
    const job: StoredJob = {
      id: generateId(),
      type,
      status: 'queued',
      progress: 0,
      priority,
      payload,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.push(job);
    await this.persist();

    const status = this.toStatus(job);
    emitEvent('job:queued', status);
    return status;
  }

  async getJob(id: string): Promise<JobStatus | null> {
    await this.ensureLoaded();
    const job = this.jobs.find((entry) => entry.id === id);
    return job ? this.toStatus(job) : null;
  }

  async listJobs(filter?: { type?: string; status?: string }): Promise<JobStatus[]> {
    await this.ensureLoaded();
    return this.jobs
      .filter((job) => {
        if (filter?.type && job.type !== filter.type) {
          return false;
        }
        if (filter?.status && job.status !== filter.status) {
          return false;
        }
        return true;
      })
      .map((job) => this.toStatus(job))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  async cancelJob(id: string): Promise<void> {
    await this.ensureLoaded();
    const job = this.jobs.find((entry) => entry.id === id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }
    if (job.status === 'complete' || job.status === 'failed') {
      return;
    }

    if (job.status === 'running') {
      this.cancelledIds.add(id);
      return;
    }

    job.status = 'failed';
    job.error = 'Cancelled by user';
    job.updatedAt = new Date().toISOString();
    await this.persist();
    emitEvent('job:failed', this.toStatus(job));
  }

  async clearCompleted(): Promise<void> {
    await this.ensureLoaded();
    this.jobs = this.jobs.filter(
      (job) => job.status !== 'complete' && job.status !== 'failed',
    );
    await this.persist();
  }

  getQueueStats(): {
    queued: number;
    running: number;
    complete: number;
    failed: number;
  } {
    return {
      queued: this.jobs.filter((job) => job.status === 'queued').length,
      running: this.jobs.filter((job) => job.status === 'running').length,
      complete: this.jobs.filter((job) => job.status === 'complete').length,
      failed: this.jobs.filter((job) => job.status === 'failed').length,
    };
  }

  async claimNextJob(): Promise<(StoredJob & { payload: unknown }) | null> {
    await this.ensureLoaded();

    const running = this.jobs.filter((job) => job.status === 'running').length;
    if (running >= MAX_CONCURRENT) {
      return null;
    }

    const queued = this.jobs
      .filter((job) => job.status === 'queued')
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));

    const next = queued[0];
    if (!next) {
      return null;
    }

    next.status = 'running';
    next.progress = 0;
    next.updatedAt = new Date().toISOString();
    await this.persist();
    emitEvent('job:progress', this.toStatus(next));
    return next;
  }

  async updateJob(
    id: string,
    updates: Partial<Pick<JobStatus, 'status' | 'progress' | 'result' | 'error'>>,
  ): Promise<JobStatus> {
    await this.ensureLoaded();
    const job = this.jobs.find((entry) => entry.id === id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    if (updates.status !== undefined) {
      job.status = updates.status;
    }
    if (updates.progress !== undefined) {
      job.progress = updates.progress;
    }
    if (updates.result !== undefined) {
      job.result = updates.result;
    }
    if (updates.error !== undefined) {
      job.error = updates.error;
    }
    job.updatedAt = new Date().toISOString();
    await this.persist();

    const status = this.toStatus(job);
    if (job.status === 'complete') {
      emitEvent('job:complete', status);
    } else if (job.status === 'failed') {
      emitEvent('job:failed', status);
    } else {
      emitEvent('job:progress', status);
    }

    return status;
  }

  async getPayload(id: string): Promise<unknown> {
    await this.ensureLoaded();
    const job = this.jobs.find((entry) => entry.id === id);
    return job?.payload;
  }

  isCancelled(id: string): boolean {
    return this.cancelledIds.has(id);
  }

  clearCancellation(id: string): void {
    this.cancelledIds.delete(id);
  }
}

export const jobQueue = new JobQueue();
