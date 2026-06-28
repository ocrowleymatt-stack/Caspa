import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { jobQueue } from '../orchestra/JobQueue';
import { sseBroadcaster } from '../orchestra/SSEBroadcaster';
import { caspaJobService } from './CaspaJobService';
import { caspaJobExecutor } from './CaspaJobExecutor';
import { caspaJobRunner } from './CaspaJobRunner';
import { caspaJobWorker } from './CaspaJobWorker';
import { buildJobStartResponse, computeJobProgress } from './jobHelpers';

function setupSse(res: import('express').Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

async function resolveJob(id: string) {
  const caspa = await caspaJobService.get(id);
  if (caspa) return { system: 'caspa' as const, job: caspa };
  const orchestra = await jobQueue.getJob(id);
  if (orchestra) return { system: 'orchestra' as const, job: orchestra };
  return null;
}

export const caspaJobsRouter = createElevationRouter();

caspaJobsRouter.get(
  '/api/jobs/stats',
  asyncHandler(async (_req, res) => {
    await jobQueue.listJobs();
    sendSuccess(res, jobQueue.getQueueStats());
  }),
);

caspaJobsRouter.get(
  '/api/jobs/stream',
  asyncHandler(async (_req, res) => {
    setupSse(res);
    sseBroadcaster.addClient(res);
    res.write(': connected\n\n');
  }),
);

caspaJobsRouter.delete(
  '/api/jobs/clear/completed',
  asyncHandler(async (_req, res) => {
    await jobQueue.clearCompleted();
    sendSuccess(res, { cleared: true });
  }),
);

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
    const job = await caspaJobService.create({
      userId: req.user?.id,
      projectId: body.projectId,
      type: body.type,
      stages: body.stages ?? [{ id: 'main', label: 'Main' }],
      payload: body.input,
    });
    caspaJobWorker.kick();
    sendSuccess(res, buildJobStartResponse(job), 202);
  }),
);

caspaJobsRouter.get(
  '/api/jobs',
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const [caspaJobs, orchestraJobs] = await Promise.all([
      caspaJobService.list({ projectId, userId: req.user?.id }),
      jobQueue.listJobs({ type, status }),
    ]);

    if (projectId || req.query.system === 'caspa') {
      sendSuccess(res, caspaJobs);
      return;
    }
    if (req.query.system === 'orchestra') {
      sendSuccess(res, orchestraJobs);
      return;
    }

    sendSuccess(res, [...caspaJobs, ...orchestraJobs].sort((a, b) => {
      const aTime = 'updatedAt' in a ? String(a.updatedAt) : String((a as { updatedAt?: string }).updatedAt ?? '');
      const bTime = 'updatedAt' in b ? String(b.updatedAt) : String((b as { updatedAt?: string }).updatedAt ?? '');
      return bTime.localeCompare(aTime);
    }));
  }),
);

caspaJobsRouter.get(
  '/api/jobs/:jobId/progress',
  asyncHandler(async (req, res) => {
    const resolved = await resolveJob(param(req, 'jobId'));
    if (!resolved) {
      sendError(res, new Error('Job not found'), 404);
      return;
    }
    if (resolved.system === 'orchestra') {
      sendSuccess(res, {
        jobId: resolved.job.id,
        status: resolved.job.status,
        progress: resolved.job.progress,
        result: resolved.job.result,
        error: resolved.job.error,
      });
      return;
    }
    sendSuccess(res, {
      jobId: resolved.job.id,
      status: resolved.job.status,
      progress: computeJobProgress(resolved.job),
      currentStage: resolved.job.currentStage,
      stages: resolved.job.stages,
      partialResult: resolved.job.partialResult,
      result: resolved.job.result,
      error: resolved.job.error,
    });
  }),
);

caspaJobsRouter.get(
  '/api/jobs/:jobId/stream',
  asyncHandler(async (req, res) => {
    const id = param(req, 'jobId');
    const resolved = await resolveJob(id);
    if (!resolved) {
      sendError(res, new Error('Job not found'), 404);
      return;
    }

    setupSse(res);

    if (resolved.system === 'orchestra') {
      sseBroadcaster.addClient(res, { jobId: id });
      const data = {
        id: resolved.job.id,
        type: resolved.job.type,
        status: resolved.job.status,
        progress: resolved.job.progress,
        result: resolved.job.result,
        error: resolved.job.error,
      };
      res.write(`event: job-update\ndata: ${JSON.stringify(data)}\n\n`);
      return;
    }

    const writeUpdate = async () => {
      const job = await caspaJobService.get(id);
      if (!job) return;
      res.write(`event: job-update\ndata: ${JSON.stringify({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: computeJobProgress(job),
        currentStage: job.currentStage,
        stages: job.stages,
        partialResult: job.partialResult,
        result: job.result,
        error: job.error,
      })}\n\n`);
    };

    await writeUpdate();
    const timer = setInterval(() => {
      void writeUpdate().then(() => {
        void caspaJobService.get(id).then((job) => {
          if (job && ['completed', 'failed', 'cancelled'].includes(job.status)) {
            clearInterval(timer);
            res.end();
          }
        });
      });
    }, 2000);

    req.on('close', () => clearInterval(timer));
  }),
);

caspaJobsRouter.get(
  '/api/jobs/:jobId',
  asyncHandler(async (req, res) => {
    const resolved = await resolveJob(param(req, 'jobId'));
    if (!resolved) {
      sendError(res, new Error('Job not found'), 404);
      return;
    }
    sendSuccess(res, resolved.job);
  }),
);

caspaJobsRouter.delete(
  '/api/jobs/:jobId',
  asyncHandler(async (req, res) => {
    const id = param(req, 'jobId');
    const caspa = await caspaJobService.get(id);
    if (caspa) {
      sendSuccess(res, await caspaJobService.patch(id, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
      }));
      return;
    }
    const orchestra = await jobQueue.getJob(id);
    if (!orchestra) {
      sendError(res, new Error('Job not found'), 404);
      return;
    }
    await jobQueue.cancelJob(id);
    sendSuccess(res, { cancelled: id });
  }),
);

caspaJobsRouter.post(
  '/api/jobs/:jobId/cancel',
  asyncHandler(async (req, res) => {
    const id = param(req, 'jobId');
    const job = await caspaJobService.get(id);
    if (!job) {
      sendError(res, new Error('Job not found'), 404);
      return;
    }
    sendSuccess(res, await caspaJobService.patch(id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    }));
  }),
);

caspaJobsRouter.post(
  '/api/jobs/:jobId/retry',
  asyncHandler(async (req, res) => {
    const id = param(req, 'jobId');
    const job = await caspaJobService.get(id);
    if (!job) {
      sendError(res, new Error('Job not found'), 404);
      return;
    }
    const retried = await caspaJobService.retry(id);
    caspaJobWorker.kick();
    sendSuccess(res, buildJobStartResponse(retried!));
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
    sendSuccess(res, await caspaJobExecutor.resume(job.id, req.user));
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

export async function enqueueCaspaJob(input: {
  userId?: string;
  projectId?: string;
  type: string;
  stages: Array<{ id: string; label: string }>;
  payload?: Record<string, unknown>;
}) {
  const job = await caspaJobService.create(input);
  caspaJobWorker.kick();
  return job;
}

export function startCaspaJobSync(
  jobId: string,
  user?: import('../auth/types').UserPublic,
) {
  return caspaJobRunner.run(jobId, user);
}
