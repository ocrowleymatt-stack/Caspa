import type { GoldSynthesisStage } from '../../shared/goldSynthesis';
import { novelWriteProService, type NovelWriteProRequest } from '../casper-freestyle/NovelWriteProService';
import { goldPassRunService } from '../gold/GoldPassRunService';
import { goldPipeline } from '../gold/GoldPipeline';
import { goldSourceLockService } from '../gold/GoldSourceLockService';
import { ProjectService } from '../manuscript/ProjectService';
import type { UserPublic } from '../auth/types';
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
      if (job.type === 'gold-pipeline') {
        return await this.resumeGoldPipeline(jobId, job, user);
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
    const result = await novelWriteProService.generate({ ...input, caspaJobId: jobId });
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
    user?: UserPublic,
  ): Promise<CaspaJob> {
    const projectId = job.projectId;
    if (!projectId) throw new Error('Gold Pass job missing projectId');

    await this.projectService.getProject(projectId, user);
    const sourceLockId = typeof job.input.sourceLockId === 'string' ? job.input.sourceLockId : undefined;
    if (!sourceLockId) throw new Error('Gold Pass job missing sourceLockId — create a new source lock and run again.');

    const sourceLock = await goldSourceLockService.verifyLock(sourceLockId, projectId);
    const stage = typeof job.input.stage === 'string'
      ? job.input.stage as GoldSynthesisStage
      : 'revision';

    await caspaJobService.startStage(jobId, 'synthesis');
    const result = await goldPassRunService.execute({
      projectId,
      sourceText: sourceLock.sourceText,
      sourceLock,
      improveText: job.input.improveText !== false,
      stage,
      user,
    });

    await caspaJobService.completeStage(jobId, 'synthesis', {
      stage: result.synthesis.stage,
      outputId: result.outputId,
    });

    const completed = await caspaJobService.complete(jobId, {
      outputId: result.outputId,
      driftBlocked: result.driftBlocked,
      fidelity: result.fidelity,
    });
    if (!completed) throw new Error('Job update failed after Gold Pass resume');
    return completed;
  }

  private async resumeGoldPipeline(
    jobId: string,
    job: CaspaJob,
    user?: UserPublic,
  ): Promise<CaspaJob> {
    const projectId = job.projectId;
    if (!projectId) throw new Error('Gold pipeline job missing projectId');

    await this.projectService.getProject(projectId, user);
    const sourceLockId = typeof job.input.sourceLockId === 'string' ? job.input.sourceLockId : undefined;
    if (!sourceLockId) {
      throw new Error('Gold pipeline job missing sourceLockId — confirm source and run again.');
    }

    const sourceLock = await goldSourceLockService.verifyLock(sourceLockId, projectId);
    const resumeStage = job.resumeFromStage ?? job.currentStage ?? job.stages[0]?.id;
    const startIdx = Math.max(
      0,
      job.stages.findIndex((stage) => stage.id === resumeStage),
    );

    for (let idx = startIdx; idx < job.stages.length; idx++) {
      const stage = job.stages[idx];
      await caspaJobService.startStage(jobId, stage.id);
      if (idx === job.stages.length - 1) {
        const report = await goldPipeline.run(projectId, { sourceText: sourceLock.sourceText });
        await caspaJobService.completeStage(jobId, stage.id, { reportId: report.id });
        const completed = await caspaJobService.complete(jobId, {
          reportId: report.id,
          overallScore: report.overallScore,
        });
        if (!completed) throw new Error('Job update failed after Gold pipeline resume');
        return completed;
      }
      await caspaJobService.completeStage(jobId, stage.id);
    }

    throw new Error('Gold pipeline resume found no stages to execute');
  }
}

export const caspaJobExecutor = new CaspaJobExecutor();
