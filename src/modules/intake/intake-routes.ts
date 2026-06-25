import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { universalIntakeEngine } from './UniversalIntakeEngine';
import { sourceLedger } from './SourceLedger';

export const intakeRouter = createElevationRouter();

intakeRouter.post(
  '/api/intake/analyse',
  asyncHandler(async (req, res) => {
    const { content, projectId, filename } = req.body as {
      content?: string;
      projectId?: string;
      filename?: string;
    };
    if (!content?.trim()) {
      sendError(res, new Error('content is required'), 400);
      return;
    }
    sendSuccess(res, await universalIntakeEngine.analyse({ content, projectId, filename }));
  }),
);

intakeRouter.get(
  '/api/intake/sources',
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    sendSuccess(res, await sourceLedger.list(projectId));
  }),
);

intakeRouter.get(
  '/api/intake/sources/:id',
  asyncHandler(async (req, res) => {
    const record = await sourceLedger.get(param(req, 'id'));
    if (!record) {
      sendError(res, new Error('Source not found'), 404);
      return;
    }
    sendSuccess(res, record);
  }),
);

intakeRouter.post(
  '/api/intake/classify',
  asyncHandler(async (req, res) => {
    const { content, filename } = req.body as { content?: string; filename?: string };
    if (!content?.trim()) {
      sendError(res, new Error('content is required'), 400);
      return;
    }
    const { sourceClassifier } = await import('./SourceClassifier');
    sendSuccess(res, sourceClassifier.classify(content, filename));
  }),
);
