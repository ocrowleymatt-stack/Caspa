import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { config } from '../../shared';
import { findById } from '../../shared/db';
import type { GoldReport } from '../../shared';
import type { GoldSynthesisStage } from '../../shared/goldSynthesis';
import type { UserPublic } from '../auth/types';
import { ProjectService } from '../manuscript/ProjectService';
import { buildJobStartResponse, GOLD_PASS_JOB_STAGES } from '../jobs/jobHelpers';
import { enqueueCaspaJob, startCaspaJobSync } from '../jobs/caspa-jobs-routes';
import { goldPipeline } from './GoldPipeline';
import {
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

  await projectService.getProject(body.projectId, getUser(req));

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

  const sync = req.query.sync === '1';
  const job = await enqueueCaspaJob({
    userId: req.user?.id,
    projectId: body.projectId,
    type: 'gold-pass',
    stages: [...GOLD_PASS_JOB_STAGES],
    payload: {
      sourceLockId: body.sourceLockId,
      source: body.source,
      mode: body.mode,
      improveText: body.improveText ?? true,
      stage: body.stage,
      swarmOutputId: body.swarmOutputId,
      awardAssessmentOutputId: body.awardAssessmentOutputId,
      includeElevationSteps: body.includeElevationSteps,
    },
  });

  if (sync) {
    const completed = await startCaspaJobSync(job.id, getUser(req));
    sendSuccess(res, {
      jobId: job.id,
      caspaJobId: job.id,
      ...(completed.result as object),
    });
    return;
  }

  sendSuccess(res, buildJobStartResponse(job), 202);
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
