import { Router, type Request, type Response } from 'express';
import path from 'path';
import type { ShowPackage } from '../../shared/index';
import {
  ShowFactoryJobNotFoundError,
  ShowFactoryNotFoundError,
  showFactoryService,
} from './ShowFactoryService';

const service = showFactoryService;

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
  const message = error instanceof Error ? error.message : 'Unknown error';
  let code = status;

  if (error instanceof ShowFactoryNotFoundError || error instanceof ShowFactoryJobNotFoundError) {
    code = 404;
  }

  const body: ApiResponse = { success: false, error: message };
  res.status(code).json(body);
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

const VALID_TYPES: ShowPackage['type'][] = [
  'theatre',
  'radio',
  'podcast',
  'live-reading',
];

export const showFactoryRouter = Router();

showFactoryRouter.get(
  '/api/show-factory/packages/:projectId',
  asyncHandler(async (req, res) => {
    const packages = await service.listShowPackages(param(req, 'projectId'));
    sendSuccess(res, packages);
  }),
);

showFactoryRouter.post(
  '/api/show-factory/generate',
  asyncHandler(async (req, res) => {
    const { projectId, type } = req.body as {
      projectId?: string;
      type?: ShowPackage['type'];
    };

    if (!projectId || !type) {
      sendError(res, new Error('projectId and type are required'), 400);
      return;
    }

    if (!VALID_TYPES.includes(type)) {
      sendError(res, new Error(`type must be one of: ${VALID_TYPES.join(', ')}`), 400);
      return;
    }

    const result = await service.generateShowPackage(projectId, type);
    sendSuccess(res, result, 202);
  }),
);

showFactoryRouter.get(
  '/api/show-factory/package/:id',
  asyncHandler(async (req, res) => {
    const pkg = await service.getShowPackage(param(req, 'id'));
    sendSuccess(res, pkg);
  }),
);

showFactoryRouter.delete(
  '/api/show-factory/package/:id',
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    await service.deleteShowPackage(id);
    sendSuccess(res, { id });
  }),
);

showFactoryRouter.get(
  '/api/show-factory/export/:id',
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const formatParam = typeof req.query.format === 'string' ? req.query.format : 'zip';
    const format = formatParam === 'pdf' ? 'pdf' : 'zip';

    const exportPath = await service.exportShowPackage(id, format);
    res.download(exportPath, path.basename(exportPath), (error) => {
      if (error && !res.headersSent) {
        sendError(res, error);
      }
    });
  }),
);

showFactoryRouter.get(
  '/api/show-factory/status/:id',
  asyncHandler(async (req, res) => {
    const status = await service.getJobStatus(param(req, 'id'));
    sendSuccess(res, status);
  }),
);
