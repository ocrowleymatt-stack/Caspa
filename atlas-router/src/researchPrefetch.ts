import { callCloudProvider } from './cloudModelRouter';

export interface PrefetchedSource {
  title: string;
  url: string;
  snippet: string;
  score: number;
  query: string;
}

export interface ResearchPrefetchResult {
  usable: boolean;
  queries: string[];
  sources: PrefetchedSource[];
  evidencePrompt: string;
  durationMs: number;
  plannerDurationMs: number;
  retrievalDurationMs: number;
  errors: string[];
}

const TAVILY_URL = process.env.ATLAS_TAVILY_URL || 'http://127.0.0.1:3006/search';
const MAX_QUERIES = Math.max(2, Math.min(6, Number(process.env.ATLAS_PREFETCH_MAX_QUERIES || 4)));
const MAX_SOURCES = Math.max(4, Math.min(20, Number(process.env.ATLAS_PREFETCH_MAX_SOURCES || 12)));
const MIN_SOURCES = Math.max(2, Math.min(8, Number(process.env.ATLAS_PREFETCH_MIN_SOURCES || 3)));
const QUERY_TIMEOUT_MS = Math.max(2_000, Math.min(20_000, Number(process.env.ATLAS_PREFETCH_QUERY_TIMEOUT_MS || 10_000)));
const EVIDENCE_CHAR_LIMIT = Math.max(4_000, Math.min(30_000, Number(process.env.ATLAS_PREFETCH_EVIDENCE_CHARS || 14_000)));

function latestUserText(prompt: string): string {
  const text = String(prompt || '');
  const marker = '[USER]\n';
  const idx = text.lastIndexOf(marker);
  if (idx >= 0) {
    const tail = text.slice(idx + marker.length);
    const nextRole = tail.search(/\n\n\[[A-Z][A-Z _-]+\]\n/);
    return (nextRole >= 0 ? tail.slice(0, nextRole) : tail).trim();
  }
  return text.slice(-8_000).trim();
}

function normaliseQuery(line: string): string {
  return String(line || '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

function deterministicQueries(userText: string): string[] {
  const subjectMatch = userText.match(/\bfor\s+(.+?)(?=\s+(?:previously|formerly|now|currently|living|from|who|,)|$)/i);
  const subject = normaliseQuery(subjectMatch?.[1] || '');
  const locations = [...userText.matchAll(/\b(?:of|in|from)\s+([A-Z]?[a-z][\w'-]*(?:\s+[A-Z]?[a-z][\w'-]*){0,2})/gi)]
    .map((m) => normaliseQuery(m[1]))
    .filter(Boolean);
  const related = [...userText.matchAll(/\b(?:partner of|with|and)\s+([A-Z]?[a-z][\w'-]+(?:\s+[A-Z]?[a-z][\w'-]+){1,2})/gi)]
    .map((m) => normaliseQuery(m[1]))
    .filter(Boolean);
  const base = subject || normaliseQuery(userText
    .replace(/^\s*(?:osint|open[- ]source intelligence|search|research|look up)\b[^\n]{0,60}?\b(?:for|about)\s+/i, '')
    .replace(/\b(?:create|write)\s+(?:a\s+)?background (?:story|profile).*$/i, ''));
  const candidates = [
    [base, ...locations.slice(0, 2)].filter(Boolean).join(' '),
    [base, ...related.slice(0, 1)].filter(Boolean).join(' '),
    [base, ...related.slice(1, 2)].filter(Boolean).join(' '),
    [base, 'employment professional profile'].filter(Boolean).join(' '),
    [base, 'social media public profile'].filter(Boolean).join(' '),
  ].map(normaliseQuery).filter((q) => q.length >= 4);
  return [...new Set(candidates)].slice(0, MAX_QUERIES);
}

async function planQueries(userText: string): Promise<{ queries: string[]; durationMs: number; error?: string }> {
  const started = Date.now();
  const plannerPrompt = [
    'You are Atlas search-query planner. Produce exactly four compact public-web search-engine queries, one per line, no bullets and no commentary.',
    'The queries must investigate the request rather than assume its claims are true.',
    'Prioritise: (1) identity + locations, (2) employment/professional records, (3) named-person co-occurrence/relationship evidence, (4) public/social footprint.',
    'Use quotes around distinctive full names when useful. Do not include words like OSINT, background story, search the web, or current info unless genuinely useful search terms.',
    '',
    `REQUEST: ${userText.slice(0, 4_000)}`,
  ].join('\n');
  try {
    const planned = await callCloudProvider('grok', plannerPrompt, {
      mode: 'speed',
      task: 'fast',
      maxTokens: 220,
      useSearch: false,
    });
    const queries = [...new Set(planned.text.split(/\r?\n/).map(normaliseQuery).filter((q) => q.length >= 4))].slice(0, MAX_QUERIES);
    if (queries.length >= 2) return { queries, durationMs: Date.now() - started };
    return { queries: deterministicQueries(userText), durationMs: Date.now() - started, error: 'planner returned fewer than two usable queries' };
  } catch (error: any) {
    return {
      queries: deterministicQueries(userText),
      durationMs: Date.now() - started,
      error: `planner: ${String(error?.message || error || 'unknown error').slice(0, 240)}`,
    };
  }
}

