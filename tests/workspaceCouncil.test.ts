import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkshopCouncilPrompt,
  buildWorkshopDiagnosisPrompt,
  extractJsonObject,
  normalizeWorkshopCouncil,
  normalizeWorkshopDiagnosis,
} from '../src/services/workspaceCouncil';

describe('workshop council', () => {
  it('normalizes a four-critic report', () => {
    const council = normalizeWorkshopCouncil({
      summary: 'The page hides the wound behind competent weather.',
      critics: [
        { name: 'Mara', role: 'structural', severity: 'high', finding: 'No turn.', evidence: 'She leaves the same way she entered.', fix: 'Make the leaving cost something.' },
        { name: 'Voss', role: 'vocal', severity: 'medium', finding: 'Voice flattens.', evidence: 'I felt a sense of loss.', fix: 'Give him a glass he will not put down.' },
        { name: 'Len', role: 'sentence', severity: 'low', finding: 'The last line explains.', evidence: 'He was consumed by grief.', fix: 'Cut the last sentence.' },
        { name: 'Reed', role: 'agent', severity: 'medium', finding: 'The page is pretty and still.', evidence: 'Two pages of rain.', fix: 'Put a decision in the rain.' },
      ],
    });
    assert.equal(council.summary, 'The page hides the wound behind competent weather.');
    assert.equal(council.critics.length, 4);
    assert.equal(council.critics[0].severity, 'high');
  });

  it('repairs diagnosis-shaped payloads so a loose model still yields notes', () => {
    const council = normalizeWorkshopCouncil({
      holding: 'Nothing turns.',
      evidence: 'She washes the glass twice.',
      next_move: 'Break the glass or keep it and refuse to leave.',
    });
    assert.match(council.summary, /Nothing turns/);
    assert.ok(council.critics.length >= 1);
    assert.match(council.critics[0].evidence, /glass/);
    assert.match(council.critics[0].fix, /Break the glass/);
  });

  it('repairs fenced JSON and diagnosis findings as council notes', () => {
    const council = normalizeWorkshopCouncil(`\`\`\`json
{"findings":[{"category":"voice","severity":"major","evidence":"I felt a sense of loss.","rationale":"The narrator names the feeling.","recommendation":"Give him a glass he will not put down."}]}
\`\`\``);
    assert.ok(council.critics.length >= 1);
    assert.match(council.critics[0].evidence, /sense of loss/);
    assert.equal(council.critics[0].severity, 'high');
  });

  it('asks for evidence and forbids generic advice', () => {
    const prompt = buildWorkshopCouncilPrompt({
      title: 'Tide Tables',
      mode: 'novel',
      manuscript: 'She washed the glass again.',
    });
    assert.match(prompt, /evidence/);
    assert.match(prompt, /wound/);
    assert.match(prompt, /Ban "add more tension"/);
    assert.match(prompt, /She washed the glass again/);
    assert.match(prompt, /PROJECT: Tide Tables/);
    assert.match(prompt, /Do not continue the story/);
  });
});

describe('workshop diagnosis', () => {
  it('normalizes findings and repairs holding-shaped payloads', () => {
    const first = normalizeWorkshopDiagnosis({
      summary: 'The opening is held.',
      findings: [{ category: 'pacing', severity: 'major', evidence: 'the sea arriving a minute early', rationale: 'The discrepancy is late.', recommendation: 'Arrive sooner.' }],
    });
    assert.equal(first.findings.length, 1);
    assert.match(first.findings[0].evidence, /sea arriving/);

    const repaired = normalizeWorkshopDiagnosis({
      holding: 'Nothing turns.',
      evidence: 'She washes the glass twice.',
      next_move: 'Break the glass.',
    });
    assert.match(repaired.summary, /Nothing turns/);
    assert.ok(repaired.findings.length >= 1);
    assert.match(repaired.findings[0].evidence, /glass/);
  });

  it('asks for evidence from the live page', () => {
    const prompt = buildWorkshopDiagnosisPrompt({
      title: 'Tide Tables',
      mode: 'novel',
      manuscript: 'The clerk washed the same glass.',
    });
    assert.match(prompt, /The clerk washed the same glass/);
    assert.match(prompt, /Ban "add more tension"/);
    assert.match(prompt, /wound/);
  });
});

describe('extractJsonObject', () => {
  it('pulls an object out of prose and fences', () => {
    const parsed = extractJsonObject('Here you go:\n```json\n{"summary":"Held.","critics":[]}\n```\nThanks.');
    assert.deepEqual(parsed, { summary: 'Held.', critics: [] });
  });
});
