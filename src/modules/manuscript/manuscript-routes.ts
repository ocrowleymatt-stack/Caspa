import { Router, type Request, type Response } from 'express';
import type { UserPublic } from '../auth/types';
import { ChapterService } from './ChapterService';
import { CharacterService } from './CharacterService';
import { NotFoundError, ProjectService } from './ProjectService';
import { PlotService } from './PlotService';
import { ResearchService } from './ResearchService';

const projectService = new ProjectService();
const chapterService = new ChapterService();
const characterService = new CharacterService();
const plotService = new PlotService();
const researchService = new ResearchService();

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

function getUser(req: Request): UserPublic {
  return req.user!;
}

export const manuscriptRouter = Router();

manuscriptRouter.get(
  '/api/projects',
  asyncHandler(async (req, res) => {
    const projects = await projectService.listProjects(getUser(req));
    sendSuccess(res, projects);
  }),
);

manuscriptRouter.post(
  '/api/projects',
  asyncHandler(async (req, res) => {
    const project = await projectService.createProject(req.body, getUser(req).id);
    sendSuccess(res, project, 201);
  }),
);

manuscriptRouter.get(
  '/api/projects/:id',
  asyncHandler(async (req, res) => {
    const project = await projectService.getProject(param(req, 'id'), getUser(req));
    sendSuccess(res, project);
  }),
);

manuscriptRouter.put(
  '/api/projects/:id',
  asyncHandler(async (req, res) => {
    const project = await projectService.updateProject(param(req, 'id'), req.body, getUser(req));
    sendSuccess(res, project);
  }),
);

manuscriptRouter.delete(
  '/api/projects/:id',
  asyncHandler(async (req, res) => {
    await projectService.deleteProject(param(req, 'id'), getUser(req));
    sendSuccess(res, { id: param(req, 'id') });
  }),
);

manuscriptRouter.get(
  '/api/projects/:id/stats',
  asyncHandler(async (req, res) => {
    const stats = await projectService.getProjectStats(param(req, 'id'), getUser(req));
    sendSuccess(res, stats);
  }),
);

manuscriptRouter.get(
  '/api/projects/:id/chapters',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const chapters = await chapterService.listChapters(param(req, 'id'));
    sendSuccess(res, chapters);
  }),
);

manuscriptRouter.post(
  '/api/projects/:id/chapters',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const chapter = await chapterService.createChapter({
      ...req.body,
      projectId: param(req, 'id'),
    });
    sendSuccess(res, chapter, 201);
  }),
);

manuscriptRouter.post(
  '/api/projects/:id/chapters/reorder',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const { orderedIds } = req.body as { orderedIds?: string[] };
    if (!Array.isArray(orderedIds)) {
      sendError(res, new Error('orderedIds must be an array'), 400);
      return;
    }
    await chapterService.reorderChapters(param(req, 'id'), orderedIds);
    sendSuccess(res, { reordered: true });
  }),
);

manuscriptRouter.get(
  '/api/chapters/:id',
  asyncHandler(async (req, res) => {
    const chapter = await chapterService.getChapter(param(req, 'id'));
    await projectService.getProject(chapter.projectId, getUser(req));
    sendSuccess(res, chapter);
  }),
);

manuscriptRouter.put(
  '/api/chapters/:id',
  asyncHandler(async (req, res) => {
    const existing = await chapterService.getChapter(param(req, 'id'));
    await projectService.getProject(existing.projectId, getUser(req));
    const chapter = await chapterService.updateChapter(param(req, 'id'), req.body);
    sendSuccess(res, chapter);
  }),
);

manuscriptRouter.delete(
  '/api/chapters/:id',
  asyncHandler(async (req, res) => {
    const existing = await chapterService.getChapter(param(req, 'id'));
    await projectService.getProject(existing.projectId, getUser(req));
    await chapterService.deleteChapter(param(req, 'id'));
    sendSuccess(res, { id: param(req, 'id') });
  }),
);

manuscriptRouter.get(
  '/api/chapters/:id/history',
  asyncHandler(async (req, res) => {
    const existing = await chapterService.getChapter(param(req, 'id'));
    await projectService.getProject(existing.projectId, getUser(req));
    const history = await chapterService.getChapterHistory(param(req, 'id'));
    sendSuccess(res, history);
  }),
);

manuscriptRouter.post(
  '/api/chapters/:id/restore',
  asyncHandler(async (req, res) => {
    const existing = await chapterService.getChapter(param(req, 'id'));
    await projectService.getProject(existing.projectId, getUser(req));
    const { timestamp } = req.body as { timestamp?: string };
    if (!timestamp) {
      sendError(res, new Error('timestamp is required'), 400);
      return;
    }
    const chapter = await chapterService.restoreChapter(param(req, 'id'), timestamp);
    sendSuccess(res, chapter);
  }),
);

