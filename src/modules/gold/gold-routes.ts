import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { config } from '../../shared';
import { findById } from '../../shared/db';
import type { GoldReport } from '../../shared';
import type { GoldSynthesisStage } from '../../shared/goldSynthesis';
import { standardOutputProvenance } from '../../shared/outputSemantics';
import type { UserPublic } from '../auth/types';
import { ProjectService } from '../manuscript/ProjectService';
import { outputRegistry } from '../outputs';
import { caspaJobService } from '../jobs/CaspaJobService';
import { goldPipeline } from './GoldPipeline';
import { goldSynthesisService } from './GoldSynthesisService';
import {
  assessGoldFidelity,
  goldSourceLockService,
  type GoldPassMode,
  type GoldSourceType,
} from './GoldSourceLockService';

const COLLECTION = 'gold-reports';

export const goldRouter = createElevationRouter();

const projectService = new ProjectService();

const LOCAL_USER: UserPublic = {
  id: 'local',
  email: 'local@caspa.local',
  displayName: 'Local User',
  role: 'admin',
  status: 'active',
  createdAt: new Date(0).toISOString(),
};

function getUser(req: { user?: UserPublic }): UserPublic {
  if (req.user) return req.user;
  if (!config.authEnabled) return LOCAL_USER;
  throw new Error('Authentication required');
}

goldRouter.post('/api/gold/source-lock', asyncHandler(async (req, res) => {
  const body = req.body as {
    projectId?: string;
    sourceType?: GoldSourceType;
    sourceId?: string;
    unitId?: string;
    chapterId?: string;
    outputId?: string;
    pastedText?: string;
    mode?: GoldPassMode;
  };
  if (!body.projectId?.trim()) {
    sendError(res, new Error('projectId is required'), 400);
    return;
  }
  const lock = await goldSourceLockService.createLock({
    projectId: body.projectId,
    sourceType: body.sourceType ?? 'current-manuscript',
    sourceId: body.sourceId,
    unitId: body.unitId,
    chapterId: body.chapterId,
    outputId: body.outputId,
    pastedText: body.pastedText,
    mode: body.mode ?? 'improve-same-story',
    user: getUser(req),
  });
  sendSuccess(res, lock, 201);
}));

goldRouter.get('/api/gold/source-lock/:id', asyncHandler(async (req, res) => {
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
  if (!projectId) {
    sendError(res, new Error('projectId query required'), 400);
    return;
  }
  sendSuccess(res, await goldSourceLockService.getLock(param(req, 'id'), projectId));
}));

goldRouter.post('/api/gold/run/:projectId', asyncHandler(async (req, res) => {
  await projectService.getProject(param(req, 'projectId'), getUser(req));
  sendSuccess(res, await goldPipeline.run(param(req, 'projectId')));
}));

