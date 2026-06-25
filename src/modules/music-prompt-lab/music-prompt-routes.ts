import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { musicPromptInterpreter } from './MusicPromptInterpreter';
import { jamSessionEngine } from './JamSessionEngine';

export const musicPromptRouter = createElevationRouter();

musicPromptRouter.post(
  '/api/music-prompt/interpret',
  asyncHandler(async (req, res) => {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) {
      sendError(res, new Error('prompt is required'), 400);
      return;
    }
    const interpreted = musicPromptInterpreter.interpret(prompt);
    const saved = await musicPromptInterpreter.save(interpreted);
    sendSuccess(res, saved, 201);
  }),
);

musicPromptRouter.post(
  '/api/music-prompt/jam/start',
  asyncHandler(async (req, res) => {
    const { projectId, promptId, participants } = req.body as {
      projectId?: string;
      promptId?: string;
      participants?: string[];
    };
    sendSuccess(res, await jamSessionEngine.start({ projectId, promptId, participants }), 201);
  }),
);

musicPromptRouter.post(
  '/api/music-prompt/jam/:id/note',
  asyncHandler(async (req, res) => {
    const { note } = req.body as { note?: string };
    if (!note?.trim()) {
      sendError(res, new Error('note is required'), 400);
      return;
    }
    const session = await jamSessionEngine.addNote(param(req, 'id'), note);
    if (!session) {
      sendError(res, new Error('Jam session not found'), 404);
      return;
    }
    sendSuccess(res, session);
  }),
);

musicPromptRouter.get(
  '/api/music-prompt/jam/:id',
  asyncHandler(async (req, res) => {
    const session = await jamSessionEngine.get(param(req, 'id'));
    if (!session) {
      sendError(res, new Error('Jam session not found'), 404);
      return;
    }
    sendSuccess(res, session);
  }),
);

musicPromptRouter.get(
  '/api/music-prompt/:id',
  asyncHandler(async (req, res) => {
    const item = await musicPromptInterpreter.get(param(req, 'id'));
    if (!item) {
      sendError(res, new Error('Prompt not found'), 404);
      return;
    }
    sendSuccess(res, item);
  }),
);
