import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { NotFoundError } from '../manuscript';
import { commercialReadinessEngine } from './CommercialReadinessEngine';
import { livePerformanceMode } from './LivePerformanceMode';

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
  const code = error instanceof NotFoundError ? 404 : status;
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

const MIME_TYPES: Record<string, string> = {
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
};

export const showBoxRouter = Router();

showBoxRouter.post(
  '/api/show-box/assess/:projectId',
  asyncHandler(async (req, res) => {
    const report = await commercialReadinessEngine.assessProject(param(req, 'projectId'));
    sendSuccess(res, report);
  }),
);

showBoxRouter.get(
  '/api/show-box/report/:projectId',
  asyncHandler(async (req, res) => {
    const report = await commercialReadinessEngine.getLatestReport(param(req, 'projectId'));
    sendSuccess(res, report);
  }),
);

showBoxRouter.post(
  '/api/show-box/pitch-deck/:projectId',
  asyncHandler(async (req, res) => {
    const filePath = await commercialReadinessEngine.generatePitchDeck(param(req, 'projectId'));
    sendSuccess(res, { filePath });
  }),
);

showBoxRouter.post(
  '/api/show-box/press-kit/:projectId',
  asyncHandler(async (req, res) => {
    const filePath = await commercialReadinessEngine.generatePressKit(param(req, 'projectId'));
    sendSuccess(res, { filePath });
  }),
);

showBoxRouter.post(
  '/api/show-box/marketing/:projectId',
  asyncHandler(async (req, res) => {
    const pack = await commercialReadinessEngine.generateMarketingCopy(param(req, 'projectId'));
    sendSuccess(res, pack);
  }),
);

showBoxRouter.post(
  '/api/show-box/social/:projectId',
  asyncHandler(async (req, res) => {
    const pack = await commercialReadinessEngine.generateSocialPack(param(req, 'projectId'));
    sendSuccess(res, pack);
  }),
);

showBoxRouter.get(
  '/api/show-box/download/:type/:projectId',
  asyncHandler(async (req, res) => {
    const assetType = param(req, 'type');
    const projectId = param(req, 'projectId');
    const filePath = commercialReadinessEngine.getAssetPath(projectId, assetType);

    try {
      await fs.access(filePath);
    } catch {
      sendError(res, new NotFoundError(`Asset not found: ${assetType} for project ${projectId}`), 404);
      return;
    }

    const ext = path.extname(filePath);
    const content = await fs.readFile(filePath);
    res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${assetType}${ext}"`,
    );
    res.send(content);
  }),
);

showBoxRouter.post(
  '/api/show-box/cue-list',
  asyncHandler(async (req, res) => {
    const { showPackageId } = req.body as { showPackageId?: string };
    if (!showPackageId) {
      sendError(res, new Error('showPackageId is required'), 400);
      return;
    }
    const cueList = await livePerformanceMode.createCueList(showPackageId);
    sendSuccess(res, cueList, 201);
  }),
);

showBoxRouter.get(
  '/api/show-box/cue-list/:id',
  asyncHandler(async (req, res) => {
    const cueList = await livePerformanceMode.getCueList(param(req, 'id'));
    sendSuccess(res, cueList);
  }),
);

showBoxRouter.put(
  '/api/show-box/cue-list/:id/cue/:cueId',
  asyncHandler(async (req, res) => {
    const cue = await livePerformanceMode.updateCue(
      param(req, 'id'),
      param(req, 'cueId'),
      req.body,
    );
    sendSuccess(res, cue);
  }),
);

showBoxRouter.get(
  '/api/show-box/cue-list/:id/pdf',
  asyncHandler(async (req, res) => {
    const filePath = await livePerformanceMode.exportCueListAsPDF(param(req, 'id'));
    const content = await fs.readFile(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cue-list-${param(req, 'id')}.pdf"`,
    );
    res.send(content);
  }),
);
