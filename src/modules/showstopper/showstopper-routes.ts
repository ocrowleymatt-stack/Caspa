import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { signatureMomentFinder } from './SignatureMomentFinder';
import { bigNumberGenerator } from './BigNumberGenerator';
import { elevenOClockNumberEngine } from './ElevenOClockNumberEngine';
import { finaleBuilder } from './FinaleBuilder';
import { killerLineGenerator } from './KillerLineGenerator';
import { trailerMomentExtractor } from './TrailerMomentExtractor';
import { buildShowstopperBundle } from './SignatureMomentFinder';
import { requireProject } from '../../shared/elevationHelpers';

export const showstopperRouter = createElevationRouter();

showstopperRouter.post(
  '/api/showstopper/find/:projectId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await signatureMomentFinder.find(param(req, 'projectId')));
  }),
);

showstopperRouter.post(
  '/api/showstopper/killer-lines',
  asyncHandler(async (req, res) => {
    const { text, projectId } = req.body as { text?: string; projectId?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    sendSuccess(res, await killerLineGenerator.generate(text, projectId));
  }),
);

showstopperRouter.post(
  '/api/showstopper/big-number/:projectId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await bigNumberGenerator.generate(param(req, 'projectId')));
  }),
);

showstopperRouter.post(
  '/api/showstopper/finale/:projectId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await finaleBuilder.build(param(req, 'projectId')));
  }),
);

showstopperRouter.post(
  '/api/showstopper/trailer-moments/:projectId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await trailerMomentExtractor.extract(param(req, 'projectId')));
  }),
);

showstopperRouter.post(
  '/api/showstopper/poster-quotes/:projectId',
  asyncHandler(async (req, res) => {
    const project = await requireProject(param(req, 'projectId'));
    sendSuccess(res, buildShowstopperBundle(project.title, project.description));
  }),
);
