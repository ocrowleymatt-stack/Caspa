import { asyncHandler, createElevationRouter, param, sendSuccess } from '../../shared/routeHelpers';
import { festivalFitFinder } from './FestivalFitFinder';
import { awardsReadinessPack } from './AwardsReadinessPack';
import { submissionStatementWriter } from './SubmissionStatementWriter';
import { artisticStatementGenerator } from './ArtisticStatementGenerator';
import { judgesBriefGenerator } from './JudgesBriefGenerator';
import { pullQuoteSelector } from './PullQuoteSelector';
import { awardReadinessScorer } from '../wonder';

export const awardsRouter = createElevationRouter();

awardsRouter.post('/api/awards/readiness/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await awardsReadinessPack.build(param(req, 'projectId')));
}));

awardsRouter.post('/api/awards/festival-pack/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await festivalFitFinder.find(param(req, 'projectId')));
}));

awardsRouter.post('/api/awards/artist-statement/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await artisticStatementGenerator.generate(param(req, 'projectId')));
}));

awardsRouter.post('/api/awards/judges-brief/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await judgesBriefGenerator.generate(param(req, 'projectId')));
}));

awardsRouter.post('/api/awards/pull-quotes/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await pullQuoteSelector.select(param(req, 'projectId')));
}));

awardsRouter.post('/api/awards/category-fit/:projectId', asyncHandler(async (req, res) => {
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
