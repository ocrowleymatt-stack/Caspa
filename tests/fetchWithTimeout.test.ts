import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FetchTimeoutError,
  friendlyFetchError,
  isTimeoutError,
} from '../src/lib/fetchWithTimeout.ts';

describe('fetchWithTimeout helpers', () => {
  it('classifies AbortError / TimeoutError as timeouts', () => {
    const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    const timeout = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
    assert.equal(isTimeoutError(abort), true);
    assert.equal(isTimeoutError(timeout), true);
    assert.equal(isTimeoutError(new Error('Seed failed')), false);
  });

  it('returns a recoverable message for timeouts', () => {
    const msg = friendlyFetchError(new FetchTimeoutError(180_000), 'fallback');
    assert.match(msg, /timed out/i);
    assert.match(msg, /saved/i);
    assert.equal(friendlyFetchError(new Error('Seed failed'), 'fallback'), 'Seed failed');
  });
});
