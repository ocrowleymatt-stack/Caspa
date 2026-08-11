import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOsintAnalystPrompt, normaliseOsintAnalystOutput } from '../src/services/osintAnalystService';

test('OSINT analyst prompt enforces provenance and second-pass pivots', () => {
  const prompt = buildOsintAnalystPrompt({
    target: 'Example Ltd',
    objective: 'Map directors and linked domains',
    collectedText: 'S1 says Alice is a director. S2 lists example.org.',
    sources: ['https://example.com/a', 'https://example.com/b'],
  });
  assert.match(prompt, /FACT/);
  assert.match(prompt, /INFERENCE/);
  assert.match(prompt, /HYPOTHESIS/);
  assert.match(prompt, /second-pass search pivots/i);
  assert.match(prompt, /Never invent a source/i);
  assert.match(prompt, /\[S1\]/);
});

test('OSINT analyst output preserves pivots, provenance and contradictions', () => {
  const raw = JSON.stringify({
    findings: [{ claim: 'Alice is a director', status: 'fact', confidence: 0.98, support: ['S1'] }],
    entities: [{ name: 'Alice', type: 'person', aliases: [] }],
    timeline: [],
    contradictions: [{ issue: 'Two incorporation dates', competingAccounts: ['2020', '2021'], nextCheck: 'Companies House filing history' }],
    pivots: [{ query: '"Example Ltd" "Alice" director', reason: 'Corroborate role', priority: 'high' }],
    gaps: ['Registration number'],
    summary: 'One supported role; incorporation date unresolved.',
  });
  const out = normaliseOsintAnalystOutput(raw);
  assert.equal(out.findings[0].support[0], 'S1');
  assert.equal(out.pivots[0].priority, 'high');
  assert.equal(out.contradictions.length, 1);
  assert.equal(out.gaps[0], 'Registration number');
});