function sourceFromRow(row: any, query: string): PrefetchedSource | null {
  if (!row || typeof row !== 'object') return null;
  const url = String(row.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const title = String(row.title || url).replace(/\s+/g, ' ').trim().slice(0, 300);
  const snippet = String(row.content || row.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 1_200);
  if (!snippet && !title) return null;
  const scoreRaw = Number(row.score);
  const score = Number.isFinite(scoreRaw) ? scoreRaw : 0;
  return { title, url, snippet, score, query };
}

async function tavilySearch(query: string): Promise<{ sources: PrefetchedSource[]; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
  try {
    const response = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!response.ok) return { sources: [], error: `tavily ${response.status}` };
    const data: any = await response.json();
    if (data?.source === 'mock_fallback' || data?.warning) {
      return { sources: [], error: String(data?.warning || 'tavily mock fallback') };
    }
    const rows = Array.isArray(data?.results) ? data.results : [];
    return { sources: rows.map((row: any) => sourceFromRow(row, query)).filter(Boolean) as PrefetchedSource[] };
  } catch (error: any) {
    return { sources: [], error: `tavily: ${String(error?.message || error || 'unknown error').slice(0, 200)}` };
  } finally {
    clearTimeout(timer);
  }
}

function buildEvidencePrompt(originalPrompt: string, queries: string[], sources: PrefetchedSource[]): string {
  const ranked = [...sources].sort((a, b) => b.score - a.score).slice(0, MAX_SOURCES);
  const blocks: string[] = [];
  for (let i = 0; i < ranked.length; i += 1) {
    const s = ranked[i];
    blocks.push(`[S${i + 1}] ${s.title}\nURL: ${s.url}\nRetrieved for: ${s.query}\nSnippet: ${s.snippet}`);
  }
  let evidence = blocks.join('\n\n');
  if (evidence.length > EVIDENCE_CHAR_LIMIT) evidence = evidence.slice(0, EVIDENCE_CHAR_LIMIT);
  return [
    originalPrompt,
    '',
    '[ATLAS PRE-RETRIEVED PUBLIC-WEB EVIDENCE]',
    'The items below are search-engine retrieval snippets, not automatically verified facts. Use them as evidence/leads only. Cross-check identity collisions and contradictions. Do not treat a relationship/location stated only in the user request as confirmed. Cite the exact URLs below for claims you retain. Ignore irrelevant or low-quality hits. Do not perform or narrate another search unless the evidence is insufficient.',
    '',
    `QUERY PLAN: ${queries.join(' | ')}`,
    '',
    evidence,
    '',
    '[SYNTHESIS INSTRUCTION]',
    'Answer the original user request directly in British English. Build the strongest evidence-led narrative supported by the retrieved material, clearly separating verified facts, plausible identity matches, user-supplied assertions and unresolved points. Prefer precision over filler.',
  ].join('\n');
}

export async function prefetchResearchEvidence(prompt: string): Promise<ResearchPrefetchResult> {
  const started = Date.now();
  const userText = latestUserText(prompt);
  const plan = await planQueries(userText);
  const retrievalStarted = Date.now();
  const errors: string[] = [];
  if (plan.error) errors.push(plan.error);
  const batches = await Promise.all(plan.queries.map((query) => tavilySearch(query)));
  const byUrl = new Map<string, PrefetchedSource>();
  for (const batch of batches) {
    if (batch.error) errors.push(batch.error);
    for (const source of batch.sources) {
      const existing = byUrl.get(source.url);
      if (!existing || source.score > existing.score) byUrl.set(source.url, source);
    }
  }
  const sources = [...byUrl.values()].sort((a, b) => b.score - a.score).slice(0, MAX_SOURCES);
  const usable = sources.length >= MIN_SOURCES;
  return {
    usable,
    queries: plan.queries,
    sources,
    evidencePrompt: usable ? buildEvidencePrompt(prompt, plan.queries, sources) : prompt,
    durationMs: Date.now() - started,
    plannerDurationMs: plan.durationMs,
    retrievalDurationMs: Date.now() - retrievalStarted,
    errors: errors.slice(0, 8),
  };
}

export function parallelRetrievalConfig() {
  return {
    enabled: process.env.ATLAS_PARALLEL_RETRIEVAL_ENABLED !== 'false',
    tavilyUrl: TAVILY_URL,
    maxQueries: MAX_QUERIES,
    maxSources: MAX_SOURCES,
    minSources: MIN_SOURCES,
    queryTimeoutMs: QUERY_TIMEOUT_MS,
  };
}
