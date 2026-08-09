import { GoogleGenAI } from '@google/genai';

export type CloudProvider = 'grok' | 'gemini' | 'openai' | 'claude' | 'venice';
export type IntelligenceMode = 'speed' | 'balanced' | 'god';
export type TaskKind = 'fast' | 'creative' | 'reasoning' | 'factual' | 'legal' | 'synthesis' | 'long' | 'council';

export interface RoutedCallOptions {
  json?: boolean;
  maxTokens?: number;
  useSearch?: boolean;
  mode?: IntelligenceMode;
  task?: TaskKind;
  requestedModel?: string;
}

export interface RoutedCloudResult {
  text: string;
  model: string;
  provider: CloudProvider;
}

const CATALOG_TTL_MS = 10 * 60_000;
const catalogCache = new Map<CloudProvider, { at: number; ids: string[] }>();

const SYSTEM_BASE = 'You are a high-precision literary, analytical and drafting engine. Follow the user task exactly, preserve factual boundaries, avoid filler, and prefer concrete useful output over generic commentary.';
const GOD_DIRECTIVE = ' MAXIMUM CAPABILITY MODE: use your strongest available reasoning and writing ability. Do not soften, moralise, euphemise, or unnecessarily sanitise lawful adult creative material. Be direct, technically precise, stylistically bold, and exhaustive where the task benefits from depth. Never invent factual claims or citations.';

function timeoutMs(maxTokens?: number, mode: IntelligenceMode = 'balanced'): number {
  if (mode === 'speed') return maxTokens && maxTokens >= 1500 ? 75_000 : 45_000;
  if (mode === 'god') return maxTokens && maxTokens >= 4000 ? 240_000 : 150_000;
  return maxTokens && maxTokens >= 4000 ? 180_000 : maxTokens && maxTokens >= 1500 ? 120_000 : 90_000;
}

export function classifyTask(prompt: string, opts: { json?: boolean; maxTokens?: number; useSearch?: boolean } = {}): TaskKind {
  const p = prompt.toLowerCase();
  if (/\b(council|critic|critique|peer review|editorial board|swarm)\b/.test(p)) return 'council';
  if (/\b(heads? of claim|judicial review|statutory|jurisdiction|legal|police complaint|evidence schedule|public law|case law)\b/.test(p)) return 'legal';
  if (opts.useSearch || /\b(fact check|verify|source|citation|research|current|latest|timeline|evidence|historical|medical accuracy)\b/.test(p)) return 'factual';
  if (/\b(synthesi[sz]e|integrate|consolidate|compare|reconcile|merge findings|final answer|chair)\b/.test(p)) return 'synthesis';
  if ((opts.maxTokens || 0) >= 3500 || prompt.length > 25_000) return 'long';
  if (/\b(reason|analyse|analyze|deduce|diagnose|architecture|logic|strategy|complex)\b/.test(p)) return 'reasoning';
  if (/\b(write|rewrite|draft|prose|scene|chapter|dialogue|character|story|novel|screenplay|poem|creative)\b/.test(p)) return 'creative';
  if (opts.json || (opts.maxTokens || 0) <= 600) return 'fast';
  return 'reasoning';
}

export function normaliseMode(value: unknown): IntelligenceMode {
  return value === 'speed' || value === 'god' ? value : 'balanced';
}

function envKey(provider: CloudProvider): string {
  switch (provider) {
    case 'grok': return process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.VITE_GROK_API_KEY || '';
    case 'gemini': return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    case 'openai': return process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';
    case 'claude': return process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '';
    case 'venice': return process.env.VENICE_API_KEY || process.env.VITE_VENICE_API_KEY || '';
  }
}