manuscriptRouter.get(
  '/api/projects/:id/characters',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const characters = await characterService.listCharacters(param(req, 'id'));
    sendSuccess(res, characters);
  }),
);

manuscriptRouter.post(
  '/api/projects/:id/characters',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const character = await characterService.createCharacter({
      ...req.body,
      projectId: param(req, 'id'),
    });
    sendSuccess(res, character, 201);
  }),
);

manuscriptRouter.get(
  '/api/characters/:id',
  asyncHandler(async (req, res) => {
    const character = await characterService.getCharacter(param(req, 'id'));
    await projectService.getProject(character.projectId, getUser(req));
    sendSuccess(res, character);
  }),
);

manuscriptRouter.put(
  '/api/characters/:id',
  asyncHandler(async (req, res) => {
    const existing = await characterService.getCharacter(param(req, 'id'));
    await projectService.getProject(existing.projectId, getUser(req));
    const character = await characterService.updateCharacter(param(req, 'id'), req.body);
    sendSuccess(res, character);
  }),
);

manuscriptRouter.delete(
  '/api/characters/:id',
  asyncHandler(async (req, res) => {
    const existing = await characterService.getCharacter(param(req, 'id'));
    await projectService.getProject(existing.projectId, getUser(req));
    await characterService.deleteCharacter(param(req, 'id'));
    sendSuccess(res, { id: param(req, 'id') });
  }),
);

manuscriptRouter.get(
  '/api/projects/:id/relationship-map',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const map = await characterService.getCharacterRelationshipMap(param(req, 'id'));
    sendSuccess(res, map);
  }),
);

manuscriptRouter.get(
  '/api/projects/:id/plot',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const plotPoints = await plotService.listPlotPoints(param(req, 'id'));
    sendSuccess(res, plotPoints);
  }),
);

manuscriptRouter.post(
  '/api/projects/:id/plot',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const plotPoint = await plotService.createPlotPoint({
      ...req.body,
      projectId: param(req, 'id'),
    });
    sendSuccess(res, plotPoint, 201);
  }),
);

manuscriptRouter.put(
  '/api/plot/:id',
  asyncHandler(async (req, res) => {
    const existing = await plotService.getPlotPoint(param(req, 'id'));
    await projectService.getProject(existing.projectId, getUser(req));
    const plotPoint = await plotService.updatePlotPoint(param(req, 'id'), req.body);
    sendSuccess(res, plotPoint);
  }),
);

manuscriptRouter.delete(
  '/api/plot/:id',
  asyncHandler(async (req, res) => {
    const existing = await plotService.getPlotPoint(param(req, 'id'));
    await projectService.getProject(existing.projectId, getUser(req));
    await plotService.deletePlotPoint(param(req, 'id'));
    sendSuccess(res, { id: param(req, 'id') });
  }),
);

manuscriptRouter.post(
  '/api/projects/:id/plot/reorder',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const { orderedIds } = req.body as { orderedIds?: string[] };
    if (!Array.isArray(orderedIds)) {
      sendError(res, new Error('orderedIds must be an array'), 400);
      return;
    }
    await plotService.reorderPlotPoints(param(req, 'id'), orderedIds);
    sendSuccess(res, { reordered: true });
  }),
);

manuscriptRouter.get(
  '/api/projects/:id/research',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const tagsParam = req.query.tags;
    const tags =
      typeof tagsParam === 'string' && tagsParam.length > 0
        ? tagsParam.split(',').map((tag) => tag.trim()).filter(Boolean)
        : undefined;
    const notes = await researchService.listNotes(param(req, 'id'), tags);
    sendSuccess(res, notes);
  }),
);

manuscriptRouter.post(
  '/api/projects/:id/research',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const note = await researchService.createNote({
      ...req.body,
      projectId: param(req, 'id'),
    });
    sendSuccess(res, note, 201);
  }),
);

manuscriptRouter.put(
  '/api/research/:id',
  asyncHandler(async (req, res) => {
    const existing = await researchService.getNote(param(req, 'id'));
    await projectService.getProject(existing.projectId, getUser(req));
    const note = await researchService.updateNote(param(req, 'id'), req.body);
    sendSuccess(res, note);
  }),
);

manuscriptRouter.delete(
  '/api/research/:id',
  asyncHandler(async (req, res) => {
    const existing = await researchService.getNote(param(req, 'id'));
    await projectService.getProject(existing.projectId, getUser(req));
    await researchService.deleteNote(param(req, 'id'));
    sendSuccess(res, { id: param(req, 'id') });
  }),
);

manuscriptRouter.get(
  '/api/projects/:id/research/search',
  asyncHandler(async (req, res) => {
    await projectService.getProject(param(req, 'id'), getUser(req));
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const notes = await researchService.searchNotes(param(req, 'id'), query);
    sendSuccess(res, notes);
  }),
);
