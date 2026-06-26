import { asyncHandler, createElevationRouter, sendError, sendSuccess } from '../../shared/routeHelpers';
import { config } from '../../shared';
import type { SwarmMode } from '../../shared/agentSwarm';
import type { UserPublic } from '../auth/types';
import { ProjectService } from '../manuscript/ProjectService';
import { agentSwarmService } from './AgentSwarmService';

export const agentSwarmRouter = createElevationRouter();

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

agentSwarmRouter.get(
  '/api/agents',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, agentSwarmService.listAgents());
  }),
);

agentSwarmRouter.post(
  '/api/agents/swarm',
  asyncHandler(async (req, res) => {
    const body = req.body as {
      projectId?: string;
      sourceText?: string;
      workType?: string;
      agentIds?: string[];
      targetAwardIds?: string[];
      researchItemIds?: string[];
      mode?: SwarmMode;
    };
    if (!body.projectId?.trim()) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }
    await projectService.getProject(body.projectId, getUser(req));
    sendSuccess(res, await agentSwarmService.swarm({
      projectId: body.projectId,
      sourceText: body.sourceText,
      workType: body.workType,
      agentIds: body.agentIds,
      targetAwardIds: body.targetAwardIds,
      researchItemIds: body.researchItemIds,
      mode: body.mode,
      user: getUser(req),
    }), 201);
  }),
);
