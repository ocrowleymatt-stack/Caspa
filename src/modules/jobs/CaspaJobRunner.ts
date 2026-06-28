import { logger } from '../../shared';
import type { GoldSynthesisStage } from '../../shared/goldSynthesis';
import { novelWriteProService, type NovelWriteProRequest } from '../casper-freestyle/NovelWriteProService';
import { goldPassRunService } from '../gold/GoldPassRunService';
import { goldPipeline } from '../gold/GoldPipeline';
import { goldSourceLockService } from '../gold/GoldSourceLockService';
import { bookMapService } from '../book/BookMapService';
import { cutTightenService } from '../book/CutTightenService';
import { projectBibleService } from '../manuscript/ProjectBibleService';
import { ProjectService } from '../manuscript/ProjectService';
import type { UserPublic } from '../auth/types';
import { caspaJobService, type CaspaJob } from './CaspaJobService';

async function runStage(jobId: string, stageId: string, fn: () => Promise<unknown>) {
  await caspaJobService.startStage(jobId, stageId);
  const result = await fn();
  await caspaJobService.completeStage(jobId, stageId, result);
  return result;
}

export class CaspaJobRunner {
  private readonly projectService = new ProjectService();

  async run(jobId: string, user?: UserPublic): Promise<CaspaJob> {
    const job = await caspaJobService.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status === 'cancelled') throw new Error('Job was cancelled');
    if (job.status === 'completed') return job;

    await caspaJobService.patch(jobId, {
      status: 'running',
      error: undefined,
      startedAt: job.startedAt ?? new Date().toISOString(),
    });

