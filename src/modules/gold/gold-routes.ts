import { asyncHandler, createElevationRouter, param, sendSuccess } from '../../shared/routeHelpers';
import { goldPipeline } from './GoldPipeline';

export const goldRouter = createElevationRouter();

goldRouter.post('/api/gold/run/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await goldPipeline.run(param(req, 'projectId')));
}));

goldRouter.get('/api/gold/report/:projectId', asyncHandler(async (req, res) => {
  sendSuccess(res, await goldPipeline.getLatestReport(param(req, 'projectId')));
}));
