import assert from 'node:assert/strict';
import test from 'node:test';
import { DESK_STAGES, findWorkspaceTool, toolsForStage } from '../src/services/workspaceCatalog';
import { applyRebuildChanges, applySingleRebuildChange, detectManuscriptProposal, splitManuscript, splitManuscriptChapters } from '../src/services/workspaceRebuild';
import { briefFromProject, collectToolCache, hydrateToolCache, mergeWorkspaceArtefacts, scopedCacheKey } from '../src/services/workspaceProjectBridge';
import { assertExpectedSourceVersion, HybridConflictError } from '../src/services/hybridCoreRepository';
import { readIngestFile } from '../src/services/workspaceIngest';

test('desk journey includes idea and structure without dropping publish', () => {
  assert.deepEqual([...DESK_STAGES], ['Library', 'Idea', 'Structure', 'Draft', 'Workshop', 'Revise', 'Finish', 'Publish']);
  assert.ok(toolsForStage('Revise').some((tool) => tool.id === 'rebuild'));
  assert.equal(findWorkspaceTool('Rip up and rebuild')?.destructive, true);
});

test('rebuild applies only accepted bounded chapter changes', () => {
  const manuscript = '# CHAPTER 1: Arrival\n\nOld arrival.\n\n# CHAPTER 2: Turn\n\nOld turn.';
  const chapters = splitManuscriptChapters(manuscript);
  assert.equal(chapters.length, 2);
  const next = applySingleRebuildChange(manuscript, {
    id: 'c1',
    chapterTitle: 'CHAPTER 1: Arrival',
    currentExcerpt: 'Old arrival.',
    proposed: 'New arrival, same facts.',
    rationale: 'Open later.',
    status: 'accepted',
  });
  assert.match(next, /New arrival, same facts/);
  assert.match(next, /Old turn/);
  const rejected = applyRebuildChanges(manuscript, [{
    id: 'c2',
    chapterTitle: 'CHAPTER 2: Turn',
    currentExcerpt: 'Old turn.',
    proposed: 'Should not apply.',
    rationale: 'No',
    status: 'rejected',
  }]);
  assert.equal(rejected, manuscript);
});

test('artefact merge never overwrites canonical manuscript fields', () => {
  const merged = mergeWorkspaceArtefacts(
    { manuscript: 'CANON', whitePage: 'CANON', manuscriptSource: 'CANON', commission: { artefact: 'CANON', chapters: [] }, brief: { idea: 'seed' } },
    { brief: { idea: 'updated' }, commission: { artefact: 'SHOULD NOT WIN', chapters: [{ title: 'X' }] }, research: [{ id: 'n1' }] },
  );
  assert.equal(merged.manuscript, 'CANON');
  assert.equal(merged.whitePage, 'CANON');
  assert.equal(merged.commission.artefact, 'CANON');
  assert.equal(merged.brief.idea, 'updated');
  assert.equal(merged.research[0].id, 'n1');
});

test('project brief is derived from the server project, not a detached browser shelf', () => {
  const brief = briefFromProject({
    id: 'p1',
    title: 'Harbour Book',
    mode: 'novel',
    revision: 3,
    updatedAt: '2026-08-22T00:00:00.000Z',
    state: { brief: { idea: 'A clerk keeps the tide tables', tone: 'cold' }, hybrid: { startingIdea: 'fallback' } },
  });
  assert.equal(brief.title, 'Harbour Book');
  assert.equal(brief.idea, 'A clerk keeps the tide tables');
  assert.equal(detectManuscriptProposal('same', 'same'), false);
  assert.equal(detectManuscriptProposal('same', 'other'), true);
});

test('numbered chapter headings stay distinct so one accept cannot replace every chapter', () => {
  const manuscript = '# Chapter 1\n\nFirst watch.\n\n# Chapter 2\n\nSecond watch.';
  const chapters = splitManuscriptChapters(manuscript);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].title, 'Chapter 1');
  assert.equal(chapters[1].title, 'Chapter 2');
  const next = applySingleRebuildChange(manuscript, {
    id: 'c1',
    chapterTitle: 'Chapter 1',
    currentExcerpt: 'First watch.',
    proposed: 'Rebuilt first watch.',
    rationale: 'Tighten the opening.',
    status: 'accepted',
  });
  assert.match(next, /Rebuilt first watch/);
  assert.match(next, /Second watch/);
  assert.equal((next.match(/Rebuilt first watch/g) || []).length, 1);
  const byIndex = applySingleRebuildChange(manuscript, {
    id: 'c2',
    chapterTitle: 'Chapter',
    chapterIndex: 1,
    currentExcerpt: 'Second watch.',
    proposed: 'Rebuilt second watch.',
    rationale: 'Keep the turn.',
    status: 'accepted',
  });
  assert.match(byIndex, /First watch/);
  assert.match(byIndex, /Rebuilt second watch/);
});

