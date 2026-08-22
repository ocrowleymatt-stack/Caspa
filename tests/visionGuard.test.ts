import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caspa-vision-'));
process.env.CASPA_DATA_DIR = dataDir;

const {
  acquireVisionSlot,
  MAX_USER_PER_HOUR,
  resetVisionGuardForTests,
  resetVisionGuardMemoryForTests,
  validateVisionImage,
} = await import('../src/services/visionGuard');

function pngWithSize(width: number, height: number, frames = 1): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const chunks: Buffer[] = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
  ];
  if (frames > 1) {
    const actl = Buffer.alloc(8);
    actl.writeUInt32BE(frames, 0);
    actl.writeUInt32BE(0, 4);
    chunks.push(chunk('acTL', actl));
  }
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]);
}

function gifFrames(frameCount: number): Buffer {
  const parts: number[] = [
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  ];
  for (let index = 0; index < frameCount; index += 1) {
    parts.push(
      0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0x02, 0x02, 0x4c, 0x01, 0x00,
    );
  }
  parts.push(0x3b);
  return Buffer.from(parts);
}

const png = pngWithSize(1, 1).toString('base64');

test('vision rejects oversized, non-image and mismatched payloads before a provider call', () => {
  resetVisionGuardForTests();
  assert.equal(validateVisionImage('', 'image/png').ok, false);
  assert.equal(validateVisionImage(`data:image/png;base64,${png}`, 'image/png').ok, false);
  assert.equal(validateVisionImage('not-base64!!!', 'image/png').ok, false);
  assert.equal(validateVisionImage('A'.repeat(5_000_000), 'image/png').ok, false);
  assert.equal(validateVisionImage(Buffer.from('hello').toString('base64'), 'image/png').ok, false);
  const jpegClaimed = validateVisionImage(png, 'image/jpeg');
  assert.equal(jpegClaimed.ok, false);
  const ok = validateVisionImage(png, 'image/png');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.mimeType, 'image/png');
    assert.equal(ok.width, 1);
    assert.equal(ok.height, 1);
  }
});

test('vision rejects images without readable dimensions, oversized canvases and animation', () => {
  const magicOnly = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString('base64');
  const unread = validateVisionImage(magicOnly, 'image/png');
  assert.equal(unread.ok, false);
  if (!unread.ok) assert.match(unread.message, /dimensions/i);

  const huge = validateVisionImage(pngWithSize(5000, 32).toString('base64'), 'image/png');
  assert.equal(huge.ok, false);
  if (!huge.ok) assert.match(huge.message, /too large/i);

  const animatedPng = validateVisionImage(pngWithSize(8, 8, 3).toString('base64'), 'image/png');
  assert.equal(animatedPng.ok, false);
  if (!animatedPng.ok) assert.match(animatedPng.message, /Animated/i);

  const animatedGif = validateVisionImage(gifFrames(2).toString('base64'), 'image/gif');
  assert.equal(animatedGif.ok, false);
  if (!animatedGif.ok) assert.match(animatedGif.message, /Animated/i);

  const stillGif = validateVisionImage(gifFrames(1).toString('base64'), 'image/gif');
  assert.equal(stillGif.ok, true);
});

test('vision enforces per-user and global concurrency plus hourly quota', () => {
  resetVisionGuardForTests();
  const first = acquireVisionSlot('user-a');
  assert.equal(first.ok, true);
  const busy = acquireVisionSlot('user-a');
  assert.equal(busy.ok, false);
  if (!busy.ok) assert.equal(busy.status, 429);
  if (first.ok) first.release();

  for (let index = 0; index < MAX_USER_PER_HOUR; index += 1) {
    const slot = acquireVisionSlot('user-b');
    assert.equal(slot.ok, true);
    if (slot.ok) slot.release();
  }
  const blocked = acquireVisionSlot('user-b');
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.status, 429);
});

test('vision hourly quota survives an in-process restart', () => {
  resetVisionGuardForTests();
  for (let index = 0; index < MAX_USER_PER_HOUR; index += 1) {
    const slot = acquireVisionSlot('user-c');
    assert.equal(slot.ok, true);
    if (slot.ok) slot.release();
  }
  resetVisionGuardMemoryForTests();
  const afterRestart = acquireVisionSlot('user-c');
  assert.equal(afterRestart.ok, false);
  if (!afterRestart.ok) assert.equal(afterRestart.status, 429);
  assert.equal(fs.existsSync(path.join(dataDir, 'caspa-vision-quota.json')), true);
});
