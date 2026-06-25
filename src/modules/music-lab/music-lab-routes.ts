import { Router, type Request, type Response } from 'express';
import { musicLabService, NotFoundError } from './MusicLabService';
import { overnightScheduler } from './OvernightScheduler';

type ApiResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
};

function sendSuccess(res: Response, data: unknown, status = 200): void {
  const body: ApiResponse = { success: true, data };
  res.status(status).json(body);
}

function sendError(res: Response, error: unknown, status = 500): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const code = error instanceof NotFoundError ? 404 : status;
  const body: ApiResponse = { success: false, error: message };
  res.status(code).json(body);
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response) => void {
  return (req, res) => {
    handler(req, res).catch((error) => sendError(res, error));
  };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export const musicLabRouter = Router();

musicLabRouter.get(
  '/api/music-lab/tracks',
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const tracks = await musicLabService.listTracks(projectId);
    sendSuccess(res, tracks);
  }),
);

musicLabRouter.post(
  '/api/music-lab/tracks',
  asyncHandler(async (req, res) => {
    const { genre, mood, tempo, duration, description, projectId, title } = req.body as {
      genre?: string;
      mood?: string;
      tempo?: number;
      duration?: number;
      description?: string;
      projectId?: string;
      title?: string;
    };

    if (!genre || !mood || tempo === undefined || duration === undefined) {
      sendError(res, new Error('genre, mood, tempo, and duration are required'), 400);
      return;
    }

    const track = await musicLabService.createTrack({
      genre,
      mood,
      tempo,
      duration,
      description,
      projectId,
      title,
    });
    sendSuccess(res, track, 201);
  }),
);

musicLabRouter.get(
  '/api/music-lab/tracks/:id',
  asyncHandler(async (req, res) => {
    const result = await musicLabService.getTrackWithBrief(param(req, 'id'));
    sendSuccess(res, result);
  }),
);

musicLabRouter.delete(
  '/api/music-lab/tracks/:id',
  asyncHandler(async (req, res) => {
    await musicLabService.deleteTrack(param(req, 'id'));
    sendSuccess(res, { id: param(req, 'id') });
  }),
);

musicLabRouter.post(
  '/api/music-lab/generate/chapter',
  asyncHandler(async (req, res) => {
    const { chapterId } = req.body as { chapterId?: string };
    if (!chapterId) {
      sendError(res, new Error('chapterId is required'), 400);
      return;
    }
    const track = await musicLabService.generateChapterTheme(chapterId);
    sendSuccess(res, track, 201);
  }),
);

musicLabRouter.post(
  '/api/music-lab/generate/character',
  asyncHandler(async (req, res) => {
    const { characterId } = req.body as { characterId?: string };
    if (!characterId) {
      sendError(res, new Error('characterId is required'), 400);
      return;
    }
    const track = await musicLabService.generateCharacterLeitmotif(characterId);
    sendSuccess(res, track, 201);
  }),
);

musicLabRouter.post(
  '/api/music-lab/generate/pack',
  asyncHandler(async (req, res) => {
    const { projectId } = req.body as { projectId?: string };
    if (!projectId) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }
    const tracks = await musicLabService.generateAtmosphericPack(projectId);
    sendSuccess(res, tracks, 201);
  }),
);

musicLabRouter.post(
  '/api/music-lab/overnight/schedule',
  asyncHandler(async (req, res) => {
    const { projectId, trackCount, startHour } = req.body as {
      projectId?: string;
      trackCount?: number;
      startHour?: number;
    };

    if (!projectId || trackCount === undefined || startHour === undefined) {
      sendError(res, new Error('projectId, trackCount, and startHour are required'), 400);
      return;
    }

    const scheduleId = await overnightScheduler.scheduleOvernightRun(projectId, {
      trackCount,
      startHour,
    });
    sendSuccess(res, { scheduleId }, 201);
  }),
);

musicLabRouter.delete(
  '/api/music-lab/overnight/:id',
  asyncHandler(async (req, res) => {
    await overnightScheduler.cancelSchedule(param(req, 'id'));
    sendSuccess(res, { id: param(req, 'id') });
  }),
);

musicLabRouter.get(
  '/api/music-lab/overnight',
  asyncHandler(async (_req, res) => {
    const schedules = overnightScheduler.listSchedules();
    sendSuccess(res, schedules);
  }),
);

musicLabRouter.get(
  '/api/music-lab/jobs/:id',
  asyncHandler(async (req, res) => {
    const job = musicLabService.getJobStatus(param(req, 'id'));
    if (!job) {
      sendError(res, new NotFoundError(`Job not found: ${param(req, 'id')}`), 404);
      return;
    }
    sendSuccess(res, job);
  }),
);
