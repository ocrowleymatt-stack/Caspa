import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { toolRegistry } from '../command-orchestrator/ToolRegistry';
import { casperFreestyleEngine } from './CasperFreestyleEngine';
import { freestyleSessionStore } from './FreestyleSessionStore';
import { novelWriteProService } from './NovelWriteProService';
import type { NovelWriteProMode } from './novelWritePro';

export const casperRouter = createElevationRouter();

casperRouter.post(
  '/api/casper/novel-write-pro',
  asyncHandler(async (req, res) => {
    const body = req.body as {
      projectId?: string;
      mode?: NovelWriteProMode;
      output?: string;
      spark?: string;
      source?: string;
      tone?: string;
      uploadedName?: string | null;
      modeTitle?: string;
      genre?: string;
    };

    sendSuccess(res, await novelWriteProService.generate(body), 201);
  }),
);

casperRouter.post(
  '/api/casper/freestyle',
  asyncHandler(async (req, res) => {
    const { input, sessionId, projectId } = req.body as {
      input?: string;
      sessionId?: string;
      projectId?: string;
    };

    if (sessionId && input) {
      const result = await casperFreestyleEngine.continueSession(sessionId, input);
      sendSuccess(res, result);
      return;
    }

    if (!input?.trim()) {
      const session = await casperFreestyleEngine.start(projectId);
      sendSuccess(res, { session, message: 'Session started. Send input to continue.' });
      return;
    }

    const session = await casperFreestyleEngine.start(projectId);
    const result = await casperFreestyleEngine.process(session.id, input);
    sendSuccess(res, result);
  }),
);

casperRouter.post(
  '/api/casper/freestyle/stream',
  asyncHandler(async (req, res) => {
    const { input, sessionId, projectId } = req.body as {
      input?: string;
      sessionId?: string;
      projectId?: string;
    };

    if (!input?.trim()) {
      sendError(res, new Error('input is required'), 400);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let sid = sessionId;
    if (!sid) {
      const session = await casperFreestyleEngine.start(projectId);
      sid = session.id;
      res.write(`data: ${JSON.stringify({ phase: 'session', sessionId: sid })}\n\n`);
    }

    const result = await casperFreestyleEngine.process(sid, input);
    res.write(`data: ${JSON.stringify({ phase: 'parsed', data: result.parsed })}\n\n`);
    res.write(`data: ${JSON.stringify({ phase: 'actions', data: result.actions })}\n\n`);
    res.write(`data: ${JSON.stringify({ phase: 'complete', session: result.session })}\n\n`);
    res.end();
  }),
);

casperRouter.get(
  '/api/casper/sessions',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await freestyleSessionStore.list());
  }),
);

casperRouter.get(
  '/api/casper/session/:id',
  asyncHandler(async (req, res) => {
    const session = await freestyleSessionStore.get(param(req, 'id'));
    if (!session) {
      sendError(res, new Error('Session not found'), 404);
      return;
    }
    sendSuccess(res, session);
  }),
);

casperRouter.post(
  '/api/casper/session/:id/continue',
  asyncHandler(async (req, res) => {
    const { input } = req.body as { input?: string };
    if (!input?.trim()) {
      sendError(res, new Error('input is required'), 400);
      return;
    }
    const result = await casperFreestyleEngine.continueSession(param(req, 'id'), input);
    sendSuccess(res, result);
  }),
);

casperRouter.get(
  '/api/casper/tools',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, toolRegistry.listTools());
  }),
);

casperRouter.get(
  '/api/casper/status',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await casperFreestyleEngine.getStatus());
  }),
);
