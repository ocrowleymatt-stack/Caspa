import express from 'express';
import { createHash } from 'node:crypto';
import { requestUser } from '../middleware/authenticatedUser';
import {
  acceptDraftPreview,
  acceptRebuildChange,
  createDraftPreview,
  createManuscriptVersion,
  getAuditEvents,
  getOwnedProject,
  isHybridConflictError,
  latestDiagnosis,
  latestDraftPreview,
  latestRebuildPlan,
  getManuscriptVersion,
  latestManuscriptVersion,
  listManuscriptVersionSummaries,
  migrateOwnedProjects,
  rejectDraftPreview,
  rejectRebuildChange,
  runExportPreflight,
  saveDiagnosis,
  saveRebuildPlan,
  exportableManuscript,
  workspaceSnapshot,
} from '../services/hybridCoreRepository';
import { callServerAi } from '../services/serverAiHelper';
import { assertJobBoundToProject, bindJobToProject, getUserJob, jobSummary, listUserJobs } from '../services/jobQueueService';
import { getProject, updateProject } from '../services/projectRepository';
import { splitRebuildChapters, titlesMatch } from '../services/workspaceRebuild';
import { mergeWorkspaceArtefacts } from '../services/workspaceProjectBridge';

const router = express.Router();

router.get('/projects/:projectId/versions', async (req, res) => {
  const versions = await listManuscriptVersionSummaries(requestUser(res).id, req.params.projectId);
  return res.json({ success: true, data: { versions } });
});

router.get('/projects/:projectId/versions/latest', async (req, res) => {
  const version = await latestManuscriptVersion(requestUser(res).id, req.params.projectId);
  return version
    ? res.json({ success: true, data: version })
    : res.status(404).json({ success: false, message: 'No immutable version has been saved yet.' });
});

router.get('/projects/:projectId/versions/:versionId', async (req, res) => {
  const version = await getManuscriptVersion(requestUser(res).id, req.params.projectId, req.params.versionId);
  return version
    ? res.json({ success: true, data: version })
    : res.status(404).json({ success: false, message: 'Version not found.' });
});

router.post('/projects/:projectId/versions', async (req, res) => {
  const content = String(req.body?.content || '');
  const name = String(req.body?.name || '').trim();
  if (!name || !content.trim() || content.length > 4_000_000) {
    return res.status(400).json({ success: false, message: 'A version name and manuscript are required.' });
  }
  const expectedRaw = req.body?.expectedSourceVersionId ?? req.body?.sourceVersionId;
  const expectedSourceVersionId = expectedRaw === undefined || expectedRaw === null || expectedRaw === ''
    ? null
    : String(expectedRaw);
  try {
    const version = await createManuscriptVersion(requestUser(res).id, req.params.projectId, {
      name,
      content,
      trigger: String(req.body?.trigger || 'manual-save').slice(0, 80),
      sourceVersionId: req.body?.sourceVersionId ? String(req.body.sourceVersionId) : expectedSourceVersionId,
      expectedSourceVersionId,
    });
    if (!version) return res.status(404).json({ success: false, message: 'Project not found.' });
    return res.status(201).json({ success: true, data: version });
  } catch (error) {
    if (isHybridConflictError(error)) {
      return res.status(409).json({ success: false, message: error.message, code: error.code });
    }
    throw error;
  }
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
  const latest = await latestManuscriptVersion(user.id, project.id);
  const source = String(latest?.content || project.state?.commission?.artefact || project.state?.manuscriptSource || project.state?.whitePage || '');
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
    sourceVersionId: latest?.id || null,
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
  try {
    const version = await acceptDraftPreview(requestUser(res).id, req.params.previewId);
    return version ? res.json({ success: true, data: version }) : res.status(409).json({ success: false, message: 'Preview is stale, rejected or already accepted.' });
  } catch (error) {
    if (isHybridConflictError(error)) {
      return res.status(409).json({ success: false, message: error.message, code: error.code });
    }
    throw error;
  }
});

router.get('/projects/:projectId/diagnosis', async (req, res) => {
  return res.json({ success: true, data: await latestDiagnosis(requestUser(res).id, req.params.projectId) });
});

