import assert from 'node:assert/strict';
import test from 'node:test';
import { DESK_STAGES, findWorkspaceTool, toolsForStage } from '../src/services/workspaceCatalog';
import { applyRebuildChanges, applySingleRebuildChange, detectManuscriptProposal, splitManuscriptChapters } from '../src/services/workspaceRebuild';
import { briefFromProject, mergeWorkspaceArtefacts } from '../src/services/workspaceProjectBridge';

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
