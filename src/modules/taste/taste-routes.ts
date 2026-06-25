import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { tasteProfileService } from './TasteProfileService';
import { styleDNAExtractor } from './StyleDNAExtractor';
import { tasteEngine } from './tasteEngine';
import { referenceLibrary } from './ReferenceLibrary';

export const tasteRouter = createElevationRouter();

tasteRouter.get(
  '/api/taste/profiles',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await tasteProfileService.list());
  }),
);

tasteRouter.get(
  '/api/taste/profiles/:id',
  asyncHandler(async (req, res) => {
    const profile = await tasteProfileService.get(param(req, 'id'));
    if (!profile) {
      sendError(res, new Error('Profile not found'), 404);
      return;
    }
    sendSuccess(res, profile);
  }),
);

tasteRouter.post(
  '/api/taste/profiles',
  asyncHandler(async (req, res) => {
    const profile = await tasteProfileService.create(req.body);
    sendSuccess(res, profile, 201);
  }),
);

tasteRouter.put(
  '/api/taste/profiles/:id',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await tasteProfileService.update(param(req, 'id'), req.body));
  }),
);

tasteRouter.delete(
  '/api/taste/profiles/:id',
  asyncHandler(async (req, res) => {
    const removed = await tasteProfileService.remove(param(req, 'id'));
    if (!removed) {
      sendError(res, new Error('Profile not found'), 404);
      return;
    }
    sendSuccess(res, { removed: true });
  }),
);

tasteRouter.post(
  '/api/taste/extract-style',
  asyncHandler(async (req, res) => {
    const { text, projectId } = req.body as { text?: string; projectId?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    sendSuccess(res, await styleDNAExtractor.extract(text, projectId));
  }),
);

tasteRouter.post(
  '/api/taste/apply-profile',
  asyncHandler(async (req, res) => {
    const { profileId, text } = req.body as { profileId?: string; text?: string };
    if (!profileId || !text?.trim()) {
      sendError(res, new Error('profileId and text are required'), 400);
      return;
    }
    sendSuccess(res, await tasteEngine.applyProfile(profileId, text));
  }),
);

tasteRouter.post(
  '/api/taste/compare-output',
  asyncHandler(async (req, res) => {
    const { profileId, textA, textB } = req.body as { profileId?: string; textA?: string; textB?: string };
    if (!profileId || !textA || !textB) {
      sendError(res, new Error('profileId, textA, and textB are required'), 400);
      return;
    }
    sendSuccess(res, await tasteEngine.compareOutput(profileId, textA, textB));
  }),
);

tasteRouter.get(
  '/api/taste/references',
  asyncHandler(async (req, res) => {
    const tags = req.query.tags ? String(req.query.tags).split(',') : undefined;
    sendSuccess(res, referenceLibrary.list(tags));
  }),
);
