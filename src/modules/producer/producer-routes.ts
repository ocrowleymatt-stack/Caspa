import { asyncHandler, createElevationRouter, param, sendSuccess } from '../../shared/routeHelpers';
import { budgetEstimator } from './BudgetEstimator';
import { venueFitScorer } from './VenueFitScorer';
import { rightsRiskScanner } from './RightsRiskScanner';
import { productionScheduleBuilder } from './ProductionScheduleBuilder';
import { castCrewPlanner } from './CastCrewPlanner';
import { revenueScenarioModel } from './RevenueScenarioModel';

export const producerRouter = createElevationRouter();

producerRouter.post('/api/producer/budget/:showPackageId', asyncHandler(async (req, res) => {
  sendSuccess(res, await budgetEstimator.estimate(param(req, 'showPackageId')));
}));

producerRouter.post('/api/producer/venue-fit/:showPackageId', asyncHandler(async (req, res) => {
  sendSuccess(res, await venueFitScorer.score(param(req, 'showPackageId')));
}));

producerRouter.post('/api/producer/rights-risk/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await rightsRiskScanner.scan(param(req, 'projectId')));
}));

producerRouter.post('/api/producer/schedule/:showPackageId', asyncHandler(async (req, res) => {
  sendSuccess(res, await productionScheduleBuilder.build(param(req, 'showPackageId')));
}));

producerRouter.post('/api/producer/cast-crew/:showPackageId', asyncHandler(async (req, res) => {
  sendSuccess(res, await castCrewPlanner.plan(param(req, 'showPackageId')));
}));

producerRouter.post('/api/producer/revenue/:showPackageId', asyncHandler(async (req, res) => {
  sendSuccess(res, await revenueScenarioModel.model(param(req, 'showPackageId')));
}));
