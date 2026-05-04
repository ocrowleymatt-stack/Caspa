import { AIService } from './ai';
import { updateNarrativeRuntimeMemory } from './installLiteraryRuntime';
import { Chapter, Character, PlotNode, Project, ResearchNote, SourceMaterial, ExternalReview } from '../types';
import { buildCleanContinuityContext, repetitionPenaltyReport, applyScorePenalties } from './contextHygiene';

export type NarrativeScore = {
  overall: number;
  prose: number;
  structure: number;
  character: number;
  originality: number;
  continuity: number;
  marketPrizeFit: number;
  verdict: 'pass' | 'revise' | 'rewrite';
  reasons: string[];
  requiredFixes: string[];
};

export type NarrativeCycleResult = {
  draft: string;
  score: NarrativeScore;
  critique: string;
  rewriteApplied: boolean;
  attempts: number;
  blocked?: boolean;
  blockReason?: string;
};

function safeParseJSON(text: string, fallback: any) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try { return JSON.parse(match[1]); } catch {}
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch {}
    }
    return fallback;
  }
}

function clampScore(value: any, fallback = 60): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normaliseScore(raw: any): NarrativeScore {
  const overall = clampScore(raw.overall ?? raw.score, 60);
  const score: NarrativeScore = {
    overall,
    prose: clampScore(raw.prose, overall),
    structure: clampScore(raw.structure, overall),
    character: clampScore(raw.character, overall),
    originality: clampScore(raw.originality, overall),
    continuity: clampScore(raw.continuity, overall),
    marketPrizeFit: clampScore(raw.marketPrizeFit ?? raw.prizeFit, overall),
    verdict: raw.verdict === 'pass' || raw.verdict === 'revise' || raw.verdict === 'rewrite'
      ? raw.verdict
      : overall >= 82 ? 'pass' : overall >= 68 ? 'revise' : 'rewrite',
    reasons: Array.isArray(raw.reasons) ? raw.reasons.map(String).slice(0, 8) : [],
    requiredFixes: Array.isArray(raw.requiredFixes) ? raw.requiredFixes.map(String).slice(0, 10) : []
  };

  if (score.overall < 68) score.verdict = 'rewrite';
  else if (score.overall < 82 && score.verdict === 'pass') score.verdict = 'revise';

  return score;
}

export async function scoreNarrativeChapter(args: {
  project: Project;
  chapterTitle: string;
  draft: string;
  previousChapters?: Chapter[];
  characters?: Character[];
  targetPrize?: string;
}): Promise<{ score: NarrativeScore; critique: string }> {
  const context = buildCleanContinuityContext(args.previousChapters || []);

  const prompt = `
You are the Narrative Quality Controller for a serious literary manuscript.

Assess this chapter with brutal practical precision. Return ONLY valid JSON.

Project: ${args.project.title}
Genre: ${args.project.genre}
Tone: ${args.project.tone}
Target prize/standard: ${args.targetPrize || args.project.targetPrize || 'serious literary fiction'}

Previous continuity context:
${context}

Chapter title: ${args.chapterTitle}

Draft:
${args.draft.slice(0, 45000)}

Score fields 0-100:
- overall
- prose
- structure
- character
- originality
- continuity
- marketPrizeFit

Verdict must be one of: pass, revise, rewrite.

JSON shape:
{
  "overall": 0,
  "prose": 0,
  "structure": 0,
  "character": 0,
  "originality": 0,
  "continuity": 0,
  "marketPrizeFit": 0,
  "verdict": "pass|revise|rewrite",
  "reasons": ["..."],
  "requiredFixes": ["..."]
}`;

  const raw = await AIService.callAI({ prompt, json: true, model: 'gemini-flash-latest' } as any);
  const parsed = safeParseJSON(raw || '{}', {});
  let score = normaliseScore(parsed);

  const penalties = repetitionPenaltyReport(args.draft, args.previousChapters || []);
  score = applyScorePenalties(score as any, penalties) as NarrativeScore;

  const critique = [...score.reasons, ...score.requiredFixes].join('\n');
  return { score, critique };
}

export async function rewriteWithCritique(args: {
  project: Project;
  chapterTitle: string;
  draft: string;
  critique: string;
  score: NarrativeScore;
  previousChapters?: Chapter[];
  research?: ResearchNote[];
}): Promise<string> {
  const previous = buildCleanContinuityContext(args.previousChapters || []);

  const prompt = `
Rewrite the chapter below using the critique and score report.

Rules:
- Return the full rewritten chapter only.
- Preserve essential plot facts and continuity.
- Fix the specific weaknesses; do not perform decorative rewriting.
- If the score is low, rebuild weak scenes rather than polishing bad paragraphs.
- Expand only through earned scene action, dialogue pressure, contradiction, setting pressure and interiority.
- No padding. No meta-commentary.
- Remove repeated openings, duplicated blocks and recycled phrasing.

Project: ${args.project.title}
Target standard: ${args.project.targetPrize || 'serious literary fiction'}
Chapter: ${args.chapterTitle}

Previous continuity:
${previous}

Score:
${JSON.stringify(args.score, null, 2)}

Critique:
${args.critique}

Draft to rewrite:
${args.draft.slice(0, 65000)}
`;

  return await AIService.callAI({ prompt, model: 'gemini-3.1-pro-preview' } as any);
}

export async function runNarrativeQualityCycle(args: {
  project: Project;
  title: string;
  summary: string;
  context: string;
  activeNodes: PlotNode[];
  research?: ResearchNote[];
  characters?: Character[];
  chapters?: Chapter[];
  sourceMaterials?: SourceMaterial[];
  directives?: string[];
  externalReviews?: ExternalReview[];
  maxAttempts?: number;
}): Promise<NarrativeCycleResult> {
  const chapters = args.chapters || [];
  const characters = args.characters || [];
  const maxAttempts = Math.max(1, Math.min(args.maxAttempts || 2, 4));

  updateNarrativeRuntimeMemory({ project: args.project, chapters, characters });

  const cleanContext = buildCleanContinuityContext(chapters);

  let draft = await AIService.writeDraft(
    args.title,
    args.summary,
    cleanContext,
    args.project.type,
    args.activeNodes,
    args.research || [],
    args.project.maturity,
    args.sourceMaterials || [],
    args.directives || [],
    args.project.targetWordCount,
    args.externalReviews || []
  );

  let attempts = 1;
  let rewriteApplied = false;
  let scored = await scoreNarrativeChapter({
    project: args.project,
    chapterTitle: args.title,
    draft,
    previousChapters: chapters,
    characters,
    targetPrize: args.project.targetPrize
  });

  while (attempts < maxAttempts && scored.score.verdict !== 'pass') {
    draft = await rewriteWithCritique({
      project: args.project,
      chapterTitle: args.title,
      draft,
      critique: scored.critique,
      score: scored.score,
      previousChapters: chapters,
      research: args.research || []
    });
    rewriteApplied = true;
    attempts += 1;
    scored = await scoreNarrativeChapter({
      project: args.project,
      chapterTitle: args.title,
      draft,
      previousChapters: chapters,
      characters,
      targetPrize: args.project.targetPrize
    });
  }

  if (scored.score.overall < 82) {
    return {
      draft,
      score: scored.score,
      critique: scored.critique,
      rewriteApplied,
      attempts,
      blocked: true,
      blockReason: `QUALITY_GATE_BLOCK: Chapter did not reach required quality. Final score: ${scored.score.overall}`
    };
  }

  return {
    draft,
    score: scored.score,
    critique: scored.critique,
    rewriteApplied,
    attempts,
    blocked: false
  };
}