goldRouter.post('/api/gold/run', asyncHandler(async (req, res) => {
  const body = req.body as {
    projectId?: string;
    source?: string;
    sourceLockId?: string;
    improveText?: boolean;
    stage?: GoldSynthesisStage;
    swarmOutputId?: string;
    awardAssessmentOutputId?: string;
    includeElevationSteps?: boolean;
    mode?: GoldPassMode;
  };
  if (!body.projectId?.trim()) {
    sendError(res, new Error('projectId is required'), 400);
    return;
  }

  const project = await projectService.getProject(body.projectId, getUser(req));

  let sourceText = body.source?.trim() ?? '';
  let sourceLock = null as Awaited<ReturnType<typeof goldSourceLockService.getLock>> | null;

  if (body.sourceLockId) {
    sourceLock = await goldSourceLockService.verifyLock(
      body.sourceLockId,
      body.projectId,
      body.source,
    );
    sourceText = sourceLock.sourceText;
  } else if (body.mode === 'adapt-reinvent') {
    sendError(res, new Error('Adapt/reinvent mode requires an explicit source lock.'), 400);
    return;
  }

  const job = await caspaJobService.create({
    userId: req.user?.id,
    projectId: body.projectId,
    type: 'gold-pass',
    stages: [
      { id: 'synthesis', label: 'Gold synthesis' },
      ...(body.includeElevationSteps ? [{ id: 'elevation', label: 'Elevation steps' }] : []),
    ],
    payload: {
      sourceLockId: body.sourceLockId,
      mode: body.mode,
    },
  });

  let synthesis;
  let report: GoldReport | undefined;

  try {
    await caspaJobService.startStage(job.id, 'synthesis');
    synthesis = await goldSynthesisService.synthesize({
      projectId: body.projectId,
      sourceText,
      sourceLock: sourceLock ?? undefined,
      improveText: body.improveText ?? true,
      stage: body.stage,
      swarmOutputId: body.swarmOutputId,
      awardAssessmentOutputId: body.awardAssessmentOutputId,
      includeElevationSteps: body.includeElevationSteps,
    }, getUser(req));
    await caspaJobService.completeStage(job.id, 'synthesis', {
      stage: synthesis.stage,
    });

    if (body.includeElevationSteps) {
      await caspaJobService.startStage(job.id, 'elevation');
      report = await goldPipeline.run(body.projectId, { sourceText });
      await caspaJobService.completeStage(job.id, 'elevation', {
        reportId: report?.id,
        overallScore: report?.overallScore,
      });
    }
  } catch (err) {
    await caspaJobService.fail(job.id, err instanceof Error ? err.message : 'Gold Pass failed');
    throw err;
  }

  const improved = synthesis.improvedText ?? synthesis.revisionPlan.join('\n');
  const fidelity = sourceLock && synthesis.improvedText
    ? assessGoldFidelity(sourceLock.sourceText, synthesis.improvedText, sourceLock)
    : undefined;

  const driftBlocked = fidelity
    && (fidelity.verdict === 'major-drift' || fidelity.verdict === 'different-story');

  const critique = [
    synthesis.judgeAssessment,
    `Structure: ${synthesis.structuralAssessment.summary}`,
    `Research: ${synthesis.researchAssessment.summary}`,
    `Anti-filler: ${synthesis.antiFillerReport.summary}`,
    fidelity ? `Fidelity: ${fidelity.verdict} (${fidelity.sameStoryScore}/100)` : '',
    driftBlocked ? 'WARNING: Gold Pass drifted from the source. Kept as alternative — not a safe revision.' : '',
  ].filter(Boolean).join('\n\n');

  const record = await outputRegistry.register({
    projectId: body.projectId,
    type: 'gold-pass',
    title: driftBlocked
      ? `Gold alternative (drift detected) — ${synthesis.stage}`
      : `Gold synthesis — ${synthesis.stage}`,
    path: '',
    metadata: {
      kind: 'gold-synthesis',
      ...standardOutputProvenance({
        workType: project.workType,
        sourceScope: sourceLock?.sourceType ?? (body.source?.trim() ? 'provided-text' : 'whole-manuscript'),
        unitId: sourceLock?.unitId,
        unitTitle: sourceLock?.title,
        swarmOutputId: body.swarmOutputId,
        stage: synthesis.stage,
        targetAwardIds: project.targetPrizeIds,
      }),
      text: improved,
      critique,
      synthesis,
      reportId: report?.id,
      overallScore: report?.overallScore,
      overallStatus: report?.overallStatus,
      sourceLockId: sourceLock?.sourceLockId,
      sourceHash: sourceLock?.sourceHash,
      fidelity,
      driftBlocked,
      applyBlocked: driftBlocked,
      destination: sourceLock?.unitId ? 'beside-unit' : 'writing-history',
      sourceExcerpt: sourceText.slice(0, 500),
      sourceScope: sourceLock?.sourceType ?? (body.source?.trim() ? 'provided-text' : 'full-project'),
    },
  });

  await caspaJobService.complete(job.id, {
    outputId: record.id,
    driftBlocked,
    fidelity,
  });

  sendSuccess(res, {
    jobId: job.id,
    caspaJobId: job.id,
    goldReportId: report?.id,
    status: 'complete',
    outputId: record.id,
    synthesis,
    report,
    improved,
    critique,
    fidelity,
    driftBlocked,
    destination: sourceLock?.unitId ? `Draft saved beside ${sourceLock.title}` : 'Draft saved to Writing History',
    nextActions: driftBlocked
      ? ['Keep as alternative', 'Review source lock', 'Run again with line-edit only']
      : ['Apply safely', 'Compare', 'Continue from this', 'Export'],
  });
}));

goldRouter.get('/api/gold/progress/:jobId', asyncHandler(async (req, res) => {
  const report = await findById<GoldReport>(COLLECTION, param(req, 'jobId'));
  if (!report) {
    sendError(res, new Error('Gold job not found'), 404);
    return;
  }

  sendSuccess(res, {
    jobId: report.id,
    status: report.completedAt ? 'complete' : 'running',
    overallScore: report.overallScore,
    overallStatus: report.overallStatus,
    stepsCompleted: report.steps.length,
    completedAt: report.completedAt,
  });
}));

goldRouter.get('/api/gold/report/:projectId', asyncHandler(async (req, res) => {
  await projectService.getProject(param(req, 'projectId'), getUser(req));
  sendSuccess(res, await goldPipeline.getLatestReport(param(req, 'projectId')));
}));
