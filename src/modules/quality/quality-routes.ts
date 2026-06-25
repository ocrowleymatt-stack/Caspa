import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { qualityCoreOrchestrator } from '../quality-core';
import { qualityOrchestrator } from './qualityOrchestrator';

export const qualityRouter = createElevationRouter();

qualityRouter.post(
  '/api/quality/check-text',
  asyncHandler(async (req, res) => {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    sendSuccess(res, qualityOrchestrator.checkText(text));
  }),
);

qualityRouter.post(
  '/api/quality/check-project/:projectId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await qualityOrchestrator.checkProject(param(req, 'projectId')));
  }),
);

qualityRouter.post(
  '/api/quality/check-show/:showPackageId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await qualityOrchestrator.checkShow(param(req, 'showPackageId')));
  }),
);

qualityRouter.post(
  '/api/quality/check-marketing',
  asyncHandler(async (req, res) => {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    sendSuccess(res, await qualityOrchestrator.checkMarketing(text));
  }),
);

qualityRouter.post(
  '/api/quality/final-gate/:projectId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await qualityOrchestrator.finalGate(param(req, 'projectId')));
  }),
);

qualityRouter.post(
  '/api/quality/ai-smell',
  asyncHandler(async (req, res) => {
    const { text, projectId } = req.body as { text?: string; projectId?: string };
    if (!text?.trim() && !projectId) {
      sendError(res, new Error('text or projectId is required'), 400);
      return;
    }
    sendSuccess(res, await qualityCoreOrchestrator.aiSmell(text, projectId));
  }),
);

qualityRouter.post(
  '/api/quality/human-voice',
  asyncHandler(async (req, res) => {
    const { text, projectId } = req.body as { text?: string; projectId?: string };
    if (!text?.trim() && !projectId) {
      sendError(res, new Error('text or projectId is required'), 400);
      return;
    }
    sendSuccess(res, await qualityCoreOrchestrator.humanVoice(text, projectId));
  }),
);

qualityRouter.post(
  '/api/quality/consolidated-gate/:projectId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await qualityCoreOrchestrator.consolidatedGate(param(req, 'projectId')));
  }),
);
