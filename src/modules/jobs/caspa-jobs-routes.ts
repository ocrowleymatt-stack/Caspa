import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { caspaJobService } from './CaspaJobService';

export const caspaJobsRouter = createElevationRouter();

caspaJobsRouter.post(
  '/api/jobs',
  asyncHandler(async (req, res) => {
    const body = req.body as {
      projectId?: string;
      type?: string;
      stages?: Array<{ id: string; label: string }>;
      input?: Record<string, unknown>;
    };
    if (!body.type?.trim()) {
      sendError(res, new Error('type is required'), 400);
      return;
    }
    sendSuccess(
      res,
      await caspaJobService.create({
        userId: req.user?.id,
        projectId: body.projectId,
        type: body.type,
        stages: body.stages ?? [{ id: 'main', label: 'Main' }],
        payload: body.input,
      }),
      201,
    );
  }),
);

caspaJobsRouter.get(
  '/api/jobs',
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    sendSuccess(res, await caspaJobService.list({ projectId, userId: req.user?.id }));
  }),
);

caspaJobsRouter.get(
  '/api/jobs/:jobId',
  asyncHandler(async (req, res) => {
    const job = await caspaJobService.get(param(req, 'jobId'));
    if (!job) {
      sendError(res, new Error('Job not found'), 404);
      return;
    }
    sendSuccess(res, job);
  }),
);

caspaJobsRouter.post(
  '/api/jobs/:jobId/resume',
  asyncHandler(async (req, res) => {
    const job = await caspaJobService.get(param(req, 'jobId'));
    if (!job) {
      sendError(res, new Error('Job not found'), 404);
      return;
    }
    sendSuccess(res, await caspaJobService.patch(job.id, {
      status: 'queued',
      retryCount: job.retryCount + 1,
      error: undefined,
    }));
  }),
);

caspaJobsRouter.post(
  '/api/jobs/:jobId/cancel',
  asyncHandler(async (req, res) => {
    const job = await caspaJobService.get(param(req, 'jobId'));
    if (!job) {
      sendError(res, new Error('Job not found'), 404);
      return;
    }
    sendSuccess(res, await caspaJobService.patch(job.id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    }));
  }),
);

caspaJobsRouter.get(
  '/api/projects/:id/jobs',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await caspaJobService.list({ projectId: param(req, 'id') }));
  }),
);

caspaJobsRouter.get(
  '/api/projects/:id/jobs/latest',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await caspaJobService.latestForProject(param(req, 'id')));
  }),
);
