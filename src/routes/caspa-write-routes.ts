/**
 * Quick Write + prize draft routes — seed → spine → draft → critic → rewrite.
 * Whole-book drafting is backgrounded: the browser starts a job, then polls short JSON responses.
 */

import express from 'express';
import { callServerAi } from '../services/serverAiHelper';
import { createJob, getJob, updateJob } from '../services/jobQueueService';
import {
  buildAutoWritePrompt,
  buildSeedToStoryPrompt,
  buildCutPrompt,
  modeTitle,
  type NovelWriteProMode,
} from '../services/literary/novelWritePro';
import {
  buildPlanningPrompt,
  buildFirstDraftPrompt,
  buildCriticPrompt,
  buildRewritePrompt,
  parseStructuredPlan,
} from '../services/literary/structuredPipeline';
import { BUILTIN_AWARD_LENSES, awardLensPromptBlock, getAwardLens } from '../services/literary/awardsShelf';
import { routeCaspaIntent } from '../services/intent-router';
import { LITERARY_ENGINE_RULES, AWARD_BAR, ARTEFACT_FIRST, engineRulesForMode } from '../services/literary/novelWritePro';
import { runQualityGates, aggregateQuality } from '../services/qualityGateService';
import { buildServerPlotHoldBlock, type ServerPlotHold } from '../services/literary/plotHoldServer';
import {
  buildExpandSectionPrompt,
  countWords,
  planQualityCut,
  sectionOutputInstruction,
  sectionWordBudget,
  tokensForWordTarget,
  type SectionWordBudget,
} from '../services/wordCountService';

const router = express.Router();

const VALID_MODES: NovelWriteProMode[] = [
  'novel', 'nonfiction', 'essay', 'poetry', 'script', 'musical', 'adaptation', 'polish', 'chaos',
];

function beatKindForMode(mode: NovelWriteProMode): 'chapter' | 'section' | 'scene' {
  if (mode === 'nonfiction' || mode === 'essay') return 'section';
  if (mode === 'script' || mode === 'musical') return 'scene';
  return 'chapter';
}

function defaultGenreForMode(mode: NovelWriteProMode): string {
  switch (mode) {
    case 'nonfiction': return 'Creative Non-Fiction';
    case 'essay': return 'Educational';
    case 'poetry': return 'Epic Poetry';
    case 'script': return 'Stage Play';
    case 'musical': return 'Musical / Show';
    case 'adaptation':
    case 'polish': return 'Literary Fiction';
    case 'chaos': return 'Experimental';
    case 'novel':
    default: return 'Literary Fiction';
  }
}

function safeMode(mode: NovelWriteProMode | undefined): NovelWriteProMode {
  return mode && VALID_MODES.includes(mode) ? mode : 'novel';
}

function budgetFromRequest(opts: {
  mode: NovelWriteProMode;
  targetWordCount?: number | null;
  sourceText?: string;
  plotHold?: ServerPlotHold | null;
}): SectionWordBudget | null {
  if (typeof opts.targetWordCount !== 'number' || opts.targetWordCount <= 0) return null;
  const beats = opts.plotHold?.beats || [];
  const totalBeats = Math.max(1, beats.length || 1);
  const remainingBeats = Math.max(
    1,
    beats.filter((b) => (b.status || 'pending') !== 'drafted').length || totalBeats
  );
  return sectionWordBudget({
    targetWordCount: opts.targetWordCount,
    totalBeats,
    remainingBeats,
    currentWords: countWords(opts.sourceText || ''),
    mode: opts.mode,
  });
}

function withBudgetFields<T extends Record<string, unknown>>(input: T, budget: SectionWordBudget | null) {
  if (!budget) return input;
  return {
    ...input,
    targetWordCount: budget.bookTarget,
    sectionWordTarget: budget.sectionTarget,
    sectionWordMin: budget.minWords,
    sectionWordMax: budget.maxWords,
    currentManuscriptWords: budget.currentWords,
    remainingBeats: budget.remainingBeats,
  };
}

