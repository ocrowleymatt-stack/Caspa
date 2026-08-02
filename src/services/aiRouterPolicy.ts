/**
 * Routing policy for the multi-provider AI fallback in /api/ai/call.
 *
 * Pure, side-effect-free helpers so the "which providers do we attempt, and in
 * what order" decision is testable without booting the Express server.
 */

export const AI_PROVIDERS = ['grok', 'openai', 'claude', 'gemini', 'venice'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Env var names (server + Vite aliases) that configure each provider. */
export const AI_PROVIDER_ENV_KEYS: Record<string, string[]> = {
  grok: ['GROK_API_KEY', 'XAI_API_KEY', 'VITE_GROK_API_KEY'],
  openai: ['OPENAI_API_KEY', 'VITE_OPENAI_API_KEY'],
  claude: ['ANTHROPIC_API_KEY', 'VITE_ANTHROPIC_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'VITE_GEMINI_API_KEY'],
  venice: ['VENICE_API_KEY', 'VITE_VENICE_API_KEY'],
};

/** True when at least one of a provider's API keys is present in the env. */
export function isProviderConfigured(
  provider: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const names = AI_PROVIDER_ENV_KEYS[provider] || [];
  return names.some((name) => Boolean(env[name] && String(env[name]).trim()));
}

/**
 * Decide the attempt order from an already-prioritised provider list.
 * - Drops providers with no API key (never worth attempting).
 * - Prefers providers not currently in cooldown (circuit breaker "open").
 * - If every configured provider is cooling down, attempts them anyway rather
 *   than hard-failing (a transient blip must not lock the whole router out).
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
  /** True while the provider is in its post-failure cooldown window. */
  isOpen(provider: string): boolean;
  recordFailure(provider: string): void;
  recordSuccess(provider: string): void;
}

/**
 * In-memory per-provider circuit breaker. After a failure, a provider is
 * skipped for `cooldownMs`; a success clears its cooldown immediately.
 * `now` is injectable for deterministic tests.
 */
export function createCircuitBreaker(
  cooldownMs = 30_000,
  now: () => number = () => Date.now(),
): CircuitBreaker {
  const openUntil: Record<string, number> = {};
  return {
    isOpen: (provider) => now() < (openUntil[provider] || 0),
    recordFailure: (provider) => {
      openUntil[provider] = now() + cooldownMs;
    },
    recordSuccess: (provider) => {
      delete openUntil[provider];
    },
  };
}
