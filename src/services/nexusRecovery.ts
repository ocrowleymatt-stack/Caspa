export type NexusRecoveryIncident = {
  id: string;
  source: string;
  operation: string;
  error: string;
  kind: string;
  action: 'retry' | 'fallback' | 'diagnose' | 'repair' | 'escalate';
  retryable: boolean;
  delayMs: number;
  attempt: number;
  requiresHuman: boolean;
  instructions: string[];
  createdAt: string;
};

export type NexusRecoveryContext = {
  operation: string;
  safeToRetry?: boolean;
  context?: Record<string, unknown>;
};

const DEFAULT_RECOVERY_URL = 'http://127.0.0.1:43101/internal/recovery/incidents';
const REPORT_TIMEOUT_MS = 1_200;

function recoveryUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  if (String(env.NEXUS_RECOVERY_DISABLED || '').toLowerCase() === 'true' || env.NEXUS_RECOVERY_DISABLED === '1') return null;
  const raw = (env.NEXUS_RECOVERY_URL || DEFAULT_RECOVERY_URL).trim();
  return raw || null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? 'Unknown Caspa failure');
}

export async function reportNexusIncident(
  failure: unknown,
  options: NexusRecoveryContext & { attempt?: number },
  env: NodeJS.ProcessEnv = process.env,
): Promise<NexusRecoveryIncident | null> {
  const url = recoveryUrl(env);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
      body: JSON.stringify({
        source: 'caspa',
        operation: options.operation,
        error: errorMessage(failure),
        attempt: options.attempt || 1,
        safeToRetry: Boolean(options.safeToRetry),
        context: options.context || {},
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { incident?: NexusRecoveryIncident };
    return data.incident || null;
  } catch {
    // Recovery telemetry must never become a second outage. Caspa keeps its
    // existing local/cloud fallback semantics if Nexus itself is unavailable.
    return null;
  }
}

export async function callWithNexusRecovery<T>(
  operation: () => Promise<T>,
  options: NexusRecoveryContext,
  env: NodeJS.ProcessEnv = process.env,
): Promise<T> {
  try {
    return await operation();
  } catch (firstError) {
    const incident = await reportNexusIncident(firstError, { ...options, attempt: 1 }, env);
    if (!incident?.retryable || !options.safeToRetry) throw firstError;

    const delayMs = Math.max(0, Math.min(incident.delayMs || 0, 5_000));
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    try {
      return await operation();
    } catch (secondError) {
      await reportNexusIncident(secondError, { ...options, attempt: 2 }, env);
      throw secondError;
    }
  }
}
