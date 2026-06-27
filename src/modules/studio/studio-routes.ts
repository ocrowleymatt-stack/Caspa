import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { projectAssetService } from './ProjectAssetService';
import { productionBriefService } from './ProductionBriefService';
import { guideStateService } from './GuideStateService';
import { intimacySettingsService } from './IntimacySettingsService';
import { aiOrchestrator } from '../ai/AIOrchestrator';
import { manuscriptStructureService } from '../book/ManuscriptStructureService';
import { ChapterService } from '../manuscript/ChapterService';

export const studioRouter = createElevationRouter();

studioRouter.get(
  '/api/projects/:id/assets',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await projectAssetService.list(param(req, 'id'), req.user));
  }),
);

studioRouter.post(
  '/api/projects/:id/assets',
  asyncHandler(async (req, res) => {
    const body = req.body as {
      title?: string;
      originalFilename?: string;
      mimeType?: string;
      sourceText?: string;
      tags?: string[];
    };
    if (!body.sourceText?.trim()) {
      sendError(res, new Error('sourceText is required'), 400);
      return;
    }
    const asset = await projectAssetService.create(
      param(req, 'id'),
      { ...body, sourceText: body.sourceText.trim() },
      req.user,
    );

    const projectId = param(req, 'id');
    const chapters = await new ChapterService().listChapters(projectId);
    let structureSuggestion = null as Awaited<ReturnType<typeof manuscriptStructureService.analyse>> | null;

    if (body.sourceText.trim().length > 1500 && chapters.length <= 1) {
      structureSuggestion = manuscriptStructureService.analyse({
        rawText: body.sourceText.trim(),
        filename: body.originalFilename ?? body.title,
        projectId,
      });
    }

    sendSuccess(res, { asset, structureSuggestion }, 201);
  }),
);

studioRouter.get(
  '/api/projects/:id/assets/:assetId',
  asyncHandler(async (req, res) => {
    const asset = await projectAssetService.get(param(req, 'id'), param(req, 'assetId'), req.user);
    if (!asset) {
      sendError(res, new Error('Asset not found'), 404);
      return;
    }
    sendSuccess(res, asset);
  }),
);

studioRouter.patch(
  '/api/projects/:id/assets/:assetId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await projectAssetService.patch(param(req, 'id'), param(req, 'assetId'), req.body ?? {}, req.user));
  }),
);

studioRouter.delete(
  '/api/projects/:id/assets/:assetId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, { deleted: await projectAssetService.remove(param(req, 'id'), param(req, 'assetId'), req.user) });
  }),
);

studioRouter.get(
  '/api/projects/:id/creative-specification',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await productionBriefService.get(param(req, 'id'), req.user));
  }),
);

studioRouter.patch(
  '/api/projects/:id/creative-specification',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await productionBriefService.patch(param(req, 'id'), req.body ?? {}, req.user));
  }),
);

studioRouter.get(
  '/api/projects/:id/production-brief',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await productionBriefService.get(param(req, 'id'), req.user));
  }),
);

studioRouter.post(
  '/api/projects/:id/production-brief/generate',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await productionBriefService.generate(param(req, 'id'), req.user), 201);
  }),
);

studioRouter.patch(
  '/api/projects/:id/production-brief',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await productionBriefService.patch(param(req, 'id'), req.body ?? {}, req.user));
  }),
);

studioRouter.get(
  '/api/projects/:id/guide-state',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await guideStateService.getGuideState(param(req, 'id'), req.user));
  }),
);

studioRouter.get(
  '/api/projects/:id/intimacy-settings',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await intimacySettingsService.get(param(req, 'id'), req.user));
  }),
);

studioRouter.patch(
  '/api/projects/:id/intimacy-settings',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await intimacySettingsService.patch(param(req, 'id'), req.body ?? {}, req.user));
  }),
);

studioRouter.post(
  '/api/providers/test-all',
  asyncHandler(async (_req, res) => {
    const started = Date.now();
    const providers = await aiOrchestrator.getProviderRuntimeStatus();
    sendSuccess(res, {
      testedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      providers,
    });
  }),
);
