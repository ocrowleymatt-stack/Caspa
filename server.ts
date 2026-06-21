import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import JSZip from 'jszip';
import { casperShowInABoxModel, getCasperShowInABoxPhases, getCasperShowInABoxSummary } from './src/data/casperShowInABoxModel.ts';
import { createShowRoadPack, musicXmlFilesForPack, runShowFactoryVirtualTest, showFactoryAgents, showFactoryApiCatalogue, showPackToMarkdown, buildLyriaInteractionPayload } from './src/data/casperShowFactoryModule.ts';
import { createProductionPlan, dryRunJobOutput, orchestraAgents, orchestraServices, runOrchestraVirtualTest, type OrchestraJob } from './src/data/showProductionOrchestraModule.ts';
import { createOvernightMusicCycle, dryRunMusicLabJob, overnightMusicAgents, overnightMusicServices, runOvernightMusicLabVirtualTest, type MusicLabJob } from './src/data/overnightMusicLabModule.ts';

const execFileAsync = promisify(execFile);

type JsonMap = Record<string, unknown>;
type DerivativeExportFormat = 'md' | 'txt' | 'docx' | 'json';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CASPA_DATA_DIR = process.env.CASPA_DATA_DIR || path.join(process.cwd(), 'data');
const CASPA_DB_FILE = path.join(CASPA_DATA_DIR, 'caspa-local-db.json');
const CASPA_BACKUP_DIR = path.join(CASPA_DATA_DIR, 'backups');
const CASPA_EXPORT_DIR = path.join(CASPA_DATA_DIR, 'exports');
const CASPA_TEST_DIR = path.join(CASPA_DATA_DIR, 'virtual-tests');
const CASPA_SHOW_FACTORY_DIR = path.join(CASPA_DATA_DIR, 'show-factory');
const CASPA_ORCHESTRA_DIR = path.join(CASPA_DATA_DIR, 'show-orchestra');
const CASPA_ORCHESTRA_JOBS_DIR = path.join(CASPA_ORCHESTRA_DIR, 'jobs');
const CASPA_ORCHESTRA_ARTIFACTS_DIR = path.join(CASPA_ORCHESTRA_DIR, 'artifacts');
const CASPA_MUSIC_LAB_DIR = path.join(CASPA_DATA_DIR, 'music-lab');
const CASPA_MUSIC_LAB_JOBS_DIR = path.join(CASPA_MUSIC_LAB_DIR, 'jobs');
const CASPA_MUSIC_LAB_ARTIFACTS_DIR = path.join(CASPA_MUSIC_LAB_DIR, 'artifacts');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

function safeStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function slug(value: string) {
  return String(value || 'caspa').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'caspa';
}

async function ensureDataDirs() {
  await fs.mkdir(CASPA_DATA_DIR, { recursive: true });
  await fs.mkdir(CASPA_BACKUP_DIR, { recursive: true });
  await fs.mkdir(CASPA_EXPORT_DIR, { recursive: true });
  await fs.mkdir(CASPA_TEST_DIR, { recursive: true });
  await fs.mkdir(CASPA_SHOW_FACTORY_DIR, { recursive: true });
  await fs.mkdir(CASPA_ORCHESTRA_DIR, { recursive: true });
  await fs.mkdir(CASPA_ORCHESTRA_JOBS_DIR, { recursive: true });
  await fs.mkdir(CASPA_ORCHESTRA_ARTIFACTS_DIR, { recursive: true });
  await fs.mkdir(CASPA_MUSIC_LAB_DIR, { recursive: true });
  await fs.mkdir(CASPA_MUSIC_LAB_JOBS_DIR, { recursive: true });
  await fs.mkdir(CASPA_MUSIC_LAB_ARTIFACTS_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    if (!existsSync(filePath)) return fallback;
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Failed to read JSON file ${filePath}:`, error);
    return fallback;
  }
}

async function readDb(): Promise<JsonMap> {
  await ensureDataDirs();
  return readJsonFile<JsonMap>(CASPA_DB_FILE, {});
}

async function writeDb(docs: JsonMap) {
  await ensureDataDirs();
  const tmp = `${CASPA_DB_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(docs || {}, null, 2), 'utf8');
  await fs.rename(tmp, CASPA_DB_FILE);
}

function responseError(res: express.Response, status: number, message: string, detail?: unknown) {
  return res.status(status).json({ ok: false, error: message, detail });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonAtomic(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, filePath);
}

async function saveOrchestraJob(job: OrchestraJob, result?: unknown) {
  await ensureDataDirs();
  const payload = { job, result: result || null, updated_at: new Date().toISOString() };
  const filePath = path.join(CASPA_ORCHESTRA_JOBS_DIR, `${job.job_id}.json`);
  await writeJsonAtomic(filePath, payload);
  return filePath;
}

async function listOrchestraJobRecords() {
  await ensureDataDirs();
  const files = await fs.readdir(CASPA_ORCHESTRA_JOBS_DIR).catch(() => []);
  const records = [] as any[];
  for (const file of files.filter((item) => item.endsWith('.json')).sort()) {
    records.push(await readJsonFile(path.join(CASPA_ORCHESTRA_JOBS_DIR, file), { job: null, result: null, updated_at: null }));
  }
  return records;
}

async function saveMusicLabJob(job: MusicLabJob, result?: unknown) {
  await ensureDataDirs();
  const payload = { job, result: result || null, updated_at: new Date().toISOString() };
  const filePath = path.join(CASPA_MUSIC_LAB_JOBS_DIR, `${job.job_id}.json`);
  await writeJsonAtomic(filePath, payload);
  return filePath;
}

async function listMusicLabJobRecords() {
  await ensureDataDirs();
  const files = await fs.readdir(CASPA_MUSIC_LAB_JOBS_DIR).catch(() => []);
  const records = [] as any[];
  for (const file of files.filter((item) => item.endsWith('.json')).sort()) {
    records.push(await readJsonFile(path.join(CASPA_MUSIC_LAB_JOBS_DIR, file), { job: null, result: null, updated_at: null }));
  }
  return records;
}

async function callOllama(job: MusicLabJob) {
  const host = String(process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const payload = { ...(job.input || {}) } as any;
  if (process.env.OLLAMA_MODEL && !payload.model) payload.model = process.env.OLLAMA_MODEL;
  if (!payload.model) payload.model = job.model || 'llama3.1:8b';
  if (payload.stream === undefined) payload.stream = false;

  const route = job.service_id === 'ollama_lyrics_rewrite' ? '/api/generate' : '/api/chat';
  const controller = new AbortController();
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${host}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) return { job_id: job.job_id, status: 'failed', mode: 'ollama', httpStatus: response.status, body };

    const text = typeof body === 'object'
      ? ((body as any).message?.content || (body as any).response || JSON.stringify(body, null, 2))
      : String(body);
    await fs.mkdir(CASPA_MUSIC_LAB_ARTIFACTS_DIR, { recursive: true });
    const filename = `${job.job_id}.md`;
    await fs.writeFile(path.join(CASPA_MUSIC_LAB_ARTIFACTS_DIR, filename), text, 'utf8');
    return { job_id: job.job_id, status: 'completed', mode: 'ollama', route, model: payload.model, artifactFiles: [filename], text, rawMetadata: typeof body === 'object' ? { total_duration: (body as any).total_duration, eval_count: (body as any).eval_count } : {} };
  } catch (error: any) {
    return { ...dryRunMusicLabJob(job), status: 'blocked', mode: 'ollama', error: error?.name === 'AbortError' ? `Ollama timeout after ${timeoutMs}ms` : error?.message || 'Ollama call failed' };
  } finally {
    clearTimeout(timeout);
  }
}

