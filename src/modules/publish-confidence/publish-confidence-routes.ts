import { asyncHandler, createElevationRouter, param, sendError, sendSuccess } from '../../shared/routeHelpers';
import { readJsonFile, listJsonFiles } from '../../shared/fileStore';
import { publicationConfidenceEngine, type ConfidenceCertificate } from './PublicationConfidenceEngine';

export const publishConfidenceRouter = createElevationRouter();

publishConfidenceRouter.post(
  '/api/publish-confidence/check',
  asyncHandler(async (req, res) => {
    const { projectId } = req.body as { projectId?: string };
    if (!projectId) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }
    sendSuccess(res, await publicationConfidenceEngine.check(projectId));
  }),
);

publishConfidenceRouter.get(
  '/api/publish-confidence/certificates',
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const files = await listJsonFiles('confidence-certificates');
    const certs: ConfidenceCertificate[] = [];
    for (const file of files) {
      const c = await readJsonFile<ConfidenceCertificate>('confidence-certificates', file);
      if (c && (!projectId || c.projectId === projectId)) certs.push(c);
    }
    sendSuccess(res, certs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }),
);

publishConfidenceRouter.get(
  '/api/publish-confidence/certificates/:id',
  asyncHandler(async (req, res) => {
    const cert = await readJsonFile<ConfidenceCertificate>('confidence-certificates', `${param(req, 'id')}.json`);
    if (!cert) {
      sendError(res, new Error('Certificate not found'), 404);
      return;
    }
    sendSuccess(res, cert);
  }),
);
