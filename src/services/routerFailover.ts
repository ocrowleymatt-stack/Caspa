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

export type AtlasProvider = CloudProvider | 'ollama';

export interface RouterFailoverAttempt {
  provider: string;
  error: string;
  billingFailure: boolean;
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
  providerDeadlineMs?: number;
}

function providerDeadlineMs(mode: IntelligenceMode, task: TaskKind, override?: number): number {
  if (override && Number.isFinite(override) && override > 0) return Math.max(5_000, override);
  if (task === 'council') return mode === 'speed' ? 12_000 : mode === 'god' ? 24_000 : 16_000;
  if (mode === 'speed') return 20_000;
  if (mode === 'god') {
    return ['reasoning', 'legal', 'factual', 'synthesis', 'long'].includes(task) ? 75_000 : 50_000;
  }
  return ['reasoning', 'legal', 'factual', 'synthesis', 'long'].includes(task) ? 45_000 : 30_000;
}

async function withProviderDeadline<T>(promise: Promise<T>, ms: number, provider: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`ROUTER_TIMEOUT: ${provider} exceeded ${Math.round(ms / 1000)}s failover budget`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Canonical Atlas failover path.
 *
 * 1. Try the ordered cloud provider pool.
 * 2. Treat billing/quota exhaustion as provider-scoped, never request-fatal.
 * 3. Bound each provider with a router-level deadline so one slow provider cannot
 *    stall the whole job while healthier alternatives are available.
 * 4. If every cloud provider is unavailable, enter the dynamic local Ollama pool.
 * 5. Fail only when both cloud and local survival tiers are exhausted.
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
  const deadline = providerDeadlineMs(mode, task, opts.providerDeadlineMs);

  for (const providerName of ordered) {
    const provider = providerName as CloudProvider;
    try {
      const result = await withProviderDeadline(
        callCloudProvider(provider, prompt, { ...opts, mode, task }),
        deadline,
        provider,
      );
      return { ...result, attempts };
    } catch (error: any) {
      const message = String(error?.message || error || 'Unknown provider failure');
      attempts.push({
        provider,
        error: message,
        billingFailure: isBillingFailure(error),
      });
      // Continue immediately. A dead, slow or exhausted provider must never hold
      // the entire Atlas request hostage while another provider can answer.
    }
  }

  if (!opts.disableLocalFallback) {
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
    .map((attempt) => `${attempt.provider}: ${attempt.error.slice(0, 180)}`)
    .join(' | ');
  throw new Error(`Atlas model pool exhausted${summary ? ` — ${summary}` : ''}`);
}
