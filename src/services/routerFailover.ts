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
import { callOllamaModelHunt } from './freeModelPool';
import {
  isProviderConfigured,
  selectAttemptOrder,
  sharedCircuitBreaker,
} from './aiRouterPolicy';
import { callWithNexusRecovery } from './nexusRecovery';
import {
  callHostUnifiedRouter,
  unifiedRouterConfigured,
} from './unifiedRouterHost';

export type AtlasProvider = CloudProvider | 'ollama' | 'unified';

export interface RouterFailoverAttempt {
  provider: string;
  error: string;
  billingFailure: boolean;
  skipped?: boolean;
}

export interface RouterFailoverResult {
  text: string;
  model: string;
  provider: AtlasProvider;
  attempts: RouterFailoverAttempt[];
}

export interface RouterFailoverOptions extends RoutedCallOptions {
  primaryProvider?: string;
  sensitive?: boolean;
  disableLocalFallback?: boolean;
  strictProvider?: boolean;
  /**
   * User-facing requests should not die merely because a selected provider has
   * exhausted its account credit. Keep this true by default so Atlas can move to
   * another healthy provider. Set false only for provider diagnostics/tests that
   * genuinely require a hard single-provider result.
   */
  allowBillingFailover?: boolean;
}

const BILLING_COOLDOWN_MS = Number(process.env.AI_BILLING_COOLDOWN_MS) || 15 * 60_000;
const TRANSIENT_COOLDOWN_MS = Number(process.env.AI_PROVIDER_COOLDOWN_MS) || 60_000;

/**
 * Providers that have a real web-search tool binding in cloudModelRouter.ts.
 * This is deliberately explicit: a provider being able to answer a prompt is
 * not the same thing as being able to satisfy a web-required request.
 */
export const WEB_SEARCH_CAPABLE_PROVIDERS = ['venice', 'gemini', 'grok'] as const;
const WEB_SEARCH_CAPABLE_PROVIDER_SET = new Set<string>(WEB_SEARCH_CAPABLE_PROVIDERS);

export function providerSupportsWebSearch(provider: string): boolean {
  return WEB_SEARCH_CAPABLE_PROVIDER_SET.has(String(provider || '').toLowerCase());
}

function unifiedHostTimeoutMs(mode: IntelligenceMode, task: TaskKind, maxTokens?: number): number {
  if (task === 'council') {
    if (mode === 'speed') return 10_000;
    if (mode === 'god') return 20_000;
    return 16_000;
  }
  if (maxTokens && maxTokens >= 4000) return 180_000;
  return 120_000;
}

function shouldTryUnifiedRouter(opts: RouterFailoverOptions, primary: string, webRequired: boolean): boolean {
  if (!unifiedRouterConfigured()) return false;
  if (webRequired && primary !== 'unified') return false;
  if (opts.strictProvider && primary && primary !== 'unified') return false;
  return true;
}

function recoveryContext(mode: IntelligenceMode, task: TaskKind, webRequired: boolean, provider: string) {
  return { mode, task, webRequired, provider };
}

/**
 * Canonical Atlas failover path.
 *
 * - Host Unified Router (Atlas) is first when UNIFIED_ROUTER_URL is set.
 * - Every executable provider/local attempt is wrapped by the Nexus recovery
 *   fabric. Safe transient failures receive one bounded retry only when Nexus
 *   classifies them as retryable; persistent failures then continue through the
 *   existing circuit-breaker/fallback chain.
 * - Only configured, healthy cloud providers are attempted after that.
 * - Billing/quota failures quarantine a provider for longer than transient errors.
 * - Successful providers are immediately restored to healthy state.
 * - Explicit strict-provider requests remain strict for ordinary model/runtime
 *   failures, but billing exhaustion automatically falls through to another
 *   healthy provider unless allowBillingFailover is explicitly false. A dead
 *   credit balance must not take the whole Caspa application down.
 * - Web-required calls are capability-gated: only providers with a wired search
 *   tool may participate, and local Ollama fallback is forbidden.
 * - If every cloud provider is unavailable, Atlas enters the dynamic Ollama pool
 *   only for non-search work unless local fallback was otherwise disabled.
 */
