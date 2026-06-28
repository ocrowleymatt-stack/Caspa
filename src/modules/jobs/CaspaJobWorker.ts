import { config, logger } from '../../shared';
import { UserService } from '../auth/UserService';
import type { UserPublic } from '../auth/types';
import { caspaJobRunner } from './CaspaJobRunner';
import { caspaJobService, type CaspaJob } from './CaspaJobService';

const userService = new UserService();

const LOCAL_USER: UserPublic = {
  id: 'local',
  email: 'local@caspa.local',
  displayName: 'Local User',
  role: 'admin',
  status: 'active',
  createdAt: new Date(0).toISOString(),
};

async function resolveJobUser(job: CaspaJob): Promise<UserPublic | undefined> {
  if (job.userId) {
    const user = await userService.getById(job.userId);
    if (user) return userService.toPublic(user);
  }
  if (!config.authEnabled) return LOCAL_USER;
  return undefined;
}

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
      void resolveJobUser(job)
        .then((user) => caspaJobRunner.run(job.id, user))
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
