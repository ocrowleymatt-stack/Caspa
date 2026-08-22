import { closeSync, existsSync, openSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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
const LOCK_STALE_MS = 8_000;
const LOCK_WAIT_MS = 2_500;
const INFLIGHT_STALE_MS = 10 * 60 * 1000;
const DEFAULT_RESERVE_TOKENS = 6_000;
const DEFAULT_RESERVE_CENTS = 6;

const MAGIC: Array<{ mime: string; test: (bytes: Uint8Array) => boolean }> = [
  { mime: 'image/jpeg', test: (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mime: 'image/jpg', test: (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mime: 'image/png', test: (bytes) => bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  { mime: 'image/gif', test: (bytes) => bytes.length > 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 },
  { mime: 'image/webp', test: (bytes) => bytes.length > 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 },
];

type QuotaUser = {
  hourKey: string;
  hourCount: number;
  dayKey: string;
  dayCount: number;
  dayTokens: number;
  dayCostCents: number;
};

type InflightEntry = {
  userId: string;
  token: string;
  startedAt: number;
  tokens: number;
  costCents: number;
};

type QuotaFile = {
  dayKey: string;
  globalDayTokens: number;
  globalDayCostCents: number;
  users: Record<string, QuotaUser>;
  inflight: InflightEntry[];
};

export type VisionSpend = { tokens: number; costCents: number };

export type VisionValidation =
  | { ok: true; mimeType: string; byteLength: number; width: number; height: number; base64: string }
  | { ok: false; status: number; message: string };

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function quotaPath(): string {
  return path.join(getDataDir(), 'caspa-vision-quota.json');
}

function lockPath(): string {
  return `${quotaPath()}.lock`;
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function stealStaleLock(lock: string): void {
  try {
    if (!existsSync(lock)) return;
    if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) unlinkSync(lock);
  } catch {
    /* another worker may have removed it */
  }
}

function withQuotaLock<T>(fn: () => T): T {
  const lock = lockPath();
  const started = Date.now();
  while (true) {
    stealStaleLock(lock);
    try {
      const fd = openSync(lock, 'wx');
      try {
        writeFileSync(fd, `${process.pid}\n${Date.now()}`);
        try { utimesSync(lock, new Date(), new Date()); } catch { /* best-effort freshness */ }
        return fn();
      } finally {
        closeSync(fd);
        try { unlinkSync(lock); } catch { /* already gone */ }
      }
    } catch (error) {
      if (Date.now() - started > LOCK_WAIT_MS) throw error;
      sleepSync(20);
    }
  }
}

function emptyQuota(now: Date): QuotaFile {
  return {
    dayKey: utcDayKey(now),
    globalDayTokens: 0,
    globalDayCostCents: 0,
    users: {},
    inflight: [],
  };
}

function readQuotaFile(now: Date): QuotaFile {
  try {
    if (!existsSync(quotaPath())) return emptyQuota(now);
    const parsed = JSON.parse(readFileSync(quotaPath(), 'utf8')) as Partial<QuotaFile>;
    if (!parsed || typeof parsed !== 'object') return emptyQuota(now);
    const dayKey = utcDayKey(now);
    const sameDay = parsed.dayKey === dayKey;
    return {
      dayKey,
      globalDayTokens: sameDay ? Number(parsed.globalDayTokens) || 0 : 0,
      globalDayCostCents: sameDay ? Number(parsed.globalDayCostCents) || 0 : 0,
      users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
      inflight: Array.isArray(parsed.inflight) ? parsed.inflight : [],
    };
  } catch {
    return emptyQuota(now);
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
  const sameDay = entry?.dayKey === dayKey;
  return {
    hourKey,
    hourCount: entry?.hourKey === hourKey ? entry.hourCount : 0,
    dayKey,
    dayCount: sameDay ? entry.dayCount : 0,
    dayTokens: sameDay ? entry.dayTokens || 0 : 0,
    dayCostCents: sameDay ? entry.dayCostCents || 0 : 0,
  };
}

function liveInflight(entries: InflightEntry[], now: number): InflightEntry[] {
  return entries.filter((entry) => now - entry.startedAt < INFLIGHT_STALE_MS);
}

export function estimateVisionSpend(image: { width: number; height: number; byteLength: number }): VisionSpend {
  const tiles = Math.max(1, Math.ceil(image.width / 768) * Math.ceil(image.height / 768));
  const tokens = tiles * 255 + 4096 + Math.ceil(Math.max(1, image.byteLength) / 1024);
  return { tokens, costCents: Math.max(1, Math.ceil(tokens / 800)) };
}

function decodeStrictBase64(raw: string): Buffer | null {
  const compact = raw.replace(/\s+/g, '');
  if (!compact || compact.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  if (compact.includes('=') && !/^[A-Za-z0-9+/]+={1,2}$/.test(compact)) return null;
  const expected = compact.endsWith('==') ? (compact.length / 4) * 3 - 2 : compact.endsWith('=') ? (compact.length / 4) * 3 - 1 : (compact.length / 4) * 3;
  const bytes = Buffer.from(compact, 'base64');
  if (!bytes.length || bytes.length !== expected) return null;
  const roundTrip = bytes.toString('base64').replace(/=+$/, '');
  const compactBare = compact.replace(/=+$/, '');
  if (roundTrip !== compactBare) return null;
  return bytes;
}

function reserveDurableQuota(
  userId: string,
  spend: VisionSpend,
): { ok: true; token: string } | { ok: false; status: number; message: string } {
  try {
    return withQuotaLock<{ ok: true; token: string } | { ok: false; status: number; message: string }>(() => {
      const now = new Date();
      const nowMs = now.getTime();
      const file = readQuotaFile(now);
      const inflight = liveInflight(file.inflight, nowMs);
      if (inflight.filter((entry) => entry.userId === userId).length >= MAX_USER_CONCURRENT) {
        return { ok: false, status: 429, message: 'A vision request is already running for this account.' };
      }
      if (inflight.length >= MAX_GLOBAL_CONCURRENT) {
        return { ok: false, status: 429, message: 'Vision is busy. Try again in a moment.' };
      }

      const next: QuotaFile = {
        dayKey: file.dayKey,
        globalDayTokens: file.globalDayTokens,
        globalDayCostCents: file.globalDayCostCents,
        users: {},
        inflight,
      };
      for (const [id, raw] of Object.entries(file.users)) {
        const live = liveQuota(raw, now);
        if (live.hourCount > 0 || live.dayCount > 0 || live.dayTokens > 0) next.users[id] = live;
      }
      const current = liveQuota(next.users[userId], now);
      if (current.hourCount >= MAX_USER_PER_HOUR) {
        return { ok: false, status: 429, message: 'Vision limit reached for this hour. Try again later.' };
      }
      if (current.dayCount >= MAX_USER_PER_DAY) {
        return { ok: false, status: 429, message: 'Daily vision quota reached. Try again tomorrow.' };
      }
      if (current.dayTokens + spend.tokens > envInt('CASPA_VISION_DAILY_TOKEN_CEILING', 80_000)) {
        return { ok: false, status: 429, message: 'Daily vision token ceiling reached. Try again tomorrow.' };
      }
      if (current.dayCostCents + spend.costCents > envInt('CASPA_VISION_DAILY_COST_CENTS', 800)) {
        return { ok: false, status: 429, message: 'Daily vision spend ceiling reached. Try again tomorrow.' };
      }
      if (next.globalDayTokens + spend.tokens > envInt('CASPA_VISION_GLOBAL_DAILY_TOKEN_CEILING', 400_000)) {
        return { ok: false, status: 429, message: 'Vision token ceiling reached. Try again tomorrow.' };
      }
      if (next.globalDayCostCents + spend.costCents > envInt('CASPA_VISION_GLOBAL_DAILY_COST_CENTS', 4_000)) {
        return { ok: false, status: 429, message: 'Vision spend ceiling reached. Try again tomorrow.' };
      }

      const token = randomUUID();
      next.users[userId] = {
        hourKey: current.hourKey,
        hourCount: current.hourCount + 1,
        dayKey: current.dayKey,
        dayCount: current.dayCount + 1,
        dayTokens: current.dayTokens + spend.tokens,
        dayCostCents: current.dayCostCents + spend.costCents,
      };
      next.globalDayTokens += spend.tokens;
      next.globalDayCostCents += spend.costCents;
      next.inflight.push({
        userId,
        token,
        startedAt: nowMs,
        tokens: spend.tokens,
        costCents: spend.costCents,
      });
      writeQuotaFile(next);
      return { ok: true, token };
    });
  } catch {
    return { ok: false, status: 503, message: 'Vision is busy. Try again in a moment.' };
  }
}

function releaseInflight(token: string): void {
  try {
    withQuotaLock(() => {
      const now = new Date();
      const file = readQuotaFile(now);
      file.inflight = liveInflight(file.inflight, now.getTime()).filter((entry) => entry.token !== token);
      writeQuotaFile(file);
    });
  } catch {
    /* stale lock/inflight expire on the next reserve */
  }
}

export function resetVisionGuardMemoryForTests(): void {
  /* durable inflight/quota live on disk so a process restart cannot reset them */
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

  const compact = raw.replace(/\s+/g, '');
  const bytes = decodeStrictBase64(compact);
  if (!bytes) return { ok: false, status: 400, message: 'Image payload is not valid base64.' };
  if (bytes.length > MAX_IMAGE_BYTES) {
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
  if (geometry.ok === false) return { ok: false, status: 400, message: geometry.message };

  return {
    ok: true,
    mimeType: claimedFamily,
    byteLength: bytes.length,
    width: geometry.width,
    height: geometry.height,
    base64: compact,
  };
}

export function acquireVisionSlot(
  userId: string,
  spend?: Partial<VisionSpend>,
): { ok: true; release: () => void } | { ok: false; status: number; message: string } {
  const id = String(userId || '').trim();
  if (!id) return { ok: false, status: 401, message: 'Authentication required' };
  const reserved = reserveDurableQuota(id, {
    tokens: Math.max(1, Math.floor(spend?.tokens || DEFAULT_RESERVE_TOKENS)),
    costCents: Math.max(1, Math.floor(spend?.costCents || DEFAULT_RESERVE_CENTS)),
  });
  if (reserved.ok === false) return reserved;
  let released = false;
  return {
    ok: true,
    release() {
      if (released) return;
      released = true;
      releaseInflight(reserved.token);
    },
  };
}
