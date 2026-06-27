import { novelWriteProService, type NovelWriteProRequest } from '../casper-freestyle/NovelWriteProService';
import { goldSynthesisService } from '../gold/GoldSynthesisService';
import { goldSourceLockService } from '../gold/GoldSourceLockService';
import { ProjectService } from '../manuscript/ProjectService';
import { caspaJobService, type CaspaJob } from './CaspaJobService';

export class CaspaJobExecutor {
  private readonly projectService = new ProjectService();

  async resume(jobId: string, user?: import('../auth/types').UserPublic): Promise<CaspaJob> {
    const job = await caspaJobService.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status === 'completed') return job;
    if (job.status === 'cancelled') throw new Error('Job was cancelled');

    await caspaJobService.patch(jobId, {
      status: 'running',
      error: undefined,
      retryCount: job.retryCount + 1,
    });

    try {
      if (job.type === 'novel-write-pro') {
        return await this.resumeNovelWritePro(jobId, job.input as NovelWriteProRequest);
      }
      if (job.type === 'gold-pass') {
        return await this.resumeGoldPass(jobId, job, user);
      }
      await caspaJobService.patch(jobId, { status: 'needs-review', error: 'Resume not implemented for this job type.' });
      throw new Error(`Resume not implemented for job type: ${job.type}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Job resume failed';
      await caspaJobService.fail(jobId, message);
      throw err;
    }
  }

  private async resumeNovelWritePro(jobId: string, input: NovelWriteProRequest): Promise<CaspaJob> {
    await caspaJobService.startStage(jobId, 'plan');
    const result = await novelWriteProService.generate(input);
    const completed = await caspaJobService.complete(jobId, {
      outputId: result.outputId,
      kind: result.kind,
      title: result.title,
    });
    if (!completed) throw new Error('Job update failed after Novel Write Pro resume');
    return completed;
  }

  private async resumeGoldPass(
    jobId: string,
    job: CaspaJob,
    user?: import('../auth/types').UserPublic,
  ): Promise<CaspaJob> {
    const projectId = job.projectId;
    if (!projectId) throw new Error('Gold Pass job missing projectId');

    await this.projectService.getProject(projectId, user);
    const sourceLockId = typeof job.input.sourceLockId === 'string' ? job.input.sourceLockId : undefined;
    if (!sourceLockId) throw new Error('Gold Pass job missing sourceLockId — create a new source lock and run again.');

    const sourceLock = await goldSourceLockService.verifyLock(sourceLockId, projectId);
    await caspaJobService.startStage(jobId, 'synthesis');
    const synthesis = await goldSynthesisService.synthesize({
      projectId,
      sourceText: sourceLock.sourceText,
      sourceLock,
      improveText: job.input.improveText !== false,
      stage: typeof job.input.stage === 'string' ? job.input.stage as 'draft' | 'revision' | 'submission' : 'revision',
    }, user);

    const completed = await caspaJobService.complete(jobId, {
      synthesisStage: synthesis.stage,
      sourceLockId,
    });
    if (!completed) throw new Error('Job update failed after Gold Pass resume');
    return completed;
  }
}

export const caspaJobExecutor = new CaspaJobExecutor();
