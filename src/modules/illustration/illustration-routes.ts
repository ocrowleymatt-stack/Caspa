import { asyncHandler, createElevationRouter, sendError, sendSuccess } from '../../shared/routeHelpers';
import { generateId, writeJsonFile } from '../../shared/fileStore';
import { illustrationBriefBuilder } from './IllustrationBriefBuilder';
import { pagePlanEngine } from './PagePlanEngine';

export const illustrationRouter = createElevationRouter();

illustrationRouter.post(
  '/api/illustration/brief',
  asyncHandler(async (req, res) => {
    const { scene, mood, style, projectId } = req.body as {
      scene?: string;
      mood?: string;
      style?: string;
      projectId?: string;
    };
    if (!scene?.trim()) {
      sendError(res, new Error('scene is required'), 400);
      return;
    }
    const brief = {
      id: generateId(),
      ...illustrationBriefBuilder.build({ scene, mood, style, projectId }),
      createdAt: new Date().toISOString(),
    };
    await writeJsonFile('document-renders', `brief-${brief.id}.json`, brief);
    sendSuccess(res, brief, 201);
  }),
);

illustrationRouter.post(
  '/api/illustration/page-plan',
  asyncHandler(async (req, res) => {
    const { text, pagesPerChapter } = req.body as { text?: string; pagesPerChapter?: number };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    sendSuccess(res, pagePlanEngine.plan(text, pagesPerChapter));
  }),
);
