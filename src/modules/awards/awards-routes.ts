import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { config } from '../../shared';
import type { AssessmentStage } from '../../shared/awardsShelf';
import type { UserPublic } from '../auth/types';
import { ProjectService } from '../manuscript/ProjectService';
import { festivalFitFinder } from './FestivalFitFinder';
import { awardsReadinessPack } from './AwardsReadinessPack';
import { submissionStatementWriter } from './SubmissionStatementWriter';
import { artisticStatementGenerator } from './ArtisticStatementGenerator';
import { judgesBriefGenerator } from './JudgesBriefGenerator';
import { pullQuoteSelector } from './PullQuoteSelector';
import { awardReadinessScorer } from '../wonder';
import { awardsShelfService } from './AwardsShelfService';

export const awardsRouter = createElevationRouter();

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

awardsRouter.get(
  '/api/awards',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await awardsShelfService.listCatalog());
  }),
);

awardsRouter.post(
  '/api/awards/custom',
  asyncHandler(async (req, res) => {
    const body = req.body as {
      name?: string;
      description?: string;
      rubricFocus?: string[];
      inspiredBy?: string;
      category?: import('../../shared/awardsShelf').AwardLensCategory;
    };
    if (!body.name?.trim() || !body.description?.trim()) {
      sendError(res, new Error('name and description are required'), 400);
      return;
    }
    sendSuccess(res, await awardsShelfService.createCustomAward({
      name: body.name,
      description: body.description,
      rubricFocus: body.rubricFocus ?? [],
      inspiredBy: body.inspiredBy,
      category: body.category,
    }), 201);
  }),
);

awardsRouter.get(
  '/api/projects/:id/awards',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await awardsShelfService.getProjectShelf(param(req, 'id'), getUser(req)));
  }),
);

awardsRouter.patch(
  '/api/projects/:id/awards',
  asyncHandler(async (req, res) => {
    const { awardIds } = req.body as { awardIds?: string[] };
    if (!Array.isArray(awardIds)) {
      sendError(res, new Error('awardIds must be an array'), 400);
      return;
    }
    sendSuccess(res, await awardsShelfService.updateProjectShelf(param(req, 'id'), awardIds, getUser(req)));
  }),
);

awardsRouter.post(
  '/api/awards/assess',
  asyncHandler(async (req, res) => {
    const body = req.body as {
      projectId?: string;
      awardIds?: string[];
      sourceText?: string;
      workType?: string;
      stage?: AssessmentStage;
    };
    if (!body.projectId?.trim() || !Array.isArray(body.awardIds) || body.awardIds.length === 0) {
      sendError(res, new Error('projectId and awardIds are required'), 400);
      return;
    }
    sendSuccess(res, await awardsShelfService.assess({
      projectId: body.projectId,
      awardIds: body.awardIds,
      sourceText: body.sourceText,
      workType: body.workType,
      stage: body.stage,
      user: getUser(req),
    }), 201);
  }),
);

awardsRouter.post('/api/awards/readiness/:projectId', asyncHandler(async (req, res) => {
  await projectService.getProject(param(req, 'projectId'), getUser(req));
  sendSuccess(res, await awardsReadinessPack.build(param(req, 'projectId')));
}));

awardsRouter.post('/api/awards/festival-pack/:projectId', asyncHandler(async (req, res) => {
  await projectService.getProject(param(req, 'projectId'), getUser(req));
  sendSuccess(res, await festivalFitFinder.find(param(req, 'projectId')));
}));

awardsRouter.post('/api/awards/artist-statement/:projectId', asyncHandler(async (req, res) => {
  await projectService.getProject(param(req, 'projectId'), getUser(req));
  sendSuccess(res, await artisticStatementGenerator.generate(param(req, 'projectId')));
}));

awardsRouter.post('/api/awards/judges-brief/:projectId', asyncHandler(async (req, res) => {
  await projectService.getProject(param(req, 'projectId'), getUser(req));
  sendSuccess(res, await judgesBriefGenerator.generate(param(req, 'projectId')));
}));

awardsRouter.post('/api/awards/pull-quotes/:projectId', asyncHandler(async (req, res) => {
  await projectService.getProject(param(req, 'projectId'), getUser(req));
  sendSuccess(res, await pullQuoteSelector.select(param(req, 'projectId')));
}));

awardsRouter.post('/api/awards/category-fit/:projectId', asyncHandler(async (req, res) => {
  await projectService.getProject(param(req, 'projectId'), getUser(req));
  const score = await awardReadinessScorer.scoreProject(param(req, 'projectId'));
  sendSuccess(res, {
    projectId: param(req, 'projectId'),
    categories: [
      { category: 'Best New Writing', fit: score.dimensions.originality },
      { category: 'Best Adaptation', fit: score.dimensions.commercialAppeal },
      { category: 'Outstanding Drama', fit: score.dimensions.emotionalDepth },
    ],
    generatedAt: new Date().toISOString(),
  });
}));
