/**
 * Parse an /api response as JSON, failing fast if the server returned HTML
 * (SPA shell or Express default error page) instead of an API payload.
 */
export async function readApiJson<T = any>(response: Response): Promise<T> {
  const ctype = (response.headers.get("content-type") || "").toLowerCase();
  if (ctype.includes("text/html")) {
    throw new Error(
      `API returned HTML instead of JSON (${response.status} ${response.url || ""}). ` +
        "The server likely served the SPA for an unmatched /api route — redeploy the API JSON guard."
    );
  }

  const text = await response.text();
  const trimmed = text.trim();
  if (
    trimmed.startsWith("<!doctype html") ||
    trimmed.startsWith("<!DOCTYPE html") ||
    trimmed.startsWith("<html")
  ) {
    throw new Error(
      `API returned an HTML document instead of JSON (${response.status}). ` +
        "Unmatched /api request fell through to the SPA."
    );
  }

  if (!trimmed) {
    return {} as T;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `API returned non-JSON body (${response.status}): ${trimmed.slice(0, 160)}`
    );
  }
}