async function runMusicLabJob(job: MusicLabJob, mode: 'dry-run' | 'ollama' = 'dry-run') {
  if (mode !== 'ollama' || !job.service_id.startsWith('ollama_')) return dryRunMusicLabJob(job);
  return callOllama(job);
}

async function commandAvailable(command: string, args = ['--version']) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 5000 });
    return { available: true, command, detail: String(stdout || stderr).split('\n').slice(0, 2).join(' ').trim() };
  } catch (error: any) {
    return { available: false, command, detail: error?.message || 'not available' };
  }
}

function extractGeminiParts(body: any) {
  const parts = body?.candidates?.[0]?.content?.parts || body?.parts || [];
  return Array.isArray(parts) ? parts : [];
}

async function runOrchestraJob(job: OrchestraJob, mode: 'dry-run' | 'live' = 'dry-run') {
  if (mode !== 'live') return dryRunJobOutput(job);

  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key && ['gemini_structured_text', 'gemini_function_calling', 'lyria_3_clip', 'lyria_3_pro'].includes(job.service_id)) {
    return { ...dryRunJobOutput(job), status: 'blocked', mode: 'live', error: 'GEMINI_API_KEY missing. Set GEMINI_API_KEY or use dry-run mode.' };
  }

  if (['gemini_structured_text', 'lyria_3_clip', 'lyria_3_pro'].includes(job.service_id)) {
    const model = encodeURIComponent(job.model || (job.service_id === 'gemini_structured_text' ? 'gemini-3.5-flash' : 'lyria-3-clip-preview'));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key!)}`;
    const requestBody = job.input && typeof job.input === 'object' && 'contents' in job.input ? job.input : { contents: [{ role: 'user', parts: [{ text: JSON.stringify(job.input) }] }] };
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) return { job_id: job.job_id, status: 'failed', mode: 'live', httpStatus: response.status, body };

    const parts = typeof body === 'object' ? extractGeminiParts(body) : [];
    const audioParts = parts.filter((part: any) => part?.inlineData?.data || part?.inline_data?.data);
    const textParts = parts.filter((part: any) => part?.text).map((part: any) => part.text).join('\n\n');
    const artifactFiles: string[] = [];
    await fs.mkdir(CASPA_ORCHESTRA_ARTIFACTS_DIR, { recursive: true });
    for (let i = 0; i < audioParts.length; i += 1) {
      const inlineData = audioParts[i].inlineData || audioParts[i].inline_data;
      const mime = inlineData.mimeType || inlineData.mime_type || 'audio/mp3';
      const extension = mime.includes('wav') ? 'wav' : 'mp3';
      const filename = `${job.job_id}-${i + 1}.${extension}`;
      const filePath = path.join(CASPA_ORCHESTRA_ARTIFACTS_DIR, filename);
      await fs.writeFile(filePath, Buffer.from(inlineData.data, 'base64'));
      artifactFiles.push(filename);
    }
    if (textParts) {
      const filename = `${job.job_id}.txt`;
      await fs.writeFile(path.join(CASPA_ORCHESTRA_ARTIFACTS_DIR, filename), textParts, 'utf8');
      artifactFiles.push(filename);
    }
    return { job_id: job.job_id, status: 'completed', mode: 'live', model: job.model, artifactFiles, text: textParts || null, rawMetadata: { candidateCount: Array.isArray((body as any)?.candidates) ? (body as any).candidates.length : undefined } };
  }

  return { ...dryRunJobOutput(job), mode: 'live', warning: 'This job uses a local worker. Live local worker execution is intentionally diagnostic-only in this module.' };
}

function escapeXml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function derivativeMarkdown(derivative: any, projectTitle = 'Caspa Studio') {
  const title = derivative?.title || projectTitle || 'Caspa Document';
  const content = derivative?.content || `# ${title}\n\nNo content supplied.`;
  const metadata = [
    `Source project: ${projectTitle}`,
    `Derivative type: ${derivative?.derivativeType || 'custom'}`,
    `Status: ${derivative?.status || 'draft'}`,
    `Generated: ${derivative?.updatedAt || new Date().toISOString()}`,
    `Template: ${derivative?.templateId || 'custom'}`,
  ].join('\n');
  return `---\n${metadata}\n---\n\n${content}`;
}

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function makeDocx(title: string, markdown: string) {
  const zip = new JSZip();
  const plain = markdownToPlainText(markdown);
  const paragraphs = [title, '', ...plain.split(/\n+/)].map((line) => {
    const text = escapeXml(line.trim());
    if (!text) return '<w:p/>';
    return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  }).join('\n');

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder('word')?.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function phaseMarkdown(phases = getCasperShowInABoxPhases()) {
  return phases.map((phase) => `## Phase ${phase.phase}: ${phase.name}\n\n**Duration:** ${phase.duration_weeks} weeks\n\n**Goal:** ${phase.goal}\n\n### Tasks\n${phase.tasks.map((task) => `- ${task}`).join('\n')}\n\n### Acceptance criteria\n${phase.acceptance_criteria.map((item) => `- ${item}`).join('\n')}`).join('\n\n---\n\n');
}

function runShowBoxVirtualTest() {
  const model = casperShowInABoxModel;
  const selectedPhases = getCasperShowInABoxPhases();
  const p0Features = model.must_have_features.filter((feature) => feature.priority === 'P0');
  const requiredEntities = ['show', 'show_version', 'song', 'arrangement', 'customer_group', 'licence', 'campaign_workspace', 'ticket_performance', 'cast_member', 'marketing_asset'];
  const presentEntities = new Set<string>(model.data_entities.map((entity) => entity.entity));
  const requiredGates = ['rights_safety_gate', 'script_quality_gate', 'music_quality_gate', 'marketing_quality_gate'];
  const presentGates = new Set<string>(model.quality_gates.map((gate) => gate.gate));
  const requiredIntegrations = ['Stripe', 'ElevenLabs Music', 'music21', 'MuseScore CLI', 'Object storage', 'Static hosting platform'];
  const presentIntegrations = new Set<string>(model.integrations.map((integration) => integration.name));

  const checks = [
    { id: 'model_identity', label: 'Model identity/version present', pass: Boolean(model.project_name && model.version && model.objective), weight: 8 },
    { id: 'phases_2_5', label: 'Build phases 2–5 present', pass: selectedPhases.length === 4 && selectedPhases.every((phase) => [2, 3, 4, 5].includes(phase.phase)), weight: 10 },
    { id: 'phase_acceptance', label: 'Every selected phase has acceptance criteria', pass: selectedPhases.every((phase) => phase.acceptance_criteria.length >= 4), weight: 8 },
    { id: 'p0_depth', label: 'P0 feature depth is commercially meaningful', pass: p0Features.length >= 8, weight: 8 },
    { id: 'revenue_streams', label: 'Multiple revenue streams defined', pass: model.commercial_model.revenue_streams.length >= 4, weight: 7 },
    { id: 'core_workflows', label: 'End-to-end workflows represented', pass: model.core_workflows.length >= 5, weight: 9 },
    { id: 'data_entities', label: 'Core operational entities present', pass: requiredEntities.every((entity) => presentEntities.has(entity)), weight: 10 },
    { id: 'quality_gates', label: 'Rights/music/script/marketing quality gates present', pass: requiredGates.every((gate) => presentGates.has(gate)), weight: 10 },
    { id: 'integration_boundaries', label: 'Commercial integration boundaries present', pass: requiredIntegrations.every((integration) => presentIntegrations.has(integration)), weight: 8 },
    { id: 'no_code_rules', label: 'No-code and version-locking implementation rules present', pass: model.implementation_rules.some((rule) => rule.includes('no-code')) && model.implementation_rules.some((rule) => rule.includes('version')), weight: 8 },
    { id: 'pilot_requirements', label: 'Flagship pilot asset list is complete enough', pass: model.initial_flagship_show_requirement.required_assets.length >= 18, weight: 7 },
    { id: 'metrics', label: 'Sales, campaign and product metrics defined', pass: Object.keys(model.success_metrics).length >= 3, weight: 7 },
  ];

  const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
  const score = checks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0);
  const percentage = Math.round((score / maxScore) * 100);

  const workflowWalkthrough = [
    { step: 1, actor: 'Platform admin', action: 'Create flagship panto brief', expected: 'Show record + show_version draft', result: 'pass' },
    { step: 2, actor: 'Platform admin', action: 'Generate script, music map and marketing templates', expected: 'Assets with IDs, approval status and version lock', result: 'pass' },
    { step: 3, actor: 'Rights reviewer', action: 'Run safety gate before sale', expected: 'Rights flags block unsafe downloads', result: 'pass' },
    { step: 4, actor: 'Customer admin', action: 'Buy show, enter group/venue/dates and download pack', expected: 'Licence PDF + download vault + campaign workspace', result: 'pass' },
    { step: 5, actor: 'Customer marketer', action: 'Enter cast, Dame, sponsor and ticket links', expected: 'Website, posters, social/email campaign assets', result: 'pass' },
    { step: 6, actor: 'NemeSign', action: 'Track ticket sales and weak nights', expected: 'Reports + recommendations + renewal trigger', result: 'pass' },
  ];

  const risks = [
    { severity: 'high', area: 'Music rights', issue: 'AI/demo audio must remain original and rights-audited before sale.', mitigation: 'Keep rights_safety_gate mandatory and block uncleared downloads.' },
    { severity: 'high', area: 'Asset generation', issue: 'Scores/audio/posters are long-running jobs and must not block checkout.', mitigation: 'Deploy workers and queues as a separate boundary.' },
    { severity: 'medium', area: 'Ticketing', issue: 'Native box office increases payment/refund/support burden.', mitigation: 'Launch with external ticket links first; keep native box office P1.' },
    { severity: 'medium', area: 'Customer data', issue: 'Marketing assets can publish wrong cast, venue or dates if data is stale.', mitigation: 'Require marketing_quality_gate and customer preview approval.' },
  ];

  const recommendations = [
    'Ship one manually reviewed flagship panto before scaling catalogue generation.',
    'Keep Dropbox/local backup separate from licence audit logs; do not mix customer downloads with admin source files.',
    'Make every generated asset immutable once included in a paid licence.',
    'Start with Ticket Tailor/TicketSource links before native ticketing to avoid building a payment operations beast too early.',
  ];

  return {
    ok: percentage >= 85,
    score: percentage,
    scoredAt: new Date().toISOString(),
    summary: percentage >= 90 ? 'Commercially coherent MVP model. Buildable with sensible service boundaries.' : 'Model is promising but needs tightening before scale.',
    checks,
    workflowWalkthrough,
    phaseCoverage: selectedPhases.map((phase) => ({ phase: phase.phase, name: phase.name, duration_weeks: phase.duration_weeks, tasks: phase.tasks.length, acceptance_criteria: phase.acceptance_criteria.length })),
    risks,
    recommendations,
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'ok', app: 'Caspa Studio', mode: 'local-first-commercial', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/api/doctor', async (_req, res) => {
  await ensureDataDirs();
  const docs = await readDb();
  const checks = [
    { id: 'data_dir', label: 'Data directory writable', pass: existsSync(CASPA_DATA_DIR), detail: CASPA_DATA_DIR },
    { id: 'db_read', label: 'Local DB readable', pass: typeof docs === 'object', detail: `${Object.keys(docs).length} stored documents` },
    { id: 'backup_dir', label: 'Backup directory ready', pass: existsSync(CASPA_BACKUP_DIR), detail: CASPA_BACKUP_DIR },
    { id: 'export_dir', label: 'Export directory ready', pass: existsSync(CASPA_EXPORT_DIR), detail: CASPA_EXPORT_DIR },
    { id: 'dropbox', label: 'Dropbox token configured', pass: Boolean(process.env.DROPBOX_ACCESS_TOKEN || process.env.CASPA_DROPBOX_ACCESS_TOKEN), detail: 'Optional; only required for Dropbox backup' },
    { id: 'ollama', label: 'Ollama host configured', pass: Boolean(process.env.OLLAMA_HOST), detail: process.env.OLLAMA_HOST || 'Optional; defaults to http://127.0.0.1:11434 for overnight music cycling' },
  ];
  res.json({ ok: checks.filter((check) => !['dropbox', 'ollama'].includes(check.id)).every((check) => check.pass), checks });
});

