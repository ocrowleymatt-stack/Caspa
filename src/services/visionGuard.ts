import { closeSync, existsSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDataDir } from './dataPaths';
import { assertImageLimits, inspectImageGeometry } from './imageGeometry';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 48;
export const MAX_USER_PER_HOUR = 12;
export const MAX_USER_PER_DAY = 36;
const MAX_USER_CONCURRENT = 1;
const MAX_GLOBAL_CONCURRENT = 3;

const MAGIC: Array<{ mime: string; test: (bytes: Uint8Array) => boolean }> = [
  { mime: 'image/jpeg', test: (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mime: 'image/jpg', test: (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mime: 'image/png', test: (bytes) => bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  { mime: 'image/gif', test: (bytes) => bytes.length > 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 },
  { mime: 'image/webp', test: (bytes) => bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 },
];

const userInflight = new Map<string, number>();
let globalInflight = 0;

type QuotaUser = {
  hourKey: string;
  hourCount: number;
  dayKey: string;
  dayCount: number;
};

type QuotaFile = {
  users: Record<string, QuotaUser>;
};

export type VisionValidation =
  | { ok: true; mimeType: string; byteLength: number; width: number; height: number }
  | { ok: false; status: number; message: string };

function quotaPath(): string {
  return path.join(getDataDir(), 'caspa-vision-quota.json');
}

function lockPath(): string {
  return `${quotaPath()}.lock`;
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withQuotaLock<T>(fn: () => T): T {
  const lock = lockPath();
  const started = Date.now();
  while (true) {
    try {
      const fd = openSync(lock, 'wx');
      try {
        return fn();
      } finally {
        closeSync(fd);
        try { unlinkSync(lock); } catch { /* already gone */ }
      }
    } catch (error) {
      if (Date.now() - started > 2000) throw error;
      sleepSync(15);
    }
  }
}

function readQuotaFile(): QuotaFile {
  try {
    if (!existsSync(quotaPath())) return { users: {} };
    const parsed = JSON.parse(readFileSync(quotaPath(), 'utf8')) as QuotaFile;
    if (!parsed || typeof parsed !== 'object' || !parsed.users || typeof parsed.users !== 'object') {
      return { users: {} };
    }
    return parsed;
  } catch {
    return { users: {} };
  }
}

function writeQuotaFile(data: QuotaFile): void {
  const target = quotaPath();
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, target);
}

function utcHourKey(now: Date): string {
  return now.toISOString().slice(0, 13);
}

function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function liveQuota(entry: QuotaUser | undefined, now: Date): QuotaUser {
  const hourKey = utcHourKey(now);
  const dayKey = utcDayKey(now);
  return {
    hourKey,
    hourCount: entry?.hourKey === hourKey ? entry.hourCount : 0,
    dayKey,
    dayCount: entry?.dayKey === dayKey ? entry.dayCount : 0,
  };
}

function reserveDurableQuota(userId: string): { ok: true } | { ok: false; status: number; message: string } {
  return withQuotaLock(() => {
    const now = new Date();
    const file = readQuotaFile();
    const next: QuotaFile = { users: {} };
    for (const [id, raw] of Object.entries(file.users)) {
      const live = liveQuota(raw, now);
      if (live.hourCount > 0 || live.dayCount > 0) next.users[id] = live;
    }
    const current = liveQuota(next.users[userId], now);
    if (current.hourCount >= MAX_USER_PER_HOUR) {
      return { ok: false, status: 429, message: 'Vision limit reached for this hour. Try again later.' };
    }
    if (current.dayCount >= MAX_USER_PER_DAY) {
      return { ok: false, status: 429, message: 'Daily vision quota reached. Try again tomorrow.' };
    }
    next.users[userId] = {
      hourKey: current.hourKey,
      hourCount: current.hourCount + 1,
      dayKey: current.dayKey,
      dayCount: current.dayCount + 1,
    };
    writeQuotaFile(next);
    return { ok: true };
  });
}

export function resetVisionGuardMemoryForTests(): void {
  userInflight.clear();
  globalInflight = 0;
}

export function resetVisionGuardForTests(): void {
  resetVisionGuardMemoryForTests();
  try { unlinkSync(quotaPath()); } catch { /* missing is fine */ }
  try { unlinkSync(lockPath()); } catch { /* missing is fine */ }
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

  const geometry = assertImageLimits(inspectImageGeometry(bytes, claimedFamily));
  if (!geometry.ok) return { ok: false, status: 400, message: geometry.message };

  return {
    ok: true,
    mimeType: claimedFamily,
    byteLength: bytes.length,
    width: geometry.width,
    height: geometry.height,
  };
}

export function acquireVisionSlot(userId: string): { ok: true; release: () => void } | { ok: false; status: number; message: string } {
  const id = String(userId || '').trim();
  if (!id) return { ok: false, status: 401, message: 'Authentication required' };
  if ((userInflight.get(id) || 0) >= MAX_USER_CONCURRENT) {
    return { ok: false, status: 429, message: 'A vision request is already running for this account.' };
  }
  if (globalInflight >= MAX_GLOBAL_CONCURRENT) {
    return { ok: false, status: 429, message: 'Vision is busy. Try again in a moment.' };
  }

  const reserved = reserveDurableQuota(id);
  if (!reserved.ok) return reserved;

  userInflight.set(id, (userInflight.get(id) || 0) + 1);
  globalInflight += 1;
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
