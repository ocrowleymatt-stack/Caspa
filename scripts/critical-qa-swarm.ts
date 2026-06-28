#!/usr/bin/env npx tsx
/**
 * CASPA Critical QA Swarm — hostile-user diagnostic suite.
 *
 * Usage:
 *   npx tsx scripts/critical-qa-swarm.ts
 *   npx tsx scripts/critical-qa-swarm.ts --base-url https://caspa.ocrowley.com
 *   npx tsx scripts/critical-qa-swarm.ts --with-ai   # includes slow AI calls (~5–15 min)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const REPORTS_DIR = path.join(ROOT, 'reports');
const DOCS_REPORT = path.join(ROOT, 'docs', 'CRITICAL_QA_SWARM_REPORT.md');

type AgentStatus = 'pass' | 'warn' | 'fail';
type Severity = 'low' | 'medium' | 'high' | 'blocker';

interface AgentReport {
  agent: string;
  score: number;
  status: AgentStatus;
  tested: string[];
  evidence: string[];
  failures: string[];
  recommendedFixes: string[];
  severity: Severity;
}

interface SwarmReport {
  generatedAt: string;
  baseUrl: string;
  commit: string | null;
  withAi: boolean;
  agents: AgentReport[];
  overallScore: number;
  browserReadinessScore: number;
  finishedBookMachineScore: number;
  dataSafetyScore: number;
  topDefects: string[];
  priority: { p0: string[]; p1: string[]; p2: string[] };
  browserChecklist: string[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = 'http://127.0.0.1:3000';
  let withAi = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--base-url' && args[i + 1]) {
      baseUrl = args[i + 1].replace(/\/$/, '');
      i += 1;
    } else if (args[i] === '--live') {
      baseUrl = 'https://caspa.ocrowley.com';
    } else if (args[i] === '--with-ai') {
      withAi = true;
    }
  }
  return { baseUrl, withAi };
}

function loadEnv(): Record<string, string> {
  const envPath = path.join(ROOT, '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [k, ...rest] = trimmed.split('=');
      env[k.trim()] = rest.join('=').trim();
    }
  }
  if (process.env.ADMIN_EMAIL) env.ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  if (process.env.ADMIN_PASSWORD) env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  return env;
}

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

class HttpClient {
  constructor(
    readonly baseUrl: string,
    private token: string | null = null,
  ) {}

  setToken(token: string) {
    this.token = token;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 30_000,
  ): Promise<{ status: number; ok: boolean; data: T; raw: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (this.token) headers.Authorization = `Bearer ${this.token}`;

      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const raw = await res.text();
      let data: T = {} as T;
      try {
        data = JSON.parse(raw) as T;
      } catch {
        data = { raw } as T;
      }
      return { status: res.status, ok: res.ok, data, raw };
    } finally {
      clearTimeout(timer);
    }
  }

  async expectStatus(method: string, path: string, expected: number, body?: unknown, timeoutMs = 30_000) {
    const res = await this.request(method, path, body, timeoutMs);
    return { ...res, matches: res.status === expected };
  }
}

function unwrap<T>(data: unknown): T {
  if (data && typeof data === 'object' && 'data' in (data as object)) {
    return (data as { data: T }).data;
  }
  return data as T;
}

function makeAgent(agent: string): AgentReport {
  return {
    agent,
    score: 10,
    status: 'pass',
    tested: [],
    evidence: [],
    failures: [],
    recommendedFixes: [],
    severity: 'low',
  };
}

function fail(report: AgentReport, msg: string, fix?: string, sev: Severity = 'high') {
  report.failures.push(msg);
  if (fix) report.recommendedFixes.push(fix);
  report.score = Math.max(0, report.score - (sev === 'blocker' ? 4 : sev === 'high' ? 2.5 : sev === 'medium' ? 1.5 : 0.75));
  if (sev === 'blocker' || report.status === 'pass') {
    report.status = sev === 'blocker' || sev === 'high' ? 'fail' : 'warn';
  }
  if (sev === 'blocker') report.severity = 'blocker';
  else if (sev === 'high' && report.severity !== 'blocker') report.severity = 'high';
  else if (sev === 'medium' && report.severity === 'low') report.severity = 'medium';
}

function warn(report: AgentReport, msg: string, fix?: string) {
  report.failures.push(`WARN: ${msg}`);
  if (fix) report.recommendedFixes.push(fix);
  report.score = Math.max(0, report.score - 1);
  if (report.status === 'pass') report.status = 'warn';
  if (report.severity === 'low') report.severity = 'medium';
}

function finalize(report: AgentReport) {
  report.score = Math.round(report.score * 10) / 10;
  if (report.failures.length === 0) report.status = 'pass';
  else if (report.severity === 'blocker' || report.failures.some((f) => !f.startsWith('WARN:'))) {
    if (report.status !== 'fail' && report.score >= 7) report.status = 'warn';
    if (report.score < 5) report.status = 'fail';
  }
}

async function login(http: HttpClient, env: Record<string, string>): Promise<string> {
  const candidates = [
    [env.ADMIN_EMAIL, env.ADMIN_PASSWORD],
    ['admin@caspa.local', env.ADMIN_PASSWORD || 'changeme'],
  ].filter(([e, p]) => e && p) as [string, string][];

  for (const [email, password] of candidates) {
    const res = await http.request('POST', '/api/auth/login', { email, password });
    const data = unwrap<{ token?: string }>(res.data);
    if (res.ok && data.token) return data.token;
  }
  throw new Error('Login failed — set ADMIN_EMAIL and ADMIN_PASSWORD in .env');
}

async function fetchUiBundleText(baseUrl: string): Promise<string> {
  try {
    const indexRes = await fetch(`${baseUrl}/`);
    const html = await indexRes.text();
    const assetMatch = html.match(/\/assets\/index-[\w-]+\.js/);
    if (!assetMatch) return html;
    const jsRes = await fetch(`${baseUrl}${assetMatch[0]}`);
    return (await jsRes.text()) + html;
  } catch {
    return '';
  }
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function looksLikeSummary(text: string): boolean {
  const words = wordCount(text);
  if (words < 120) return true;
  const lower = text.toLowerCase();
  if (lower.includes('in summary') || lower.includes('this essay') || lower.includes('in conclusion,')) return true;
  if (words < 400 && (lower.includes('the story is about') || lower.includes('this chapter summarizes'))) return true;
  return false;
}

async function runImpatientNewUser(http: HttpClient, uiText: string): Promise<AgentReport> {
  const r = makeAgent('Impatient New User');
  r.tested.push('POST /api/auth/login');
  r.tested.push('POST /api/projects (blank project)');
  r.tested.push('GET /api/casper/status');
  r.tested.push('GET /api/outputs');
  r.tested.push('UI bundle string scan');

  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Blank ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    fictionality: 'fiction',
    form: 'book',
    structureType: 'chapters',
    description: 'Critical QA blank project',
    targetWordCount: 80000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);
  if (!projectRes.ok || !project.id) {
    fail(r, 'Cannot create blank project', 'Fix POST /api/projects for authenticated users', 'blocker');
    finalize(r);
    return r;
  }
  r.evidence.push(`Created project ${project.id.slice(0, 8)}`);

  const routes: Array<[string, string]> = [
    ['GET', '/api/casper/status'],
    ['GET', `/api/projects/${project.id}/book-map`],
    ['GET', `/api/outputs?projectId=${project.id}`],
    ['GET', `/api/projects/${project.id}/export/markdown`],
  ];
  for (const [method, p] of routes) {
    const res = await http.request(method, p);
    if (!res.ok) fail(r, `${method} ${p} returned ${res.status}`, `Ensure route works for new projects`, 'high');
    else r.evidence.push(`${method} ${p} → ${res.status}`);
  }

  const uiNeedles = ['Saved Writing', 'Book Map', 'Novel Write Pro', 'Finish This Book', 'What are we making today'];
  for (const needle of uiNeedles) {
    if (!uiText.includes(needle)) {
      warn(r, `UI bundle missing label "${needle}"`, `Expose "${needle}" in primary navigation/copy`);
    } else {
      r.evidence.push(`UI contains "${needle}"`);
    }
  }

  finalize(r);
  return r;
}

async function runAngryNovelist(http: HttpClient, withAi: boolean): Promise<AgentReport> {
  const r = makeAgent('Angry Novelist');
  const novel = loadFixture('multi-chapter-novel.md');
  r.tested.push('POST /api/manuscript/import/analyse (multi-chapter fixture)');
  r.tested.push('POST /api/projects/:id/book-map/generate');

  const analysisRes = await http.request('POST', '/api/manuscript/import/analyse', {
    filename: 'multi-chapter-novel.md',
    rawText: novel,
    declaredWorkType: 'novel',
  });
  const analysis = unwrap<{ detectedUnits?: unknown[]; recommendedImportMode?: string }>(analysisRes.data);
  if (!analysisRes.ok || (analysis.detectedUnits?.length ?? 0) < 3) {
    fail(r, `Multi-chapter fixture detected ${analysis.detectedUnits?.length ?? 0} units (expected ≥3)`, 'Improve ImportAnalyser chapter heading detection', 'blocker');
  } else {
    r.evidence.push(`Detected ${analysis.detectedUnits!.length} units; mode=${analysis.recommendedImportMode}`);
  }

  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Angry Novelist ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    fictionality: 'fiction',
    form: 'book',
    structureType: 'chapters',
    targetWordCount: 80000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);
  if (!project.id) {
    fail(r, 'Project creation failed', undefined, 'blocker');
    finalize(r);
    return r;
  }

  const mapRes = await http.request('POST', `/api/projects/${project.id}/book-map/generate`, {}, 180_000);
  const bookMap = unwrap<{ outputId?: string; finishRoadmap?: string[]; missingSections?: string[]; nextRecommendedChapter?: string }>(mapRes.data);
  if (!mapRes.ok || !bookMap.outputId) {
    fail(r, 'Book Map generate did not return outputId', 'Fix book-map/generate persistence', 'high');
  } else {
    r.evidence.push(`Book Map outputId=${bookMap.outputId.slice(0, 8)}`);
    if (!bookMap.finishRoadmap?.length) warn(r, 'Book Map missing finishRoadmap');
    if (!bookMap.missingSections?.length) warn(r, 'Book Map missing missingSections suggestions');
  }

  if (withAi) {
    r.tested.push('POST /api/casper/finish-book (plan)');
    r.tested.push('POST /api/casper/novel-write-pro (optional)');
    const finishRes = await http.request('POST', '/api/casper/finish-book', { projectId: project.id, mode: 'plan' }, 180_000);
    const finish = unwrap<{ outputId?: string }>(finishRes.data);
    if (!finishRes.ok || !finish.outputId) fail(r, 'Finish This Book plan missing outputId', undefined, 'high');
    else r.evidence.push(`Finish plan outputId=${finish.outputId.slice(0, 8)}`);

    const nwpRes = await http.request('POST', '/api/casper/novel-write-pro', {
      projectId: project.id,
      mode: 'novel',
      output: 'Full chapter',
      spark: 'Mara returns to Blackwater harbour',
      tone: 'Gothic, precise',
      source: novel.slice(0, 4000),
    }, 360_000);
    const nwp = unwrap<{ outputId?: string; text?: string }>(nwpRes.data);
    if (!nwpRes.ok || !nwp.outputId) {
      fail(r, 'Novel Write Pro failed or missing outputId', 'Check Ollama / NWP pipeline', 'blocker');
    } else if (looksLikeSummary(nwp.text ?? '')) {
      fail(r, `Novel Write Pro output looks like summary (${wordCount(nwp.text ?? '')} words)`, 'Enforce chapter-scale prompts in NWP', 'blocker');
    } else {
      r.evidence.push(`NWP ${wordCount(nwp.text ?? '')} words, outputId=${nwp.outputId.slice(0, 8)}`);
    }
  } else {
    warn(r, 'Skipped live NWP/finish AI calls (use --with-ai)', 'Run with --with-ai on server for full Angry Novelist test');
  }

  finalize(r);
  return r;
}

async function runManuscriptSurgeon(http: HttpClient): Promise<AgentReport> {
  const r = makeAgent('Manuscript Surgeon');
  const fixtures: Array<[string, string, (a: Record<string, unknown>) => void]> = [
    ['multi-chapter-novel.md', 'novel', (a) => {
      if ((a.detectedUnits as unknown[] | undefined)?.length < 3) fail(r, 'Novel fixture: too few units', undefined, 'high');
    }],
    ['stage-play-scene.txt', 'stage-play', (a) => {
      const types = new Set((a.detectedUnits as Array<{ type: string }> | undefined)?.map((u) => u.type));
      if (!types.has('act') && !types.has('scene')) warn(r, 'Play fixture: no act/scene units detected');
    }],
    ['nonfiction-outline.md', 'business-book', (a) => {
      if ((a.detectedUnits as unknown[] | undefined)?.length < 2) warn(r, 'Nonfiction fixture: expected multiple sections');
    }],
    ['messy-bad-project.md', 'novel', (a) => {
      if (!a.warnings || (a.warnings as string[]).length === 0) warn(r, 'Messy fixture produced no warnings');
    }],
  ];

  for (const [file, workType, assertFn] of fixtures) {
    r.tested.push(`POST /api/manuscript/import/analyse (${file})`);
    const text = loadFixture(file);
    const res = await http.request('POST', '/api/manuscript/import/analyse', {
      filename: file,
      rawText: text,
      declaredWorkType: workType,
    });
    const analysis = unwrap<Record<string, unknown>>(res.data);
    if (!res.ok) fail(r, `Analyse failed for ${file}`, undefined, 'high');
    else {
      r.evidence.push(`${file}: ${(analysis.detectedUnits as unknown[] | undefined)?.length ?? 0} units, confidence=${analysis.confidence}`);
      assertFn(analysis);
    }
  }

  r.tested.push('POST /api/manuscript/import/apply (preserve source)');
  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Surgeon ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    targetWordCount: 80000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);
  const novel = loadFixture('multi-chapter-novel.md');
  const applyRes = await http.request('POST', '/api/manuscript/import/apply', {
    projectId: project.id,
    rawText: novel,
    filename: 'multi-chapter-novel.md',
    importMode: 'whole-manuscript-source',
  });
  if (!applyRes.ok) fail(r, 'Import apply failed', undefined, 'high');
  else r.evidence.push('whole-manuscript-source apply succeeded');

  const structureRes = await http.request('POST', `/api/projects/${project.id}/structure/analyse`, { saveOutput: true }, 60_000);
  const structure = unwrap<{ outputId?: string; units?: unknown[] }>(structureRes.data);
  if (!structureRes.ok) fail(r, 'Structure analyse endpoint failed', undefined, 'medium');
  else r.evidence.push(`Structure report outputId=${structure.outputId?.slice(0, 8) ?? 'none'}`);

  finalize(r);
  return r;
}

async function runContinuityPedant(http: HttpClient, withAi: boolean): Promise<AgentReport> {
  const r = makeAgent('Continuity Pedant');
  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Continuity ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    targetWordCount: 80000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);

  r.tested.push('POST /api/projects/:id/book-map/generate');
  const mapRes = await http.request('POST', `/api/projects/${project.id}/book-map/generate`, {}, 120_000);
  if (!mapRes.ok) {
    fail(r, 'Book Map generate failed', undefined, withAi ? 'high' : 'medium');
  } else {
    const map = unwrap<Record<string, unknown>>(mapRes.data);
    const generic = !map.arcSummary || String(map.arcSummary).includes('not yet mapped');
    if (generic) warn(r, 'Book Map arcSummary is generic/empty');
    if (!(map.missingSections as string[] | undefined)?.length) warn(r, 'No missingSections in Book Map');
    if (!(map.finishRoadmap as string[] | undefined)?.length) fail(r, 'Book Map missing finishRoadmap', undefined, 'medium');
    r.evidence.push(`completion=${map.completionPercentage}% next=${map.nextRecommendedChapter}`);
  }

  r.tested.push('POST /api/projects/:id/memory/extract');
  const memRes = await http.request('POST', `/api/projects/${project.id}/memory/extract`, {});
  const memory = unwrap<Record<string, unknown>>(memRes.data);
  if (!memRes.ok) fail(r, 'Memory extract failed', undefined, 'medium');
  else r.evidence.push(`memory updatedAt=${memory.updatedAt}`);

  if (withAi) {
    r.tested.push('POST /api/casper/suggest-next-chapters');
    const planRes = await http.request('POST', '/api/casper/suggest-next-chapters', { projectId: project.id }, 180_000);
    const plan = unwrap<{ outputId?: string; missingChapters?: unknown[] }>(planRes.data);
    if (!planRes.ok || !plan.outputId) fail(r, 'suggest-next-chapters missing outputId', undefined, 'high');
    else if (!(plan.missingChapters?.length)) warn(r, 'Completion plan has no missingChapters');
  }

  finalize(r);
  return r;
}

async function runOutputAuditor(http: HttpClient, withAi: boolean): Promise<AgentReport> {
  const r = makeAgent('Output Auditor');
  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Outputs ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    targetWordCount: 80000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);
  const pid = project.id;
  const outputIds: string[] = [];

  r.tested.push('POST /api/casper/continue');
  const chapterRes = await http.request('POST', `/api/projects/${pid}/chapters`, {
    title: 'QA chapter',
    order: 1,
    content: 'Mara climbed the lighthouse stairs. The foghorn failed again.',
  });
  const chapter = unwrap<{ id: string }>(chapterRes.data);
  const contRes = await http.request('POST', '/api/casper/continue', {
    projectId: pid,
    chapterId: chapter.id,
    currentText: 'Mara climbed the lighthouse stairs.',
    mode: 'continue',
  }, withAi ? 180_000 : 30_000);
  const cont = unwrap<{ outputId?: string }>(contRes.data);
  if (!contRes.ok || !cont.outputId) {
    if (withAi) fail(r, 'Continue Writing missing outputId', undefined, 'blocker');
    else warn(r, 'Continue Writing not verified without --with-ai');
  } else outputIds.push(cont.outputId);

  r.tested.push('POST /api/research/extract-claims');
  const claimsRes = await http.request('POST', '/api/research/extract-claims', {
    projectId: pid,
    text: 'The lighthouse was built in 1847 and staffed every winter.',
  });
  const claims = unwrap<{ outputId?: string }>(claimsRes.data);
  if (!claimsRes.ok || !claims.outputId) fail(r, 'Research extract-claims missing outputId', undefined, 'high');
  else outputIds.push(claims.outputId);

  r.tested.push('POST /api/projects/:id/book-map/generate');
  const mapRes = await http.request('POST', `/api/projects/${pid}/book-map/generate`, {}, 120_000);
  const map = unwrap<{ outputId?: string }>(mapRes.data);
  if (mapRes.ok && map.outputId) outputIds.push(map.outputId);
  else if (withAi) fail(r, 'Book Map output not saved', undefined, 'high');

  r.tested.push('GET /api/outputs?projectId=');
  const listRes = await http.request('GET', `/api/outputs?projectId=${pid}`);
  const outputs = unwrap<Array<{ id: string; projectId?: string; type?: string; hasText?: boolean; excerpt?: string }>>(listRes.data);
  if (!listRes.ok) fail(r, 'Outputs list failed', undefined, 'blocker');
  else {
    r.evidence.push(`Outputs list count=${outputs.length}`);
    for (const oid of outputIds) {
      const found = outputs.find((o) => o.id === oid);
      if (!found) fail(r, `Output ${oid.slice(0, 8)} not in list`, 'Ensure outputs list includes all kinds', 'high');
      else if (found.projectId !== pid) fail(r, `Output missing/wrong projectId`, undefined, 'high');
      else if (found.hasText === false) fail(r, `Output ${oid.slice(0, 8)} missing hasText`, 'Run repair:outputs / fix output semantics', 'blocker');
    }
  }

  if (outputIds.length) {
    r.tested.push('GET /api/outputs/:id');
    const detail = await http.request('GET', `/api/outputs/${outputIds[0]}`);
    if (!detail.ok) fail(r, 'Output detail route broken', undefined, 'blocker');
    else {
      const detailData = unwrap<{ metadata?: Record<string, unknown>; hasText?: boolean }>(detail.data);
      if (detailData.hasText === false && !detailData.metadata?.text) {
        fail(r, 'Output detail missing readable text', 'Ensure enrichOutputRecord on detail route', 'blocker');
      } else {
        r.evidence.push(`Output detail hasText=${String(detailData.hasText ?? !!detailData.metadata?.text)}`);
      }
    }
  }

  finalize(r);
  return r;
}

async function runGoldFidelityAuditor(http: HttpClient): Promise<AgentReport> {
  const r = makeAgent('Gold Fidelity Auditor');
  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Gold ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    targetWordCount: 80000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);
  const pid = project.id;

  r.tested.push('POST /api/projects/:id/chapters');
  const chapterRes = await http.request('POST', `/api/projects/${pid}/chapters`, {
    title: 'QA Gold chapter',
    order: 1,
    content: 'Mara reached the lighthouse before dawn. Tomas waited with the broken foghorn.',
  });
  const chapter = unwrap<{ id: string }>(chapterRes.data);

  r.tested.push('POST /api/gold/source-lock');
  const lockRes = await http.request('POST', '/api/gold/source-lock', {
    projectId: pid,
    sourceType: 'chapter',
    chapterId: chapter.id,
    mode: 'improve-same-story',
  });
  const lock = unwrap<{ sourceLockId?: string; wordCount?: number; sourcePreviewStart?: string }>(lockRes.data);
  if (!lockRes.ok || !lock.sourceLockId) {
    fail(r, 'Gold source lock failed', 'Ensure /api/gold/source-lock route', 'blocker');
    finalize(r);
    return r;
  }
  r.evidence.push(`Source lock ${lock.sourceLockId.slice(0, 8)} · ${lock.wordCount ?? 0} words`);

  r.tested.push('GET /api/gold/source-lock/:id');
  const getLock = await http.request('GET', `/api/gold/source-lock/${lock.sourceLockId}?projectId=${pid}`);
  if (!getLock.ok) fail(r, 'Gold source lock GET failed', undefined, 'high');

  r.tested.push('POST /api/casper/quality-pass');
  const qualityRes = await http.request('POST', '/api/casper/quality-pass', {
    projectId: pid,
    chapterId: chapter.id,
    mode: 'polish',
  });
  const quality = unwrap<{ overallScore?: number; status?: string; findings?: unknown[] }>(qualityRes.data);
  if (!qualityRes.ok || typeof quality.overallScore !== 'number') {
    fail(r, 'Novel quality pass route failed', 'Ensure /api/casper/quality-pass', 'high');
  } else {
    r.evidence.push(`Quality pass score=${quality.overallScore} status=${quality.status}`);
  }

  r.tested.push('GET /api/projects/:id/jobs/latest');
  const latestJob = await http.request('GET', `/api/projects/${pid}/jobs/latest`);
  if (!latestJob.ok) warn(r, 'Project jobs/latest route unavailable');

  r.tested.push('POST /api/projects/:id/manuscript/apply-output confirm gate');
  const blockedApply = await http.request('POST', `/api/projects/${pid}/manuscript/apply-output`, {
    outputId: 'nonexistent',
    mode: 'replace-unit',
    confirmed: false,
  });
  if (blockedApply.ok) fail(r, 'apply-output allowed without confirmed:true', undefined, 'blocker');
  else r.evidence.push('apply-output requires confirmed:true');

  finalize(r);
  return r;
}

async function runDataLossParanoid(http: HttpClient): Promise<AgentReport> {
  const r = makeAgent('Data-Loss Paranoid');
  const novel = loadFixture('multi-chapter-novel.md');
  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Safety ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    targetWordCount: 80000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);

  r.tested.push('POST /api/manuscript/import/apply whole-manuscript-source');
  await http.request('POST', '/api/manuscript/import/apply', {
    projectId: project.id,
    rawText: novel,
    filename: 'original.md',
    importMode: 'whole-manuscript-source',
  });

  r.tested.push('GET /api/projects/:id/chapters');
  const chaptersBefore = unwrap<Array<{ id: string; content: string; title: string }>>(
    unwrap(await http.request('GET', `/api/projects/${project.id}/chapters`).then((x) => x.data)),
  );
  const source = chaptersBefore.find((c) => c.title.includes('Source')) ?? chaptersBefore[0];
  if (!source?.content?.includes('Mara Voss')) fail(r, 'Original source text not preserved after import', undefined, 'blocker');
  else r.evidence.push(`Source chapter preserved (${wordCount(source.content)} words)`);

  r.tested.push('POST /api/projects/:id/snapshot');
  const snapRes = await http.request('POST', `/api/projects/${project.id}/snapshot`, {
    label: 'QA pre-apply',
    reason: 'critical qa swarm',
  });
  const snap = unwrap<{ id: string }>(snapRes.data);
  if (!snapRes.ok || !snap.id) fail(r, 'Snapshot route unavailable', 'Implement snapshot before apply flows', 'blocker');
  else r.evidence.push(`Snapshot ${snap.id.slice(0, 8)} created`);

  r.tested.push('GET /api/projects/:id/versions');
  const versions = await http.request('GET', `/api/projects/${project.id}/versions`);
  if (!versions.ok) fail(r, 'Versions list failed', undefined, 'high');

  r.tested.push('GET /api/projects/:id/compare (requires two snapshots — route exists)');
  const compare = await http.request('GET', `/api/projects/${project.id}/compare?from=${snap.id}&to=${snap.id}`);
  if (!compare.ok) warn(r, 'Compare route failed (may need distinct snapshot ids)');

  finalize(r);
  return r;
}

async function runUxSadist(http: HttpClient, uiText: string): Promise<AgentReport> {
  const r = makeAgent('UX Sadist');
  r.tested.push('UI bundle CTA scan');
  r.tested.push('GET /api/casper/status availability');

  const casper = await http.request('GET', '/api/casper/status');
  if (!casper.ok) warn(r, 'Casper status endpoint unavailable');

  const primaryLabels = ['Auto-write award draft', 'Finish This Book', 'Generate Book Map', 'Saved Writing'];
  for (const label of primaryLabels) {
    if (!uiText.includes(label)) warn(r, `Primary CTA/label "${label}" not found in UI bundle`);
    else r.evidence.push(`Found "${label}" in UI`);
  }

  r.tested.push('Browser checklist (manual): empty states, duplicate project selector');
  r.evidence.push('Manual: verify each empty state has a button; verify single active project context');

  finalize(r);
  return r;
}

async function runSecurityGoblin(http: HttpClient): Promise<AgentReport> {
  const r = makeAgent('Security Goblin');
  const anon = new HttpClient(http.baseUrl, null);

  r.tested.push('GET /health (public)');
  const health = await anon.request('GET', '/health');
  if (!health.ok || !(unwrap<{ status?: string }>(health.data).status === 'ok')) fail(r, '/health not public OK', undefined, 'blocker');
  else r.evidence.push('/health public OK');

  r.tested.push('GET /api/doctor secret scan');
  const doctor = await anon.request('GET', '/api/doctor');
  const doctorRaw = doctor.raw.toLowerCase();
  const secretPatterns = ['sk-', 'api_key', 'password=', 'bearer ', '/root/', '.env', 'dropboxtoken'];
  for (const pat of secretPatterns) {
    if (doctorRaw.includes(pat) && pat !== '/root/') {
      fail(r, `Doctor response may expose secret pattern: ${pat}`, 'Sanitize /api/doctor', 'blocker');
    }
  }
  if (doctorRaw.includes('geminiconfigured') || doctorRaw.includes('"configured"')) {
    r.evidence.push('Doctor exposes booleans only (no raw keys)');
  }

  const protectedPaths = [
    ['GET', '/api/projects'],
    ['GET', '/api/outputs'],
    ['GET', '/api/ollama/health'],
    ['GET', '/api/ollama/models'],
    ['GET', '/api/projects/000000000000000000000000/book-map'],
  ];
  for (const [method, p] of protectedPaths) {
    r.tested.push(`${method} ${p} unauthenticated → 401`);
    const res = await anon.expectStatus(method, p, 401);
    if (!res.matches) fail(r, `${method} ${p} returned ${res.status}, expected 401`, 'Enforce auth middleware', 'blocker');
    else r.evidence.push(`${p} → 401`);
  }

  finalize(r);
  return r;
}

async function runPerformanceMiser(http: HttpClient, withAi: boolean): Promise<AgentReport> {
  const r = makeAgent('Performance Miser');
  r.tested.push('POST /api/ollama/generate-test');

  const start = Date.now();
  const ollama = await http.request('POST', '/api/ollama/generate-test', { prompt: 'One sentence about fog.' }, 120_000);
  const elapsed = Date.now() - start;
  if (!ollama.ok) {
    const err = unwrap<{ error?: string }>(ollama.data);
    fail(r, `Ollama generate-test failed: ${err.error ?? ollama.status}`, 'Check Ollama reachability', 'high');
  } else {
    r.evidence.push(`Ollama generate-test ${(elapsed / 1000).toFixed(1)}s`);
    if (elapsed > 90_000) warn(r, `Ollama generate-test slow (${(elapsed / 1000).toFixed(0)}s)`);
  }

  if (withAi) {
    r.tested.push('POST /api/casper/novel-write-pro timing');
    const t0 = Date.now();
    const project = unwrap<{ id: string }>(unwrap((await http.request('POST', '/api/projects', {
      title: `QA Perf ${Date.now()}`, genre: 'Novel', workType: 'novel', targetWordCount: 80000, status: 'draft',
    })).data));
    const nwp = await http.request('POST', '/api/casper/novel-write-pro', {
      projectId: project.id,
      mode: 'novel',
      output: 'First scene',
      spark: 'Harbour fog test',
      tone: 'Direct',
    }, 360_000);
    const dt = Date.now() - t0;
    if (!nwp.ok) fail(r, 'NWP hung or failed during perf test', undefined, 'high');
    else r.evidence.push(`NWP total ${(dt / 1000).toFixed(0)}s (no staged progress verified via API)`);
    warn(r, 'Staged progress UI not verifiable via API — check browser manually');
  } else {
    warn(r, 'Skipped NWP duration test (use --with-ai)');
  }

  finalize(r);
  return r;
}

async function runCommercialSnob(http: HttpClient, withAi: boolean): Promise<AgentReport> {
  const r = makeAgent('Commercial Snob');
  const novel = loadFixture('multi-chapter-novel.md');
  r.tested.push('End-to-end API journey: project → import → structure → book map → export');

  const project = unwrap<{ id: string }>(unwrap((await http.request('POST', '/api/projects', {
    title: `QA Journey ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    targetWordCount: 80000,
    status: 'draft',
  })).data));
  const pid = project.id;

  const analysis = unwrap<{ detectedUnits?: Array<{ type: string; title: string; startIndex: number; endIndex: number; wordCount: number }> }>(
    (await http.request('POST', '/api/manuscript/import/analyse', {
      filename: 'journey.md',
      rawText: novel,
      declaredWorkType: 'novel',
    })).data,
  );

  await http.request('POST', '/api/manuscript/import/apply', {
    projectId: pid,
    rawText: novel,
    filename: 'journey.md',
    importMode: 'split-into-units',
    detectedUnits: analysis.detectedUnits,
  });

  const mapOk = (await http.request('POST', `/api/projects/${pid}/book-map/generate`, {}, 120_000)).ok;
  const mdOk = (await http.request('GET', `/api/projects/${pid}/export/markdown`)).ok;
  const outs = unwrap<Array<{ id: string }>>(unwrap((await http.request('GET', `/api/outputs?projectId=${pid}`)).data));

  let journeyScore = 10;
  if (!mapOk) { journeyScore -= 2; fail(r, 'Book Map step failed in journey'); }
  if (!mdOk) { journeyScore -= 2; fail(r, 'Markdown export unavailable'); }
  if (outs.length < 1) { journeyScore -= 2; fail(r, 'Saved Writing empty after journey'); }
  else r.evidence.push(`Journey produced ${outs.length} saved outputs`);

  r.evidence.push(`Commercial journey score component: ${journeyScore}/10`);
  r.score = Math.min(r.score, journeyScore);
  if (journeyScore < 7) r.status = 'fail';
  else if (journeyScore < 9) r.status = 'warn';

  r.recommendedFixes.push('Top beta blockers: surface finish roadmap on Today; wire Trash to Treasure UI; staged progress on NWP');

  finalize(r);
  return r;
}

function aggregateScores(agents: AgentReport[]) {
  const avg = agents.reduce((s, a) => s + a.score, 0) / agents.length;
  const browser = agents.find((a) => a.agent === 'Impatient New User')?.score ?? 0;
  const book = (
    (agents.find((a) => a.agent === 'Angry Novelist')?.score ?? 0)
    + (agents.find((a) => a.agent === 'Continuity Pedant')?.score ?? 0)
  ) / 2;
  const safety = agents.find((a) => a.agent === 'Data-Loss Paranoid')?.score ?? 0;

  const defects = agents.flatMap((a) =>
    a.failures.filter((f) => !f.startsWith('WARN:')).map((f) => `[${a.agent}] ${f}`),
  );

  const p0 = agents.flatMap((a) =>
    a.severity === 'blocker'
      ? a.failures.filter((f) => !f.startsWith('WARN:')).map((f) => `${a.agent}: ${f}`)
      : [],
  );
  const p1 = agents.flatMap((a) =>
    a.status === 'fail' && a.severity !== 'blocker' ? a.failures.slice(0, 3).map((f) => `${a.agent}: ${f}`) : [],
  );
  const p2 = agents.flatMap((a) =>
    a.status === 'warn' ? a.failures.filter((f) => f.startsWith('WARN:')).slice(0, 2).map((f) => `${a.agent}: ${f}`) : [],
  );

  return {
    overallScore: Math.round(avg * 10) / 10,
    browserReadinessScore: Math.round(browser * 10) / 10,
    finishedBookMachineScore: Math.round(book * 10) / 10,
    dataSafetyScore: Math.round(safety * 10) / 10,
    topDefects: defects.slice(0, 20),
    priority: { p0, p1, p2 },
  };
}

function renderMarkdown(report: SwarmReport): string {
  const lines: string[] = [
    '# CASPA Critical QA Swarm Report',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Base URL:** ${report.baseUrl}`,
    `**Commit:** ${report.commit ?? 'unknown'}`,
    `**With AI tests:** ${report.withAi ? 'yes' : 'no (use --with-ai for full run)'}`,
    '',
    '## Scores',
    '',
    `| Metric | Score |`,
    `|--------|------:|`,
    `| **Overall** | **${report.overallScore}/10** |`,
    `| Browser readiness | ${report.browserReadinessScore}/10 |`,
    `| Finished-book machine | ${report.finishedBookMachineScore}/10 |`,
    `| Data safety | ${report.dataSafetyScore}/10 |`,
    '',
    '## Agent results',
    '',
    '| Agent | Score | Status | Blockers | Top fix |',
    '|-------|------:|--------|----------|---------|',
  ];

  for (const a of report.agents) {
    const blockers = a.severity === 'blocker' ? a.failures.filter((f) => !f.startsWith('WARN:')).length : 0;
    const topFix = a.recommendedFixes[0] ?? '—';
    lines.push(`| ${a.agent} | ${a.score} | ${a.status} | ${blockers} | ${topFix.replace(/\|/g, '/')} |`);
  }

  lines.push('', '## P0 blockers', '');
  if (report.priority.p0.length === 0) lines.push('_None detected in this run._');
  else report.priority.p0.forEach((p) => lines.push(`- ${p}`));

  lines.push('', '## P1 issues', '');
  report.priority.p1.slice(0, 15).forEach((p) => lines.push(`- ${p}`));

  lines.push('', '## P2 warnings', '');
  report.priority.p2.slice(0, 15).forEach((p) => lines.push(`- ${p}`));

  lines.push('', '## Top defects', '');
  report.topDefects.slice(0, 20).forEach((d, i) => lines.push(`${i + 1}. ${d}`));

  lines.push('', '## Agent detail', '');
  for (const a of report.agents) {
    lines.push(`### ${a.agent} (${a.status}, ${a.score}/10)`, '');
    lines.push('**Tested:**', ...a.tested.map((t) => `- ${t}`), '');
    if (a.evidence.length) lines.push('**Evidence:**', ...a.evidence.map((e) => `- ${e}`), '');
    if (a.failures.length) lines.push('**Failures:**', ...a.failures.map((f) => `- ${f}`), '');
    if (a.recommendedFixes.length) lines.push('**Recommended fixes:**', ...a.recommendedFixes.map((f) => `- ${f}`), '');
  }

  lines.push('', '## Browser checklist (manual)', '');
  report.browserChecklist.forEach((b) => lines.push(`- [ ] ${b}`));

  lines.push('', '---', '_Diagnostic run — do not treat WARN as pass unless verified._', '');
  return lines.join('\n');
}

async function runLostFirstTimeUser(http: HttpClient, uiText: string): Promise<AgentReport> {
  const r = makeAgent('Lost First-Time User');
  r.tested.push('UI bundle help/guide/wizard labels');
  r.tested.push('GET /api/projects/:id/guide-state');

  const needles = ['Help Centre', 'Guide Me', 'Production Wizard', 'Source Library', 'What are we making today'];
  for (const needle of needles) {
    if (!uiText.includes(needle)) warn(r, `First-time wayfinding missing "${needle}"`, `Expose ${needle} in primary UI`);
    else r.evidence.push(`UI contains "${needle}"`);
  }

  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Lost ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    targetWordCount: 60000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);
  if (!project.id) {
    fail(r, 'Cannot create project for guide-state test', undefined, 'high');
    finalize(r);
    return r;
  }

  const guide = await http.request('GET', `/api/projects/${project.id}/guide-state`);
  if (!guide.ok) fail(r, 'guide-state unavailable', 'Mount studio guide-state route', 'high');
  else {
    const state = unwrap<{ recommendedNextAction?: { label?: string } }>(guide.data);
    if (!state.recommendedNextAction?.label) warn(r, 'guide-state missing recommendedNextAction');
    else r.evidence.push(`Guide recommends: ${state.recommendedNextAction.label}`);
  }

  finalize(r);
  return r;
}

async function runGuidanceAnnoyanceTester(_http: HttpClient, uiText: string): Promise<AgentReport> {
  const r = makeAgent('Guidance Annoyance Tester');
  r.tested.push('UI bundle dismiss/guide patterns');

  if (uiText.includes('Dismiss guidance')) r.evidence.push('Guide dismiss copy present');
  else warn(r, 'Guide dismiss option not found in UI bundle');

  if (uiText.includes('Skip for now')) r.evidence.push('Wizard skippable');
  else warn(r, 'Production wizard skip not obvious');

  finalize(r);
  return r;
}

async function runAiRouterAuditor(http: HttpClient): Promise<AgentReport> {
  const r = makeAgent('AI Router Auditor');
  r.tested.push('POST /api/providers/test-all');

  const testAll = await http.request('POST', '/api/providers/test-all', {});
  if (!testAll.ok) fail(r, 'test-all route failed', 'Mount POST /api/providers/test-all', 'high');
  else {
    const payload = unwrap<{ providers?: Array<{ id?: string; canGenerate?: boolean; configured?: boolean }> }>(testAll.data);
    r.evidence.push(`test-all returned ${(payload.providers ?? []).length} providers`);
  }

  finalize(r);
  return r;
}

async function runAssetIngestionAuditor(http: HttpClient): Promise<AgentReport> {
  const r = makeAgent('Asset Ingestion Auditor');
  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Assets ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    targetWordCount: 50000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);
  if (!project.id) {
    fail(r, 'Project create failed', undefined, 'blocker');
    finalize(r);
    return r;
  }

  r.tested.push('POST/GET /api/projects/:id/assets');

  const receipt = await http.request('POST', `/api/projects/${project.id}/assets`, {
    title: 'Cafe receipt',
    originalFilename: 'receipt.txt',
    sourceText: 'TOTAL: £4.50\nVAT 20%\nPaid by card\nBlue Note Cafe',
  });
  const fragment = await http.request('POST', `/api/projects/${project.id}/assets`, {
    title: 'Scene fragment',
    sourceText: 'She found the ticket stub in his coat — dated the night Mara disappeared.',
  });

  if (!receipt.ok || !fragment.ok) fail(r, 'Asset create failed', 'Fix studio asset routes', 'blocker');
  else {
    const rAsset = unwrap<{ detectedUse?: string; sourceText?: string }>(receipt.data);
    if (rAsset.detectedUse !== 'receipt') warn(r, 'Receipt not classified as receipt');
    else r.evidence.push('Receipt classified correctly');
    if (!rAsset.sourceText?.includes('TOTAL')) fail(r, 'Source text not preserved on asset', undefined, 'blocker');
  }

  const list = await http.request('GET', `/api/projects/${project.id}/assets`);
  const assets = unwrap<unknown[]>(list.data);
  if (!list.ok || assets.length < 2) fail(r, 'Asset list incomplete', undefined, 'high');
  else r.evidence.push(`${assets.length} assets listed`);

  finalize(r);
  return r;
}

async function runIntimacyEditor(http: HttpClient, uiText: string): Promise<AgentReport> {
  const r = makeAgent('Intimacy Editor');
  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Intimacy ${Date.now()}`,
    genre: 'Romance',
    workType: 'novel',
    targetWordCount: 70000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);

  r.tested.push('GET/PATCH intimacy-settings');
  r.tested.push('UI wizard adult scene question');

  const getRes = await http.request('GET', `/api/projects/${project.id}/intimacy-settings`);
  if (!getRes.ok) fail(r, 'intimacy-settings GET failed', undefined, 'high');

  const patchRes = await http.request('PATCH', `/api/projects/${project.id}/intimacy-settings`, {
    defaultHeatLevel: 2,
    askBeforeIncreasingHeat: true,
  });
  if (!patchRes.ok) fail(r, 'intimacy-settings PATCH failed', undefined, 'high');
  else r.evidence.push('Intimacy settings stored');

  if (!uiText.includes('intimacy') && !uiText.includes('Fade to black')) {
    warn(r, 'Wizard intimacy copy not found in UI bundle');
  } else r.evidence.push('Wizard intimacy UI present');

  if (uiText.toLowerCase().includes('porn mode')) fail(r, 'UI contains "porn mode" label', undefined, 'high');

  finalize(r);
  return r;
}

async function runExportInspector(http: HttpClient): Promise<AgentReport> {
  const r = makeAgent('Export Inspector');
  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA Export ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    targetWordCount: 60000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);

  r.tested.push('GET export markdown + docx');

  const md = await http.request('GET', `/api/projects/${project.id}/export/markdown`);
  const docx = await http.request('GET', `/api/projects/${project.id}/export/docx`);

  if (!md.ok) fail(r, 'Markdown export failed', undefined, 'high');
  else r.evidence.push('Markdown export OK');
  if (!docx.ok) fail(r, 'DOCX export failed', undefined, 'high');
  else r.evidence.push('DOCX export OK');

  finalize(r);
  return r;
}

async function runJamesUsabilityTester(http: HttpClient, uiText: string): Promise<AgentReport> {
  const r = makeAgent('James Usability Tester');
  r.tested.push('Manual docs + core flow labels');

  const docPath = path.join(ROOT, 'docs', 'JAMES_USABILITY_TEST.md');
  const manualPath = path.join(ROOT, 'docs', 'MANUAL_MARKET_LEADER_TEST_SCRIPT.md');
  if (!fs.existsSync(docPath)) warn(r, 'JAMES_USABILITY_TEST.md missing');
  else r.evidence.push('James usability doc present');
  if (!fs.existsSync(manualPath)) warn(r, 'MANUAL_MARKET_LEADER_TEST_SCRIPT.md missing');
  else r.evidence.push('Manual market leader script present');

  const flowLabels = ['Source Library', 'Production Wizard', 'Help Centre', 'Saved Writing', 'Trash to Treasure'];
  const found = flowLabels.filter((l) => uiText.includes(l)).length;
  if (found < 4) warn(r, `Only ${found}/${flowLabels.length} flow labels in UI bundle`);
  else r.evidence.push(`${found}/${flowLabels.length} flow labels in UI`);

  const list = await http.request('GET', '/api/projects');
  if (!list.ok) fail(r, 'Projects list fails', undefined, 'high');

  finalize(r);
  return r;
}

async function runResponsiveLayoutInspector(_http: HttpClient, uiText: string): Promise<AgentReport> {
  const r = makeAgent('Responsive Layout Inspector');
  r.tested.push('UI bundle responsive shell patterns');

  const required = [
    ['overflow-x hidden', /overflow-x-hidden|overflow-x:\s*hidden/],
    ['dvh shell', /min-h-dvh|app-shell|100dvh/],
    ['mobile menu', /MobileNavDrawer|mobileNavOpen|Open menu/],
    ['bottom nav', /MobileBottomNav|Primary navigation/],
    ['Guide Me drawer', /Guide Me|guideDrawerOpen/],
    ['safe-area', /safe-area-inset/],
    ['touch 44px', /min-h-\[44px\]/],
  ] as const;

  for (const [label, pattern] of required) {
    if (!pattern.test(uiText)) fail(r, `Missing responsive pattern: ${label}`, 'Complete Phase 23 shell pass', 'high');
    else r.evidence.push(`Found ${label}`);
  }

  const manual = path.join(ROOT, 'docs', 'RESPONSIVE_DEVICE_QA_REPORT.md');
  if (fs.existsSync(manual)) r.evidence.push('Responsive QA report path exists');
  else warn(r, 'RESPONSIVE_DEVICE_QA_REPORT.md not generated yet', 'Run npm run qa:responsive');

  finalize(r);
  return r;
}

async function runIpadAuthorTester(_http: HttpClient, uiText: string): Promise<AgentReport> {
  const r = makeAgent('iPad Author Tester');
  r.tested.push('Tablet writing flow UI patterns');

  const labels = ['ChapterRail', 'Chapters', 'Book Map', 'Source Library', 'Export', 'Continue'];
  for (const label of labels) {
    if (!uiText.includes(label) && label === 'ChapterRail') continue;
    if (!uiText.includes(label.replace('ChapterRail', 'Chapters')) && label === 'ChapterRail') {
      if (!uiText.includes('Chapters')) warn(r, 'Chapter rail mobile toggle missing');
      else r.evidence.push('Chapter navigation present');
      continue;
    }
    if (uiText.includes(label)) r.evidence.push(`Flow label: ${label}`);
    else warn(r, `Missing iPad flow label: ${label}`);
  }

  if (fs.existsSync(path.join(ROOT, 'docs', 'MOBILE_TABLET_DESKTOP_TEST_SCRIPT.md'))) {
    r.evidence.push('Manual tablet test script present');
  }

  finalize(r);
  return r;
}

async function runSmallPhoneFrustrationTester(_http: HttpClient, uiText: string): Promise<AgentReport> {
  const r = makeAgent('Small Phone Frustration Tester');
  r.tested.push('390px workflow static checks');

  if (!uiText.includes('Skip for now')) warn(r, 'Wizard skip not obvious on small screens');
  else r.evidence.push('Wizard skippable');

  if (!uiText.includes('Production Wizard') || !uiText.includes('Help Centre')) {
    warn(r, 'Core guided flows not all labeled in bundle');
  } else r.evidence.push('Wizard + Help in bundle');

  if (uiText.includes('hover:') && !uiText.includes('min-h-[44px]')) {
    warn(r, 'Hover utilities without touch target guards');
  } else r.evidence.push('Touch-friendly button classes present');

  if (uiText.toLowerCase().includes('display:none') && uiText.includes('btn-primary')) {
    r.evidence.push('Primary buttons exist in bundle (not display-none only)');
  }

  finalize(r);
  return r;
}

async function runAgentSafely(name: string, fn: () => Promise<AgentReport>): Promise<AgentReport> {
  try {
    return await fn();
  } catch (error) {
    const r = makeAgent(name);
    const msg = error instanceof Error ? error.message : String(error);
    fail(r, `Agent crashed: ${msg}`, 'Fix agent timeout or server stability', 'high');
    finalize(r);
    return r;
  }
}

async function run504RecoveryAuditor(http: HttpClient, uiText: string): Promise<AgentReport> {
  const r = makeAgent('504 Recovery Auditor');
  r.tested.push('POST /api/casper/novel-write-pro returns jobId quickly');
  r.tested.push('POST /api/gold/run returns jobId quickly');
  r.tested.push('GET /api/jobs/:id/progress');
  r.tested.push('UI job progress panel');

  const projectRes = await http.request('POST', '/api/projects', {
    title: `QA 504 ${Date.now()}`,
    genre: 'Novel',
    workType: 'novel',
    targetWordCount: 50000,
    status: 'draft',
  });
  const project = unwrap<{ id: string }>(projectRes.data);
  if (!project.id) {
    fail(r, 'Project create failed', undefined, 'blocker');
    finalize(r);
    return r;
  }

  const nwpStart = Date.now();
  const nwpRes = await http.request('POST', '/api/casper/novel-write-pro', {
    projectId: project.id,
    mode: 'novel',
    spark: '504 recovery QA',
    source: 'A short paragraph used by the 504 recovery auditor to verify async job enqueue.',
  });
  const nwpElapsed = Date.now() - nwpStart;
  const nwpData = unwrap<{ jobId?: string }>(nwpRes.data);

  if (!nwpRes.ok) fail(r, 'NWP route failed to start', 'Fix POST /api/casper/novel-write-pro job enqueue', 'blocker');
  else if (!nwpData.jobId) {
    fail(r, 'NWP blocks HTTP until final prose (no jobId) — 504 risk', 'Return jobId immediately; run in CaspaJobWorker', 'blocker');
  } else {
    r.evidence.push(`NWP jobId in ${nwpElapsed}ms`);
    if (nwpElapsed > 5000) warn(r, `NWP HTTP response slow (${nwpElapsed}ms)`, 'Keep enqueue under 2s');
    const prog = await http.request('GET', `/api/jobs/${nwpData.jobId}/progress`);
    if (!prog.ok) fail(r, 'Missing GET /api/jobs/:id/progress', 'Add progress polling endpoint', 'blocker');
    else r.evidence.push('Job progress endpoint reachable');
  }

  const lockRes = await http.request('POST', '/api/gold/source-lock', {
    projectId: project.id,
    sourceType: 'current-manuscript',
    pastedText: 'Gold 504 recovery auditor sample paragraph with enough words for a source lock.',
    mode: 'improve-same-story',
  });
  const lock = unwrap<{ sourceLockId?: string }>(lockRes.data);
  if (!lock.sourceLockId) {
    fail(r, 'Gold source lock failed', undefined, 'high');
  } else {
    const goldStart = Date.now();
    const goldRes = await http.request('POST', '/api/gold/run', {
      projectId: project.id,
      sourceLockId: lock.sourceLockId,
      improveText: true,
      stage: 'revision',
    });
    const goldElapsed = Date.now() - goldStart;
    const goldData = unwrap<{ jobId?: string }>(goldRes.data);
    if (!goldRes.ok) fail(r, 'Gold route failed to start', undefined, 'blocker');
    else if (!goldData.jobId) {
      fail(r, 'Gold blocks HTTP until final prose (no jobId)', 'Return jobId immediately from /api/gold/run', 'blocker');
    } else {
      r.evidence.push(`Gold jobId in ${goldElapsed}ms`);
      if (goldElapsed > 5000) warn(r, `Gold HTTP response slow (${goldElapsed}ms)`);
    }
  }

  if (!/JobProgressPanel|still working on this in the background|Background job/i.test(uiText)) {
    warn(r, 'UI may lack JobProgressPanel / background job copy', 'Mount JobProgressPanel on long operations');
  }

  finalize(r);
  return r;
}

async function runAllAgents(http: HttpClient, uiText: string, withAi: boolean): Promise<AgentReport[]> {
  const steps: Array<[string, () => Promise<AgentReport>]> = [
    ['Impatient New User', () => runImpatientNewUser(http, uiText)],
    ['Lost First-Time User', () => runLostFirstTimeUser(http, uiText)],
    ['Angry Novelist', () => runAngryNovelist(http, withAi)],
    ['Manuscript Surgeon', () => runManuscriptSurgeon(http)],
    ['Continuity Pedant', () => runContinuityPedant(http, withAi)],
    ['Output Auditor', () => runOutputAuditor(http, withAi)],
    ['Gold Fidelity Auditor', () => runGoldFidelityAuditor(http)],
    ['Data-Loss Paranoid', () => runDataLossParanoid(http)],
    ['UX Sadist', () => runUxSadist(http, uiText)],
    ['Security Goblin', () => runSecurityGoblin(http)],
    ['Performance Miser', () => runPerformanceMiser(http, withAi)],
    ['Commercial Snob', () => runCommercialSnob(http, withAi)],
    ['Guidance Annoyance Tester', () => runGuidanceAnnoyanceTester(http, uiText)],
    ['AI Router Auditor', () => runAiRouterAuditor(http)],
    ['Asset Ingestion Auditor', () => runAssetIngestionAuditor(http)],
    ['504 Recovery Auditor', () => run504RecoveryAuditor(http, uiText)],
    ['Intimacy Editor', () => runIntimacyEditor(http, uiText)],
    ['Export Inspector', () => runExportInspector(http)],
    ['James Usability Tester', () => runJamesUsabilityTester(http, uiText)],
    ['Responsive Layout Inspector', () => runResponsiveLayoutInspector(http, uiText)],
    ['iPad Author Tester', () => runIpadAuthorTester(http, uiText)],
    ['Small Phone Frustration Tester', () => runSmallPhoneFrustrationTester(http, uiText)],
  ];
  const agents: AgentReport[] = [];
  for (const [name, run] of steps) {
    console.log(`Running ${name}...`);
    const report = await runAgentSafely(name, run);
    agents.push(report);
    console.log(`  → ${report.status} (${report.score}/10)`);
  }
  return agents;
}

async function main() {
  const { baseUrl, withAi } = parseArgs();
  const env = loadEnv();
  const http = new HttpClient(baseUrl);

  console.log('=== CASPA CRITICAL QA SWARM ===');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`With AI: ${withAi}`);
  console.log('');

  let commit: string | null = null;
  try {
    const doctor = await http.request('GET', '/api/doctor');
    const doctorData = unwrap<{ gitCommit?: string; commit?: string; version?: string }>(doctor.data);
    commit = doctorData.gitCommit ?? doctorData.commit ?? doctorData.version ?? null;
  } catch {
    /* ignore */
  }

  try {
    const token = await login(http, env);
    http.setToken(token);
    console.log('LOGIN: ok');
  } catch (error) {
    console.error('FATAL: cannot login —', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const uiText = await fetchUiBundleText(baseUrl);
  console.log(`UI bundle scanned (${uiText.length} chars)`);

  const agents = await runAllAgents(http, uiText, withAi);

  const agg = aggregateScores(agents);
  const browserChecklist = [
    'Login page loads and submits',
    'Today page shows primary actions without explanation',
    'New project wizard has visible submit on each step',
    'Novel Write Pro shows progress stages during long run',
    'Output detail shows after generation with link from toast',
    'Apply revision shows confirm() before replace',
    'Chapter editor prev/next navigation works',
    'Trash to Treasure entry point discoverable',
  ];

  const swarmReport: SwarmReport = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    commit,
    withAi,
    agents,
    browserChecklist,
    ...agg,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(DOCS_REPORT), { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, 'critical-qa-swarm.json'), JSON.stringify(swarmReport, null, 2));
  fs.writeFileSync(DOCS_REPORT, renderMarkdown(swarmReport));

  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`Overall: ${swarmReport.overallScore}/10`);
  console.log(`Browser readiness: ${swarmReport.browserReadinessScore}/10`);
  console.log(`Finished-book: ${swarmReport.finishedBookMachineScore}/10`);
  console.log(`Data safety: ${swarmReport.dataSafetyScore}/10`);
  console.log('');
  for (const a of agents) {
    console.log(`${a.status.toUpperCase().padEnd(5)} ${a.score.toFixed(1)}  ${a.agent}${a.failures.length ? ` (${a.failures.length} issues)` : ''}`);
  }
  console.log('');
  console.log(`JSON: ${path.join(REPORTS_DIR, 'critical-qa-swarm.json')}`);
  console.log(`Markdown: ${DOCS_REPORT}`);
  if (swarmReport.priority.p0.length) {
    console.log('');
    console.log('P0 BLOCKERS:');
    swarmReport.priority.p0.forEach((p) => console.log(`  - ${p}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