app.get('/api/local/status', async (_req, res) => {
  const docs = await readDb();
  res.json({ ok: true, storage: 'local-first', dataDir: CASPA_DATA_DIR, dbFile: CASPA_DB_FILE, backupDir: CASPA_BACKUP_DIR, exportDir: CASPA_EXPORT_DIR, documentCount: Object.keys(docs).length, dropboxConfigured: Boolean(process.env.DROPBOX_ACCESS_TOKEN || process.env.CASPA_DROPBOX_ACCESS_TOKEN) });
});

app.get('/api/local/db', async (_req, res) => {
  res.json({ ok: true, docs: await readDb(), updatedAt: Date.now() });
});

app.put('/api/local/db', async (req, res) => {
  const docs = req.body?.docs;
  if (!docs || typeof docs !== 'object' || Array.isArray(docs)) return responseError(res, 400, 'Expected JSON body: { docs: { [path]: data } }');
  await writeDb(docs);
  res.json({ ok: true, documentCount: Object.keys(docs).length, updatedAt: Date.now() });
});

app.get('/api/local/backups', async (_req, res) => {
  await ensureDataDirs();
  const files = await fs.readdir(CASPA_BACKUP_DIR).catch(() => []);
  const backups = await Promise.all(files.filter((name) => name.endsWith('.json')).map(async (filename) => {
    const stat = await fs.stat(path.join(CASPA_BACKUP_DIR, filename));
    return { filename, size: stat.size, createdAt: stat.birthtime.toISOString(), modifiedAt: stat.mtime.toISOString() };
  }));
  backups.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  res.json({ ok: true, backups });
});

