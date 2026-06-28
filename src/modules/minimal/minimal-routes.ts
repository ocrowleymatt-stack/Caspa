import { asyncHandler, createElevationRouter, param, sendSuccess } from '../../shared/routeHelpers';
import type { UserPublic } from '../auth/types';
import { enqueueCaspaJob, startCaspaJobSync } from '../jobs/caspa-jobs-routes';
import {
  buildJobStartResponse,
  MINIMAL_AUTO_BUILD_JOB_STAGES,
  MINIMAL_AUTO_WRITE_JOB_STAGES,
  MINIMAL_IMPROVE_JOB_STAGES,
} from '../jobs/jobHelpers';
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
    const projectId = param(req, 'id');
    const sync = req.query.sync === '1';
    const job = await enqueueCaspaJob({
      userId: req.user?.id,
      projectId,
      type: 'minimal-auto-build',
      stages: [...MINIMAL_AUTO_BUILD_JOB_STAGES],
    });

    if (sync) {
      const completed = await startCaspaJobSync(job.id, getUser(req));
      sendSuccess(res, completed.result, 201);
      return;
    }

    sendSuccess(res, buildJobStartResponse(job), 202);
  }),
);

minimalRouter.post(
  '/api/projects/:id/minimal/auto-write',
  asyncHandler(async (req, res) => {
    const projectId = param(req, 'id');
    const sync = req.query.sync === '1';
    const job = await enqueueCaspaJob({
      userId: req.user?.id,
      projectId,
      type: 'minimal-auto-write',
      stages: [...MINIMAL_AUTO_WRITE_JOB_STAGES],
    });

    if (sync) {
      const completed = await startCaspaJobSync(job.id, getUser(req));
      sendSuccess(res, completed.result, 201);
      return;
    }

    sendSuccess(res, buildJobStartResponse(job), 202);
  }),
);

minimalRouter.post(
  '/api/projects/:id/minimal/improve',
  asyncHandler(async (req, res) => {
    const projectId = param(req, 'id');
    const sync = req.query.sync === '1';
    const job = await enqueueCaspaJob({
      userId: req.user?.id,
      projectId,
      type: 'minimal-improve',
      stages: [...MINIMAL_IMPROVE_JOB_STAGES],
    });

    if (sync) {
      const completed = await startCaspaJobSync(job.id, getUser(req));
      sendSuccess(res, completed.result, 201);
      return;
    }

    sendSuccess(res, buildJobStartResponse(job), 202);
  }),
);

minimalRouter.post(
  '/api/projects/:id/minimal/export',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await minimalWorkflowService.exportAll(param(req, 'id'), req.user), 201);
  }),
);
