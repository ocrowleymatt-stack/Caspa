import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { getProjectFullText } from '../../shared/elevationHelpers';
import { showFactoryService } from '../show-factory';
import { localJokeEngine } from './LocalJokeEngine';
import { communityReferenceAdapter } from './CommunityReferenceAdapter';
import { regionalToneAdapter } from './RegionalToneAdapter';
import { castCustomiser } from './CastCustomiser';
import { venueCustomiser } from './VenueCustomiser';
import { sponsorInsertEngine } from './SponsorInsertEngine';

export const localiseRouter = createElevationRouter();

localiseRouter.post('/api/localise/project/:projectId', asyncHandler(async (req, res) => {
  const { community } = req.body as { community?: string };
  sendSuccess(res, await communityReferenceAdapter.adaptProject(param(req, 'projectId'), community ?? 'Local Community'));
}));

localiseRouter.post('/api/localise/show/:showPackageId', asyncHandler(async (req, res) => {
  const pkg = await showFactoryService.getShowPackage(param(req, 'showPackageId'));
  const { region } = req.body as { region?: string };
  sendSuccess(res, regionalToneAdapter.adapt(pkg.components.join('\n'), region ?? 'UK'));
}));

localiseRouter.post('/api/localise/local-jokes', asyncHandler(async (req, res) => {
  const { region, context, projectId } = req.body as { region?: string; context?: string; projectId?: string };
  if (!region) {
    sendError(res, new Error('region is required'), 400);
    return;
  }
  const text = context ?? (projectId ? await getProjectFullText(projectId) : '');
  sendSuccess(res, await localJokeEngine.generate(region, text, projectId));
}));

localiseRouter.post('/api/localise/cast-size', asyncHandler(async (req, res) => {
  const { castSize, venueCapacity } = req.body as { castSize?: number; venueCapacity?: number };
  sendSuccess(res, castCustomiser.customise(castSize ?? 8, venueCapacity ?? 200));
}));

localiseRouter.post('/api/localise/venue', asyncHandler(async (req, res) => {
  const { venueType, showType } = req.body as { venueType?: string; showType?: string };
  sendSuccess(res, venueCustomiser.customise(venueType ?? 'proscenium', showType ?? 'theatre'));
}));

localiseRouter.post('/api/localise/sponsor-safe', asyncHandler(async (req, res) => {
  const { context, sponsor } = req.body as { context?: string; sponsor?: string };
  sendSuccess(res, sponsorInsertEngine.generateSafe(context ?? '', sponsor));
}));