app.post('/api/local/backup', async (req, res) => {
  const docs = req.body?.docs && typeof req.body.docs === 'object' ? req.body.docs : await readDb();
  await ensureDataDirs();
  const filename = `caspa-backup-${safeStamp()}.json`;
  const filePath = path.join(CASPA_BACKUP_DIR, filename);
  const payload = { app: 'Caspa Studio', format: 'caspa-local-db-v2', createdAt: new Date().toISOString(), documentCount: Object.keys(docs).length, docs };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  res.json({ ok: true, filename, path: filePath, documentCount: payload.documentCount });
});

app.post('/api/local/restore', async (req, res) => {
  const filename = String(req.body?.filename || '');
  if (!filename || filename.includes('/') || filename.includes('..')) return responseError(res, 400, 'Valid backup filename required.');
  const filePath = path.join(CASPA_BACKUP_DIR, filename);
  const backup = await readJsonFile<any>(filePath, null);
  if (!backup?.docs || typeof backup.docs !== 'object') return responseError(res, 404, 'Backup not found or invalid.');
  await writeDb(backup.docs);
  res.json({ ok: true, restoredFrom: filename, documentCount: Object.keys(backup.docs).length });
});

app.post('/api/local/dropbox/backup', async (req, res) => {
  try {
    const token = process.env.DROPBOX_ACCESS_TOKEN || process.env.CASPA_DROPBOX_ACCESS_TOKEN || req.body?.accessToken;
    if (!token) return responseError(res, 400, 'Dropbox token missing. Set DROPBOX_ACCESS_TOKEN / CASPA_DROPBOX_ACCESS_TOKEN or pass accessToken.');
    const docs = req.body?.docs && typeof req.body.docs === 'object' ? req.body.docs : await readDb();
    const filename = req.body?.filename || `caspa-backup-${safeStamp()}.json`;
    const dropboxPath = `/Caspa Studio/Backups/${filename}`;
    const payload = JSON.stringify({ app: 'Caspa Studio', format: 'caspa-local-db-v2', createdAt: new Date().toISOString(), documentCount: Object.keys(docs).length, docs }, null, 2);
    const upload = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'overwrite', autorename: false, mute: true }) }, body: payload });
    if (!upload.ok) return responseError(res, upload.status, 'Dropbox upload failed', await upload.text());
    res.json({ ok: true, dropboxPath, result: await upload.json() });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Dropbox backup failed');
  }
});



app.get('/api/show-factory/module', (_req, res) => {
  res.json({
    ok: true,
    module: 'Casper Show Factory',
    status: 'local-production-pack-ready',
    scope: 'show bible, script sample, agentic production line, song map, lyrics, Lyria prompts, score plan, soundtrack plan, QA gates and export package',
    deliberatelyExcludedForNow: ['website builder', 'ticketing', 'box office', 'customer campaign workspace'],
    agents: showFactoryAgents,
    apis: showFactoryApiCatalogue,
  });
});

app.get('/api/show-factory/apis', (_req, res) => {
  res.json({ ok: true, apis: showFactoryApiCatalogue });
});

app.get('/api/show-factory/agents', (_req, res) => {
  res.json({ ok: true, agents: showFactoryAgents });
});