test('rebuild keeps the title page and epigraph before the first heading', () => {
  const manuscript = 'THE TITHE\n\n> The sea keeps its own books.\n\n# Chapter 1\n\nOld arrival.';
  const { preamble, chapters } = splitManuscript(manuscript);
  assert.match(preamble, /THE TITHE/);
  assert.match(preamble, /sea keeps its own books/);
  assert.equal(chapters.length, 1);
  const next = applySingleRebuildChange(manuscript, {
    id: 'c1',
    chapterTitle: 'Chapter 1',
    chapterIndex: 0,
    currentExcerpt: 'Old arrival.',
    proposed: 'New arrival.',
    rationale: 'Open later.',
    status: 'accepted',
  });
  assert.match(next, /THE TITHE/);
  assert.match(next, /sea keeps its own books/);
  assert.match(next, /New arrival/);
  assert.doesNotMatch(next, /Old arrival/);
});

test('ambiguous duplicate titles do not overwrite every matching chapter', () => {
  const manuscript = '# Interlude\n\nFirst pause.\n\n# Interlude\n\nSecond pause.';
  const next = applySingleRebuildChange(manuscript, {
    id: 'c1',
    chapterTitle: 'Interlude',
    currentExcerpt: 'First pause.',
    proposed: 'Should not spray.',
    rationale: 'Ambiguous.',
    status: 'accepted',
  });
  assert.equal(next, manuscript);
});

test('stale source versions are refused before a new immutable version is written', () => {
  assert.doesNotThrow(() => assertExpectedSourceVersion(null, null));
  assert.doesNotThrow(() => assertExpectedSourceVersion('v1', 'v1'));
  assert.doesNotThrow(() => assertExpectedSourceVersion('v1', undefined));
  assert.throws(() => assertExpectedSourceVersion('v2', 'v1'), HybridConflictError);
  assert.throws(() => assertExpectedSourceVersion('v1', null), HybridConflictError);
});

function installMemoryStorage() {
  const store = new Map<string, string>();
  const memory = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
  (globalThis as any).localStorage = memory;
  return store;
}

test('browser cache keys are scoped so two projects cannot contaminate each other', () => {
  installMemoryStorage();
  const projectA = {
    id: 'proj-a',
    title: 'Harbour Book',
    mode: 'novel',
    revision: 1,
    updatedAt: '2026-08-22T00:00:00.000Z',
    state: { brief: { idea: 'tide' } },
  };
  const projectB = {
    id: 'proj-b',
    title: 'Other Book',
    mode: 'novel',
    revision: 1,
    updatedAt: '2026-08-22T00:00:00.000Z',
    state: { brief: { idea: 'ash' } },
  };
  hydrateToolCache(projectA, '# Ch\n\nALPHA');
  hydrateToolCache(projectB, '# Ch\n\nBETA');
  assert.equal(localStorage.getItem(scopedCacheKey('caspa.whitePage', 'proj-a')), '# Ch\n\nALPHA');
  assert.equal(localStorage.getItem(scopedCacheKey('caspa.whitePage', 'proj-b')), '# Ch\n\nBETA');
  assert.equal(localStorage.getItem('caspa.whitePage'), '# Ch\n\nBETA');
  const fromA = collectToolCache(projectA, '# Ch\n\nOTHER');
  assert.match(String(fromA.manuscriptProposal || ''), /ALPHA/);
  assert.doesNotMatch(String(fromA.manuscriptProposal || ''), /BETA/);
  assert.equal(collectToolCache(projectA, '# Ch\n\nALPHA').manuscriptProposal, null);
});

test('image ingest stores extracted text and refuses a truncated data URL fallback', async () => {
  const notes = new File(['Harbour clerk, 12.40 coffee'], 'notes.txt', { type: 'text/plain' });
  const textRead = await readIngestFile(notes);
  assert.equal(textRead.kind, 'text');
  assert.match(textRead.text, /12\.40 coffee/);

  const image = new File([Uint8Array.from([137, 80, 78, 71])], 'receipt.png', { type: 'image/png' });
  await assert.rejects(() => readIngestFile(image), /truncated data URL|extraction is required/i);
  const extracted = await readIngestFile(image, {
    extractImage: async ({ filename, mimeType }) => {
      assert.equal(filename, 'receipt.png');
      assert.equal(mimeType, 'image/png');
      return 'TOTAL 12.40\nCoffee, harbour window';
    },
  });
  assert.equal(extracted.kind, 'image');
  assert.equal(extracted.extracted, true);
  assert.match(extracted.text, /TOTAL 12\.40/);
  assert.doesNotMatch(extracted.text, /data:image/);
});
