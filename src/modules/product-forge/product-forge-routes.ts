import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { productForgeBuilder } from './ProductForgeBuilder';
import { productPlanStore } from './ProductPlanStore';

export const productForgeRouter = createElevationRouter();

productForgeRouter.post(
  '/api/product-forge/recommend',
  asyncHandler(async (req, res) => {
    const { projectId } = req.body as { projectId?: string };
    if (!projectId) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }
    sendSuccess(res, await productForgeBuilder.recommend(projectId));
  }),
);

productForgeRouter.get(
  '/api/product-forge/plans',
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    sendSuccess(res, await productPlanStore.list(projectId));
  }),
);

productForgeRouter.get(
  '/api/product-forge/plans/:id',
  asyncHandler(async (req, res) => {
    const plan = await productPlanStore.get(param(req, 'id'));
    if (!plan) {
      sendError(res, new Error('Plan not found'), 404);
      return;
    }
    sendSuccess(res, plan);
  }),
);

productForgeRouter.patch(
  '/api/product-forge/plans/:id',
  asyncHandler(async (req, res) => {
    const plan = await productPlanStore.get(param(req, 'id'));
    if (!plan) {
      sendError(res, new Error('Plan not found'), 404);
      return;
    }
    const { selectedType, notes } = req.body as { selectedType?: string; notes?: string };
    if (selectedType !== undefined) plan.selectedType = selectedType;
    if (notes !== undefined) plan.notes = notes;
    sendSuccess(res, await productPlanStore.save(plan));
  }),
);
