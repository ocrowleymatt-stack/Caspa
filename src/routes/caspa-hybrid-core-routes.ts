import express from 'express';
import { requestUser } from '../middleware/authenticatedUser';
import {
  createManuscriptVersion,
  getAuditEvents,
  listManuscriptVersions,
  migrateOwnedProjects,
} from '../services/hybridCoreRepository';

const router = express.Router();

router.get('/projects/:projectId/versions', async (req, res) => {
  const versions = await listManuscriptVersions(requestUser(res).id, req.params.projectId);
  return res.json({ success: true, data: { versions } });
});

router.post('/projects/:projectId/versions', async (req, res) => {
  const content = String(req.body?.content || '');
  const name = String(req.body?.name || '').trim();
  if (!name || !content.trim() || content.length > 4_000_000) {
    return res.status(400).json({ success: false, message: 'A version name and manuscript are required.' });
  }
  const version = await createManuscriptVersion(requestUser(res).id, req.params.projectId, {
    name,
    content,
    trigger: String(req.body?.trigger || 'manual-save').slice(0, 80),
    sourceVersionId: req.body?.sourceVersionId ? String(req.body.sourceVersionId) : null,
  });
  if (!version) return res.status(404).json({ success: false, message: 'Project not found.' });
  return res.status(201).json({ success: true, data: version });
});

router.get('/projects/:projectId/audit', async (req, res) => {
  const events = await getAuditEvents(requestUser(res).id, req.params.projectId);
  return res.json({ success: true, data: { events } });
});

router.post('/migration/import-legacy', async (_req, res) => {
  const result = await migrateOwnedProjects(requestUser(res).id);
  return res.json({ success: true, data: result });
});

export default router;
