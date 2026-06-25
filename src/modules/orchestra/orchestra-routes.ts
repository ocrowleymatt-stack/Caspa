import { Router, type Request, type Response } from 'express';
import { jobQueue } from './JobQueue';
import { sseBroadcaster } from './SSEBroadcaster';

type ApiResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
};

function sendSuccess(res: Response, data: unknown, status = 200): void {
  const body: ApiResponse = { success: true, data };
  res.status(status).json(body);
}

function sendError(res: Response, error: unknown, status = 500): void {
  const message = error instanceof Error ? error.message : String(error);
  const body: ApiResponse = { success: false, error: message };
  res.status(status).json(body);
}

function setupSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response) => void {
  return (req, res) => {
    handler(req, res).catch((error) => sendError(res, error));
  };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export const orchestraRouter = Router();

orchestraRouter.get(
  '/api/jobs/stats',
  asyncHandler(async (_req, res) => {
    await jobQueue.listJobs();
    sendSuccess(res, jobQueue.getQueueStats());
  }),
);

orchestraRouter.get(
  '/api/jobs/stream',
  asyncHandler(async (_req, res) => {
    setupSse(res);
    sseBroadcaster.addClient(res);
    res.write(': connected\n\n');
  }),
);

orchestraRouter.delete(
  '/api/jobs/clear/completed',
  asyncHandler(async (_req, res) => {
    await jobQueue.clearCompleted();
    sendSuccess(res, { cleared: true });
  }),
);

orchestraRouter.get(
  '/api/jobs',
  asyncHandler(async (req, res) => {
    const type =
      typeof req.query.type === 'string' ? req.query.type : undefined;
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;

    const jobs = await jobQueue.listJobs({ type, status });
    sendSuccess(res, jobs);
  }),
);

orchestraRouter.get(
  '/api/jobs/:id/stream',
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const job = await jobQueue.getJob(id);

    if (!job) {
      sendError(res, 'Job not found', 404);
      return;
    }

    setupSse(res);
    sseBroadcaster.addClient(res, { jobId: id });

    const data = {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
    };
    res.write(`event: job-update\ndata: ${JSON.stringify(data)}\n\n`);
  }),
);

orchestraRouter.delete(
  '/api/jobs/:id',
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const job = await jobQueue.getJob(id);

    if (!job) {
      sendError(res, 'Job not found', 404);
      return;
    }

    await jobQueue.cancelJob(id);
    sendSuccess(res, { cancelled: id });
  }),
);

orchestraRouter.get(
  '/api/jobs/:id',
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const job = await jobQueue.getJob(id);

    if (!job) {
      sendError(res, 'Job not found', 404);
      return;
    }

    sendSuccess(res, job);
  }),
);