export async function callWithProviderFailover(
  prompt: string,
  opts: RouterFailoverOptions = {},
): Promise<RouterFailoverResult> {
  const mode: IntelligenceMode = normaliseMode(opts.mode);
  const task: TaskKind = opts.task || classifyTask(prompt, opts);
  const primary = String(opts.primaryProvider || '').trim();
  const unfilteredPreferred = opts.strictProvider && primary && primary !== 'unified'
    ? [primary]
    : providerOrder(primary, mode, task, Boolean(opts.sensitive));
  const attempts: RouterFailoverAttempt[] = [];
  const webRequired = Boolean(opts.useSearch);
  let localAttempted = false;

  if (webRequired && opts.strictProvider && primary && primary !== 'unified' && !providerSupportsWebSearch(primary)) {
    throw new Error(
      `Atlas web retrieval unavailable — strict provider "${primary}" has no wired web-search capability.`,
    );
  }

  if (shouldTryUnifiedRouter(opts, primary, webRequired)) {
    try {
      const hosted = await callWithNexusRecovery(
        () => callHostUnifiedRouter(prompt, {
          json: opts.json,
          maxTokens: opts.maxTokens,
          timeoutMs: unifiedHostTimeoutMs(mode, task, opts.maxTokens),
        }),
        {
          operation: 'router.unified',
          safeToRetry: true,
          context: recoveryContext(mode, task, webRequired, 'unified'),
        },
      );
      return { text: hosted.text, model: hosted.model, provider: 'unified', attempts };
    } catch (error: any) {
      attempts.push({
        provider: 'unified',
        error: String(error?.message || error || 'Unified router failure'),
        billingFailure: false,
      });
      if (opts.strictProvider && primary === 'unified') {
        const summary = attempts.map((attempt) => `${attempt.provider}: ${attempt.error.slice(0, 180)}`).join(' | ');
        throw new Error(`Atlas model pool exhausted — ${summary}`);
      }
    }
  }

  const localFirst = !webRequired
    && !opts.disableLocalFallback
    && !opts.strictProvider
    && process.env.AI_LOCAL_FIRST !== 'false'
    && (mode === 'speed' || task === 'fast' || task === 'council');

  if (localFirst) {
    localAttempted = true;
    try {
      const local = await callWithNexusRecovery(
        () => callOllamaModelHunt(prompt, {
          json: opts.json,
          maxTokens: opts.maxTokens,
          mode,
        }),
        {
          operation: 'router.ollama.local-first',
          safeToRetry: true,
          context: recoveryContext(mode, task, webRequired, 'ollama'),
        },
      );
      return { text: local.text, model: local.model, provider: 'ollama', attempts };
    } catch (error: any) {
      attempts.push({
        provider: 'ollama',
        error: String(error?.message || error || 'Local model pool failure'),
        billingFailure: false,
      });
    }
  }

  const preferred = webRequired
    ? unfilteredPreferred.filter((provider) => providerSupportsWebSearch(provider))
    : unfilteredPreferred;

  if (webRequired) {
    for (const provider of unfilteredPreferred) {
      if (!providerSupportsWebSearch(provider)) {
        attempts.push({
          provider,
          error: 'Skipped: provider has no wired Atlas web-search tool',
          billingFailure: false,
          skipped: true,
        });
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
      attempts.push({
        provider,
        error: webRequired ? 'Search-capable provider not configured' : 'Provider not configured',
        billingFailure: false,
        skipped: true,
      });
    }
  }

  for (const providerName of ordered) {
    const provider = providerName as CloudProvider;
    try {
      const result = await callWithNexusRecovery(
        () => callCloudProvider(provider, prompt, { ...opts, mode, task }),
        {
          operation: `router.cloud.${provider}`,
          safeToRetry: true,
          context: recoveryContext(mode, task, webRequired, provider),
        },
      );
      sharedCircuitBreaker.recordSuccess(provider);
      return { ...result, attempts };
    } catch (error: any) {
      const message = String(error?.message || error || 'Unknown provider failure');
      const billingFailure = isBillingFailure(error);
      sharedCircuitBreaker.recordFailure(
        provider,
        billingFailure ? BILLING_COOLDOWN_MS : TRANSIENT_COOLDOWN_MS,
      );
      attempts.push({ provider, error: message, billingFailure });
    }
  }

  // A user may have explicitly selected a provider in the UI. Keep that provider
  // strict for normal errors, but do not strand the request when the account has
  // no credit. Re-run once through the normal provider pool, removing any model
  // pin that belongs to the exhausted provider. The circuit breaker above keeps
  // the depleted provider out of the retry path.
  const strictBillingFailure = Boolean(
    opts.strictProvider
      && primary
      && attempts.some((attempt) => attempt.provider === primary && attempt.billingFailure),
  );
  if (strictBillingFailure && opts.allowBillingFailover !== false) {
    const fallback = await callWithProviderFailover(prompt, {
      ...opts,
      strictProvider: false,
      primaryProvider: '',
      requestedModel: undefined,
      allowBillingFailover: false,
    });
    return {
      ...fallback,
      attempts: [...attempts, ...fallback.attempts],
    };
  }

  // A web-required request must never silently degrade into a non-search local
  // answer. If all real search lanes fail, surface retrieval failure explicitly.
  if (!webRequired && !opts.disableLocalFallback && !opts.strictProvider && !localAttempted) {
    try {
      const local = await callWithNexusRecovery(
        () => callOllamaModelHunt(prompt, {
          json: opts.json,
          maxTokens: opts.maxTokens,
          mode,
        }),
        {
          operation: 'router.ollama.fallback',
          safeToRetry: true,
          context: recoveryContext(mode, task, webRequired, 'ollama'),
        },
      );
      return {
        text: local.text,
        model: local.model,
        provider: 'ollama',
        attempts,
      };
    } catch (error: any) {
      attempts.push({
        provider: 'ollama',
        error: String(error?.message || error || 'Local model pool failure'),
        billingFailure: false,
      });
    }
  }

  const summary = attempts
    .map((attempt) => `${attempt.provider}${attempt.skipped ? ' skipped' : ''}: ${attempt.error.slice(0, 180)}`)
    .join(' | ');
  const prefix = webRequired ? 'Atlas web retrieval unavailable' : 'Atlas model pool exhausted';
  throw new Error(`${prefix}${summary ? ` — ${summary}` : ''}`);
}