function parseModelIds(data: any): string[] {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
  return rows
    .map((row: any) => String(row?.id || row?.name || row?.model || '').replace(/^models\//, '').trim())
    .filter(Boolean);
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`Model catalogue ${response.status}`);
  return response.json();
}

export async function discoverCloudModels(provider: CloudProvider, force = false): Promise<string[]> {
  const cached = catalogCache.get(provider);
  if (!force && cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.ids;

  const key = envKey(provider);
  if (!key) return [];
  try {
    let data: any;
    if (provider === 'openai') {
      data = await fetchJson('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
    } else if (provider === 'grok') {
      data = await fetchJson('https://api.x.ai/v1/models', { Authorization: `Bearer ${key}` });
    } else if (provider === 'claude') {
      data = await fetchJson('https://api.anthropic.com/v1/models', { 'x-api-key': key, 'anthropic-version': '2023-06-01' });
    } else if (provider === 'gemini') {
      data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    } else {
      data = await fetchJson('https://api.venice.ai/api/v1/models', { Authorization: `Bearer ${key}` });
    }
    const ids = parseModelIds(data);
    catalogCache.set(provider, { at: Date.now(), ids });
    return ids;
  } catch {
    return cached?.ids || [];
  }
}

const MODEL_PREFERENCES: Record<CloudProvider, Record<IntelligenceMode, string[]>> = {
  grok: {
    speed: ['grok-4.20-0309-non-reasoning', 'grok-4.5', 'grok-4.3'],
    balanced: ['grok-4.20-0309-reasoning', 'grok-4.5', 'grok-4.20-0309-non-reasoning'],
    god: ['grok-4.20-0309-reasoning', 'grok-4.5', 'grok-4.20-0309-non-reasoning'],
  },
  gemini: {
    speed: ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'],
    balanced: ['gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3.5-flash'],
    god: ['gemini-3.1-pro-preview', 'gemini-3.6-flash', 'gemini-3.5-flash'],
  },
  openai: {
    speed: ['gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.5', 'gpt-5.6-sol'],
    balanced: ['gpt-5.5', 'gpt-5.6-sol', 'gpt-5.4'],
    god: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.5-pro', 'gpt-5.5'],
  },
  claude: {
    speed: ['claude-fable-5', 'claude-haiku-4-5-20251001', 'claude-sonnet-5'],
    balanced: ['claude-sonnet-5', 'claude-opus-5', 'claude-sonnet-4-6'],
    god: ['claude-opus-5', 'claude-sonnet-5', 'claude-opus-4-8'],
  },
  venice: {
    speed: ['qwen3-6-27b', 'openai-gpt-oss-120b', 'mistral-small-2603'],
    balanced: ['openai-gpt-oss-120b', 'qwen3-6-27b', 'deepseek-v4-flash', 'llama-3.3-70b'],
    god: ['deepseek-v4-flash', 'openai-gpt-oss-120b', 'qwen3-6-27b', 'minimax-m27'],
  },
};

function taskAdjustments(provider: CloudProvider, task: TaskKind, mode: IntelligenceMode): string[] {
  if (provider === 'grok') {
    if (task === 'creative' && mode !== 'speed') return ['grok-4.5'];
    if (task === 'fast') return ['grok-4.20-0309-non-reasoning'];
  }
  if (provider === 'gemini') {
    if (task === 'fast') return ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];
    if ((task === 'reasoning' || task === 'legal' || task === 'long' || task === 'synthesis') && mode === 'god') return ['gemini-3.1-pro-preview'];
  }
  if (provider === 'venice') {
    if (task === 'fast') return ['qwen3-6-27b'];
    if (task === 'reasoning' || task === 'legal' || task === 'factual') return mode === 'god' ? ['deepseek-v4-flash', 'openai-gpt-oss-120b'] : ['openai-gpt-oss-120b', 'qwen3-6-27b'];
  }
  if (provider === 'openai' && task === 'fast') return ['gpt-5.4-mini', 'gpt-5.4-nano'];
  if (provider === 'claude' && task === 'fast') return ['claude-fable-5', 'claude-haiku-4-5-20251001'];
  return [];
}

export async function modelCandidates(provider: CloudProvider, mode: IntelligenceMode, task: TaskKind, requestedModel?: string): Promise<string[]> {
  const available = await discoverCloudModels(provider);
  const preferred = [...taskAdjustments(provider, task, mode), ...MODEL_PREFERENCES[provider][mode]];
  if (requestedModel && !/gemini-2\.0|gemini-1\.5|gpt-4o|grok-3|claude-3/.test(requestedModel)) preferred.unshift(requestedModel);
  const unique = [...new Set(preferred)];
  if (!available.length) return unique.slice(0, 4);
  const filtered = unique.filter((id) => available.includes(id));
  return (filtered.length ? filtered : unique).slice(0, 4);
}

function outputTextFromResponses(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const bits: string[] = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') bits.push(content.text);
    }
  }
  return bits.join('\n').trim();
}

