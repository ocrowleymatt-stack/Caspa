/**
 * Host Unified Router client — OpenAI-compatible chat only.
 * No Atlas cloud fallback here. Callers that need the full cascade use
 * callUnifiedRouterChat or callWithProviderFailover.
 */

export function unifiedRouterBase(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = (env.UNIFIED_ROUTER_URL || '').trim().replace(/\/$/, '');
  return raw || null;
}

export function unifiedRouterConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(unifiedRouterBase(env));
}

export function unifiedRouterChatUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const base = unifiedRouterBase(env);
  return base ? `${base}/api/chat/completions` : null;
}

export function unifiedRouterAuthHeaders(
  env: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = (
    env.UNIFIED_ROUTER_API_KEY ||
    env.UNIFIED_ROUTER_TOKEN ||
    env.UNIFIED_ROUTER_BEARER ||
    ''
  ).trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function unifiedRouterModel(env: NodeJS.ProcessEnv = process.env): string {
  return (env.UNIFIED_ROUTER_MODEL || 'llama3.2').trim() || 'llama3.2';
}

export const UNIFIED_ROUTER_SYSTEM =
  'You are a proudly snobbish literary machine that always seeks a prize, prestige, or critical acclaim for its work. You help the user write elegantly from a developed idea, maintaining an intuitive process where the human still has a guiding hand.';

export async function callHostUnifiedRouter(
  prompt: string,
  opts?: {
    json?: boolean;
    maxTokens?: number;
    timeoutMs?: number;
    system?: string;
    env?: NodeJS.ProcessEnv;
  }
): Promise<{ text: string; model: string }> {
  const env = opts?.env || process.env;
  const url = unifiedRouterChatUrl(env);
  if (!url) throw new Error('UNIFIED_ROUTER_URL is not set');

  const timeoutMs = opts?.timeoutMs ?? (opts?.maxTokens && opts.maxTokens >= 4000 ? 180_000 : 120_000);
  const system = opts?.system || UNIFIED_ROUTER_SYSTEM;
  const model = unifiedRouterModel(env);

  const response = await fetch(url, {
    method: 'POST',
    headers: unifiedRouterAuthHeaders(env),
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: opts?.json ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON.` : prompt,
        },
      ],
      max_tokens: opts?.maxTokens || 4096,
      temperature: 0.7,
      ...(opts?.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Unified router error (${response.status}): ${raw.slice(0, 1000)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) {
    throw new Error('Unified router returned an empty completion');
  }
  return { text: String(text), model };
}