async function ensureSectionLength(opts: {
  text: string;
  budget: SectionWordBudget | null;
  mode: NovelWriteProMode;
  focusBeat?: string;
}): Promise<string> {
  if (!opts.budget) return opts.text;
  let text = opts.text;
  let words = countWords(text);
  for (let i = 0; i < 2 && words < opts.budget.minWords; i++) {
    const expand = await callServerAi(
      buildExpandSectionPrompt({
        excerpt: text,
        sectionTarget: opts.budget.sectionTarget,
        currentSectionWords: words,
        focusBeat: opts.focusBeat,
        mode: opts.mode,
      }),
      false,
      { maxTokens: tokensForWordTarget(opts.budget.sectionTarget - words + 400) }
    );
    if (!expand.trim()) break;
    text = `${text.trim()}\n\n${expand.trim()}`;
    words = countWords(text);
  }
  return text;
}

function sectionHeading(title: string, index: number, mode: NovelWriteProMode): string {
  const kind = beatKindForMode(mode);
  const clean = title.trim() || `${kind[0].toUpperCase()}${kind.slice(1)} ${index + 1}`;
  return `\n\n# ${clean}\n\n`;
}

type WriteRequest = {
  mode?: NovelWriteProMode;
  genre?: string;
  premise?: string;
  tone?: string;
  output?: string;
  sourceText?: string;
  prizeLensId?: string;
  plotHold?: ServerPlotHold;
  focusBeat?: string;
  wholeBook?: boolean;
  targetWordCount?: number | null;
};

async function generatePrizeSection(inputReq: WriteRequest) {
  const mode = safeMode(inputReq.mode);
  const genre = inputReq.genre?.trim() ? inputReq.genre : defaultGenreForMode(mode);
  const lens = getAwardLens(inputReq.prizeLensId);
  const sourceText = inputReq.sourceText || '';
  const budget = budgetFromRequest({ mode, targetWordCount: inputReq.targetWordCount, sourceText, plotHold: inputReq.plotHold });
  const resolvedOutput = budget ? sectionOutputInstruction(budget, beatKindForMode(mode)) : (inputReq.output || 'Full opening chapter');
  const structuredInput = withBudgetFields({
    mode,
    modeTitle: modeTitle(mode),
    genre,
    premise: inputReq.premise || '',
    tone: inputReq.tone || '',
    output: resolvedOutput,
    sourceText,
    prizeLens: awardLensPromptBlock(lens),
    plotHoldBlock: buildServerPlotHoldBlock(inputReq.plotHold),
    focusBeat: inputReq.focusBeat,
  }, budget);
  const proseTokens = tokensForWordTarget(budget?.sectionTarget || 2500);
  const planRaw = await callServerAi(buildPlanningPrompt(structuredInput), true);
  const plan = parseStructuredPlan(planRaw, {
    premise: inputReq.premise || '', genre, tone: inputReq.tone || '', formatDecision: resolvedOutput,
  });
  let draft = await callServerAi(buildFirstDraftPrompt(structuredInput, plan), false, { maxTokens: proseTokens });
  draft = await ensureSectionLength({ text: draft, budget, mode, focusBeat: inputReq.focusBeat });
  const criticReport = await callServerAi(buildCriticPrompt(plan, draft));
  let rewritten = await callServerAi(buildRewritePrompt(structuredInput, plan, draft, criticReport), false, { maxTokens: proseTokens });
  rewritten = await ensureSectionLength({ text: rewritten, budget, mode, focusBeat: inputReq.focusBeat });
  const quality = aggregateQuality(runQualityGates(rewritten, mode === 'polish' ? 'novel' : mode));
  return {
    text: rewritten,
    draft,
    plan,
    criticReport,
    quality,
    wordCount: countWords(rewritten),
    sectionTarget: budget?.sectionTarget ?? null,
    bookTarget: budget?.bookTarget ?? null,
    awardLens: lens,
  };
}