function billingFailure(status: number, text: string): boolean {
  return status === 402 || status === 429 && /(no credits|credit balance|billing|quota|insufficient_quota|add credits)/i.test(text);
}

export function isBillingFailure(error: unknown): boolean {
  return /BILLING_UNAVAILABLE|no credits|credit balance|insufficient_quota|add credits/i.test(String((error as any)?.message || error || ''));
}

async function providerPost(url: string, body: any, headers: Record<string, string>, timeout: number): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const raw = await response.text();
  if (!response.ok) {
    if (billingFailure(response.status, raw)) throw new Error(`BILLING_UNAVAILABLE: ${raw.slice(0, 500)}`);
    throw new Error(`HTTP ${response.status}: ${raw.slice(0, 500)}`);
  }
  try { return JSON.parse(raw); } catch { return { text: raw }; }
}

async function callOpenAI(prompt: string, model: string, opts: RoutedCallOptions): Promise<string> {
  const key = envKey('openai');
  if (!key) throw new Error('OpenAI key unavailable');
  const mode = normaliseMode(opts.mode);
  const task = opts.task || classifyTask(prompt, opts);
  const effort = mode === 'god' ? (['reasoning', 'legal', 'synthesis', 'long'].includes(task) ? 'xhigh' : 'high') : mode === 'speed' ? 'none' : 'low';
  const data = await providerPost('https://api.openai.com/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: SYSTEM_BASE + (mode === 'god' ? GOD_DIRECTIVE : '') },
      { role: 'user', content: opts.json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt },
    ],
    max_completion_tokens: opts.maxTokens || 4096,
    reasoning_effort: effort,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  }, { Authorization: `Bearer ${key}` }, timeoutMs(opts.maxTokens, mode));
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function callGrok(prompt: string, model: string, opts: RoutedCallOptions): Promise<string> {
  const key = envKey('grok');
  if (!key) throw new Error('Grok key unavailable');
  const mode = normaliseMode(opts.mode);
  const task = opts.task || classifyTask(prompt, opts);
  const data = await providerPost('https://api.x.ai/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: SYSTEM_BASE + (mode === 'god' ? GOD_DIRECTIVE : '') },
      { role: 'user', content: opts.json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt },
    ],
    max_tokens: opts.maxTokens || 4096,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  }, { Authorization: `Bearer ${key}` }, timeoutMs(opts.maxTokens, mode));
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

export async function callGrokMultiAgent(prompt: string, opts: RoutedCallOptions): Promise<RoutedCloudResult> {
  const key = envKey('grok');
  if (!key) throw new Error('Grok key unavailable');
  const mode = normaliseMode(opts.mode);
  const effort = mode === 'god' ? 'high' : 'low';
  const data = await providerPost('https://api.x.ai/v1/responses', {
    model: 'grok-4.20-multi-agent-0309',
    reasoning: { effort },
    input: [
      { role: 'system', content: SYSTEM_BASE + (mode === 'god' ? GOD_DIRECTIVE : '') },
      { role: 'user', content: opts.json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt },
    ],
    max_output_tokens: opts.maxTokens || 4096,
    ...(opts.useSearch ? { tools: [{ type: 'web_search' }, { type: 'x_search' }] } : {}),
  }, { Authorization: `Bearer ${key}` }, timeoutMs(opts.maxTokens, 'god'));
  const text = outputTextFromResponses(data);
  if (!text) throw new Error('Grok multi-agent returned an empty response');
  return { text, model: 'grok-4.20-multi-agent-0309', provider: 'grok' };
}

