import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { outputRegistry, type OutputType } from './OutputRegistry';

export const outputsRouter = createElevationRouter();

outputsRouter.get(
  '/api/outputs',
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type as OutputType : undefined;
    sendSuccess(res, await outputRegistry.list({ projectId, type }));
  }),
);

outputsRouter.get(
  '/api/outputs/:id',
  asyncHandler(async (req, res) => {
    const record = await outputRegistry.get(param(req, 'id'));
    if (!record) {
      sendError(res, new Error('Output not found'), 404);
      return;
    }
    sendSuccess(res, record);
  }),
);

outputsRouter.post(
  '/api/outputs',
  asyncHandler(async (req, res) => {
    const { projectId, type, title, path: outputPath, metadata } = req.body as {
      projectId?: string;
      type?: OutputType;
      title?: string;
      path?: string;
      metadata?: Record<string, unknown>;
    };
    if (!title?.trim() || !type) {
      sendError(res, new Error('title and type are required'), 400);
      return;
    }
    sendSuccess(res, await outputRegistry.register({
      projectId,
      type,
      title,
      path: outputPath ?? '',
      metadata: metadata ?? {},
    }), 201);
  }),
);
