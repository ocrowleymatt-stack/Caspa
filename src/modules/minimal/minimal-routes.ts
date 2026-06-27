import { asyncHandler, createElevationRouter, param, sendSuccess } from '../../shared/routeHelpers';
import type { UserPublic } from '../auth/types';
import { ProjectService } from '../manuscript/ProjectService';
import { minimalWorkflowService } from './MinimalWorkflowService';

function getUser(req: { user?: UserPublic }): UserPublic {
  if (!req.user) throw new Error('Authentication required');
  return req.user;
}

export const minimalRouter = createElevationRouter();
const projectService = new ProjectService();

minimalRouter.post(
  '/api/minimal/projects',
  asyncHandler(async (req, res) => {
    const body = req.body as { title?: string; targetWordCount?: number };
    const project = await projectService.createProject({
      title: body.title?.trim() || 'Untitled work',
      genre: 'General',
      description: 'Created in Caspa minimal mode',
      targetWordCount: body.targetWordCount ?? 60000,
      status: 'draft',
      workType: 'novel',
      workflowStage: 'blank',
    }, getUser(req).id);
    sendSuccess(res, project, 201);
  }),
);

minimalRouter.get(
  '/api/projects/:id/minimal/state',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await minimalWorkflowService.getState(param(req, 'id'), req.user));
  }),
);

minimalRouter.post(
  '/api/projects/:id/minimal/auto-build',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await minimalWorkflowService.autoBuild(param(req, 'id'), req.user), 201);
  }),
);

minimalRouter.post(
  '/api/projects/:id/minimal/auto-write',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await minimalWorkflowService.autoWrite(param(req, 'id'), req.user), 201);
  }),
);

minimalRouter.post(
  '/api/projects/:id/minimal/improve',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await minimalWorkflowService.improve(param(req, 'id'), req.user), 201);
  }),
);

minimalRouter.post(
  '/api/projects/:id/minimal/export',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await minimalWorkflowService.exportAll(param(req, 'id'), req.user), 201);
  }),
);
