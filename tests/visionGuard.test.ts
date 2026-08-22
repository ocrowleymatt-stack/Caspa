import assert from 'node:assert/strict';
import test from 'node:test';
import { acquireVisionSlot, resetVisionGuardForTests, validateVisionImage } from '../src/services/visionGuard';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString('base64');

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
  if (ok.ok) assert.equal(ok.mimeType, 'image/png');
});

test('vision enforces per-user and global concurrency plus hourly quota', () => {
  resetVisionGuardForTests();
  const first = acquireVisionSlot('user-a');
  assert.equal(first.ok, true);
  const busy = acquireVisionSlot('user-a');
  assert.equal(busy.ok, false);
  if (!busy.ok) assert.equal(busy.status, 429);
  if (first.ok) first.release();

  for (let index = 0; index < 12; index += 1) {
    const slot = acquireVisionSlot('user-b');
    assert.equal(slot.ok, true);
    if (slot.ok) slot.release();
  }
  const blocked = acquireVisionSlot('user-b');
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.status, 429);
});