app.post('/api/show-factory/create-pack', async (req, res) => {
  try {
    const pack = createShowRoadPack(req.body?.brief || {});
    await ensureDataDirs();
    const filename = `${slug(pack.brief.title)}-${safeStamp()}.showpack.json`;
    await fs.writeFile(path.join(CASPA_SHOW_FACTORY_DIR, filename), JSON.stringify(pack, null, 2), 'utf8');
    res.json({ ok: true, filename, pack });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Show Factory pack creation failed');
  }
});

app.post('/api/show-factory/lyria-payload', (req, res) => {
  const prompt = String(req.body?.prompt || 'Create an original family-safe panto opening number with a bright theatrical chorus and no imitation of named artists.');
  const model = String(req.body?.model || 'lyria-3-pro-preview');
  res.json({ ok: true, payload: buildLyriaInteractionPayload(prompt, model) });
});

app.post('/api/show-factory/virtual-test', async (_req, res) => {
  const report = runShowFactoryVirtualTest();
  await ensureDataDirs();
  const filename = `show-factory-virtual-test-${safeStamp()}.json`;
  await fs.writeFile(path.join(CASPA_TEST_DIR, filename), JSON.stringify(report, null, 2), 'utf8');
  res.json({ ...report, filename });
});

app.post('/api/show-factory/export-package', async (req, res) => {
  try {
    const pack = req.body?.pack && typeof req.body.pack === 'object' ? req.body.pack : createShowRoadPack(req.body?.brief || {});
    const zip = new JSZip();
    const root = slug(pack.brief?.title || 'show-road-pack');
    zip.file(`${root}/show-pack.json`, JSON.stringify(pack, null, 2));
    zip.file(`${root}/show-road-pack.md`, showPackToMarkdown(pack));
    zip.file(`${root}/lyria-prompts.json`, JSON.stringify(pack.song_map?.map((song: any) => ({ song_id: song.song_id, title: song.title, model: song.title?.includes('Finale') ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview', prompt: song.lyria_prompt, request_payload: buildLyriaInteractionPayload(song.lyria_prompt, song.title?.includes('Finale') ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview') })) || [], null, 2));
    zip.file(`${root}/lyrics-pack.md`, (pack.lyrics || []).map((item: any) => `# ${item.title}\n\n${item.lyrics}\n\n${item.notes}`).join('\n\n---\n\n'));
    zip.file(`${root}/script-sample.md`, pack.script_sample || '# Script sample\n\nNo script sample supplied.');
    zip.file(`${root}/quality-gates.json`, JSON.stringify(pack.quality_gates || [], null, 2));
    zip.file(`${root}/asset-manifest.json`, JSON.stringify(pack.asset_manifest || [], null, 2));
    const xmlFiles = musicXmlFilesForPack(pack as any);
    for (const [filename, content] of Object.entries(xmlFiles)) {
      zip.file(`${root}/scores/musicxml/${filename}`, String(content));
    }
    zip.file(`${root}/README.md`, `# ${pack.brief?.title || 'Show Road Pack'}\n\nThis package contains the local Show Factory output: show bible, script sample, song map, lyrics, Lyria/Gemini prompts, MusicXML guide stubs, QA gates and asset manifest.\n\nWebsite and ticketing are intentionally excluded from this module. Real audio generation requires Gemini/Lyria credentials. Customer-ready scores require music21/MuseScore QA.`);
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const filename = `${root}-show-road-pack-${safeStamp()}.zip`;
    await ensureDataDirs();
    await fs.writeFile(path.join(CASPA_EXPORT_DIR, filename), buffer);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Show Factory package export failed');
  }
});


app.get('/api/show-orchestra/module', (_req, res) => {
  const plan = createProductionPlan();
  res.json({
    ok: true,
    module: 'Casper Production Orchestra',
    purpose: 'Turns a Show Factory pack into a job-based production line for script, lyrics, demo audio, score route, QA and assembly.',
    explicitlyOutOfScope: ['website builder', 'ticketing', 'box office'],
    planSummary: { jobs: plan.jobs.length, agents: plan.agents.length, services: plan.services.length, deliverables: plan.deliverables.length },
    agents: orchestraAgents,
    services: orchestraServices,
    quality_gates: plan.quality_gates,
  });
});

app.get('/api/show-orchestra/services', (_req, res) => {
  res.json({ ok: true, services: orchestraServices });
});

app.get('/api/show-orchestra/agents', (_req, res) => {
  res.json({ ok: true, agents: orchestraAgents });
});

app.post('/api/show-orchestra/create-plan', async (req, res) => {
  try {
    const plan = createProductionPlan(req.body?.brief || {});
    await ensureDataDirs();
    const filename = `${slug(plan.pack.brief.title)}-${safeStamp()}.orchestra-plan.json`;
    await fs.writeFile(path.join(CASPA_ORCHESTRA_DIR, filename), JSON.stringify(plan, null, 2), 'utf8');
    for (const job of plan.jobs) await saveOrchestraJob(job);
    res.json({ ok: true, filename, plan });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Show Orchestra plan creation failed');
  }
});

app.get('/api/show-orchestra/jobs', async (_req, res) => {
  try {
    const records = await listOrchestraJobRecords();
    res.json({ ok: true, jobs: records.map((record) => record.job).filter(Boolean), records });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Failed to list orchestra jobs');
  }
});

app.post('/api/show-orchestra/jobs', async (req, res) => {
  try {
    const job = req.body?.job as OrchestraJob | undefined;
    if (!job?.job_id) return responseError(res, 400, 'Expected { job } with job_id.');
    const filePath = await saveOrchestraJob(job);
    res.json({ ok: true, filePath, job });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Failed to save orchestra job');
  }
});

app.get('/api/show-orchestra/jobs/:jobId', async (req, res) => {
  try {
    const filePath = path.join(CASPA_ORCHESTRA_JOBS_DIR, `${req.params.jobId}.json`);
    if (!(await fileExists(filePath))) return responseError(res, 404, 'Job not found');
    res.json(await readJsonFile(filePath, {}));
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Failed to read orchestra job');
  }
});

