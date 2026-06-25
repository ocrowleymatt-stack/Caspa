import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { claimExtractor } from '../research/ClaimExtractor';
import { verificationEngine } from './VerificationEngine';

export const verificationRouter = createElevationRouter();

verificationRouter.post(
  '/api/verification/verify',
  asyncHandler(async (req, res) => {
    const { text, projectId } = req.body as { text?: string; projectId?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    const claims = claimExtractor.extract(text);
    const entries = await Promise.all(
      claims.map(async (claim) => verificationEngine.save(verificationEngine.verify(claim, projectId))),
    );
    sendSuccess(res, { claims: entries, count: entries.length });
  }),
);

verificationRouter.post(
  '/api/verification/confirm/:id',
  asyncHandler(async (req, res) => {
    const { evidence } = req.body as { evidence?: string };
    if (!evidence?.trim()) {
      sendError(res, new Error('evidence is required'), 400);
      return;
    }
    const entry = await verificationEngine.confirm(param(req, 'id'), evidence);
    if (!entry) {
      sendError(res, new Error('Entry not found'), 404);
      return;
    }
    sendSuccess(res, entry);
  }),
);

verificationRouter.get(
  '/api/verification/ledger',
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    sendSuccess(res, await verificationEngine.list(projectId));
  }),
);
