import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { config } from '../../shared';
import { findById } from '../../shared/db';
import type { GoldReport } from '../../shared';
import type { GoldSynthesisStage } from '../../shared/goldSynthesis';
import { standardOutputProvenance } from '../../shared/outputSemantics';
import type { UserPublic } from '../auth/types';
import { ProjectService } from '../manuscript/ProjectService';
import { outputRegistry } from '../outputs';
import { goldPipeline } from './GoldPipeline';
import { goldSynthesisService } from './GoldSynthesisService';

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

goldRouter.post('/api/gold/run/:projectId', asyncHandler(async (req, res) => {
  await projectService.getProject(param(req, 'projectId'), getUser(req));
  sendSuccess(res, await goldPipeline.run(param(req, 'projectId')));
}));

goldRouter.post('/api/gold/run', asyncHandler(async (req, res) => {
  const body = req.body as {
    projectId?: string;
    source?: string;
    improveText?: boolean;
    stage?: GoldSynthesisStage;
    swarmOutputId?: string;
    awardAssessmentOutputId?: string;
    includeElevationSteps?: boolean;
  };
  if (!body.projectId?.trim()) {
    sendError(res, new Error('projectId is required'), 400);
    return;
  }

  const project = await projectService.getProject(body.projectId, getUser(req));

  const synthesis = await goldSynthesisService.synthesize({
    projectId: body.projectId,
    sourceText: body.source,
    improveText: body.improveText,
    stage: body.stage,
    swarmOutputId: body.swarmOutputId,
    awardAssessmentOutputId: body.awardAssessmentOutputId,
    includeElevationSteps: body.includeElevationSteps,
  }, getUser(req));

  let report: GoldReport | undefined;
  if (body.includeElevationSteps) {
    report = await goldPipeline.run(body.projectId, { sourceText: body.source });
  }

  const improved = synthesis.improvedText
    ?? synthesis.revisionPlan.join('\n');
  const critique = [
    synthesis.judgeAssessment,
    `Structure: ${synthesis.structuralAssessment.summary}`,
    `Research: ${synthesis.researchAssessment.summary}`,
    `Anti-filler: ${synthesis.antiFillerReport.summary}`,
  ].join('\n\n');

  const record = await outputRegistry.register({
    projectId: body.projectId,
    type: 'gold-pass',
    title: `Gold synthesis — ${synthesis.stage}`,
    path: '',
    metadata: {
      kind: 'gold-synthesis',
      ...standardOutputProvenance({
        workType: project.workType,
        sourceScope: body.source?.trim() ? 'provided-text' : 'whole-manuscript',
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
      sourceExcerpt: body.source?.slice(0, 500) ?? '',
      sourceScope: body.source?.trim() ? 'provided-text' : 'full-project',
    },
  });

  sendSuccess(res, {
    jobId: report?.id ?? record.id,
    status: 'complete',
    outputId: record.id,
    synthesis,
    report,
    improved,
    critique,
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
