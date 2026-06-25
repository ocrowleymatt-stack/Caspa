import { asyncHandler, createElevationRouter, param, sendSuccess } from '../../shared/routeHelpers';
import { visualIdentityEngine } from './VisualIdentityEngine';
import { posterCopyGenerator } from './PosterCopyGenerator';
import { colourPaletteAdvisor } from './ColourPaletteAdvisor';
import { setDesignBrief } from './SetDesignBrief';
import { costumeMoodboard } from './CostumeMoodboard';
import { trailerScriptGenerator } from './TrailerScriptGenerator';

export const visualsRouter = createElevationRouter();

visualsRouter.post('/api/visuals/identity/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await visualIdentityEngine.build(param(req, 'projectId')));
}));

visualsRouter.post('/api/visuals/poster/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await posterCopyGenerator.generate(param(req, 'projectId')));
}));

visualsRouter.post('/api/visuals/palette/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await colourPaletteAdvisor.advise(param(req, 'projectId')));
}));

visualsRouter.post('/api/visuals/set-brief/:showPackageId', asyncHandler(async (req, res) => {
  sendSuccess(res, await setDesignBrief.brief(param(req, 'showPackageId')));
}));

visualsRouter.post('/api/visuals/costume-brief/:showPackageId', asyncHandler(async (req, res) => {
  sendSuccess(res, await costumeMoodboard.brief(param(req, 'showPackageId')));
}));

visualsRouter.post('/api/visuals/trailer-script/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await trailerScriptGenerator.generate(param(req, 'projectId')));
}));