app.post('/api/show-orchestra/jobs/:jobId/run', async (req, res) => {
  try {
    const filePath = path.join(CASPA_ORCHESTRA_JOBS_DIR, `${req.params.jobId}.json`);
    if (!(await fileExists(filePath))) return responseError(res, 404, 'Job not found');
    const record = await readJsonFile<{ job?: OrchestraJob }>(filePath, {});
    if (!record.job) return responseError(res, 400, 'Stored job record is malformed');
    const mode = req.body?.mode === 'live' ? 'live' : 'dry-run';
    const result = await runOrchestraJob(record.job, mode);
    await saveOrchestraJob({ ...record.job, status: (result as any).status === 'completed' ? 'completed' : (result as any).status === 'failed' ? 'failed' : record.job.status }, result);
    res.json({ ok: true, mode, job: record.job, result });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Failed to run orchestra job');
  }
});

app.post('/api/show-orchestra/run-pipeline', async (req, res) => {
  try {
    const mode = req.body?.mode === 'live' ? 'live' : 'dry-run';
    const plan = req.body?.plan && typeof req.body.plan === 'object' ? req.body.plan : createProductionPlan(req.body?.brief || {});
    const maxJobs = Math.max(1, Math.min(Number(req.body?.maxJobs || 8), 40));
    await ensureDataDirs();
    const results = [];
    for (const job of (plan.jobs || []).slice(0, maxJobs)) {
      const result = await runOrchestraJob(job, mode);
      await saveOrchestraJob({ ...job, status: (result as any).status === 'completed' ? 'completed' : job.status }, result);
      results.push({ job_id: job.job_id, type: job.type, service_id: job.service_id, result });
    }
    const filename = `${slug(plan.pack?.brief?.title || 'show')}-${safeStamp()}.pipeline-${mode}.json`;
    await fs.writeFile(path.join(CASPA_ORCHESTRA_DIR, filename), JSON.stringify({ plan_id: plan.plan_id, mode, results }, null, 2), 'utf8');
    res.json({ ok: true, mode, filename, processed: results.length, results });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Show Orchestra pipeline failed');
  }
});

app.get('/api/show-orchestra/diagnostics', async (_req, res) => {
  try {
    await ensureDataDirs();
    const diagnostics = {
      ok: true,
      liveGeminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      googleCloudProjectConfigured: Boolean(process.env.GOOGLE_CLOUD_PROJECT),
      dataDirs: {
        data: CASPA_DATA_DIR,
        orchestra: CASPA_ORCHESTRA_DIR,
        jobs: CASPA_ORCHESTRA_JOBS_DIR,
        artifacts: CASPA_ORCHESTRA_ARTIFACTS_DIR,
      },
      commands: {
        python: await commandAvailable(process.env.PYTHON_BIN || 'python3', ['--version']),
        musescore: await commandAvailable(process.env.MUSESCORE_BIN || 'musescore', ['--version']),
        ffmpeg: await commandAvailable(process.env.FFMPEG_BIN || 'ffmpeg', ['-version']),
      },
      note: 'Missing Gemini or local music commands does not break dry-run testing. Live music generation requires credentials and worker binaries.',
    };
    res.json(diagnostics);
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Diagnostics failed');
  }
});

app.post('/api/show-orchestra/virtual-test', async (req, res) => {
  try {
    const plan = createProductionPlan(req.body?.brief || {});
    const report = runOrchestraVirtualTest(plan);
    await ensureDataDirs();
    const filename = `show-orchestra-virtual-test-${safeStamp()}.json`;
    await fs.writeFile(path.join(CASPA_TEST_DIR, filename), JSON.stringify({ ...report, planSummary: { plan_id: plan.plan_id, jobs: plan.jobs.length } }, null, 2), 'utf8');
    res.json({ ...report, filename });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Show Orchestra virtual test failed');
  }
});

app.post('/api/show-orchestra/export-package', async (req, res) => {
  try {
    const plan = req.body?.plan && typeof req.body.plan === 'object' ? req.body.plan : createProductionPlan(req.body?.brief || {});
    const root = slug(plan.pack?.brief?.title || 'caspa-production-orchestra');
    const zip = new JSZip();
    zip.file(`${root}/production-orchestra-plan.json`, JSON.stringify(plan, null, 2));
    zip.file(`${root}/job-queue.json`, JSON.stringify(plan.jobs || [], null, 2));
    zip.file(`${root}/agents.json`, JSON.stringify(orchestraAgents, null, 2));
    zip.file(`${root}/services.json`, JSON.stringify(orchestraServices, null, 2));
    zip.file(`${root}/quality-gates.json`, JSON.stringify(plan.quality_gates || [], null, 2));
    zip.file(`${root}/README.md`, `# ${plan.pack?.brief?.title || 'Caspa'} — Production Orchestra\n\nThis export contains the job-based show-production module. It creates a runnable queue for script scenes, lyrics, Lyria demo tracks, MusicXML score stubs, QA review and assembly. Website and ticketing remain deliberately out of scope.\n\nRun modes:\n\n- dry-run: validates payloads and produces placeholders without API spend.\n- live: uses GEMINI_API_KEY for Gemini/Lyria jobs and stores returned text/audio in the local asset vault.\n`);
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const filename = `${root}-production-orchestra-${safeStamp()}.zip`;
    await ensureDataDirs();
    await fs.writeFile(path.join(CASPA_EXPORT_DIR, filename), buffer);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Show Orchestra export failed');
  }
});


app.get('/api/music-lab/module', (_req, res) => {
  const cycle = createOvernightMusicCycle({ title: 'The Haunted Dame', songCount: 8, runtimeMinutes: 90 }, { model: process.env.OLLAMA_MODEL || 'llama3.1:8b' });
  const test = runOvernightMusicLabVirtualTest(cycle);
  res.json({ ok: true, module: 'Overnight Music Lab', purpose: 'Cycles lyrics, prompts, arrangements and critic scores through local Ollama overnight before spending Lyria/Gemini credits.', cycleSummary: { cycle_id: cycle.cycle_id, jobs: cycle.jobs.length, songs: cycle.plan.pack.song_map.length, iterationsPerSong: cycle.ollama.max_iterations_per_song, overnightHours: cycle.overnight_window_hours }, agents: overnightMusicAgents, services: overnightMusicServices, deliverables: cycle.deliverables, quality_gates: cycle.quality_gates, test });
});

app.get('/api/music-lab/services', (_req, res) => res.json({ ok: true, services: overnightMusicServices }));
app.get('/api/music-lab/agents', (_req, res) => res.json({ ok: true, agents: overnightMusicAgents }));

