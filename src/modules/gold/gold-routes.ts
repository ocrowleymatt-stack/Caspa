import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { findById } from '../../shared/db';
import type { GoldReport } from '../../shared';
import { outputRegistry } from '../outputs';
import { goldPipeline } from './GoldPipeline';

const COLLECTION = 'gold-reports';

export const goldRouter = createElevationRouter();

goldRouter.post('/api/gold/run/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await goldPipeline.run(param(req, 'projectId')));
}));

goldRouter.post('/api/gold/run', asyncHandler(async (req, res) => {
  const { projectId, source } = req.body as { projectId?: string; source?: string };
  if (!projectId?.trim()) {
    sendError(res, new Error('projectId is required'), 400);
    return;
  }

  const report = await goldPipeline.run(projectId, { sourceText: source });
  const polishStep = report.steps.find((step) => step.step === 'final-polish');
  const improved = polishStep?.summary ?? report.recommendations.join('\n');
  const critique = report.steps
    .slice(0, 6)
    .map((step) => `${step.label}: ${step.summary} (${step.status}, score ${step.score})`)
    .join('\n');

  const record = await outputRegistry.register({
    projectId,
    type: 'gold-pass',
    title: `Gold Pipeline — ${new Date(report.completedAt ?? report.startedAt).toLocaleString()}`,
    path: '',
    metadata: {
      kind: 'gold-pass',
      text: improved,
      critique,
      sourceExcerpt: source?.slice(0, 500) ?? '',
      sourceScope: source?.trim() ? 'provided-text' : 'full-project',
      reportId: report.id,
      overallScore: report.overallScore,
      overallStatus: report.overallStatus,
    },
  });

  sendSuccess(res, {
    jobId: report.id,
    status: 'complete',
    outputId: record.id,
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
  sendSuccess(res, await goldPipeline.getLatestReport(param(req, 'projectId')));
}));
