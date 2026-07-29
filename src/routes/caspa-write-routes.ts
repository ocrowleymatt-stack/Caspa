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
import { countWords, planQualityCut } from '../services/wordCountService';

const router = express.Router();

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
  const job = createJob('auto-write', 'drafting');
  updateJob(job.id, { status: 'running' });

  try {
    const route = routeCaspaIntent(sourceText, `write ${output}`);
    const prompt = buildAutoWritePrompt({
      mode: safeMode,
      modeTitle: modeTitle(safeMode),
      genre: resolvedGenre,
      premise,
      tone,
      output,
      sourceText,
      prizeLens: awardLensPromptBlock(lens),
      plotHoldBlock: buildServerPlotHoldBlock(plotHold),
      focusBeat,
      targetWordCount:
        typeof targetWordCount === 'number' && targetWordCount > 0 ? targetWordCount : null,
    });

    const text = await callServerAi(`${route.systemInstruction}\n\n${prompt}`);
    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
    res.json({
      success: true,
      data: {
        text,
        awardLens: lens,
        routing: route,
        wordCount: countWords(text),
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
  const input = {
    mode: safeMode,
    modeTitle: modeTitle(safeMode),
    genre: resolvedGenre,
    premise,
    tone,
    output,
    sourceText,
    prizeLens: awardLensPromptBlock(lens),
    plotHoldBlock: buildServerPlotHoldBlock(plotHold),
    focusBeat,
    targetWordCount:
      typeof targetWordCount === 'number' && targetWordCount > 0 ? targetWordCount : null,
  };

  const job = createJob('prize-draft', 'planning');
  updateJob(job.id, { status: 'running', progress: 5, stage: 'planning' });

  try {
    const planRaw = await callServerAi(buildPlanningPrompt(input), true);
    const plan = parseStructuredPlan(planRaw, {
      premise,
      genre: resolvedGenre,
      tone,
      formatDecision: output,
    });

    updateJob(job.id, { progress: 25, stage: 'drafting' });
    const draft = await callServerAi(buildFirstDraftPrompt(input, plan));

    updateJob(job.id, { progress: 55, stage: 'critic' });
    const criticReport = await callServerAi(buildCriticPrompt(plan, draft));

    updateJob(job.id, { progress: 75, stage: 'rewrite' });
    const rewritten = await callServerAi(buildRewritePrompt(input, plan, draft, criticReport));

    const findings = runQualityGates(rewritten, safeMode === 'polish' ? 'novel' : safeMode);
    const quality = aggregateQuality(findings);

    updateJob(job.id, {
      status: 'complete',
      progress: 100,
      stage: 'complete',
      result: { words: rewritten.trim().split(/\s+/).filter(Boolean).length, score: quality.overallScore },
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
        wordCount: rewritten.trim().split(/\s+/).filter(Boolean).length,
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
    wholeBook?: boolean;
    targetWordCount?: number | null;
  };

  const safeMode = VALID_MODES.includes(mode) ? mode : 'novel';
  const resolvedGenre = genre?.trim() ? genre : defaultGenreForMode(safeMode);
  const lens = getAwardLens(prizeLensId);
  const holdBlock = buildServerPlotHoldBlock(plotHold);
  const pending =
    plotHold?.beats?.find((b) => (b.status || 'pending') === 'pending') ||
    plotHold?.beats?.find((b) => b.status !== 'drafted') ||
    null;
  const focusBeat = pending ? `${pending.title}: ${pending.turn}` : 'Continue from the last page with the next inevitable turn.';
  const continueOutput =
    output?.trim() ||
    (wholeBook
      ? 'Full chapter for this beat only (1500–2500 words). Do not restart the book or repeat prior chapters.'
      : 'Next scene / chapter section only (1200–2000 words). Do not restart the book.');

  const job = createJob('auto-write', 'continue');
  updateJob(job.id, { status: 'running' });

  try {
    const route = routeCaspaIntent(sourceText, 'continue writing the next scene');
    const prompt = buildAutoWritePrompt({
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
      targetWordCount:
        typeof targetWordCount === 'number' && targetWordCount > 0 ? targetWordCount : null,
    });

    const text = await callServerAi(
      `${route.systemInstruction}\n\n${AWARD_BAR}\n\n${prompt}\n\nAppend only new material. Do not repeat prior pages.`
    );

    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
    res.json({
      success: true,
      jobId: job.id,
      data: {
        text,
        focusBeat,
        beatTitle: pending?.title || null,
        wordCount: text.trim().split(/\s+/).filter(Boolean).length,
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