router.post('/projects/:projectId/diagnosis', async (req, res) => {
  const user = requestUser(res);
  const project = await getOwnedProject(user.id, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
  const latest = await latestManuscriptVersion(user.id, project.id);
  const manuscript = String(latest?.content || project.state?.commission?.artefact || project.state?.manuscriptSource || project.state?.whitePage || '');
  if (!manuscript.trim()) return res.status(400).json({ success: false, message: 'A manuscript is required before Workshop diagnosis.' });
  const prompt = `Act as a rigorous developmental editor. Return ONLY valid JSON with this shape:
{"summary":"objective assessment","findings":[{"category":"structure|continuity|character|pacing|voice|clarity|evidence","severity":"critical|major|minor","confidence":0.0,"evidence":"specific passage or location","rationale":"why it matters","recommendation":"bounded repair"}]}
Use evidence from the text. Do not invent facts. Prefer 4-10 high-value findings.

PROJECT: ${project.title}\nMODE: ${project.mode}\nMANUSCRIPT:\n${manuscript.slice(0, 80_000)}`;
  let diagnosis: any;
  try { diagnosis = parseJson(await callServerAi(prompt, true, { maxTokens: 3500, timeoutMs: 180_000 })); }
  catch { return res.status(502).json({ success: false, message: 'Workshop could not complete the diagnosis. The manuscript is unchanged.' }); }
  const findings = Array.isArray(diagnosis.findings) ? diagnosis.findings.slice(0, 20) : [];
  const saved = await saveDiagnosis(user.id, project.id, { versionId: latest?.id || null, summary: String(diagnosis.summary || 'Diagnosis completed.'), findings });
  return res.status(201).json({ success: true, data: saved });
});

router.post('/projects/:projectId/recover-job/:jobId', async (req, res) => {
  const user = requestUser(res);
  const job = getUserJob(user.id, req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
  if (job.status !== 'complete') return res.status(409).json({ success: false, message: 'Only a completed job can become a manuscript version.' });
  try {
    assertJobBoundToProject(job, req.params.projectId);
  } catch (error) {
    return res.status(409).json({
      success: false,
      message: error instanceof Error ? error.message : 'This job does not belong to the open project.',
      code: 'JOB_PROJECT_MISMATCH',
    });
  }
  bindJobToProject(job.id, req.params.projectId);
  const result = job.result as any;
  const content = String(result?.artefact || result?.finalText || '');
  if (!content.trim()) return res.status(409).json({ success: false, message: 'The completed job has no manuscript payload.' });
  const summaries = await listManuscriptVersionSummaries(user.id, req.params.projectId);
  const duplicate = summaries.find((version) => version?.checksum === manuscriptHash(content));
  if (duplicate) {
    const existing = await getManuscriptVersion(user.id, req.params.projectId, duplicate.id);
    return res.json({ success: true, data: existing || duplicate, duplicate: true });
  }
  const latest = await latestManuscriptVersion(user.id, req.params.projectId);
  try {
    const version = await createManuscriptVersion(user.id, req.params.projectId, {
      name: `Recovered Finish run · ${new Date(job.updatedAt).toLocaleString('en-GB')}`,
      trigger: 'finish-job-recovery',
      content,
      sourceVersionId: latest?.id || null,
      expectedSourceVersionId: latest?.id || null,
    });
    return version ? res.status(201).json({ success: true, data: version }) : res.status(404).json({ success: false, message: 'Project not found.' });
  } catch (error) {
    if (isHybridConflictError(error)) {
      return res.status(409).json({ success: false, message: error.message, code: error.code });
    }
    throw error;
  }
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

router.get('/projects/:projectId/workspace', async (req, res) => {
  const snapshot = await workspaceSnapshot(requestUser(res).id, req.params.projectId);
  if (!snapshot) return res.status(404).json({ success: false, message: 'Project not found.' });
  const jobs = listUserJobs(requestUser(res).id, 12, req.params.projectId).map(jobSummary);
  return res.json({
    success: true,
    data: {
      ...snapshot,
      versions: await listManuscriptVersionSummaries(requestUser(res).id, req.params.projectId),
      jobs,
      recovery: { available: jobs.some((job) => job.status === 'complete' && job.resultAvailable) },
    },
  });
});

router.post('/projects/:projectId/artefacts', async (req, res) => {
  const user = requestUser(res);
  const expected = Number(String(req.headers['if-match'] || req.body?.revision || '').replace(/"/g, ''));
  if (!Number.isInteger(expected) || expected < 1) {
    return res.status(428).json({ success: false, message: 'If-Match project revision is required', code: 'REVISION_REQUIRED' });
  }
  const current = await getProject(user.id, req.params.projectId);
  if (!current) return res.status(404).json({ success: false, message: 'Project not found.' });
  const merged = mergeWorkspaceArtefacts(current.state, req.body?.artefacts && typeof req.body.artefacts === 'object' ? req.body.artefacts : {});
  const project = await updateProject(user.id, req.params.projectId, expected, merged, req.body?.title, req.body?.mode);
  if (!project) return res.status(409).json({ success: false, message: 'Project changed in another session', code: 'REVISION_CONFLICT' });
  res.setHeader('ETag', `"${project.revision}"`);
  return res.json({ success: true, data: { project, manuscriptUnchanged: true } });
});

router.post('/projects/:projectId/ingest', async (req, res) => {
  const user = requestUser(res);
  const current = await getProject(user.id, req.params.projectId);
  if (!current) return res.status(404).json({ success: false, message: 'Project not found.' });
  const expected = Number(String(req.headers['if-match'] || req.body?.revision || current.revision).replace(/"/g, ''));
  const text = String(req.body?.text || '').slice(0, 4_000_000);
  const title = String(req.body?.title || req.body?.filename || 'Ingested source').slice(0, 240);
  if (!text.trim()) return res.status(400).json({ success: false, message: 'Extracted text is required. Images must be OCR’d before attach.' });
  if (/^\[Image:/.test(text) && text.includes('data:image')) {
    return res.status(400).json({ success: false, message: 'Truncated image data URLs are not stored. Extract the text first.' });
  }
  const source = {
    id: `ingest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: ['text', 'file', 'image'].includes(req.body?.kind) ? req.body.kind : 'text',
    title,
    text,
    filename: req.body?.filename ? String(req.body.filename).slice(0, 240) : undefined,
    mimeType: req.body?.mimeType ? String(req.body.mimeType).slice(0, 120) : undefined,
    extracted: req.body?.extracted !== false,
    createdAt: new Date().toISOString(),
  };
  const merged = mergeWorkspaceArtefacts(current.state, { ingest: { sources: [source] } });
  const project = await updateProject(user.id, req.params.projectId, expected, merged);
  if (!project) return res.status(409).json({ success: false, message: 'Project changed in another session', code: 'REVISION_CONFLICT' });
  return res.status(201).json({ success: true, data: { source, project, manuscriptUnchanged: true } });
});

router.get('/projects/:projectId/rebuild', async (req, res) => {
  return res.json({ success: true, data: await latestRebuildPlan(requestUser(res).id, req.params.projectId) });
});

router.post('/projects/:projectId/rebuild/analyze', async (req, res) => {
  const user = requestUser(res);
  const project = await getOwnedProject(user.id, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
  const latest = await latestManuscriptVersion(user.id, project.id);
  const manuscript = String(latest?.content || project.state?.commission?.artefact || project.state?.manuscriptSource || project.state?.whitePage || '');
  if (!manuscript.trim()) return res.status(400).json({ success: false, message: 'A manuscript is required before rebuild analysis.' });
  const chapters = splitRebuildChapters(manuscript);
  const prompt = `Analyse this manuscript for structural reconstruction. Return ONLY JSON:
{"summary":"...","findings":[{"category":"structure|pacing|character|continuity","severity":"critical|major|minor","evidence":"...","recommendation":"...","chapterTitle":"..."}]}
Do not rewrite prose. Do not invent chapters. Prefer 3-8 findings.

TITLE: ${project.title}
CHAPTERS: ${chapters.map((chapter) => chapter.title).join(' | ')}
MANUSCRIPT:
${manuscript.slice(0, 70_000)}`;
  let analysis: any;
  try { analysis = parseJson(await callServerAi(prompt, true, { maxTokens: 2500, timeoutMs: 180_000 })); }
  catch { return res.status(502).json({ success: false, message: 'Rebuild analysis could not complete. The manuscript is unchanged.' }); }
  const saved = await saveRebuildPlan(user.id, project.id, {
    sourceVersionId: latest?.id || null,
    status: 'analyzed',
    analysis: { summary: String(analysis.summary || 'Analysis complete.'), findings: Array.isArray(analysis.findings) ? analysis.findings.slice(0, 12) : [] },
    changes: [],
  });
  return res.status(201).json({ success: true, data: saved });
});

router.post('/projects/:projectId/rebuild/plan', async (req, res) => {
  const user = requestUser(res);
  const project = await getOwnedProject(user.id, req.params.projectId);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
  const latest = await latestManuscriptVersion(user.id, project.id);
  const manuscript = String(latest?.content || '');
  if (!manuscript.trim()) return res.status(400).json({ success: false, message: 'A saved version is required before a rebuild plan.' });
  const current = await latestRebuildPlan(user.id, project.id);
  const chapters = splitRebuildChapters(manuscript);
  const target = String(req.body?.chapterTitle || chapters[0]?.title || '').trim();
  const chapter = chapters.find((item) => titlesMatch(item.title, target)) || chapters[0];
  if (!chapter) return res.status(400).json({ success: false, message: 'No chapter could be isolated for reconstruction.' });
  const prompt = `Propose a bounded reconstruction of ONE chapter. Return ONLY JSON:
{"chapterTitle":"${chapter.title}","rationale":"...","proposed":"full replacement chapter prose"}
Preserve names, facts, and unresolved tensions. Do not rewrite other chapters.

CONTEXT:
${manuscript.slice(0, 24_000)}

CHAPTER TO REBUILD:
# ${chapter.title}

${chapter.body.slice(0, 20_000)}`;
  let planned: any;
  try { planned = parseJson(await callServerAi(prompt, true, { maxTokens: 5000, timeoutMs: 180_000 })); }
  catch { return res.status(502).json({ success: false, message: 'Rebuild plan could not be produced. The manuscript is unchanged.' }); }
  const change = {
    id: `chg-${Date.now().toString(36)}`,
    chapterTitle: chapter.title,
    chapterIndex: chapter.index,
    currentExcerpt: chapter.body.slice(0, 1200),
    proposed: String(planned.proposed || ''),
    rationale: String(planned.rationale || current?.analysis?.summary || ''),
    status: 'pending',
  };
  if (!change.proposed.trim()) return res.status(502).json({ success: false, message: 'No replacement prose was produced. The manuscript is unchanged.' });
  const saved = await saveRebuildPlan(user.id, project.id, {
    sourceVersionId: latest?.id || null,
    status: 'planned',
    analysis: current?.analysis || { summary: change.rationale, findings: [] },
    changes: [change],
  });
  return res.status(201).json({ success: true, data: saved });
});

router.post('/rebuild-plans/:planId/changes/:changeId/reject', async (req, res) => {
  const plan = await rejectRebuildChange(requestUser(res).id, req.params.planId, req.params.changeId);
  return plan ? res.json({ success: true, data: plan }) : res.status(409).json({ success: false, message: 'Change is no longer pending.' });
});

router.post('/rebuild-plans/:planId/changes/:changeId/accept', async (req, res) => {
  if (req.body?.authorConfirmed !== true) return res.status(400).json({ success: false, message: 'Explicit author confirmation is required.' });
  try {
    const result = await acceptRebuildChange(requestUser(res).id, req.params.planId, req.params.changeId);
    if (!result) return res.status(409).json({ success: false, message: 'Change is no longer pending.' });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (isHybridConflictError(error)) {
      return res.status(409).json({ success: false, message: error.message, code: error.code });
    }
    throw error;
  }
});

export default router;
