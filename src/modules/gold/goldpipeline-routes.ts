import { asyncHandler, createElevationRouter, sendError, sendSuccess } from '../../shared/routeHelpers';
import { config } from '../../shared';
import type { UserPublic } from '../auth/types';
import { enqueueCaspaJob, startCaspaJobSync } from '../jobs/caspa-jobs-routes';
import { buildJobStartResponse, GOLD_PIPELINE_JOB_STAGES } from '../jobs/jobHelpers';
import { ProjectService } from '../manuscript/ProjectService';
import { goldSourceLockService } from './GoldSourceLockService';

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

export const goldPipelineRoutes = createElevationRouter();

goldPipelineRoutes.post(
  '/execute',
  asyncHandler(async (req, res) => {
    const { projectId, config: runConfig, chapters, sourceLockId } = req.body as {
      projectId?: string;
      config?: Record<string, unknown>;
      chapters?: string[];
      sourceLockId?: string;
    };

    if (!projectId?.trim()) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }
    if (!sourceLockId?.trim()) {
      sendError(res, new Error('sourceLockId is required — confirm manuscript source before running Gold pipeline.'), 400);
      return;
    }

    await projectService.getProject(projectId, getUser(req));
    await goldSourceLockService.verifyLock(sourceLockId, projectId);

    const sync = req.query.sync === '1';
    const job = await enqueueCaspaJob({
      userId: req.user?.id,
      projectId,
      type: 'gold-pipeline',
      stages: [...GOLD_PIPELINE_JOB_STAGES],
      payload: { sourceLockId, chapters, config: runConfig },
    });

    if (sync) {
      const completed = await startCaspaJobSync(job.id, getUser(req));
      sendSuccess(res, {
        jobId: job.id,
        ...(completed.result as object),
      });
      return;
    }

    sendSuccess(res, buildJobStartResponse(job), 202);
  }),
);