async function generateContinuation(inputReq: WriteRequest) {
  const mode = safeMode(inputReq.mode);
  const genre = inputReq.genre?.trim() ? inputReq.genre : defaultGenreForMode(mode);
  const lens = getAwardLens(inputReq.prizeLensId);
  const sourceText = inputReq.sourceText || '';
  const requestedTitle = inputReq.focusBeat?.split(':', 1)[0]?.trim();
  const requestedBeat = requestedTitle ? inputReq.plotHold?.beats?.find((b) => b.title.trim() === requestedTitle) : null;
  const pending = requestedBeat || inputReq.plotHold?.beats?.find((b) => (b.status || 'pending') === 'pending') || inputReq.plotHold?.beats?.find((b) => b.status !== 'drafted') || null;
  const focusBeat = inputReq.focusBeat?.trim() || (pending ? `${pending.title}: ${pending.turn}` : 'Continue from the last page with the next inevitable turn.');
  const budget = budgetFromRequest({ mode, targetWordCount: inputReq.targetWordCount, sourceText, plotHold: inputReq.plotHold });
  const kind = beatKindForMode(mode);
  const resolvedOutput = budget
    ? sectionOutputInstruction(budget, kind)
    : inputReq.output?.trim() || (inputReq.wholeBook ? `Full ${kind} for this beat only. Do not restart the book or repeat prior ${kind}s.` : `Next ${kind} only. Do not restart the book.`);
  const route = routeCaspaIntent(sourceText, 'continue writing the next scene');
  const prompt = buildAutoWritePrompt(withBudgetFields({
    mode,
    modeTitle: modeTitle(mode),
    genre: genre || inputReq.plotHold?.genre,
    premise: inputReq.premise || inputReq.plotHold?.premise || '',
    tone: inputReq.tone || inputReq.plotHold?.tone || '',
    output: resolvedOutput,
    sourceText: sourceText.slice(-8000),
    prizeLens: awardLensPromptBlock(lens),
    plotHoldBlock: buildServerPlotHoldBlock(inputReq.plotHold),
    focusBeat,
  }, budget));
  let text = await callServerAi(`${route.systemInstruction}\n\n${AWARD_BAR}\n\n${prompt}\n\nAppend only new material. Do not repeat prior pages.`, false, {
    maxTokens: tokensForWordTarget(budget?.sectionTarget || 2500),
  });
  text = await ensureSectionLength({ text, budget, mode, focusBeat });
  return {
    text,
    focusBeat,
    beatTitle: pending?.title || requestedTitle || null,
    wordCount: countWords(text),
    sectionTarget: budget?.sectionTarget ?? null,
    bookTarget: budget?.bookTarget ?? null,
    awardLens: lens,
  };
}

