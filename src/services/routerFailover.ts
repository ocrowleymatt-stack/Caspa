import {
  callCloudProvider,
  classifyTask,
  isBillingFailure,
  normaliseMode,
  providerOrder,
  type CloudProvider,
  type IntelligenceMode,
  type RoutedCallOptions,
  type RoutedCloudResult,
  type TaskKind,
} from './cloudModelRouter';

export interface RouterFailoverAttempt {
  provider: string;
  error: string;
  billingFailure: boolean;
}

export interface RouterFailoverResult extends RoutedCloudResult {
  attempts: RouterFailoverAttempt[];
}

export interface RouterFailoverOptions extends RoutedCallOptions {
  primaryProvider?: string;
  sensitive?: boolean;
}

/**
 * Canonical Atlas cloud failover path.
 *
 * Billing/quota exhaustion is provider-scoped: once detected, the router skips
 * the rest of that provider and immediately advances to the next provider.
 * Other provider failures are also isolated to that provider for this request.
 */
export async function callWithProviderFailover(
  prompt: string,
  opts: RouterFailoverOptions = {},
): Promise<RouterFailoverResult> {
  const mode: IntelligenceMode = normaliseMode(opts.mode);
  const task: TaskKind = opts.task || classifyTask(prompt, opts);
  const primary = String(opts.primaryProvider || '').trim();
  const ordered = providerOrder(primary, mode, task, Boolean(opts.sensitive));
  const attempts: RouterFailoverAttempt[] = [];

  for (const providerName of ordered) {
    const provider = providerName as CloudProvider;
    try {
      const result = await callCloudProvider(provider, prompt, { ...opts, mode, task });
      return { ...result, attempts };
    } catch (error: any) {
      const message = String(error?.message || error || 'Unknown provider failure');
      attempts.push({
        provider,
        error: message,
        billingFailure: isBillingFailure(error),
      });
      // Deliberately continue. A dead provider must never terminate an Atlas
      // request while another configured provider may still satisfy it.
    }
  }

  const summary = attempts
    .map((attempt) => `${attempt.provider}: ${attempt.error.slice(0, 180)}`)
    .join(' | ');
  throw new Error(`Atlas provider pool exhausted${summary ? ` — ${summary}` : ''}`);
}
