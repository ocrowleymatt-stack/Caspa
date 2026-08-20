import express from 'express';
import { requestUser } from '../middleware/authenticatedUser';
import { createProject, getProject, listProjects, listRevisions, restoreRevision, updateProject } from '../services/projectRepository';

const router = express.Router();

router.get('/', async (_req, res) => {
  const user = requestUser(res);
  res.json({ success: true, data: { projects: await listProjects(user.id) } });
});

router.post('/', async (req, res) => {
  const user = requestUser(res);
  const { projectKey, title, mode, state } = req.body || {};
  if (!projectKey || !title || !state || typeof state !== 'object') return res.status(400).json({ success: false, message: 'projectKey, title and state are required' });
  try {
    const project = await createProject(user.id, { projectKey: String(projectKey), title: String(title), mode: String(mode || 'novel'), state });
    res.setHeader('ETag', `"${project.revision}"`);
    return res.status(201).json({ success: true, data: project });
  } catch (error: any) {
    if (error?.code === '23505') return res.status(409).json({ success: false, message: 'Project already exists', code: 'PROJECT_EXISTS' });
    throw error;
  }
});

router.get('/:id', async (req, res) => {
  const project = await getProject(requestUser(res).id, req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  res.setHeader('ETag', `"${project.revision}"`);
  return res.json({ success: true, data: project });
});

router.patch('/:id', async (req, res) => {
  const expected = Number(String(req.headers['if-match'] || req.body?.revision || '').replace(/"/g, ''));
  if (!Number.isInteger(expected) || expected < 1) return res.status(428).json({ success: false, message: 'If-Match project revision is required', code: 'REVISION_REQUIRED' });
  if (!req.body?.state || typeof req.body.state !== 'object' || Array.isArray(req.body.state)) return res.status(400).json({ success: false, message: 'Project state is required' });
  const project = await updateProject(requestUser(res).id, req.params.id, expected, req.body?.state, req.body?.title, req.body?.mode);
  if (!project) return res.status(409).json({ success: false, message: 'Project changed in another session', code: 'REVISION_CONFLICT' });
  res.setHeader('ETag', `"${project.revision}"`);
  return res.json({ success: true, data: project });
});

router.get('/:id/revisions', async (req, res) => {
  const project = await getProject(requestUser(res).id, req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  return res.json({ success: true, data: { revisions: await listRevisions(requestUser(res).id, req.params.id) } });
});

router.post('/:id/restore/:revision', async (req, res) => {
  const revision = Number(req.params.revision);
  const project = Number.isInteger(revision) ? await restoreRevision(requestUser(res).id, req.params.id, revision) : null;
  if (!project) return res.status(404).json({ success: false, message: 'Project or revision not found' });
  res.setHeader('ETag', `"${project.revision}"`);
  return res.json({ success: true, data: project });
});

export default router;
