export function parseCaspaError(error: unknown, fallback: string) {
  const raw = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  const parts = raw.split("|");
  if (parts.length >= 2) return { code: parts[0], message: parts[1] || fallback, traceId: parts[2] || null };
  return { code: "REQUEST_FAILED", message: fallback, traceId: null };
}

export function downloadTextFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
