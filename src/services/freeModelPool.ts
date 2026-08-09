/**
 * Dynamic zero/low-cost model pool.
 *
 * Atlas runs Ollama on a CPU-only host. Discovery remains broad, but automatic
 * execution deliberately favours the 7-10B models and task-specific matt-* aliases;
 * 27B models remain installed for manual/deep use without blocking interactive work.
 */

import {
  unifiedRouterAuthHeaders,
  unifiedRouterBase,
  unifiedRouterChatUrl,
  unifiedRouterModel,
} from './unifiedRouter';

export type FreeModelSource = 'ollama' | 'unified';

export interface DiscoveredModel {
  id: string;
  source: FreeModelSource;
  label?: string;
  ownedBy?: string;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  likelyFree: boolean;
  score: number;
}

const DISCOVERY_CACHE_MS = 60_000;
let discoveryCache: { at: number; models: DiscoveredModel[] } | null = null;

function ollamaBase(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.OLLAMA_URL || 'http://127.0.0.1:11434/api').trim().replace(/\/$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

function isChatCandidate(id: string): boolean {
  return !/(embed|embedding|rerank|whisper|speech|tts|transcri|vision-only|image|flux|stable-diffusion|sdxl)/i.test(id);
}

function sizePenalty(id: string, parameterSize = ''): number {
  const text = `${id} ${parameterSize}`.toLowerCase();
  if (/(70b|72b|32b|30b|27b|24b)/.test(text)) return -180;
  if (/(14b|13b)/.test(text)) return -50;
  if (/(7b|8b|9b|10b)/.test(text)) return 55;
  if (/(4b|3b)/.test(text)) return 45;
  return 0;
}

function qualityScore(id: string, ownedBy = '', parameterSize = ''): number {
  const lower = `${id} ${ownedBy}`.toLowerCase();
  let score = sizePenalty(id, parameterSize);
  if (lower.includes(':free')) score += 80;
  if (/(ollama|local|open-webui)/.test(lower)) score += 45;
  if (/qwen3\.5|qwen3/.test(lower)) score += 55;
  else if (/(mistral|gemma3|llama3\.3|llama3\.2|phi4|command-r|deepseek)/.test(lower)) score += 35;
  if (lower.includes('matt-')) score += 35;
  if (/(coder|code)/.test(lower)) score -= 8;
  return score;
}

function likelyFreeModel(id: string, ownedBy = ''): boolean {
  const lower = `${id} ${ownedBy}`.toLowerCase();
  if (lower.includes(':free')) return true;
  if (/(ollama|local|open-webui)/.test(lower)) return true;
  if (!id.includes('/') && /(qwen|llama|mistral|mixtral|gemma|deepseek|phi|yi|granite|command-r|neural-chat)/i.test(id)) return true;
  return false;
}

function uniqueBySourceAndId(models: DiscoveredModel[]): DiscoveredModel[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = `${model.source}:${model.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function discoverOllamaModels(env: NodeJS.ProcessEnv = process.env): Promise<DiscoveredModel[]> {
  if (String(env.OLLAMA_DISABLED || '').toLowerCase() === 'true' || env.OLLAMA_DISABLED === '1') return [];
  try {
    const response = await fetch(`${ollamaBase(env)}/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    const data = await response.json() as {
      models?: Array<{
        name?: string;
        model?: string;
        details?: { family?: string; parameter_size?: string; quantization_level?: string };
      }>;
    };
    return (data.models || [])
      .map((entry) => {
        const id = String(entry.name || entry.model || '').trim();
        return {
          id,
          source: 'ollama' as const,
          family: entry.details?.family,
          parameterSize: entry.details?.parameter_size,
          quantization: entry.details?.quantization_level,
          ownedBy: 'ollama',
          likelyFree: true,
          score: 100 + qualityScore(id, 'ollama', entry.details?.parameter_size || ''),
        };
      })
      .filter((entry) => Boolean(entry.id) && isChatCandidate(entry.id))
      .sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

function unifiedDiscoveryUrls(base: string): string[] {
  const clean = base.replace(/\/$/, '');
  const urls = [`${clean}/api/models`, `${clean}/v1/models`, `${clean}/models`];
  if (clean.endsWith('/v1')) urls.unshift(`${clean}/models`);
  return [...new Set(urls)];
}

function parseUnifiedModels(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.models)) return data.models;
  return [];
}

export async function discoverUnifiedModels(env: NodeJS.ProcessEnv = process.env): Promise<DiscoveredModel[]> {
  const base = unifiedRouterBase(env);
  if (!base) return [];
  const headers = unifiedRouterAuthHeaders(env);
  for (const url of unifiedDiscoveryUrls(base)) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
      if (!response.ok) continue;
      const data = await response.json();
      const parsed = parseUnifiedModels(data)
        .map((entry: any) => {
          const id = String(entry?.id || entry?.name || entry?.model || '').trim();
          const ownedBy = String(entry?.owned_by || entry?.ownedBy || entry?.provider || entry?.info?.meta?.provider || '').trim();
          const free = likelyFreeModel(id, ownedBy);
          return {
            id,
            source: 'unified' as const,
            label: entry?.name || entry?.label,
            ownedBy,
            likelyFree: free,
            score: qualityScore(id, ownedBy) + (free ? 45 : 0),
          };
        })
        .filter((entry: DiscoveredModel) => Boolean(entry.id) && isChatCandidate(entry.id));
      if (parsed.length) return parsed.sort((a: DiscoveredModel, b: DiscoveredModel) => b.score - a.score);
    } catch {
      // Try the next catalogue shape.
    }
  }
  return [];
}