    try {
      if (job.type === 'novel-write-pro') {
        return await this.runNovelWritePro(jobId, job.input as NovelWriteProRequest, user);
      }
      if (job.type === 'gold-pass') {
        return await this.runGoldPass(jobId, job, user);
      }
      if (job.type === 'gold-pipeline') {
        return await this.runGoldPipeline(jobId, job, user);
      }
      if (job.type === 'project-bible') {
        return await this.runProjectBible(jobId, job, user);
      }
      if (job.type === 'book-map') {
        return await this.runBookMap(jobId, job, user);
      }
      if (job.type === 'cut-analyse') {
        return await this.runCutAnalyse(jobId, job, user);
      }
      throw new Error(`Unsupported job type: ${job.type}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Job failed';
      logger.error(`Caspa job ${jobId} failed: ${message}`);
      const failed = await caspaJobService.markFailed(jobId, message);
      if (!failed) throw err;
      throw err;
    }
  }

  private async runNovelWritePro(
    jobId: string,
    input: NovelWriteProRequest,
    user?: UserPublic,
  ): Promise<CaspaJob> {
    await runStage(jobId, 'prepare', async () => ({ ready: true }));
    await runStage(jobId, 'read-source', async () => ({ projectId: input.projectId }));
    await runStage(jobId, 'read-bible', async () => ({ projectId: input.projectId }));
    await runStage(jobId, 'read-spec', async () => ({ projectId: input.projectId }));

    const result = await novelWriteProService.generate({ ...input, caspaJobId: jobId });

    await runStage(jobId, 'save', async () => ({
      outputId: result.outputId,
      kind: result.kind,
      title: result.title,
    }));
    await caspaJobService.startStage(jobId, 'complete');
    await caspaJobService.completeStage(jobId, 'complete');

    const completed = await caspaJobService.complete(jobId, {
      outputId: result.outputId,
      kind: result.kind,
      title: result.title,
      text: result.text,
    });
    if (!completed) throw new Error('Job update failed after Novel Write Pro');
    return completed;
  }

  private async runGoldPass(jobId: string, job: CaspaJob, user?: UserPublic): Promise<CaspaJob> {
    const projectId = job.projectId;
    if (!projectId) throw new Error('Gold Pass job missing projectId');

    await this.projectService.getProject(projectId, user);
    const sourceLockId = typeof job.input.sourceLockId === 'string' ? job.input.sourceLockId : undefined;
    if (!sourceLockId) {
      throw new Error('Gold Pass requires a source lock — confirm your source and try again.');
    }

    await runStage(jobId, 'lock', async () => {
      const lock = await goldSourceLockService.verifyLock(sourceLockId, projectId, typeof job.input.source === 'string' ? job.input.source : undefined);
      return { lockId: lock.sourceLockId, title: lock.title };
    });

    const sourceLock = await goldSourceLockService.verifyLock(
      sourceLockId,
      projectId,
      typeof job.input.source === 'string' ? job.input.source : undefined,
    );

    await runStage(jobId, 'spec', async () => ({ projectId }));
    await caspaJobService.startStage(jobId, 'structure');

    const stage = typeof job.input.stage === 'string'
      ? job.input.stage as GoldSynthesisStage
      : 'revision';

    const result = await goldPassRunService.execute({
      projectId,
      sourceText: sourceLock.sourceText,
      sourceLock,
      improveText: job.input.improveText !== false,
      stage,
      swarmOutputId: typeof job.input.swarmOutputId === 'string' ? job.input.swarmOutputId : undefined,
      awardAssessmentOutputId: typeof job.input.awardAssessmentOutputId === 'string' ? job.input.awardAssessmentOutputId : undefined,
      includeElevationSteps: Boolean(job.input.includeElevationSteps),
      providedSource: typeof job.input.source === 'string' ? job.input.source : undefined,
      user,
    });

    await caspaJobService.completeStage(jobId, 'structure', { stage: result.synthesis.stage });
    await runStage(jobId, 'critique', async () => ({ critique: Boolean(result.critique) }));
    await runStage(jobId, 'continuity', async () => ({ ok: true }));
    await runStage(jobId, 'fidelity', async () => ({ fidelity: result.fidelity }));
    await runStage(jobId, 'rewrite', async () => ({ improved: result.improved }));
    await runStage(jobId, 'drift', async () => ({ driftBlocked: result.driftBlocked }));

    if (job.input.includeElevationSteps && result.report) {
      await runStage(jobId, 'save', async () => ({
        reportId: result.report?.id,
        overallScore: result.report?.overallScore,
      }));
    } else {
      await runStage(jobId, 'save', async () => ({ outputId: result.outputId }));
    }

    await caspaJobService.startStage(jobId, 'complete');
    await caspaJobService.completeStage(jobId, 'complete');

    const completed = await caspaJobService.complete(jobId, {
      outputId: result.outputId,
      driftBlocked: result.driftBlocked,
      applyBlocked: result.driftBlocked,
      fidelity: result.fidelity,
      goldReportId: result.report?.id,
      synthesis: result.synthesis,
      critique: result.critique,
      destination: sourceLock.unitId ? `Draft saved beside ${sourceLock.title}` : 'Draft saved to Writing History',
    });
    if (!completed) throw new Error('Job update failed after Gold Pass');
    return completed;
  }

  private async runGoldPipeline(jobId: string, job: CaspaJob, user?: UserPublic): Promise<CaspaJob> {
    const projectId = job.projectId;
    if (!projectId) throw new Error('Gold pipeline job missing projectId');

    await this.projectService.getProject(projectId, user);
    const sourceLockId = typeof job.input.sourceLockId === 'string' ? job.input.sourceLockId : undefined;
    if (!sourceLockId) throw new Error('Gold pipeline requires a source lock.');

    const sourceLock = await goldSourceLockService.verifyLock(sourceLockId, projectId);
    const resumeStage = job.resumeFromStage ?? job.currentStage ?? job.stages[0]?.id;
    const startIdx = Math.max(0, job.stages.findIndex((stage) => stage.id === resumeStage));

    for (let idx = startIdx; idx < job.stages.length; idx++) {
      const stage = job.stages[idx];
      if (stage.id === 'complete') continue;
      await caspaJobService.startStage(jobId, stage.id);
      if (idx === job.stages.length - 2 || stage.id === 'pipeline-run') {
        const report = await goldPipeline.run(projectId, { sourceText: sourceLock.sourceText });
        await caspaJobService.completeStage(jobId, stage.id, { reportId: report.id });
        await caspaJobService.startStage(jobId, 'complete');
        await caspaJobService.completeStage(jobId, 'complete');
        const completed = await caspaJobService.complete(jobId, {
          reportId: report.id,
          overallScore: report.overallScore,
        });
        if (!completed) throw new Error('Job update failed after Gold pipeline');
        return completed;
      }
      await caspaJobService.completeStage(jobId, stage.id);
    }

    throw new Error('Gold pipeline found no runnable stages');
  }

  private async runProjectBible(jobId: string, job: CaspaJob, user?: UserPublic): Promise<CaspaJob> {
    const projectId = job.projectId;
    if (!projectId) throw new Error('Project Bible job missing projectId');
    await this.projectService.getProject(projectId, user);

    await runStage(jobId, 'load', async () => ({ projectId }));
    const bible = await runStage(jobId, 'generate', async () => projectBibleService.generate(projectId));
    await runStage(jobId, 'save', async () => ({ projectId }));
    await caspaJobService.startStage(jobId, 'complete');
    await caspaJobService.completeStage(jobId, 'complete');

    const completed = await caspaJobService.complete(jobId, { bible });
    if (!completed) throw new Error('Job update failed after Project Bible');
    return completed;
  }

  private async runBookMap(jobId: string, job: CaspaJob, user?: UserPublic): Promise<CaspaJob> {
    const projectId = job.projectId;
    if (!projectId) throw new Error('Book Map job missing projectId');
    await this.projectService.getProject(projectId, user);

    await runStage(jobId, 'load', async () => ({ projectId }));
    const map = await runStage(jobId, 'generate', async () => bookMapService.generate(projectId, user));
    await runStage(jobId, 'save', async () => ({ outputId: (map as { outputId?: string }).outputId }));
    await caspaJobService.startStage(jobId, 'complete');
    await caspaJobService.completeStage(jobId, 'complete');

    const completed = await caspaJobService.complete(jobId, map);
    if (!completed) throw new Error('Job update failed after Book Map');
    return completed;
  }

  private async runCutAnalyse(jobId: string, job: CaspaJob, user?: UserPublic): Promise<CaspaJob> {
    const projectId = job.projectId;
    if (!projectId) throw new Error('Cut analyse job missing projectId');
    await this.projectService.getProject(projectId, user);

    const payload = job.input as Record<string, unknown>;
    await runStage(jobId, 'load', async () => ({ projectId }));
    const analysis = await runStage(jobId, 'analyse', async () =>
      cutTightenService.analyse({ ...payload, projectId }, user));
    await runStage(jobId, 'save', async () => ({ saved: true }));
    await caspaJobService.startStage(jobId, 'complete');
    await caspaJobService.completeStage(jobId, 'complete');

    const completed = await caspaJobService.complete(jobId, analysis);
    if (!completed) throw new Error('Job update failed after Cut analyse');
    return completed;
  }
}

export const caspaJobRunner = new CaspaJobRunner();
