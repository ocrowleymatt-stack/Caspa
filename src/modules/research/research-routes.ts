import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { ProjectService } from '../manuscript/ProjectService';
import type { UserPublic } from '../auth/types';
import { config } from '../../shared';
import { researchPlanner } from './ResearchPlanner';
import { claimExtractor } from './ClaimExtractor';
import { stubWebResearchProvider } from './StubWebResearchProvider';
import { manualSourceProvider } from './ManualSourceProvider';
import { researchDeskService } from './ResearchDeskService';

export const researchRouter = createElevationRouter();

const projectService = new ProjectService();

const LOCAL_USER: UserPublic = {
  id: 'local',
  email: 'local@caspa.local',
  displayName: 'Local User',
  role: 'admin',
  status: 'active',
  createdAt: new Date(0).toISOString(),
};

function getUser(req: { user?: UserPublic }): UserPublic {
  if (req.user) return req.user;
  if (!config.authEnabled) return LOCAL_USER;
  throw new Error('Authentication required');
}

async function assertProject(projectId: string, req: { user?: UserPublic }) {
  await projectService.getProject(projectId, getUser(req));
}

researchRouter.get(
  '/api/research',
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    if (!projectId?.trim()) {
      sendError(res, new Error('projectId query parameter is required'), 400);
      return;
    }
    await assertProject(projectId, req);
    const tagsParam = req.query.tags;
    const tags =
      typeof tagsParam === 'string' && tagsParam.length > 0
        ? tagsParam.split(',').map((tag) => tag.trim()).filter(Boolean)
        : undefined;
    sendSuccess(res, await researchDeskService.listNotes(projectId, tags));
  }),
);

researchRouter.post(
  '/api/research',
  asyncHandler(async (req, res) => {
    const body = req.body as {
      projectId?: string;
      title?: string;
      content?: string;
      tags?: string[];
      verificationStatus?: import('../../shared/researchDesk').ResearchVerificationStatus;
      sourceType?: import('../../shared/researchDesk').ResearchSourceType;
      queueStatus?: import('../../shared/researchDesk').ResearchQueueStatus;
      attachments?: import('../../shared/researchDesk').ResearchAttachment[];
      metadata?: Record<string, unknown>;
    };
    if (!body.projectId?.trim() || !body.title?.trim()) {
      sendError(res, new Error('projectId and title are required'), 400);
      return;
    }
    await assertProject(body.projectId, req);
    sendSuccess(res, await researchDeskService.createNote({
      projectId: body.projectId,
      title: body.title.trim(),
      content: body.content ?? '',
      tags: body.tags ?? [],
      verificationStatus: body.verificationStatus ?? 'unverified',
      sourceType: body.sourceType ?? 'user',
      queueStatus: body.queueStatus,
      attachments: body.attachments,
      metadata: body.metadata,
    }), 201);
  }),
);

researchRouter.post(
  '/api/research/suggest-topics',
  asyncHandler(async (req, res) => {
    const body = req.body as { projectId?: string; sourceText?: string; query?: string };
    if (!body.projectId?.trim()) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }
    await assertProject(body.projectId, req);
    sendSuccess(res, await researchDeskService.suggestTopics({
      projectId: body.projectId,
      sourceText: body.sourceText,
      query: body.query,
    }));
  }),
);

researchRouter.post(
  '/api/research/extract-claims',
  asyncHandler(async (req, res) => {
    const body = req.body as { projectId?: string; text?: string };
    if (!body.text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    if (body.projectId) {
      await assertProject(body.projectId, req);
    }
    sendSuccess(res, researchDeskService.extractClaims({
      projectId: body.projectId,
      text: body.text,
    }));
  }),
);

researchRouter.post(
  '/api/research/check-accuracy',
  asyncHandler(async (req, res) => {
    const body = req.body as {
      projectId?: string;
      claims?: Array<{ id?: string; text: string }>;
      sourceText?: string;
    };
    if (!body.projectId?.trim()) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }
    await assertProject(body.projectId, req);
    sendSuccess(res, await researchDeskService.checkAccuracy({
      projectId: body.projectId,
      claims: body.claims,
      sourceText: body.sourceText,
    }));
  }),
);

researchRouter.post(
  '/api/research/depth-pass',
  asyncHandler(async (req, res) => {
    const body = req.body as { projectId?: string; topic?: string; unitId?: string };
    if (!body.projectId?.trim()) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }
    await assertProject(body.projectId, req);
    sendSuccess(res, await researchDeskService.depthPass({
      projectId: body.projectId,
      topic: body.topic,
      unitId: body.unitId,
    }), 201);
  }),
);

researchRouter.get(
  '/api/research/:id',
  asyncHandler(async (req, res) => {
    const note = await researchDeskService.getNote(param(req, 'id'));
    await assertProject(note.projectId, req);
    sendSuccess(res, note);
  }),
);

researchRouter.patch(
  '/api/research/:id',
  asyncHandler(async (req, res) => {
    const existing = await researchDeskService.getNote(param(req, 'id'));
    await assertProject(existing.projectId, req);
    sendSuccess(res, await researchDeskService.updateNote(param(req, 'id'), req.body));
  }),
);

researchRouter.delete(
  '/api/research/:id',
  asyncHandler(async (req, res) => {
    const existing = await researchDeskService.getNote(param(req, 'id'));
    await assertProject(existing.projectId, req);
    await researchDeskService.deleteNote(param(req, 'id'));
    sendSuccess(res, { id: param(req, 'id') });
  }),
);

researchRouter.post(
  '/api/research/plan',
  asyncHandler(async (req, res) => {
    const { query, projectId } = req.body as { query?: string; projectId?: string };
    if (!query?.trim()) {
      sendError(res, new Error('query is required'), 400);
      return;
    }
    if (projectId) await assertProject(projectId, req);
    sendSuccess(res, researchPlanner.plan(query, projectId));
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
    if (projectId) await assertProject(projectId, req);
    sendSuccess(res, await manualSourceProvider.add({
      title,
      url,
      notes: notes ?? '',
      projectId,
    }), 201);
  }),
);

// Legacy deterministic extractor kept for tests
researchRouter.post(
  '/api/research/extract-claims/legacy',
  asyncHandler(async (req, res) => {
    const { text } = req.body as { text?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    sendSuccess(res, claimExtractor.extract(text));
  }),
);
