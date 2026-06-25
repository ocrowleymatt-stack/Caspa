import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { requireChapter } from '../../shared/elevationHelpers';
import { emotionalArcEngine } from './EmotionalArcEngine';
import { awardReadinessScorer } from './AwardReadinessScorer';
import { criticPanel } from './CriticPanel';
import { audienceSimulator } from './AudienceSimulator';
import { motifLedger } from './MotifLedger';
import { revisionLadder } from './RevisionLadder';
import { finalPolishEngine } from './FinalPolishEngine';

export const wonderRouter = createElevationRouter();

wonderRouter.post(
  '/api/wonder/analyse-project/:projectId',
  asyncHandler(async (req, res) => {
    const result = await emotionalArcEngine.analyseProject(param(req, 'projectId'));
    sendSuccess(res, result);
  }),
);

wonderRouter.post(
  '/api/wonder/analyse-chapter/:chapterId',
  asyncHandler(async (req, res) => {
    const chapter = await requireChapter(param(req, 'chapterId'));
    const result = await emotionalArcEngine.analyseChapter(
      chapter.id,
      chapter.content,
      chapter.title,
      chapter.projectId,
    );
    sendSuccess(res, result);
  }),
);

wonderRouter.post(
  '/api/wonder/polish-text',
  asyncHandler(async (req, res) => {
    const { text, projectId } = req.body as { text?: string; projectId?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    const result = await finalPolishEngine.polish(text, projectId);
    sendSuccess(res, result);
  }),
);

wonderRouter.post(
  '/api/wonder/critic-panel',
  asyncHandler(async (req, res) => {
    const { text, projectId } = req.body as { text?: string; projectId?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    const result = await criticPanel.reviewText(text, projectId);
    sendSuccess(res, result);
  }),
);

wonderRouter.post(
  '/api/wonder/revision-ladder',
  asyncHandler(async (req, res) => {
    const { text, projectId } = req.body as { text?: string; projectId?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    const result = await revisionLadder.build(text, projectId);
    sendSuccess(res, result);
  }),
);

wonderRouter.post(
  '/api/wonder/audience-sim',
  asyncHandler(async (req, res) => {
    const { text, projectId } = req.body as { text?: string; projectId?: string };
    if (!text?.trim()) {
      sendError(res, new Error('text is required'), 400);
      return;
    }
    const result = await audienceSimulator.simulate(text, projectId);
    sendSuccess(res, result);
  }),
);

wonderRouter.get(
  '/api/wonder/motif-ledger',
  asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    const motifs = await motifLedger.list(projectId);
    sendSuccess(res, motifs);
  }),
);

wonderRouter.post(
  '/api/wonder/motif-ledger',
  asyncHandler(async (req, res) => {
    const { projectId, label, description, occurrences, emotionalWeight } = req.body as {
      projectId?: string;
      label?: string;
      description?: string;
      occurrences?: string[];
      emotionalWeight?: number;
    };
    if (!projectId || !label) {
      sendError(res, new Error('projectId and label are required'), 400);
      return;
    }
    const motif = await motifLedger.create({
      projectId,
      label,
      description: description ?? '',
      occurrences: occurrences ?? [],
      emotionalWeight: emotionalWeight ?? 50,
    });
    sendSuccess(res, motif, 201);
  }),
);

wonderRouter.put(
  '/api/wonder/motif-ledger/:id',
  asyncHandler(async (req, res) => {
    const motif = await motifLedger.update(param(req, 'id'), req.body);
    sendSuccess(res, motif);
  }),
);

wonderRouter.delete(
  '/api/wonder/motif-ledger/:id',
  asyncHandler(async (req, res) => {
    const removed = await motifLedger.remove(param(req, 'id'));
    if (!removed) {
      sendError(res, new Error('Motif not found'), 404);
      return;
    }
    sendSuccess(res, { removed: true });
  }),
);

wonderRouter.get(
  '/api/wonder/score/:projectId',
  asyncHandler(async (req, res) => {
    const score = await awardReadinessScorer.scoreProject(param(req, 'projectId'));
    sendSuccess(res, score);
  }),
);