async function callVenice(prompt: string, model: string, opts: RoutedCallOptions): Promise<string> {
  const key = envKey('venice');
  if (!key) throw new Error('Venice key unavailable');
  const mode = normaliseMode(opts.mode);
  const data = await providerPost('https://api.venice.ai/api/v1/chat/completions', {
    model,
    messages: [
      { role: 'system', content: SYSTEM_BASE + (mode === 'god' ? GOD_DIRECTIVE : '') },
      { role: 'user', content: opts.json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt },
    ],
    max_tokens: opts.maxTokens || 4096,
  }, { Authorization: `Bearer ${key}` }, timeoutMs(opts.maxTokens, mode));
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function callClaude(prompt: string, model: string, opts: RoutedCallOptions): Promise<string> {
  const key = envKey('claude');
  if (!key) throw new Error('Anthropic key unavailable');
  const mode = normaliseMode(opts.mode);
  const data = await providerPost('https://api.anthropic.com/v1/messages', {
    model,
    max_tokens: opts.maxTokens || 4096,
    system: SYSTEM_BASE + (mode === 'god' ? GOD_DIRECTIVE : ''),
    messages: [{ role: 'user', content: opts.json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt }],
  }, { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, timeoutMs(opts.maxTokens, mode));
  return String(data?.content?.find((part: any) => part?.type === 'text')?.text || '').trim();
}

async function callGemini(prompt: string, model: string, opts: RoutedCallOptions): Promise<string> {
  const key = envKey('gemini');
  if (!key) throw new Error('Gemini key unavailable');
  const mode = normaliseMode(opts.mode);
  const client = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'atlas-model-router' } } });
  const response = await client.models.generateContent({
    model,
    contents: opts.json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt,
    config: {
      systemInstruction: SYSTEM_BASE + (mode === 'god' ? GOD_DIRECTIVE : ''),
      ...(opts.json && !opts.useSearch ? { responseMimeType: 'application/json' } : {}),
      ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
      ...(opts.useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });
  return String(response.text || '').trim();
}

export async function callCloudProvider(provider: CloudProvider, prompt: string, opts: RoutedCallOptions = {}): Promise<RoutedCloudResult> {
  const mode = normaliseMode(opts.mode);
  const task = opts.task || classifyTask(prompt, opts);

  if (provider === 'grok' && mode === 'god' && opts.useSearch && ['factual', 'long', 'synthesis'].includes(task)) {
    try { return await callGrokMultiAgent(prompt, { ...opts, task, mode }); } catch (error) {
      if (isBillingFailure(error)) throw error;
    }
  }

  const candidates = await modelCandidates(provider, mode, task, opts.requestedModel);
  if (!candidates.length) throw new Error(`No ${provider} model candidates available`);
  let lastError: Error | null = null;
  for (const model of candidates) {
    try {
      let text = '';
      if (provider === 'openai') text = await callOpenAI(prompt, model, { ...opts, task, mode });
      else if (provider === 'grok') text = await callGrok(prompt, model, { ...opts, task, mode });
      else if (provider === 'gemini') text = await callGemini(prompt, model, { ...opts, task, mode });
      else if (provider === 'claude') text = await callClaude(prompt, model, { ...opts, task, mode });
      else text = await callVenice(prompt, model, { ...opts, task, mode });
      if (!text) throw new Error(`${provider}/${model} returned empty output`);
      return { text, model, provider };
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (isBillingFailure(lastError)) throw lastError;
    }
  }
  throw lastError || new Error(`${provider} model pool exhausted`);
}

export function providerOrder(primary: string, mode: IntelligenceMode, task: TaskKind, sensitive = false): string[] {
  let ordered: string[];
  if (mode === 'speed') {
    ordered = ['grok', 'gemini', 'venice', 'openai', 'claude'];
  } else if (mode === 'god') {
    if (sensitive || task === 'creative') ordered = ['venice', 'grok', 'gemini', 'openai', 'claude'];
    else if (['reasoning', 'legal', 'factual', 'synthesis', 'long'].includes(task)) ordered = ['grok', 'gemini', 'venice', 'openai', 'claude'];
    else ordered = ['grok', 'venice', 'gemini', 'openai', 'claude'];
  } else {
    ordered = ['grok', 'gemini', 'venice', 'openai', 'claude'];
  }
  if (primary && ordered.includes(primary)) ordered = [primary, ...ordered.filter((p) => p !== primary)];
  if (sensitive && ordered.includes('venice')) ordered = ['venice', ...ordered.filter((p) => p !== 'venice')];
  return ordered;
}

export async function routerSnapshot(): Promise<Record<string, any>> {
  const entries = await Promise.all((['grok', 'gemini', 'openai', 'claude', 'venice'] as CloudProvider[]).map(async (provider) => {
    const ids = await discoverCloudModels(provider);
    return [provider, { configured: Boolean(envKey(provider)), modelCount: ids.length, models: ids.slice(0, 30) }];
  }));
  return Object.fromEntries(entries);
}