export async function discoverFreeModelPool(env: NodeJS.ProcessEnv = process.env, force = false): Promise<DiscoveredModel[]> {
  const now = Date.now();
  if (!force && discoveryCache && now - discoveryCache.at < DISCOVERY_CACHE_MS) return discoveryCache.models;
  const [ollama, unified] = await Promise.all([discoverOllamaModels(env), discoverUnifiedModels(env)]);
  const models = uniqueBySourceAndId([...ollama, ...unified]).sort((a, b) => b.score - a.score);
  discoveryCache = { at: now, models };
  return models;
}

export function clearFreeModelDiscoveryCache(): void {
  discoveryCache = null;
}

function specialistBoost(id: string, prompt: string): number {
  const p = prompt.toLowerCase();
  const model = id.toLowerCase();
  let score = 0;
  if (model.includes('matt-claims') && /\b(legal|claim|judicial|police|statutory|complaint|evidence|public law|ground|remedy)\b/.test(p)) score += 170;
  if (model.includes('matt-correspondence') && /\b(email|letter|correspondence|reply|write to|complaint letter|deadline|recipient)\b/.test(p)) score += 170;
  if (model.includes('matt-synthesizer') && /\b(timeline|synthesi[sz]e|evidence|cross-reference|contradiction|gap analysis|chronolog)\b/.test(p)) score += 170;
  if (/qwen3\.5.*9b/.test(model)) score += 100;
  if (model.startsWith('mistral')) score += 70;
  if (/(27b|26\.9b|27\.8b)/.test(`${model}`)) score -= 200;
  return score;
}

export async function callOllamaModelHunt(
  prompt: string,
  opts: {
    json?: boolean;
    maxTokens?: number;
    system?: string;
    env?: NodeJS.ProcessEnv;
    maxAttempts?: number;
    mode?: 'speed' | 'balanced' | 'god';
  } = {},
): Promise<{ text: string; model: string }> {
  const env = opts.env || process.env;
  const mode = opts.mode || 'balanced';
  const discovered = await discoverOllamaModels(env);
  if (!discovered.length) throw new Error('No local Ollama chat models are currently available');

  // Heavy 27B models are intentionally excluded from automatic interactive routing on
  // this CPU-only host. They remain installed and available for deliberate manual jobs.
  const candidates = discovered
    .map((model) => ({ ...model, runScore: model.score + specialistBoost(model.id, prompt) }))
    .filter((model) => !/(27b|26\.9b|27\.8b)/i.test(`${model.id} ${model.parameterSize || ''}`))
    .sort((a, b) => b.runScore - a.runScore)
    .slice(0, Math.max(1, opts.maxAttempts || 2));

  if (!candidates.length) throw new Error('No interactive-size local Ollama models are available');
  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const localTimeout = mode === 'speed' ? 30_000 : mode === 'god' ? 60_000 : 45_000;
      const response = await fetch(`${ollamaBase(env)}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(localTimeout),
        body: JSON.stringify({
          model: candidate.id,
          prompt: opts.json ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON.` : prompt,
          system: opts.system || 'You are a precise, high-quality literary and analytical assistant. Never invent facts.',
          stream: false,
          keep_alive: '30m',
          ...(opts.json ? { format: 'json' } : {}),
          options: {
            num_ctx: mode === 'god' ? 12288 : 8192,
            num_predict: Math.min(opts.maxTokens || 1200, mode === 'speed' ? 700 : 1800),
            temperature: opts.json ? 0.2 : mode === 'god' ? 0.55 : 0.4,
            top_p: 0.9,
            repeat_penalty: 1.05,
          },
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Ollama ${candidate.id} failed (${response.status}): ${detail.slice(0, 240)}`);
      }
      const data = await response.json() as { response?: string; model?: string };
      const text = String(data.response || '').trim();
      if (!text) throw new Error(`Ollama ${candidate.id} returned an empty response`);
      return { text, model: data.model || candidate.id };
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error('Interactive local model pool exhausted');
}

export async function callUnifiedModelHunt(
  prompt: string,
  opts: {
    json?: boolean;
    maxTokens?: number;
    timeoutMs?: number;
    system?: string;
    env?: NodeJS.ProcessEnv;
    maxAttempts?: number;
  } = {},
): Promise<{ text: string; model: string }> {
  const env = opts.env || process.env;
  const url = unifiedRouterChatUrl(env);
  if (!url) throw new Error('UNIFIED_ROUTER_URL is not set');

  const configured = unifiedRouterModel(env);
  const discovered = await discoverUnifiedModels(env);
  const freeCandidates = discovered.filter((model) => model.likelyFree).map((model) => model.id);
  const candidates = [...new Set([configured, ...freeCandidates])].slice(0, Math.max(1, opts.maxAttempts || 3));
  const timeout = opts.timeoutMs ?? 60_000;
  let lastError: Error | null = null;

  for (const model of candidates) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: unifiedRouterAuthHeaders(env),
        signal: AbortSignal.timeout(timeout),
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: opts.system || 'You are a precise, high-quality literary and analytical assistant.' },
            { role: 'user', content: opts.json ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON.` : prompt },
          ],
          max_tokens: opts.maxTokens || 4096,
          temperature: 0.5,
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Unified model ${model} failed (${response.status}): ${detail.slice(0, 300)}`);
      }
      const data = await response.json();
      const text = String(data?.choices?.[0]?.message?.content || '').trim();
      if (!text) throw new Error(`Unified model ${model} returned an empty completion`);
      return { text, model };
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error('Unified model pool exhausted');
}