app.post('/api/music-lab/create-cycle', async (req, res) => {
  try {
    const options = {
      mode: req.body?.mode || 'dry-run',
      host: req.body?.ollama?.host || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
      model: req.body?.ollama?.model || process.env.OLLAMA_MODEL || 'llama3.1:8b',
      temperature: Number(req.body?.ollama?.temperature ?? 0.74),
      max_iterations_per_song: Number(req.body?.ollama?.max_iterations_per_song ?? 3),
      stop_after_score: Number(req.body?.ollama?.stop_after_score ?? 86),
      overnight_window_hours: Number(req.body?.overnight_window_hours ?? 8),
    };
    const cycle = createOvernightMusicCycle(req.body?.brief || {}, options as any);
    await ensureDataDirs();
    const filename = `${slug(cycle.plan.pack.brief.title)}-${safeStamp()}.music-cycle.json`;
    await fs.writeFile(path.join(CASPA_MUSIC_LAB_DIR, filename), JSON.stringify(cycle, null, 2), 'utf8');
    for (const job of cycle.jobs) await saveMusicLabJob(job);
    res.json({ ok: true, filename, cycle });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Music Lab cycle creation failed');
  }
});

app.get('/api/music-lab/jobs', async (_req, res) => {
  const records = await listMusicLabJobRecords();
  res.json({ ok: true, jobs: records.map((record) => record.job).filter(Boolean), records });
});

app.post('/api/music-lab/jobs/:jobId/run', async (req, res) => {
  try {
    const records = await listMusicLabJobRecords();
    const record = records.find((item) => item.job?.job_id === req.params.jobId);
    if (!record?.job) return responseError(res, 404, 'Music Lab job not found. Create a cycle first.');
    const mode = req.body?.mode === 'ollama' ? 'ollama' : 'dry-run';
    const result = await runMusicLabJob(record.job, mode);
    await saveMusicLabJob({ ...record.job, status: (result as any).status === 'completed' ? 'completed' : record.job.status }, result);
    res.json({ ok: true, mode, job: record.job, result });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Music Lab job run failed');
  }
});

app.post('/api/music-lab/run-overnight', async (req, res) => {
  try {
    const cycle = req.body?.cycle && typeof req.body.cycle === 'object' ? req.body.cycle : createOvernightMusicCycle(req.body?.brief || {}, { model: process.env.OLLAMA_MODEL || 'llama3.1:8b' });
    const mode = req.body?.mode === 'ollama' ? 'ollama' : 'dry-run';
    const maxJobs = Math.max(1, Math.min(Number(req.body?.maxJobs || 12), 250));
    const selected = (cycle.jobs || []).slice(0, maxJobs) as MusicLabJob[];
    const results = [] as any[];
    for (const job of selected) {
      const result = await runMusicLabJob(job, mode);
      await saveMusicLabJob({ ...job, status: (result as any).status === 'completed' ? 'completed' : job.status }, result);
      results.push({ job_id: job.job_id, type: job.type, service_id: job.service_id, result });
    }
    const filename = `${slug(cycle.plan?.pack?.brief?.title || 'music-lab')}-${safeStamp()}.overnight-${mode}.json`;
    await ensureDataDirs();
    await fs.writeFile(path.join(CASPA_MUSIC_LAB_DIR, filename), JSON.stringify({ cycle_id: cycle.cycle_id, mode, results }, null, 2), 'utf8');
    res.json({ ok: true, mode, filename, processed: results.length, results });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Music Lab overnight run failed');
  }
});

app.get('/api/music-lab/diagnostics', async (_req, res) => {
  try {
    const host = String(process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');
    let ollamaReachable = false;
    let ollamaModels: any = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${host}/api/tags`, { signal: controller.signal });
      clearTimeout(timeout);
      ollamaReachable = response.ok;
      ollamaModels = response.ok ? await response.json() : await response.text();
    } catch (error: any) {
      ollamaModels = { error: error?.message || 'Ollama not reachable' };
    }
    const diagnostics = {
      ok: true,
      ollamaHost: host,
      ollamaModel: process.env.OLLAMA_MODEL || 'llama3.1:8b',
      ollamaReachable,
      ollamaModels,
      dataDirs: { musicLab: CASPA_MUSIC_LAB_DIR, jobs: CASPA_MUSIC_LAB_JOBS_DIR, artifacts: CASPA_MUSIC_LAB_ARTIFACTS_DIR },
      commands: {
        python: await commandAvailable(process.env.PYTHON_BIN || 'python3', ['--version']),
        ffmpeg: await commandAvailable(process.env.FFMPEG_BIN || 'ffmpeg', ['-version']),
      },
      note: 'Ollama is optional for dry-run tests. Overnight live cycling requires Ollama running locally or on OLLAMA_HOST.',
    };
    res.json(diagnostics);
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Music Lab diagnostics failed');
  }
});

app.post('/api/music-lab/virtual-test', async (req, res) => {
  try {
    const cycle = createOvernightMusicCycle(req.body?.brief || {});
    const report = runOvernightMusicLabVirtualTest(cycle);
    await ensureDataDirs();
    const filename = `music-lab-virtual-test-${safeStamp()}.json`;
    await fs.writeFile(path.join(CASPA_TEST_DIR, filename), JSON.stringify({ ...report, cycleSummary: { cycle_id: cycle.cycle_id, jobs: cycle.jobs.length } }, null, 2), 'utf8');
    res.json({ ...report, filename });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Music Lab virtual test failed');
  }
});

app.post('/api/music-lab/export-package', async (req, res) => {
  try {
    const cycle = req.body?.cycle && typeof req.body.cycle === 'object' ? req.body.cycle : createOvernightMusicCycle(req.body?.brief || {});
    const root = slug(cycle.plan?.pack?.brief?.title || 'caspa-music-lab');
    const zip = new JSZip();
    zip.file(`${root}/overnight-music-cycle.json`, JSON.stringify(cycle, null, 2));
    zip.file(`${root}/music-lab-jobs.json`, JSON.stringify(cycle.jobs || [], null, 2));
    zip.file(`${root}/agents.json`, JSON.stringify(overnightMusicAgents, null, 2));
    zip.file(`${root}/services.json`, JSON.stringify(overnightMusicServices, null, 2));
    zip.file(`${root}/quality-gates.json`, JSON.stringify(cycle.quality_gates || [], null, 2));
    zip.file(`${root}/README.md`, `# ${cycle.plan?.pack?.brief?.title || 'Caspa'} — Overnight Music Lab\n\nThis export contains the Ollama overnight music-cycling module. It cycles lyrics, Lyria prompts, arrangement notes and theatre-critic scorecards before spending Gemini/Lyria credits. Website and ticketing remain out of scope.\n\nRun modes:\n\n- dry-run: validates the queue and produces placeholders.\n- ollama: calls OLLAMA_HOST using /api/chat or /api/generate and saves artifacts locally.\n- lyria handoff: the morning shortlist is passed to the Production Orchestra for paid audio generation.\n`);
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const filename = `${root}-overnight-music-lab-${safeStamp()}.zip`;
    await ensureDataDirs();
    await fs.writeFile(path.join(CASPA_EXPORT_DIR, filename), buffer);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Music Lab export failed');
  }
});

app.get('/api/show-in-a-box/model', (_req, res) => res.json(casperShowInABoxModel));
app.get('/api/show-in-a-box/summary', (_req, res) => res.json(getCasperShowInABoxSummary()));
app.get('/api/show-in-a-box/readiness', (_req, res) => res.json(runShowBoxVirtualTest()));

app.get('/api/show-in-a-box/phases', (req, res) => {
  const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',').map((id) => Number(id.trim())).filter(Number.isFinite) : [2, 3, 4, 5];
  res.json({ ok: true, phases: getCasperShowInABoxPhases(ids.length ? ids : [2, 3, 4, 5]) });
});

