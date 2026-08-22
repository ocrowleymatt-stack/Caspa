import assert from 'node:assert/strict';
import test from 'node:test';
import { IMAGINE_ASPECTS, normaliseImagineRequest } from '../src/services/grokImagineTypes';

test('imagine requests require a prompt and coerce aspect/resolution', () => {
  assert.equal(normaliseImagineRequest({ prompt: '' }).ok, false);
  const ok = normaliseImagineRequest({ prompt: '  A clerk at the harbour window  ', aspectRatio: 'nope', resolution: '4k' });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.prompt, 'A clerk at the harbour window');
    assert.equal(ok.aspectRatio, '3:4');
    assert.equal(ok.resolution, '1k');
    assert.equal(ok.quality, 'medium');
  }
  const wide = normaliseImagineRequest({ prompt: 'dusk', aspectRatio: '16:9', resolution: '2k', quality: 'low' });
  assert.equal(wide.ok, true);
  if (wide.ok) {
    assert.equal(wide.aspectRatio, '16:9');
    assert.equal(wide.resolution, '2k');
    assert.equal(wide.quality, 'low');
  }
  assert.ok(IMAGINE_ASPECTS.includes('3:4'));
  assert.ok(IMAGINE_ASPECTS.includes('3:2'));
  const tooLong = normaliseImagineRequest({ prompt: 'x'.repeat(4001) });
  assert.equal(tooLong.ok, false);
});
