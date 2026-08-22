/**
 * Host Unified Router — OpenAI-compatible chat via /api/chat/completions.
 *
 * Typical bases:
 *   - same host:     http://127.0.0.1:9999
 *   - Docker bridge: http://172.18.0.1:9999
 * External nginx vhost is environment-specific (see auth-gateway.conf).
 */

import { routeAtlasPrompt } from './routerFallbackBridge';
import {
  callHostUnifiedRouter,
  unifiedRouterAuthHeaders,
  unifiedRouterBase,
  unifiedRouterChatUrl,
  unifiedRouterConfigured,
  unifiedRouterModel,
} from './unifiedRouterHost';

export {
  callHostUnifiedRouter,
  unifiedRouterAuthHeaders,
  unifiedRouterBase,
  unifiedRouterChatUrl,
  unifiedRouterConfigured,
  unifiedRouterModel,
};

async function cloudFallback(
  prompt: string,
  opts?: {
    json?: boolean;
    maxTokens?: number;
    system?: string;
  }
): Promise<string> {
  const effectivePrompt = opts?.system
    ? `${opts.system}\n\nUSER TASK:\n${prompt}`
    : prompt;
  const result = await routeAtlasPrompt(effectivePrompt, {
    json: opts?.json,
    maxTokens: opts?.maxTokens,
  });
  return result.text;
}

/**
 * Call the unified router's OpenAI-compatible chat completions endpoint.
 *
 * The host router remains first choice when configured. If it is absent or
 * unhealthy, Atlas automatically continues through the cloud provider router.
 * Billing/quota exhaustion inside that router is provider-scoped and causes an
 * immediate move to the next provider rather than terminating the request.
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
  if (!unifiedRouterChatUrl(env)) {
    return cloudFallback(prompt, opts);
  }

  try {
    const hosted = await callHostUnifiedRouter(prompt, opts);
    return hosted.text;
  } catch {
    // Host/local router failure is not terminal. Continue via Atlas's provider
    // cascade so one dead endpoint, quota boundary or provider cannot kill a job.
    return cloudFallback(prompt, opts);
  }
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