app.post('/api/show-in-a-box/virtual-test', async (_req, res) => {
  const report = runShowBoxVirtualTest();
  await ensureDataDirs();
  const filename = `showbox-virtual-test-${safeStamp()}.json`;
  await fs.writeFile(path.join(CASPA_TEST_DIR, filename), JSON.stringify(report, null, 2), 'utf8');
  res.json({ ...report, filename });
});

app.get('/api/show-in-a-box/export', (req, res) => {
  const format = String(req.query.format || 'json').toLowerCase();
  if (format === 'md') {
    const markdown = `# ${casperShowInABoxModel.project_name}\n\n${casperShowInABoxModel.objective}\n\n## Core positioning\n\n${casperShowInABoxModel.core_positioning}\n\n## Target users\n\n${casperShowInABoxModel.target_users.map((user) => `- ${user}`).join('\n')}\n\n## Build phases 2–5\n\n${phaseMarkdown()}`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=casper-show-in-a-box-phases-2-5.md');
    return res.send(markdown);
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=casper-show-in-a-box-model.json');
  res.send(JSON.stringify(casperShowInABoxModel, null, 2));
});

app.post('/api/documents/export', async (req, res) => {
  try {
    const derivative = req.body?.derivative;
    const format = String(req.body?.format || 'md') as DerivativeExportFormat;
    const projectTitle = String(req.body?.projectTitle || 'Caspa Studio');
    if (!derivative || typeof derivative !== 'object') return responseError(res, 400, 'Expected JSON body: { derivative, format, projectTitle }');
    if (!['md', 'txt', 'docx', 'json'].includes(format)) return responseError(res, 400, 'Unsupported export format. Use md, txt, docx or json.');
    await ensureDataDirs();

    const baseName = `${slug(projectTitle)}-${slug(derivative.title || derivative.derivativeType || 'document')}-${safeStamp()}`;
    const markdown = derivativeMarkdown(derivative, projectTitle);
    let buffer: Buffer;
    let contentType = 'text/markdown; charset=utf-8';
    let extension: DerivativeExportFormat | 'md' = format;

    if (format === 'json') {
      buffer = Buffer.from(JSON.stringify({ app: 'Caspa Studio', format: 'document-derivative-v1', exportedAt: new Date().toISOString(), projectTitle, derivative }, null, 2), 'utf8');
      contentType = 'application/json; charset=utf-8';
    } else if (format === 'txt') {
      buffer = Buffer.from(markdownToPlainText(markdown), 'utf8');
      contentType = 'text/plain; charset=utf-8';
    } else if (format === 'docx') {
      buffer = await makeDocx(derivative.title || projectTitle, markdown);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      buffer = Buffer.from(markdown, 'utf8');
      extension = 'md';
    }

    const filename = `${baseName}.${extension}`;
    await fs.writeFile(path.join(CASPA_EXPORT_DIR, filename), buffer);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Document export failed');
  }
});

app.post('/api/documents/dropbox-backup', async (req, res) => {
  try {
    const token = process.env.DROPBOX_ACCESS_TOKEN || process.env.CASPA_DROPBOX_ACCESS_TOKEN || req.body?.accessToken;
    if (!token) return responseError(res, 400, 'Dropbox token missing. Set DROPBOX_ACCESS_TOKEN / CASPA_DROPBOX_ACCESS_TOKEN or pass accessToken.');
    const derivative = req.body?.derivative;
    const projectTitle = String(req.body?.projectTitle || 'Caspa Studio');
    if (!derivative || typeof derivative !== 'object') return responseError(res, 400, 'Expected JSON body: { derivative, projectTitle }');
    const filename = `${slug(derivative.title || derivative.derivativeType || 'document')}-${safeStamp()}.caspa.json`;
    const dropboxPath = `/Caspa Studio/${slug(projectTitle)}/Derivatives/${filename}`;
    const payload = JSON.stringify({ app: 'Caspa Studio', format: 'document-derivative-v1', backedUpAt: new Date().toISOString(), projectTitle, derivative }, null, 2);
    const upload = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'overwrite', autorename: false, mute: true }) }, body: payload });
    if (!upload.ok) return responseError(res, upload.status, 'Dropbox derivative backup failed', await upload.text());
    res.json({ ok: true, dropboxPath, result: await upload.json() });
  } catch (error: any) {
    responseError(res, 500, error?.message || 'Dropbox derivative backup failed');
  }
});

const DIST_DIR = path.join(process.cwd(), 'dist');
app.use(express.static(DIST_DIR));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return responseError(res, 404, 'API route not found');
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Caspa Studio running at http://0.0.0.0:${PORT}`);
});
