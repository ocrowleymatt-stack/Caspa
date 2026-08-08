/**
 * Host Unified Router — OpenAI-compatible chat via /api/chat/completions.
 *
 * Typical bases:
 *   - same host:     http://127.0.0.1:9999
 *   - Docker bridge: http://172.18.0.1:9999
 * External nginx vhost is environment-specific (see auth-gateway.conf).
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

/**
 * Call the unified router's OpenAI-compatible chat completions endpoint.
 */
export async function callUnifiedRouterChat(
  prompt: string,
  opts?: {
    json?: boolean;
    maxTokens?: number;
    timeoutMs?: number;
    system?: string;
    env?: NodeJS.ProcessEnv;
  }
): Promise<string> {
  const env = opts?.env || process.env;
  const url = unifiedRouterChatUrl(env);
  if (!url) throw new Error('UNIFIED_ROUTER_URL is not set');

  const timeoutMs = opts?.timeoutMs ?? (opts?.maxTokens && opts.maxTokens >= 4000 ? 180_000 : 120_000);
  const system =
    opts?.system ||
    'You are a proudly snobbish literary machine that always seeks a prize, prestige, or critical acclaim for its work. You help the user write elegantly from a developed idea, maintaining an intuitive process where the human still has a guiding hand.';

  const response = await fetch(url, {
    method: 'POST',
    headers: unifiedRouterAuthHeaders(env),
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: unifiedRouterModel(env),
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
    const err = await response.json().catch(async () => ({ text: await response.text().catch(() => '') }));
    throw new Error(`Unified router error (${response.status}): ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) {
    throw new Error('Unified router returned an empty completion');
  }
  return String(text);
}

/** Lightweight reachability probe for doctor / readiness (no secrets). */
export async function probeUnifiedRouter(
  env: NodeJS.ProcessEnv = process.env,
  timeoutMs = 4000
): Promise<{ configured: boolean; available: boolean; base: string | null }> {
  const base = unifiedRouterBase(env);
  if (!base) return { configured: false, available: false, base: null };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Prefer /health; fall back to base URL if the router has no health route.
    let ok = false;
    try {
      const health = await fetch(`${base}/health`, { signal: controller.signal });
      ok = health.ok;
    } catch {
      /* try base */
    }
    if (!ok) {
      const root = await fetch(base, { signal: controller.signal });
      // Any HTTP response (even 401/404) means the router process is up.
      ok = root.status > 0;
    }
    clearTimeout(timer);
    return { configured: true, available: ok, base };
  } catch {
    return { configured: true, available: false, base };
  }
}
