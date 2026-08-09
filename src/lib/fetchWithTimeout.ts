/**
 * Client fetch with AbortController timeout.
 * Long AI calls must not look like a broken project — callers should treat
 * FetchTimeoutError as recoverable (draft kept, retry safe).
 */

export class FetchTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(
      `That call timed out after ${Math.round(timeoutMs / 1000)}s. Your draft is still saved — try again or continue later.`
    );
    this.name = 'FetchTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** Default client wait for short AI routes (seed, cut, single chapter). */
export const AI_FETCH_TIMEOUT_MS = 300_000;

/**
 * Whole-book / multi-pass jobs can legitimately take many minutes.
 * Keep the browser out of the way; server/proxy timeouts are aligned to this.
 */
export const AI_LONG_FETCH_TIMEOUT_MS = 1_800_000;

export function isTimeoutError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof FetchTimeoutError) return true;
  const name = String((err as { name?: string }).name || '');
  const message = String((err as { message?: string }).message || '');
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    /timeout|timed out|aborted/i.test(message)
  );
}

export function friendlyFetchError(err: unknown, fallback: string): string {
  if (isTimeoutError(err)) {
    if (err instanceof FetchTimeoutError) return err.message;
    return 'That call timed out. Your draft is still saved — try again or continue later.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = AI_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const upstream = init.signal;
  const onUpstreamAbort = () => controller.abort();
  upstream?.addEventListener('abort', onUpstreamAbort);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });

    // Reverse proxies commonly return an HTML 502/504 page. Without this guard,
    // callers doing response.json() surface the useless "Unexpected token <" error.
    const ctype = (response.headers.get('content-type') || '').toLowerCase();
    if (ctype.includes('text/html')) {
      const body = await response.clone().text().catch(() => '');
      const status = response.status || 0;
      const gateway = status === 502 || status === 503 || status === 504;
      throw new Error(
        gateway
          ? `The writing service was still working but the gateway closed the connection (${status}). Your completed sections are saved; continue the remaining section.`
          : `The API returned HTML instead of JSON (${status}). ${body.replace(/\s+/g, ' ').slice(0, 100)}`
      );
    }

    return response;
  } catch (err) {
    if (controller.signal.aborted && !upstream?.aborted) {
      throw new FetchTimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener('abort', onUpstreamAbort);
  }
}
