import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import {
  emitEvent,
  findById,
  generateId,
  readCollection,
  upsert,
  type ExportJob,
  type Project,
} from '../../shared';
import { jobQueue } from '../orchestra';
import { pdfAssembler, type PDFOptions } from './PDFAssembler';
import { epubBuilder, type EPUBOptions } from './EPUBBuilder';
import { kdpPackager } from './KDPPackager';

const EXPORTS = 'exports';

type ApiResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
};

function sendSuccess(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data } satisfies ApiResponse);
}

function sendError(res: Response, error: unknown, status = 500): void {
  const message = error instanceof Error ? error.message : String(error);
  res.status(status).json({ success: false, error: message } satisfies ApiResponse);
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

async function createExportJob(
  projectId: string,
  format: ExportJob['format'],
): Promise<ExportJob> {
  const project = await findById<Project>('projects', projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const now = new Date().toISOString();
  const exportJob: ExportJob = {
    id: generateId(),
    projectId,
    format,
    status: 'queued',
    createdAt: now,
  };

  await upsert(EXPORTS, exportJob);
  emitEvent('export:started', exportJob);
  return exportJob;
}

async function updateExportJob(
  exportId: string,
  updates: Partial<Pick<ExportJob, 'status' | 'outputPath'>>,
): Promise<ExportJob> {
  const existing = await findById<ExportJob>(EXPORTS, exportId);
  if (!existing) {
    throw new Error(`Export not found: ${exportId}`);
  }

  const updated: ExportJob = { ...existing, ...updates };
  await upsert(EXPORTS, updated);

  if (updated.status === 'complete') {
    emitEvent('export:complete', updated);
  }

  return updated;
}

export const publishingRouter = Router();

publishingRouter.post(
  '/api/publish/pdf',
  asyncHandler(async (req, res) => {
    const { projectId, options } = req.body as {
      projectId?: string;
      options?: PDFOptions;
    };

    if (!projectId || !options) {
      sendError(res, new Error('projectId and options are required'), 400);
      return;
    }

    const exportJob = await createExportJob(projectId, 'pdf');
    const job = await jobQueue.enqueue('pdf-export', {
      exportId: exportJob.id,
      projectId,
      options,
    });

    sendSuccess(res, { jobId: job.id, exportId: exportJob.id }, 202);
  }),
);

publishingRouter.post(
  '/api/publish/epub',
  asyncHandler(async (req, res) => {
    const { projectId, options } = req.body as {
      projectId?: string;
      options?: EPUBOptions;
    };

    if (!projectId || !options) {
      sendError(res, new Error('projectId and options are required'), 400);
      return;
    }

    const exportJob = await createExportJob(projectId, 'epub');
    const job = await jobQueue.enqueue('epub-export', {
      exportId: exportJob.id,
      projectId,
      options,
    });

    sendSuccess(res, { jobId: job.id, exportId: exportJob.id }, 202);
  }),
);

publishingRouter.post(
  '/api/publish/kdp',
  asyncHandler(async (req, res) => {
    const { projectId } = req.body as { projectId?: string };

    if (!projectId) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }

    const exportJob = await createExportJob(projectId, 'kdp');
    const job = await jobQueue.enqueue('kdp-package', {
      exportId: exportJob.id,
      projectId,
    });

    sendSuccess(res, { jobId: job.id, exportId: exportJob.id }, 202);
  }),
);

publishingRouter.post(
  '/api/publish/ingram',
  asyncHandler(async (req, res) => {
    const { projectId } = req.body as { projectId?: string };

    if (!projectId) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }

    const exportJob = await createExportJob(projectId, 'ingram');
    const job = await jobQueue.enqueue('ingram-package', {
      exportId: exportJob.id,
      projectId,
    });

    sendSuccess(res, { jobId: job.id, exportId: exportJob.id }, 202);
  }),
);

publishingRouter.get(
  '/api/publish/exports',
  asyncHandler(async (req, res) => {
    const projectId =
      typeof req.query.projectId === 'string' ? req.query.projectId : undefined;

    const exports = await readCollection<ExportJob>(EXPORTS);
    const filtered = projectId
      ? exports.filter((entry) => entry.projectId === projectId)
      : exports;

    sendSuccess(
      res,
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );
  }),
);

publishingRouter.get(
  '/api/publish/exports/:id',
  asyncHandler(async (req, res) => {
    const exportJob = await findById<ExportJob>(EXPORTS, param(req, 'id'));
    if (!exportJob) {
      sendError(res, new Error('Export not found'), 404);
      return;
    }
    sendSuccess(res, exportJob);
  }),
);

publishingRouter.get(
  '/api/publish/download/:id',
  asyncHandler(async (req, res) => {
    const exportJob = await findById<ExportJob>(EXPORTS, param(req, 'id'));
    if (!exportJob) {
      sendError(res, new Error('Export not found'), 404);
      return;
    }

    if (exportJob.status !== 'complete' || !exportJob.outputPath) {
      sendError(res, new Error('Export is not ready for download'), 400);
      return;
    }

    try {
      await fs.access(exportJob.outputPath);
    } catch {
      sendError(res, new Error('Export file missing from disk'), 404);
      return;
    }

    res.download(exportJob.outputPath, path.basename(exportJob.outputPath), (error) => {
      if (error && !res.headersSent) {
        sendError(res, error);
      }
    });
  }),
);

publishingRouter.post(
  '/api/publish/validate/pdf',
  asyncHandler(async (req, res) => {
    const { filePath } = req.body as { filePath?: string };
    if (!filePath) {
      sendError(res, new Error('filePath is required'), 400);
      return;
    }

    const result = await pdfAssembler.validateCMYK(filePath);
    sendSuccess(res, result);
  }),
);

publishingRouter.post(
  '/api/publish/validate/kdp',
  asyncHandler(async (req, res) => {
    const { projectId } = req.body as { projectId?: string };
    if (!projectId) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }

    const result = await kdpPackager.validateForKDP(projectId);
    sendSuccess(res, result);
  }),
);

publishingRouter.get(
  '/api/publish/metadata/:projectId',
  asyncHandler(async (req, res) => {
    const project = await findById<Project>('projects', param(req, 'projectId'));
    if (!project) {
      sendError(res, new Error('Project not found'), 404);
      return;
    }

    const xml = kdpPackager.generateMetadataXML(project);
    res.type('application/xml').send(xml);
  }),
);

export { updateExportJob };
