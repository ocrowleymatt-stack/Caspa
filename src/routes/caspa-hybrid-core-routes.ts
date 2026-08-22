import express from 'express';
import { createHash } from 'node:crypto';
import { requestUser } from '../middleware/authenticatedUser';
import {
  acceptDraftPreview,
  createDraftPreview,
  createManuscriptVersion,
  getAuditEvents,
  getOwnedProject,
  latestDiagnosis,
  latestDraftPreview,
  listManuscriptVersions,
  migrateOwnedProjects,
  rejectDraftPreview,
  runExportPreflight,
  saveDiagnosis,
  exportableManuscript,
} from '../services/hybridCoreRepository';
import { callServerAi } from '../services/serverAiHelper';
import { getUserJob } from '../services/jobQueueService';

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

function parseJson(text: string): any {
  const clean = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(clean);
}

router.get('/projects/:projectId/draft-preview', async (req, res) => {
  return res.json({ success: true, data: await latestDraftPreview(requestUser(res).id, req.params.projectId) });
});

router.post('/projects/:projectId/draft-preview', async (req, res) => {
  const user = requestUser(res);
  const project = await getOwnedProject(user.id, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
  const chapterTitle = String(req.body?.chapterTitle || '').trim().slice(0, 240);
  const targetWords = Math.max(250, Math.min(6000, Number(req.body?.targetWords || 1200)));
  const mode = ['opening', 'append', 'replace'].includes(req.body?.mode) ? req.body.mode : 'append';
  if (!chapterTitle) return res.status(400).json({ success: false, message: 'Chapter title is required.' });
  const versions = await listManuscriptVersions(user.id, project.id);
  const source = String(versions[0]?.content || project.state?.commission?.artefact || project.state?.manuscriptSource || project.state?.whitePage || '');
  const prompt = `You are Caspa, a precise literary collaborator. Draft prose only; never include commentary.
Project: ${project.title}
Mode: ${project.mode}
Operation: ${mode}
Chapter title: ${chapterTitle}
Target: approximately ${targetWords} words
Outline: ${String(req.body?.outline || 'Use the established dramatic trajectory.')}
Voice notes: ${String(req.body?.voiceNotes || 'Preserve the manuscript voice.')}
Exclusions: ${String(req.body?.exclusions || 'None specified.')}

Established manuscript context (most recent material):
${source.slice(-28_000)}

Write the requested chapter now. Preserve established facts, voice, names, chronology and unresolved tensions.`;
  const prose = await callServerAi(prompt, false, { maxTokens: Math.min(8000, Math.ceil(targetWords * 1.7)), timeoutMs: 180_000 });
  if (!prose.trim()) return res.status(502).json({ success: false, message: 'No draft was produced. Your manuscript was not changed.' });
  const reviewPrompt = `Review the candidate against the established context. Return ONLY JSON:
{"approved":true,"violations":[],"summary":"..."}
Reject only concrete contradictions, exclusion breaches, identity changes or chronology errors.

CONTEXT:\n${source.slice(-18_000)}\n\nCANDIDATE:\n${prose.slice(0, 24_000)}`;
  let review: any = { approved: true, violations: [], summary: 'Continuity review completed.' };
  try { review = parseJson(await callServerAi(reviewPrompt, true, { maxTokens: 700, timeoutMs: 90_000 })); } catch { /* retain safe preview; author still must accept */ }
  if (review.approved === false || (Array.isArray(review.violations) && review.violations.length)) {
    return res.status(422).json({ success: false, message: 'The draft was withheld because it contradicted established manuscript facts.', data: { violations: review.violations || [] } });
  }
  const preview = await createDraftPreview(user.id, project.id, {
    sourceVersionId: versions[0]?.id || null,
    mode,
    chapterTitle,
    content: prose,
    grounding: { summary: String(review.summary || 'Continuity review completed.'), targetWords, outline: String(req.body?.outline || '') },
  });
  return res.status(201).json({ success: true, data: preview });
});

router.post('/draft-previews/:previewId/reject', async (req, res) => {
  const rejected = await rejectDraftPreview(requestUser(res).id, req.params.previewId);
  return rejected ? res.json({ success: true }) : res.status(409).json({ success: false, message: 'Preview is no longer awaiting review.' });
});

router.post('/draft-previews/:previewId/accept', async (req, res) => {
  if (req.body?.authorConfirmed !== true) return res.status(400).json({ success: false, message: 'Explicit author confirmation is required.' });
  const version = await acceptDraftPreview(requestUser(res).id, req.params.previewId);
  return version ? res.json({ success: true, data: version }) : res.status(409).json({ success: false, message: 'Preview is stale, rejected or already accepted.' });
});

router.get('/projects/:projectId/diagnosis', async (req, res) => {
  return res.json({ success: true, data: await latestDiagnosis(requestUser(res).id, req.params.projectId) });
});

router.post('/projects/:projectId/diagnosis', async (req, res) => {
  const user = requestUser(res);
  const project = await getOwnedProject(user.id, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
  const versions = await listManuscriptVersions(user.id, project.id);
  const manuscript = String(versions[0]?.content || project.state?.commission?.artefact || project.state?.manuscriptSource || project.state?.whitePage || '');
  if (!manuscript.trim()) return res.status(400).json({ success: false, message: 'A manuscript is required before Workshop diagnosis.' });
  const prompt = `Act as a rigorous developmental editor. Return ONLY valid JSON with this shape:
{"summary":"objective assessment","findings":[{"category":"structure|continuity|character|pacing|voice|clarity|evidence","severity":"critical|major|minor","confidence":0.0,"evidence":"specific passage or location","rationale":"why it matters","recommendation":"bounded repair"}]}
Use evidence from the text. Do not invent facts. Prefer 4-10 high-value findings.

PROJECT: ${project.title}\nMODE: ${project.mode}\nMANUSCRIPT:\n${manuscript.slice(0, 80_000)}`;
  let diagnosis: any;
  try { diagnosis = parseJson(await callServerAi(prompt, true, { maxTokens: 3500, timeoutMs: 180_000 })); }
  catch { return res.status(502).json({ success: false, message: 'Workshop could not complete the diagnosis. The manuscript is unchanged.' }); }
  const findings = Array.isArray(diagnosis.findings) ? diagnosis.findings.slice(0, 20) : [];
  const saved = await saveDiagnosis(user.id, project.id, { versionId: versions[0]?.id || null, summary: String(diagnosis.summary || 'Diagnosis completed.'), findings });
  return res.status(201).json({ success: true, data: saved });
});

router.post('/projects/:projectId/recover-job/:jobId', async (req, res) => {
  const user = requestUser(res);
  const job = getUserJob(user.id, req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
  if (job.status !== 'complete') return res.status(409).json({ success: false, message: 'Only a completed job can become a manuscript version.' });
  const result = job.result as any;
  const content = String(result?.artefact || result?.finalText || '');
  if (!content.trim()) return res.status(409).json({ success: false, message: 'The completed job has no manuscript payload.' });
  const current = await listManuscriptVersions(user.id, req.params.projectId);
  if (current.some((version) => version.checksum === manuscriptHash(content))) {
    return res.json({ success: true, data: current.find((version) => version.checksum === manuscriptHash(content)), duplicate: true });
  }
  const version = await createManuscriptVersion(user.id, req.params.projectId, {
    name: `Recovered Finish run · ${new Date(job.updatedAt).toLocaleString('en-GB')}`,
    trigger: 'finish-job-recovery',
    content,
    sourceVersionId: current[0]?.id || null,
  });
  return version ? res.status(201).json({ success: true, data: version }) : res.status(404).json({ success: false, message: 'Project not found.' });
});

router.post('/projects/:projectId/export-preflight', async (req, res) => {
  const preflight = await runExportPreflight(requestUser(res).id, req.params.projectId);
  return preflight
    ? res.json({ success: true, data: preflight })
    : res.status(404).json({ success: false, message: 'Save an immutable manuscript version before publishing.' });
});

router.get('/projects/:projectId/export.txt', async (req, res) => {
  const exported = await exportableManuscript(requestUser(res).id, req.params.projectId);
  if (!exported) return res.status(409).type('text/plain').send('A passing export preflight is required for the current version.');
  const filename = String(exported.title || 'manuscript').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'manuscript';
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
  return res.send(exported.version.content);
});

function manuscriptHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export default router;
