import { fetchWithTimeout } from '../lib/fetchWithTimeout';

export type IngestKind = 'text' | 'file' | 'image';

export type IngestRead = {
  kind: IngestKind;
  text: string;
  extracted: boolean;
  filename: string;
  mimeType: string;
};

export type ImageExtractInput = {
  imageBase64: string;
  mimeType: string;
  filename: string;
};

const MAX_INGEST_CHARS = 400_000;

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function clipIngestText(text: string): string {
  const value = String(text || '');
  if (value.length <= MAX_INGEST_CHARS) return value;
  return `${value.slice(0, MAX_INGEST_CHARS)}\n\n[Truncated after ${MAX_INGEST_CHARS.toLocaleString()} characters.]`;
}

export async function readIngestFile(
  file: File,
  options?: { extractImage?: (input: ImageExtractInput) => Promise<string> },
): Promise<IngestRead> {
  const mimeType = file.type || 'application/octet-stream';
  const filename = file.name || 'untitled';
  if (mimeType.startsWith('image/')) {
    const extract = options?.extractImage;
    if (!extract) {
      throw new Error('Image text extraction is required. Caspa will not store a truncated data URL.');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = clipIngestText(String(await extract({
      imageBase64: bytesToBase64(bytes),
      mimeType,
      filename,
    }) || '').trim());
    if (!text.trim()) throw new Error('No text could be read from that image. Nothing was attached.');
    return { kind: 'image', text, extracted: true, filename, mimeType };
  }
  const raw = await file.text();
  const text = clipIngestText(raw);
  if (!text.trim()) throw new Error('That file was empty. Nothing was attached.');
  const kind: IngestKind = mimeType.startsWith('text') || /\.(txt|md|markdown)$/i.test(filename) ? 'text' : 'file';
  return { kind, text, extracted: true, filename, mimeType };
}

export async function extractImageViaVision(input: ImageExtractInput): Promise<string> {
  const response = await fetchWithTimeout('/api/ai/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: input.imageBase64, mimeType: input.mimeType }),
  }, 180_000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.message
      || 'Could not extract text from that image. Configure a vision-capable AI provider, or paste the text. Nothing was attached.',
    );
  }
  return String(data.result || data.text || '');
}