async function runWholeBookJob(jobId: string, request: WriteRequest) {
  const mode = safeMode(request.mode);
  const hold = request.plotHold ? JSON.parse(JSON.stringify(request.plotHold)) as ServerPlotHold : null;
  if (!hold?.beats?.length) {
    updateJob(jobId, { status: 'failed', error: 'No held spine was supplied.' });
    return;
  }
  let manuscript = request.sourceText || '';
  const pendingBeats = hold.beats.filter((b) => (b.status || 'pending') !== 'drafted');
  const total = pendingBeats.length || hold.beats.length;
  let done = 0;
  let lastScore: number | null = null;

  updateJob(jobId, {
    status: 'running', progress: 1, stage: 'starting',
    result: { manuscript, plotHold: hold, done, total, currentTitle: '', words: countWords(manuscript) },
  });

  try {
    for (let index = 0; index < hold.beats.length; index++) {
      const beat = hold.beats[index];
      if ((beat.status || 'pending') === 'drafted' && manuscript.trim()) continue;
      const focusBeat = `${beat.title}: ${beat.turn}`;
      updateJob(jobId, {
        status: 'running',
        progress: Math.max(2, Math.round((done / Math.max(1, total)) * 100)),
        stage: `writing:${beat.title}`,
        result: { manuscript, plotHold: hold, done, total, currentTitle: beat.title, words: countWords(manuscript), score: lastScore ?? undefined },
      });

      const common: WriteRequest = {
        ...request,
        mode,
        plotHold: hold,
        focusBeat,
        sourceText: manuscript,
        wholeBook: true,
        output: mode === 'nonfiction' || mode === 'essay'
          ? 'Full section for this beat only — hit the aspire-to section word target. Do not restart or repeat prior sections.'
          : 'Full chapter for this beat only — hit the aspire-to section word target. Do not restart or repeat prior chapters.',
      };
      const generated = manuscript.trim() ? await generateContinuation(common) : await generatePrizeSection(common);
      const chunk = generated.text || '';
      manuscript = manuscript.trim()
        ? `${manuscript.trim()}${sectionHeading(beat.title, index, mode)}${chunk}`.trim()
        : chunk;
      beat.status = 'drafted';
      done += 1;
      if ('quality' in generated && generated.quality?.overallScore != null) lastScore = generated.quality.overallScore;
      updateJob(jobId, {
        status: 'running',
        progress: Math.min(99, Math.round((done / Math.max(1, total)) * 100)),
        stage: done >= total ? 'finishing' : 'section-complete',
        result: {
          manuscript,
          plotHold: hold,
          done,
          total,
          currentTitle: beat.title,
          words: countWords(manuscript),
          score: lastScore ?? undefined,
          sectionTarget: generated.sectionTarget,
        },
      });
    }
    updateJob(jobId, {
      status: 'complete', progress: 100, stage: 'complete',
      result: {
        manuscript,
        finalText: manuscript,
        plotHold: hold,
        done,
        total,
        currentTitle: '',
        words: countWords(manuscript),
        score: lastScore ?? undefined,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Whole-book drafting failed';
    updateJob(jobId, {
      status: 'failed',
      error: message,
      stage: 'failed',
      result: { manuscript, plotHold: hold, done, total, currentTitle: hold.beats.find((b) => (b.status || 'pending') !== 'drafted')?.title || '', words: countWords(manuscript), score: lastScore ?? undefined },
    });
  }
}

router.get('/awards', (_req, res) => {
  res.json({ success: true, data: { lenses: BUILTIN_AWARD_LENSES } });
});

router.post('/seed', async (req, res) => {
  const { seed = '', mode = 'novel' } = req.body as { seed?: string; mode?: NovelWriteProMode };
  const modeSafe = safeMode(mode);
  const job = createJob('seed-to-story', 'proposing');
  updateJob(job.id, { status: 'running' });
  try {
    const raw = await callServerAi(buildSeedToStoryPrompt(seed, modeSafe), true);
    let proposal: Record<string, unknown> = {};
    try { proposal = JSON.parse(raw); }
    catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start >= 0 && end > start) proposal = JSON.parse(raw.slice(start, end + 1));
    }
    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete', result: proposal });
    res.json({ success: true, data: proposal, jobId: job.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Seed proposal failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

router.post('/auto-write', async (req, res) => {
  const request = req.body as WriteRequest;
  const job = createJob('auto-write', 'drafting');
  updateJob(job.id, { status: 'running' });
  try {
    const mode = safeMode(request.mode);
    const genre = request.genre?.trim() ? request.genre : defaultGenreForMode(mode);
    const lens = getAwardLens(request.prizeLensId);
    const sourceText = request.sourceText || '';
    const budget = budgetFromRequest({ mode, targetWordCount: request.targetWordCount, sourceText, plotHold: request.plotHold });
    const resolvedOutput = budget ? sectionOutputInstruction(budget, beatKindForMode(mode)) : (request.output || 'Full chapter for the current focus beat');
    const route = routeCaspaIntent(sourceText, `write ${resolvedOutput}`);
    const prompt = buildAutoWritePrompt(withBudgetFields({
      mode, modeTitle: modeTitle(mode), genre, premise: request.premise || '', tone: request.tone || '', output: resolvedOutput,
      sourceText, prizeLens: awardLensPromptBlock(lens), plotHoldBlock: buildServerPlotHoldBlock(request.plotHold), focusBeat: request.focusBeat,
    }, budget));
    let text = await callServerAi(`${route.systemInstruction}\n\n${prompt}`, false, { maxTokens: tokensForWordTarget(budget?.sectionTarget || 2500) });
    text = await ensureSectionLength({ text, budget, mode, focusBeat: request.focusBeat });
    const data = { text, awardLens: lens, routing: route, wordCount: countWords(text), sectionTarget: budget?.sectionTarget ?? null, bookTarget: budget?.bookTarget ?? null };
    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
    res.json({ success: true, data, jobId: job.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auto-write failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

router.post('/prize-draft', async (req, res) => {
  const job = createJob('prize-draft', 'planning');
  updateJob(job.id, { status: 'running', progress: 5, stage: 'planning' });
  try {
    const data = await generatePrizeSection(req.body as WriteRequest);
    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete', result: { words: data.wordCount, score: data.quality.overallScore } });
    res.json({ success: true, jobId: job.id, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prize draft failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

router.post('/whole-book/start', (req, res) => {
  const request = req.body as WriteRequest;
  if (!request.plotHold?.beats?.length) {
    return res.status(400).json({ success: false, message: 'Expand a seed into a spine first.' });
  }
  const job = createJob('auto-write', 'whole-book-queued');
  updateJob(job.id, {
    status: 'queued', progress: 0, stage: 'whole-book-queued',
    result: { manuscript: request.sourceText || '', plotHold: request.plotHold, done: 0, total: request.plotHold.beats.filter((b) => (b.status || 'pending') !== 'drafted').length || request.plotHold.beats.length, words: countWords(request.sourceText || '') },
  });
  setImmediate(() => { void runWholeBookJob(job.id, request); });
  return res.status(202).json({ success: true, jobId: job.id, statusUrl: `/api/caspa/write/whole-book/job/${job.id}` });
});

router.get('/whole-book/job/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Whole-book job not found.' });
  return res.json({ success: true, data: job });
});

router.post('/cut', async (req, res) => {
  const { content = '', mode = 'novel', targetWordCount = null, reduction = null } = req.body as {
    content?: string; mode?: NovelWriteProMode; targetWordCount?: number | null; reduction?: number | null;
  };
  if (!content.trim()) return res.status(400).json({ success: false, message: 'content is required' });
  const modeSafe = safeMode(mode);
  const plan = planQualityCut(content, { mode: modeSafe, targetWordCount: typeof targetWordCount === 'number' && targetWordCount > 0 ? targetWordCount : null });
  if (typeof reduction === 'number' && reduction > 0) {
    plan.suggestedReduction = Math.min(0.45, Math.max(0.04, reduction));
    plan.suggestedAfterWords = Math.max(40, Math.round(plan.beforeWords * (1 - plan.suggestedReduction)));
    plan.needsCut = true;
    plan.reasons = [`Author requested a soft lean (~${Math.round(plan.suggestedReduction * 100)}%).`, ...plan.reasons];
  }
  try {
    const text = await callServerAi(buildCutPrompt(content, { mode: modeSafe, targetWordCount: plan.targetWords, suggestedReduction: plan.needsCut ? plan.suggestedReduction : 0, cutBrief: plan.cutBrief }));
    const afterWords = countWords(text);
    res.json({ success: true, data: { text, beforeWords: plan.beforeWords, afterWords, targetWords: plan.targetWords, suggestedAfterWords: plan.suggestedAfterWords, suggestedReduction: plan.suggestedReduction, needsCut: plan.needsCut, reasons: plan.reasons, qualityScoreBefore: plan.qualityScore, cutDelta: plan.beforeWords - afterWords } });
  } catch (err) {
    res.status(500).json({ success: false, message: err instanceof Error ? err.message : 'Cut failed' });
  }
});

router.post('/cut-plan', async (req, res) => {
  const { content = '', mode = 'novel', targetWordCount = null } = req.body as { content?: string; mode?: NovelWriteProMode; targetWordCount?: number | null };
  if (!content.trim()) return res.status(400).json({ success: false, message: 'content is required' });
  const plan = planQualityCut(content, { mode: safeMode(mode), targetWordCount: typeof targetWordCount === 'number' && targetWordCount > 0 ? targetWordCount : null });
  res.json({ success: true, data: plan });
});

router.post('/prize-pass', async (req, res) => {
  const { content = '', prizeLensId, title = 'Untitled', mode = 'novel', targetWordCount = null } = req.body as {
    content?: string; prizeLensId?: string; title?: string; mode?: NovelWriteProMode; targetWordCount?: number | null;
  };
  if (!content.trim()) return res.status(400).json({ success: false, message: 'content is required' });
  const modeSafe = safeMode(mode);
  const lens = getAwardLens(prizeLensId);
  const job = createJob('prize-pass', 'assessing');
  updateJob(job.id, { status: 'running' });
  try {
    const quality = aggregateQuality(runQualityGates(content, modeSafe));
    const words = countWords(content);
    const nonfiction = modeSafe === 'nonfiction' || modeSafe === 'essay';
    const assessPrompt = [
      nonfiction ? 'You are a serious non-fiction assessor using an inspired-by quality lens (not official criteria).' : 'You are a prize-committee literary assessor using an inspired-by lens (not official criteria).',
      `Title: ${title}`, `Mode: ${modeTitle(modeSafe)}`,
      typeof targetWordCount === 'number' && targetWordCount > 0 ? `Aspire-to length: ~${Math.round(targetWordCount).toLocaleString()} words (current: ${words.toLocaleString()}).` : `Current length: ${words.toLocaleString()} words.`,
      awardLensPromptBlock(lens), engineRulesForMode(modeSafe), AWARD_BAR, '',
      nonfiction ? 'Score the excerpt 0–100 on: clarity, claimPrecision, evidence, structure, originality, language, pace, depth.' : 'Score the excerpt 0–100 on: voice, control, originality, structure, emotionalForce, language, pace, depth.',
      'Return JSON: {"overallReadiness":0-100,"prose":{...scores},"strengths":[],"risks":[],"fixes":["top 5 concrete fixes"],"judgeComment":"2 sentences"}', '', content.slice(0, 10000),
    ].join('\n');
    const raw = await callServerAi(assessPrompt, true);
    let assessment: Record<string, unknown> = {};
    try { assessment = JSON.parse(raw); } catch { assessment = { overallReadiness: quality.overallScore, judgeComment: raw.slice(0, 500), fixes: [] }; }
    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
    res.json({ success: true, jobId: job.id, data: { awardLens: lens, quality, assessment, wordCount: words, targetWordCount: typeof targetWordCount === 'number' && targetWordCount > 0 ? targetWordCount : null, readyEnough: Number(assessment.overallReadiness || quality.overallScore) >= 78 } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prize pass failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

router.post('/continue', async (req, res) => {
  const job = createJob('auto-write', 'continue');
  updateJob(job.id, { status: 'running' });
  try {
    const data = await generateContinuation(req.body as WriteRequest);
    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
    res.json({ success: true, jobId: job.id, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Continue failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

router.get('/engine', (_req, res) => {
  res.json({ success: true, data: { literaryRules: LITERARY_ENGINE_RULES, nonfictionRules: engineRulesForMode('nonfiction'), awardBar: AWARD_BAR, artefactFirst: ARTEFACT_FIRST, steps: ['seed', 'spine', 'draft', 'cut', 'pack'], cutPolicy: 'Cut by product need (aspire-to length + quality gates). Never a fixed percentage quota.', wholeBookTransport: 'background-job-polling' } });
});

export default router;
