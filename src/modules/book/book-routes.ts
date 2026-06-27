import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { bookMapService } from './BookMapService';
import { manuscriptStructureService } from './ManuscriptStructureService';
import { projectMemoryService } from './ProjectMemoryService';
import { projectSnapshotService } from './ProjectSnapshotService';
import { projectExportService } from './ProjectExportService';

export const bookRouter = createElevationRouter();

bookRouter.get(
  '/api/projects/:id/book-map',
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const map = await bookMapService.get(id, req.user);
    if (!map) {
      sendSuccess(res, await bookMapService.buildDraft(id, req.user));
      return;
    }
    sendSuccess(res, map);
  }),
);

bookRouter.post(
  '/api/projects/:id/book-map/generate',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await bookMapService.generate(param(req, 'id'), req.user), 201);
  }),
);

bookRouter.patch(
  '/api/projects/:id/book-map',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await bookMapService.patch(param(req, 'id'), req.body ?? {}, req.user));
  }),
);

bookRouter.post(
  '/api/projects/:id/structure/analyse',
  asyncHandler(async (req, res) => {
    const id = param(req, 'id');
    const body = req.body as { rawText?: string; filename?: string; saveOutput?: boolean };
    if (body.rawText?.trim()) {
      const report = manuscriptStructureService.analyse({
        rawText: body.rawText,
        filename: body.filename,
        projectId: id,
      });
      if (body.saveOutput !== false) {
        const saved = await manuscriptStructureService.analyseAndSave({
          rawText: body.rawText,
          filename: body.filename,
          projectId: id,
          user: req.user,
        });
        sendSuccess(res, saved, 201);
        return;
      }
      sendSuccess(res, report);
      return;
    }
    sendSuccess(res, await manuscriptStructureService.analyseProjectManuscript(id, req.user), 201);
  }),
);

bookRouter.get(
  '/api/projects/:id/memory',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await projectMemoryService.get(param(req, 'id'), req.user));
  }),
);

bookRouter.patch(
  '/api/projects/:id/memory',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await projectMemoryService.patch(param(req, 'id'), req.body ?? {}, req.user));
  }),
);

bookRouter.post(
  '/api/projects/:id/memory/extract',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await projectMemoryService.extractFromProject(param(req, 'id'), req.user));
  }),
);

bookRouter.get(
  '/api/projects/:id/versions',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await projectSnapshotService.list(param(req, 'id'), req.user));
  }),
);

bookRouter.post(
  '/api/projects/:id/snapshot',
  asyncHandler(async (req, res) => {
    const body = req.body as { label?: string; reason?: string };
    sendSuccess(res, await projectSnapshotService.create(param(req, 'id'), body, req.user), 201);
  }),
);

bookRouter.post(
  '/api/projects/:id/restore',
  asyncHandler(async (req, res) => {
    const body = req.body as { snapshotId?: string };
    if (!body.snapshotId?.trim()) {
      sendError(res, new Error('snapshotId is required'), 400);
      return;
    }
    sendSuccess(res, await projectSnapshotService.restore(param(req, 'id'), body.snapshotId, req.user));
  }),
);

bookRouter.get(
  '/api/projects/:id/compare',
  asyncHandler(async (req, res) => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (!from || !to) {
      sendError(res, new Error('from and to query params required'), 400);
      return;
    }
    sendSuccess(res, await projectSnapshotService.compare(param(req, 'id'), from, to, req.user));
  }),
);

bookRouter.get(
  '/api/projects/:id/export/markdown',
  asyncHandler(async (req, res) => {
    const markdown = await projectExportService.exportMarkdownManuscript(param(req, 'id'), req.user);
    sendSuccess(res, { markdown });
  }),
);

bookRouter.post(
  '/api/projects/:id/export/archive',
  asyncHandler(async (req, res) => {
    sendSuccess(res, await projectExportService.exportProjectArchive(param(req, 'id'), req.user), 201);
  }),
);
