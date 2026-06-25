import { asyncHandler, createElevationRouter, sendError, sendSuccess } from '../../shared/routeHelpers';
import { researchPlanner } from './ResearchPlanner';
import { claimExtractor } from './ClaimExtractor';
import { stubWebResearchProvider } from './StubWebResearchProvider';
import { manualSourceProvider } from './ManualSourceProvider';

export const researchRouter = createElevationRouter();

researchRouter.post(
  '/api/research/plan',
  asyncHandler(async (req, res) => {
    const { query, projectId } = req.body as { query?: string; projectId?: string };
    if (!query?.trim()) {
      sendError(res, new Error('query is required'), 400);
      return;
    }
    sendSuccess(res, researchPlanner.plan(query, projectId));
  }),
);

researchRouter.post(
  '/api/research/extract-claims',
  asyncHandler(async (req, res) => {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    sendSuccess(res, claimExtractor.extract(text));
  }),
);

researchRouter.post(
  '/api/research/web-search',
  asyncHandler(async (req, res) => {
    const { query } = req.body as { query?: string };
    if (!query?.trim()) {
      sendError(res, new Error('query is required'), 400);
      return;
    }
    sendSuccess(res, stubWebResearchProvider.search(query));
  }),
);

researchRouter.post(
  '/api/research/manual-source',
  asyncHandler(async (req, res) => {
    const { title, url, notes, projectId } = req.body as {
      title?: string;
      url?: string;
      notes?: string;
      projectId?: string;
    };
    if (!title?.trim()) {
      sendError(res, new Error('title is required'), 400);
      return;
    }
    sendSuccess(res, await manualSourceProvider.add({
      title,
      url,
      notes: notes ?? '',
      projectId,
    }), 201);
  }),
);
