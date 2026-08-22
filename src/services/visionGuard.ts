const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 48;
const MAX_USER_PER_HOUR = 12;
const MAX_USER_PER_DAY = 36;
const MAX_USER_CONCURRENT = 1;
const MAX_GLOBAL_CONCURRENT = 3;

const MAGIC: Array<{ mime: string; test: (bytes: Uint8Array) => boolean }> = [
  { mime: 'image/jpeg', test: (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mime: 'image/jpg', test: (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mime: 'image/png', test: (bytes) => bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  { mime: 'image/gif', test: (bytes) => bytes.length > 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 },
  { mime: 'image/webp', test: (bytes) => bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 },
];

type WindowHit = { at: number };

const hourly = new Map<string, WindowHit[]>();
const daily = new Map<string, WindowHit[]>();
const userInflight = new Map<string, number>();
let globalInflight = 0;

export type VisionValidation =
  | { ok: true; mimeType: string; byteLength: number }
  | { ok: false; status: number; message: string };

function prune(hits: WindowHit[], windowMs: number, now: number): WindowHit[] {
  return hits.filter((hit) => now - hit.at < windowMs);
}

function countWindow(store: Map<string, WindowHit[]>, userId: string, windowMs: number, now: number): number {
  const next = prune(store.get(userId) || [], windowMs, now);
  store.set(userId, next);
  return next.length;
}

function record(store: Map<string, WindowHit[]>, userId: string, now: number): void {
  const hits = store.get(userId) || [];
  hits.push({ at: now });
  store.set(userId, hits);
}

export function resetVisionGuardForTests(): void {
  hourly.clear();
  daily.clear();
  userInflight.clear();
  globalInflight = 0;
}

export function detectImageMime(bytes: Uint8Array): string | null {
  return MAGIC.find((entry) => entry.test(bytes))?.mime || null;
}

export function validateVisionImage(imageBase64: unknown, mimeType: unknown): VisionValidation {
  const raw = String(imageBase64 || '').trim();
  if (!raw) return { ok: false, status: 400, message: 'imageBase64 required' };
  if (raw.startsWith('data:')) return { ok: false, status: 400, message: 'Send raw base64, not a data URL.' };
  if (raw.length > MAX_BASE64_CHARS) return { ok: false, status: 413, message: 'Image is too large. Use a file under 3 MB.' };
  if (!/^[A-Za-z0-9+/=\s]+$/.test(raw)) return { ok: false, status: 400, message: 'Image payload is not valid base64.' };

  let bytes: Buffer;
  try {
    bytes = Buffer.from(raw.replace(/\s+/g, ''), 'base64');
  } catch {
    return { ok: false, status: 400, message: 'Image payload is not valid base64.' };
  }
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, message: 'Image is too large. Use a file under 3 MB.' };
  }

  const detected = detectImageMime(bytes);
  if (!detected) return { ok: false, status: 400, message: 'Only JPEG, PNG, GIF or WebP images are accepted.' };

  const claimed = String(mimeType || detected).toLowerCase().split(';')[0].trim();
  if (!ALLOWED_MIME.has(claimed)) return { ok: false, status: 400, message: 'Only JPEG, PNG, GIF or WebP images are accepted.' };
  const claimedFamily = claimed === 'image/jpg' ? 'image/jpeg' : claimed;
  const detectedFamily = detected === 'image/jpg' ? 'image/jpeg' : detected;
  if (claimedFamily !== detectedFamily) {
    return { ok: false, status: 400, message: 'Image type does not match the file contents.' };
  }

  return { ok: true, mimeType: claimedFamily, byteLength: bytes.length };
}

export function acquireVisionSlot(userId: string): { ok: true; release: () => void } | { ok: false; status: number; message: string } {
  const id = String(userId || '').trim();
  if (!id) return { ok: false, status: 401, message: 'Authentication required' };
  const now = Date.now();
  if (countWindow(hourly, id, 60 * 60 * 1000, now) >= MAX_USER_PER_HOUR) {
    return { ok: false, status: 429, message: 'Vision limit reached for this hour. Try again later.' };
  }
  if (countWindow(daily, id, 24 * 60 * 60 * 1000, now) >= MAX_USER_PER_DAY) {
    return { ok: false, status: 429, message: 'Daily vision quota reached. Try again tomorrow.' };
  }
  if ((userInflight.get(id) || 0) >= MAX_USER_CONCURRENT) {
    return { ok: false, status: 429, message: 'A vision request is already running for this account.' };
  }
  if (globalInflight >= MAX_GLOBAL_CONCURRENT) {
    return { ok: false, status: 429, message: 'Vision is busy. Try again in a moment.' };
  }

  userInflight.set(id, (userInflight.get(id) || 0) + 1);
  globalInflight += 1;
  record(hourly, id, now);
  record(daily, id, now);
  let released = false;
  return {
    ok: true,
    release() {
      if (released) return;
      released = true;
      userInflight.set(id, Math.max(0, (userInflight.get(id) || 1) - 1));
      globalInflight = Math.max(0, globalInflight - 1);
    },
  };
}
