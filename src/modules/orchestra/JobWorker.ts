import { logger } from '../../shared';
import { jobQueue } from './JobQueue';

export type JobHandler = (
  payload: unknown,
  updateProgress: (progress: number, message?: string) => Promise<void>,
) => Promise<unknown>;

const POLL_INTERVAL_MS = 2000;

export class JobWorker {
  private handlers = new Map<string, JobHandler>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private activeJobs = new Set<string>();
  private stopping = false;

  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.stopping = false;
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
    void this.poll();
    logger.info('Job worker started');
  }

  async stop(): Promise<void> {
    this.stopping = true;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    while (this.activeJobs.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.running = false;
    logger.info('Job worker stopped');
  }

  async updateProgress(
    jobId: string,
    progress: number,
    _message?: string,
  ): Promise<void> {
    await jobQueue.updateJob(jobId, {
      progress: Math.min(100, Math.max(0, progress)),
    });
  }

  private async poll(): Promise<void> {
    if (this.stopping) {
      return;
    }

    while (true) {
      const job = await jobQueue.claimNextJob();
      if (!job) {
        break;
      }

      void this.processJob(job);
    }
  }

  private async processJob(job: {
    id: string;
    type: string;
    payload: unknown;
  }): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await jobQueue.updateJob(job.id, {
        status: 'failed',
        error: `No handler registered for job type: ${job.type}`,
      });
      return;
    }

    this.activeJobs.add(job.id);

    try {
      if (jobQueue.isCancelled(job.id)) {
        await jobQueue.updateJob(job.id, {
          status: 'failed',
          error: 'Cancelled by user',
        });
        return;
      }

      const updateProgress = async (
        progress: number,
        _message?: string,
      ): Promise<void> => {
        if (jobQueue.isCancelled(job.id)) {
          throw new Error('Cancelled by user');
        }
        await this.updateProgress(job.id, progress);
      };

      const result = await handler(job.payload, updateProgress);

      if (jobQueue.isCancelled(job.id)) {
        await jobQueue.updateJob(job.id, {
          status: 'failed',
          error: 'Cancelled by user',
        });
        return;
      }

      await jobQueue.updateJob(job.id, {
        status: 'complete',
        progress: 100,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await jobQueue.updateJob(job.id, {
        status: 'failed',
        error: message,
      });
    } finally {
      jobQueue.clearCancellation(job.id);
      this.activeJobs.delete(job.id);

      if (this.running && !this.stopping) {
        void this.poll();
      }
    }
  }
}

export const jobWorker = new JobWorker();
