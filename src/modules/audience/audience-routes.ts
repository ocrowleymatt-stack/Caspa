import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { getProjectFullText } from '../../shared/elevationHelpers';
import { audiencePersonaService } from './AudiencePersonaService';
import { reactionSimulator } from './ReactionSimulator';
import { marketFitScorer } from './MarketFitScorer';
import { ticketBuyerPredictor } from './TicketBuyerPredictor';
import { readerReviewSimulator } from './ReaderReviewSimulator';

export const audienceRouter = createElevationRouter();

audienceRouter.post(
  '/api/audience/simulate/:projectId',
  asyncHandler(async (req, res) => {
    const text = await getProjectFullText(param(req, 'projectId'));
    sendSuccess(res, await reactionSimulator.simulateProject(text, param(req, 'projectId')));
  }),
);

audienceRouter.post(
  '/api/audience/test-text',
  asyncHandler(async (req, res) => {
    const { text, persona, projectId } = req.body as { text?: string; persona?: string; projectId?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    const personas = audiencePersonaService.list();
    const selected = personas.includes(persona as typeof personas[number])
      ? (persona as typeof personas[number])
      : personas[0];
    sendSuccess(res, await reactionSimulator.simulatePersona(text, selected, projectId));
  }),
);

audienceRouter.get(
  '/api/audience/market-fit/:projectId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await marketFitScorer.score(param(req, 'projectId')));
  }),
);

audienceRouter.post(
  '/api/audience/review-sim/:projectId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await readerReviewSimulator.simulate(param(req, 'projectId')));
  }),
);

audienceRouter.get(
  '/api/audience/ticket-buyer-fit/:projectId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await ticketBuyerPredictor.predict(param(req, 'projectId')));
  }),
);

audienceRouter.get(
  '/api/audience/personas',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, audiencePersonaService.list());
  }),
);
