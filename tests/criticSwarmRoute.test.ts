import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('workshop critique and diagnosis use one Atlas call with no fiction wrap', async () => {
  const source = await readFile(new URL('../src/routes/caspa-hybrid-core-routes.ts', import.meta.url), 'utf8');
  const desk = await readFile(new URL('../src/components/HybridWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /authorialVoice: 'none'/);
  assert.match(source, /buildWorkshopCouncilPrompt/);
  assert.match(source, /buildWorkshopDiagnosisPrompt/);
  assert.match(source, /normalizeWorkshopCouncil/);
  assert.doesNotMatch(desk, /getSwarmCritique/);
  assert.match(desk, /\/critique/);
  assert.match(desk, /workshop-report/);
});

test('critic swarm seats go through Atlas instead of pinning cloud keys', async () => {
  const source = await readFile(new URL('../src/services/ai.ts', import.meta.url), 'utf8');
  const swarm = source.slice(source.indexOf('async getSwarmCritique'), source.indexOf('async writeDraft'));
  assert.match(swarm, /taskHint: 'council'/);
  assert.match(swarm, /Atlas/);
  assert.doesNotMatch(swarm, /providerOverride/);
  assert.doesNotMatch(swarm, /strictProvider/);
  assert.doesNotMatch(swarm, /skipLocalFallback/);
  assert.doesNotMatch(swarm, /providerRotation/);
});
