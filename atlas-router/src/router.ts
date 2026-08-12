import {
  callCloudProvider,
  classifyTask,
  isBillingFailure,
  normaliseMode,
  providerOrder,
  type CloudProvider,
  type IntelligenceMode,
  type RoutedCallOptions,
  type TaskKind,
} from './cloudModelRouter';
import {
  isProviderConfigured,
  selectAttemptOrder,
  sharedCircuitBreaker,
} from './aiRouterPolicy';

export type AtlasProvider = CloudProvider;

export interface RouterFailoverAttempt {
  provider: string;
  error: string;
  billingFailure: boolean;
  configurationFailure?: boolean;
  skipped?: boolean;
  durationMs?: number;
}

export interface RouterFailoverResult {
  text: string;
  model: string;
  provider: AtlasProvider;
  attempts: RouterFailoverAttempt[];
  durationMs: number;
  providerDurationMs: number;
}

export interface RouterFailoverOptions extends RoutedCallOptions {
  primaryProvider?: string;
  sensitive?: boolean;
  strictProvider?: boolean;
}

const BILLING_COOLDOWN_MS = Number(process.env.AI_BILLING_COOLDOWN_MS) || 15 * 60_000;
const AUTH_COOLDOWN_MS = Number(process.env.AI_PROVIDER_AUTH_COOLDOWN_MS) || 60 * 60_000;
const TRANSIENT_COOLDOWN_MS = Number(process.env.AI_PROVIDER_COOLDOWN_MS) || 60_000;

export const WEB_SEARCH_CAPABLE_PROVIDERS = ['venice', 'gemini', 'grok'] as const;
const WEB_SEARCH_CAPABLE_PROVIDER_SET = new Set<string>(WEB_SEARCH_CAPABLE_PROVIDERS);

export function providerSupportsWebSearch(provider: string): boolean {
  return WEB_SEARCH_CAPABLE_PROVIDER_SET.has(String(provider || '').toLowerCase());
}

function isProviderConfigurationFailure(error: unknown): boolean {
  const message = String((error as any)?.message || error || '');
  return /api key (?:is )?not valid|invalid api key|incorrect api key|invalid_api_key|authentication failed|unauthori[sz]ed|HTTP 401\b/i.test(message);
}

/** Atlas-owned cloud failover. Local fail-soft belongs to OpenWebUI. */
export async function routeAtlasPrompt(
  prompt: string,
  opts: RouterFailoverOptions = {},
): Promise<RouterFailoverResult> {
  const routeStartedAt = Date.now();
  const mode: IntelligenceMode = normaliseMode(opts.mode);
  const task: TaskKind = opts.task || classifyTask(prompt, opts);
  const primary = String(opts.primaryProvider || '').trim();
  const unfilteredPreferred = opts.strictProvider && primary
    ? [primary]
    : providerOrder(primary, mode, task, Boolean(opts.sensitive));
  const attempts: RouterFailoverAttempt[] = [];
  const webRequired = Boolean(opts.useSearch);

  if (webRequired && opts.strictProvider && primary && !providerSupportsWebSearch(primary)) {
    throw new Error(`Atlas web retrieval unavailable — strict provider "${primary}" has no wired web-search capability.`);
  }

  const preferred = webRequired
    ? unfilteredPreferred.filter((provider) => providerSupportsWebSearch(provider))
    : unfilteredPreferred;

  if (webRequired) {
    for (const provider of unfilteredPreferred) {
      if (!providerSupportsWebSearch(provider)) {
        attempts.push({ provider, error: 'Skipped: provider has no wired Atlas web-search tool', billingFailure: false, skipped: true, durationMs: 0 });
      }
    }
  }

  const { attempt: ordered, anyConfigured } = selectAttemptOrder(
    preferred,
    (provider) => isProviderConfigured(provider),
    (provider) => sharedCircuitBreaker.isOpen(provider),
  );

  if (!anyConfigured) {
    for (const provider of preferred) {
      attempts.push({ provider, error: webRequired ? 'Search-capable provider not configured' : 'Provider not configured', billingFailure: false, skipped: true, durationMs: 0 });
    }
  }

  for (const providerName of ordered) {
    const provider = providerName as CloudProvider;
    const providerStartedAt = Date.now();
    try {
      const result = await callCloudProvider(provider, prompt, { ...opts, mode, task });
      const providerDurationMs = Date.now() - providerStartedAt;
      sharedCircuitBreaker.recordSuccess(provider);
      return {
        ...result,
        attempts,
        durationMs: Date.now() - routeStartedAt,
        providerDurationMs,
      };
    } catch (error: any) {
      const durationMs = Date.now() - providerStartedAt;
      const message = String(error?.message || error || 'Unknown provider failure');
      const billingFailure = isBillingFailure(error);
      const configurationFailure = isProviderConfigurationFailure(error);
      const cooldownMs = configurationFailure
        ? AUTH_COOLDOWN_MS
        : billingFailure
          ? BILLING_COOLDOWN_MS
          : TRANSIENT_COOLDOWN_MS;
      sharedCircuitBreaker.recordFailure(provider, cooldownMs);
      attempts.push({ provider, error: message, billingFailure, configurationFailure, durationMs });
    }
  }

  const summary = attempts.map((attempt) => `${attempt.provider}${attempt.skipped ? ' skipped' : ''}: ${attempt.error.slice(0, 180)}`).join(' | ');
  const prefix = webRequired ? 'Atlas web retrieval unavailable' : 'Atlas model pool exhausted';
  throw new Error(`${prefix}${summary ? ` — ${summary}` : ''}`);
}

export { classifyTask, normaliseMode } from './cloudModelRouter';
