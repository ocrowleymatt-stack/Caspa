import type { UserPublic } from '../auth/types';
import { buildJobStartResponse } from './jobHelpers';
import { caspaJobRunner } from './CaspaJobRunner';
import { caspaJobService, type CaspaJob } from './CaspaJobService';
import { caspaJobWorker } from './CaspaJobWorker';

export class CaspaJobExecutor {
  async resume(jobId: string, user?: UserPublic): Promise<CaspaJob | { jobId: string; status: string; message: string }> {
    const job = await caspaJobService.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status === 'completed') return job;
    if (job.status === 'cancelled') throw new Error('Job was cancelled');

    const retried = await caspaJobService.retry(jobId);
    if (!retried) throw new Error('Could not queue job for resume');
    caspaJobWorker.kick();

    if (reqWantsSync(user)) {
      return caspaJobRunner.run(jobId, user);
    }

    return buildJobStartResponse(retried);
  }
}

function reqWantsSync(_user?: UserPublic): boolean {
  return false;
}

export const caspaJobExecutor = new CaspaJobExecutor();
