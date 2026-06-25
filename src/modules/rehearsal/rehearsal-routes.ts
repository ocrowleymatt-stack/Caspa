import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { actorTableRead } from './ActorTableRead';
import { dialogueSpeakability } from './DialogueSpeakability';
import { blockingAdvisor } from './BlockingAdvisor';
import { pacingAnalyser } from './PacingAnalyser';
import { castabilityScorer } from './CastabilityScorer';
import { rehearsalNotesGenerator } from './RehearsalNotesGenerator';

export const rehearsalRouter = createElevationRouter();

rehearsalRouter.post(
  '/api/rehearsal/table-read/:showPackageId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await actorTableRead.run(param(req, 'showPackageId')));
  }),
);

rehearsalRouter.post(
  '/api/rehearsal/dialogue-check',
  asyncHandler(async (req, res) => {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    sendSuccess(res, dialogueSpeakability.check(text));
  }),
);

rehearsalRouter.post(
  '/api/rehearsal/blocking/:showPackageId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await blockingAdvisor.advise(param(req, 'showPackageId')));
  }),
);

rehearsalRouter.post(
  '/api/rehearsal/pacing/:showPackageId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await pacingAnalyser.analyse(param(req, 'showPackageId')));
  }),
);

rehearsalRouter.post(
  '/api/rehearsal/castability/:showPackageId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await castabilityScorer.score(param(req, 'showPackageId')));
  }),
);

rehearsalRouter.post(
  '/api/rehearsal/notes/:showPackageId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await rehearsalNotesGenerator.generate(param(req, 'showPackageId')));
  }),
);
