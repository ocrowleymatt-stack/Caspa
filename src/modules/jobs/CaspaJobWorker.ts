import { logger } from '../../shared';
import { caspaJobRunner } from './CaspaJobRunner';
import { caspaJobService } from './CaspaJobService';

const POLL_INTERVAL_MS = 1500;

export class CaspaJobWorker {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private activeJobs = new Set<string>();

  start(): void {
    if (this.running) return;
    this.running = true;
    void caspaJobService.recoverStuckJobs();
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
    void this.poll();
    logger.info('Caspa job worker started');
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.running = false;
  }

  kick(): void {
    void this.poll();
  }

  private async poll(): Promise<void> {
    while (this.activeJobs.size < 2) {
      const job = await caspaJobService.claimNextJob();
      if (!job) break;
      if (this.activeJobs.has(job.id)) break;
      this.activeJobs.add(job.id);
      void caspaJobRunner
        .run(job.id)
        .catch((err) => {
          logger.error(`Background job ${job.id} error: ${err instanceof Error ? err.message : String(err)}`);
        })
        .finally(() => {
          this.activeJobs.delete(job.id);
        });
    }
  }
}

export const caspaJobWorker = new CaspaJobWorker();
