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

export type AtlasProvider = CloudProvider | 'ollama';

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

/**
 * Canonical Atlas failover path.
 *
 * - Only configured, healthy cloud providers are attempted.
 * - Billing/quota failures quarantine a provider for longer than transient errors.
 * - Successful providers are immediately restored to healthy state.
 * - Explicit strict-provider requests still enter this router, but are constrained
 *   to the requested cloud provider and never silently switch elsewhere.
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
  const unfilteredPreferred = opts.strictProvider && primary
    ? [primary]
    : providerOrder(primary, mode, task, Boolean(opts.sensitive));
  const attempts: RouterFailoverAttempt[] = [];
  const webRequired = Boolean(opts.useSearch);

  if (webRequired && opts.strictProvider && primary && !providerSupportsWebSearch(primary)) {
    throw new Error(
      `Atlas web retrieval unavailable — strict provider "${primary}" has no wired web-search capability.`,
    );
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
      const result = await callCloudProvider(provider, prompt, { ...opts, mode, task });
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

  // A web-required request must never silently degrade into a non-search local
  // answer. If all real search lanes fail, surface retrieval failure explicitly.
  if (!webRequired && !opts.disableLocalFallback && !opts.strictProvider) {
    try {
      const local = await callOllamaModelHunt(prompt, {
        json: opts.json,
        maxTokens: opts.maxTokens,
        mode,
      });
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
