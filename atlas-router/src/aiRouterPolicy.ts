/**
 * Routing policy for the multi-provider AI fallback in /api/ai/call.
 *
 * Pure, side-effect-free helpers so the "which providers do we attempt, and in
 * what order" decision is testable without booting the Express server.
 */

/** Prefer host/local routes when configured, then direct cloud providers. */
export const AI_PROVIDERS = ['unified', 'ollama', 'grok', 'openai', 'claude', 'gemini', 'venice'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Env var names (server + Vite aliases) that configure each provider. */
export const AI_PROVIDER_ENV_KEYS: Record<string, string[]> = {
  unified: ['UNIFIED_ROUTER_URL'],
  ollama: ['OLLAMA_URL'],
  grok: ['GROK_API_KEY', 'XAI_API_KEY', 'VITE_GROK_API_KEY'],
  openai: ['OPENAI_API_KEY', 'VITE_OPENAI_API_KEY'],
  claude: ['ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'VITE_GEMINI_API_KEY'],
  venice: ['VENICE_API_KEY', 'VITE_VENICE_API_KEY'],
};

/** True when at least one of a provider's API keys / URL is present in the env. */
export function isProviderConfigured(
  provider: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (provider === 'ollama') {
    return String(env.OLLAMA_DISABLED || '').toLowerCase() !== 'true' && env.OLLAMA_DISABLED !== '1';
  }
  const names = AI_PROVIDER_ENV_KEYS[provider] || [];
  return names.some((name) => Boolean(env[name] && String(env[name]).trim()));
}

/**
 * Decide the attempt order from an already-prioritised provider list.
 * - Drops providers with no API key (never worth attempting).
 * - Prefers providers not currently in cooldown.
 * - If every configured provider is cooling down, attempts them anyway rather
 *   than hard-failing; this keeps recovery possible after transient faults.
 */
export function selectAttemptOrder(
  ordered: string[],
  isConfigured: (p: string) => boolean,
  isInCooldown: (p: string) => boolean,
): { attempt: string[]; anyConfigured: boolean } {
  const configured = ordered.filter(isConfigured);
  if (configured.length === 0) return { attempt: [], anyConfigured: false };

  const ready = configured.filter((p) => !isInCooldown(p));
  return { attempt: ready.length > 0 ? ready : configured, anyConfigured: true };
}

export interface CircuitBreaker {
  isOpen(provider: string): boolean;
  recordFailure(provider: string, cooldownOverrideMs?: number): void;
  recordSuccess(provider: string): void;
}

/**
 * In-memory per-provider circuit breaker. Billing/credit failures can request a
 * much longer cooldown so the router does not waste time repeatedly calling a
 * provider that cannot possibly succeed until the account state changes.
 */
export function createCircuitBreaker(
  cooldownMs = 30_000,
  now: () => number = () => Date.now(),
): CircuitBreaker {
  const openUntil: Record<string, number> = {};
  return {
    isOpen: (provider) => now() < (openUntil[provider] || 0),
    recordFailure: (provider, cooldownOverrideMs) => {
      openUntil[provider] = now() + (cooldownOverrideMs || cooldownMs);
    },
    recordSuccess: (provider) => {
      delete openUntil[provider];
    },
  };
}

export const sharedCircuitBreaker: CircuitBreaker = createCircuitBreaker(
  Number(process.env.AI_PROVIDER_COOLDOWN_MS) || 30_000,
);
