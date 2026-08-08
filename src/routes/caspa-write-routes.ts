/**
 * Quick Write + prize draft routes — seed → spine → draft → critic → rewrite.
 */

import express from 'express';
import { callServerAi } from '../services/serverAiHelper';
import { createJob, updateJob } from '../services/jobQueueService';
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

function beatKindForMode(mode: NovelWriteProMode): 'chapter' | 'section' | 'scene' {
  if (mode === 'nonfiction' || mode === 'essay') return 'section';
  if (mode === 'script' || mode === 'musical') return 'scene';
  return 'chapter';
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
  // Up to two expand passes if the model stops short of the contract.
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

const VALID_MODES: NovelWriteProMode[] = [
  'novel',
  'nonfiction',
  'essay',
  'poetry',
  'script',
  'musical',
  'adaptation',
  'polish',
  'chaos',
];

function defaultGenreForMode(mode: NovelWriteProMode): string {
  switch (mode) {
    case 'nonfiction':
      return 'Creative Non-Fiction';
    case 'essay':
      return 'Educational';
    case 'poetry':
      return 'Epic Poetry';
    case 'script':
      return 'Stage Play';
    case 'musical':
      return 'Musical / Show';
    case 'adaptation':
      return 'Literary Fiction';
    case 'polish':
      return 'Literary Fiction';
    case 'chaos':
      return 'Experimental';
    case 'novel':
    default:
      return 'Literary Fiction';
  }
}

router.get('/awards', (_req, res) => {
  res.json({ success: true, data: { lenses: BUILTIN_AWARD_LENSES } });
});

router.post('/seed', async (req, res) => {
  const { seed = '', mode = 'novel' } = req.body as { seed?: string; mode?: NovelWriteProMode };
  const safeMode = VALID_MODES.includes(mode) ? mode : 'novel';
  const job = createJob('seed-to-story', 'proposing');
  updateJob(job.id, { status: 'running' });

  try {
    const raw = await callServerAi(buildSeedToStoryPrompt(seed, safeMode), true);
    let proposal: Record<string, unknown> = {};
    try {
      proposal = JSON.parse(raw);
    } catch {
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
  const {
    mode = 'novel',
    genre = '',
    premise = '',
    tone = '',
    output = 'Full chapter for the current focus beat (1500–2500 words)',
    sourceText = '',
    prizeLensId,
    plotHold,
    focusBeat,
    targetWordCount = null,
  } = req.body as {
    mode?: NovelWriteProMode;
    genre?: string;
    premise?: string;
    tone?: string;
    output?: string;
    sourceText?: string;
    prizeLensId?: string;
    plotHold?: ServerPlotHold;
    focusBeat?: string;
    targetWordCount?: number | null;
  };

  const safeMode = VALID_MODES.includes(mode) ? mode : 'novel';
  const resolvedGenre = genre?.trim() ? genre : defaultGenreForMode(safeMode);
  const lens = getAwardLens(prizeLensId);
  const budget = budgetFromRequest({ mode: safeMode, targetWordCount, sourceText, plotHold });
  const kind = beatKindForMode(safeMode);
  const resolvedOutput = budget ? sectionOutputInstruction(budget, kind) : output;
  const job = createJob('auto-write', 'drafting');
  updateJob(job.id, { status: 'running' });

  try {
    const route = routeCaspaIntent(sourceText, `write ${resolvedOutput}`);
    const prompt = buildAutoWritePrompt(
      withBudgetFields(
        {
          mode: safeMode,
          modeTitle: modeTitle(safeMode),
          genre: resolvedGenre,
          premise,
          tone,
          output: resolvedOutput,
          sourceText,
          prizeLens: awardLensPromptBlock(lens),
          plotHoldBlock: buildServerPlotHoldBlock(plotHold),
          focusBeat,
        },
        budget
      )
    );

    let text = await callServerAi(`${route.systemInstruction}\n\n${prompt}`, false, {
      maxTokens: tokensForWordTarget(budget?.sectionTarget || 2500),
    });
    text = await ensureSectionLength({ text, budget, mode: safeMode, focusBeat });
    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
    res.json({
      success: true,
      data: {
        text,
        awardLens: lens,
        routing: route,
        wordCount: countWords(text),
        sectionTarget: budget?.sectionTarget ?? null,
        bookTarget: budget?.bookTarget ?? null,
      },
      jobId: job.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auto-write failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

router.post('/prize-draft', async (req, res) => {
  const {
    mode = 'novel',
    genre = '',
    premise = '',
    tone = '',
    output = 'Full opening chapter for the current focus beat (1800–2800 words)',
    sourceText = '',
    prizeLensId,
    plotHold,
    focusBeat,
    targetWordCount = null,
  } = req.body as {
    mode?: NovelWriteProMode;
    genre?: string;
    premise?: string;
    tone?: string;
    output?: string;
    sourceText?: string;
    prizeLensId?: string;
    plotHold?: ServerPlotHold;
    focusBeat?: string;
    targetWordCount?: number | null;
  };

  const safeMode = VALID_MODES.includes(mode) ? mode : 'novel';
  const resolvedGenre = genre?.trim() ? genre : defaultGenreForMode(safeMode);
  const lens = getAwardLens(prizeLensId);
  const budget = budgetFromRequest({ mode: safeMode, targetWordCount, sourceText, plotHold });
  const kind = beatKindForMode(safeMode);
  const resolvedOutput = budget ? sectionOutputInstruction(budget, kind) : output;
  const input = withBudgetFields(
    {
      mode: safeMode,
      modeTitle: modeTitle(safeMode),
      genre: resolvedGenre,
      premise,
      tone,
      output: resolvedOutput,
      sourceText,
      prizeLens: awardLensPromptBlock(lens),
      plotHoldBlock: buildServerPlotHoldBlock(plotHold),
      focusBeat,
    },
    budget
  );

  const job = createJob('prize-draft', 'planning');
  updateJob(job.id, { status: 'running', progress: 5, stage: 'planning' });
  const proseTokens = tokensForWordTarget(budget?.sectionTarget || 2500);

  try {
    const planRaw = await callServerAi(buildPlanningPrompt(input), true);
    const plan = parseStructuredPlan(planRaw, {
      premise,
      genre: resolvedGenre,
      tone,
      formatDecision: resolvedOutput,
    });

    updateJob(job.id, { progress: 25, stage: 'drafting' });
    let draft = await callServerAi(buildFirstDraftPrompt(input, plan), false, { maxTokens: proseTokens });
    draft = await ensureSectionLength({ text: draft, budget, mode: safeMode, focusBeat });

    updateJob(job.id, { progress: 55, stage: 'critic' });
    const criticReport = await callServerAi(buildCriticPrompt(plan, draft));

    updateJob(job.id, { progress: 75, stage: 'rewrite' });
    let rewritten = await callServerAi(buildRewritePrompt(input, plan, draft, criticReport), false, {
      maxTokens: proseTokens,
    });
    rewritten = await ensureSectionLength({
      text: rewritten,
      budget,
      mode: safeMode,
      focusBeat,
    });

    const findings = runQualityGates(rewritten, safeMode === 'polish' ? 'novel' : safeMode);
    const quality = aggregateQuality(findings);
    const words = countWords(rewritten);

    updateJob(job.id, {
      status: 'complete',
      progress: 100,
      stage: 'complete',
      result: { words, score: quality.overallScore },
    });

    res.json({
      success: true,
      jobId: job.id,
      data: {
        plan,
        draft,
        criticReport,
        text: rewritten,
        awardLens: lens,
        quality,
        wordCount: words,
        sectionTarget: budget?.sectionTarget ?? null,
        bookTarget: budget?.bookTarget ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prize draft failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

router.post('/cut', async (req, res) => {
  const {
    content = '',
    mode = 'novel',
    targetWordCount = null,
    reduction = null,
  } = req.body as {
    content?: string;
    mode?: NovelWriteProMode;
    targetWordCount?: number | null;
    /** Optional override — ignored unless explicitly provided; quality/target plan wins by default. */
    reduction?: number | null;
  };
  if (!content.trim()) return res.status(400).json({ success: false, message: 'content is required' });

  const safeMode = VALID_MODES.includes(mode) ? mode : 'novel';
  const plan = planQualityCut(content, {
    mode: safeMode,
    targetWordCount:
      typeof targetWordCount === 'number' && targetWordCount > 0 ? targetWordCount : null,
  });

  // Explicit reduction is a soft override only when the client insists; still no hard quota in the prompt.
  if (typeof reduction === 'number' && reduction > 0) {
    plan.suggestedReduction = Math.min(0.45, Math.max(0.04, reduction));
    plan.suggestedAfterWords = Math.max(40, Math.round(plan.beforeWords * (1 - plan.suggestedReduction)));
    plan.needsCut = true;
    plan.reasons = [`Author requested a soft lean (~${Math.round(plan.suggestedReduction * 100)}%).`, ...plan.reasons];
  }

  try {
    const text = await callServerAi(
      buildCutPrompt(content, {
        mode: safeMode,
        targetWordCount: plan.targetWords,
        suggestedReduction: plan.needsCut ? plan.suggestedReduction : 0,
        cutBrief: plan.cutBrief,
      })
    );
    const afterWords = countWords(text);
    res.json({
      success: true,
      data: {
        text,
        beforeWords: plan.beforeWords,
        afterWords,
        targetWords: plan.targetWords,
        suggestedAfterWords: plan.suggestedAfterWords,
        suggestedReduction: plan.suggestedReduction,
        needsCut: plan.needsCut,
        reasons: plan.reasons,
        qualityScoreBefore: plan.qualityScore,
        cutDelta: plan.beforeWords - afterWords,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err instanceof Error ? err.message : 'Cut failed' });
  }
});

router.post('/cut-plan', async (req, res) => {
  const { content = '', mode = 'novel', targetWordCount = null } = req.body as {
    content?: string;
    mode?: NovelWriteProMode;
    targetWordCount?: number | null;
  };
  if (!content.trim()) return res.status(400).json({ success: false, message: 'content is required' });
  const safeMode = VALID_MODES.includes(mode) ? mode : 'novel';
  const plan = planQualityCut(content, {
    mode: safeMode,
    targetWordCount:
      typeof targetWordCount === 'number' && targetWordCount > 0 ? targetWordCount : null,
  });
  res.json({ success: true, data: plan });
});

router.post('/prize-pass', async (req, res) => {
  const {
    content = '',
    prizeLensId,
    title = 'Untitled',
    mode = 'novel',
    targetWordCount = null,
  } = req.body as {
    content?: string;
    prizeLensId?: string;
    title?: string;
    mode?: NovelWriteProMode;
    targetWordCount?: number | null;
  };
  if (!content.trim()) return res.status(400).json({ success: false, message: 'content is required' });

  const safeMode = VALID_MODES.includes(mode) ? mode : 'novel';
  const lens = getAwardLens(prizeLensId);
  const job = createJob('prize-pass', 'assessing');
  updateJob(job.id, { status: 'running' });

  try {
    const findings = runQualityGates(content, safeMode);
    const quality = aggregateQuality(findings);
    const words = countWords(content);
    const nonfiction = safeMode === 'nonfiction' || safeMode === 'essay';
    const rules = engineRulesForMode(safeMode);

    const assessPrompt = [
      nonfiction
        ? 'You are a serious non-fiction assessor using an inspired-by quality lens (not official criteria).'
        : 'You are a prize-committee literary assessor using an inspired-by lens (not official criteria).',
      `Title: ${title}`,
      `Mode: ${modeTitle(safeMode)}`,
      typeof targetWordCount === 'number' && targetWordCount > 0
        ? `Aspire-to length: ~${Math.round(targetWordCount).toLocaleString()} words (current: ${words.toLocaleString()}).`
        : `Current length: ${words.toLocaleString()} words.`,
      awardLensPromptBlock(lens),
      rules,
      AWARD_BAR,
      '',
      nonfiction
        ? 'Score the excerpt 0–100 on: clarity, claimPrecision, evidence, structure, originality, language, pace, depth.'
        : 'Score the excerpt 0–100 on: voice, control, originality, structure, emotionalForce, language, pace, depth.',
      'Return JSON: {"overallReadiness":0-100,"prose":{...scores},"strengths":[],"risks":[],"fixes":["top 5 concrete fixes"],"judgeComment":"2 sentences"}',
      '',
      content.slice(0, 10000),
    ].join('\n');

    const raw = await callServerAi(assessPrompt, true);
    let assessment: Record<string, unknown> = {};
    try {
      assessment = JSON.parse(raw);
    } catch {
      assessment = { overallReadiness: quality.overallScore, judgeComment: raw.slice(0, 500), fixes: [] };
    }

    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
    res.json({
      success: true,
      jobId: job.id,
      data: {
        awardLens: lens,
        quality,
        assessment,
        wordCount: words,
        targetWordCount:
          typeof targetWordCount === 'number' && targetWordCount > 0 ? targetWordCount : null,
        readyEnough: Number(assessment.overallReadiness || quality.overallScore) >= 78,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prize pass failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

router.post('/continue', async (req, res) => {
  const {
    mode = 'novel',
    genre = '',
    premise = '',
    tone = '',
    sourceText = '',
    prizeLensId,
    plotHold,
    output,
    focusBeat: requestedFocusBeat,
    wholeBook = false,
    targetWordCount = null,
  } = req.body as {
    mode?: NovelWriteProMode;
    genre?: string;
    premise?: string;
    tone?: string;
    sourceText?: string;
    prizeLensId?: string;
    plotHold?: ServerPlotHold;
    output?: string;
    focusBeat?: string;
    wholeBook?: boolean;
    targetWordCount?: number | null;
  };

  const safeMode = VALID_MODES.includes(mode) ? mode : 'novel';
  const resolvedGenre = genre?.trim() ? genre : defaultGenreForMode(safeMode);
  const lens = getAwardLens(prizeLensId);
  const holdBlock = buildServerPlotHoldBlock(plotHold);
  const requestedTitle = requestedFocusBeat?.split(':', 1)[0]?.trim();
  const requestedBeat = requestedTitle
    ? plotHold?.beats?.find((b) => b.title.trim() === requestedTitle)
    : null;
  const pending =
    requestedBeat ||
    plotHold?.beats?.find((b) => (b.status || 'pending') === 'pending') ||
    plotHold?.beats?.find((b) => b.status !== 'drafted') ||
    null;
  const focusBeat = requestedFocusBeat?.trim()
    ? requestedFocusBeat.trim()
    : pending
      ? `${pending.title}: ${pending.turn}`
      : 'Continue from the last page with the next inevitable turn.';
  const budget = budgetFromRequest({ mode: safeMode, targetWordCount, sourceText, plotHold });
  const kind = beatKindForMode(safeMode);
  const continueOutput =
    budget
      ? sectionOutputInstruction(budget, kind)
      : output?.trim() ||
        (wholeBook
          ? `Full ${kind} for this beat only. Do not restart the book or repeat prior ${kind}s.`
          : `Next ${kind} only. Do not restart the book.`);

  const job = createJob('auto-write', 'continue');
  updateJob(job.id, { status: 'running' });

  try {
    const route = routeCaspaIntent(sourceText, 'continue writing the next scene');
    const prompt = buildAutoWritePrompt(
      withBudgetFields(
        {
          mode: safeMode,
          modeTitle: modeTitle(safeMode),
          genre: resolvedGenre || plotHold?.genre,
          premise: premise || plotHold?.premise || '',
          tone: tone || plotHold?.tone || '',
          output: continueOutput,
          sourceText: sourceText.slice(-8000),
          prizeLens: awardLensPromptBlock(lens),
          plotHoldBlock: holdBlock,
          focusBeat,
        },
        budget
      )
    );

    let text = await callServerAi(
      `${route.systemInstruction}\n\n${AWARD_BAR}\n\n${prompt}\n\nAppend only new material. Do not repeat prior pages.`,
      false,
      { maxTokens: tokensForWordTarget(budget?.sectionTarget || 2500) }
    );
    text = await ensureSectionLength({ text, budget, mode: safeMode, focusBeat });

    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
    res.json({
      success: true,
      jobId: job.id,
      data: {
        text,
        focusBeat,
        beatTitle: pending?.title || requestedTitle || null,
        wordCount: countWords(text),
        sectionTarget: budget?.sectionTarget ?? null,
        bookTarget: budget?.bookTarget ?? null,
        awardLens: lens,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Continue failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

router.get('/engine', (_req, res) => {
  res.json({
    success: true,
    data: {
      literaryRules: LITERARY_ENGINE_RULES,
      nonfictionRules: engineRulesForMode('nonfiction'),
      awardBar: AWARD_BAR,
      artefactFirst: ARTEFACT_FIRST,
      steps: ['seed', 'spine', 'draft', 'cut', 'pack'],
      cutPolicy: 'Cut by product need (aspire-to length + quality gates). Never a fixed percentage quota.',
    },
  });
});

export default router;
