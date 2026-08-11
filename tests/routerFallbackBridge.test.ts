import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('routeAtlasPrompt delegates to the canonical failover router', async () => {
  const source = await readFile(new URL('../src/services/routerFallbackBridge.ts', import.meta.url), 'utf8');
  assert.match(source, /return callWithProviderFailover\(prompt, options\);/);
  assert.match(source, /from '\.\/routerFailover'/);
});
