/**
 * Structured Caspa pipeline: plan → draft → critic → rewrite.
 * Structural integrity, continuity and promises precede prose polish.
 */

import {
  STRUCTURE_FIRST_CONTRACT,
  criticRoomForMode,
  engineRulesForMode,
  qualityBarForMode,
  ARTEFACT_FIRST,
  type NovelWriteProPromptInput,
} from './novelWritePro';

export interface StructuredPlan {
  premise: string;
  genre: string;
  tone: string;
  intendedAudience: string;
  formatDecision: string;
  characterWoundMap: string;
  scenePlan: string[];
  characters: Array<{ name: string; role: string; wound: string; desire: string }>;
  setting: string;
  themes: string[];
  structure: string;
  sourceNotes: string;
  styleRules: string[];
}

function isNonfiction(input: NovelWriteProPromptInput): boolean {
  return input.mode === 'nonfiction' || input.mode === 'essay';
}

export function buildPlanningPrompt(input: NovelWriteProPromptInput): string {
  const nf = isNonfiction(input);
  return `You are Caspa — STRUCTURAL PLANNING PHASE ONLY.

${STRUCTURE_FIRST_CONTRACT}

PROJECT TYPE: ${input.modeTitle} / ${input.genre}
USER BRIEF: ${input.premise || '[Invent a fresh premise]'}
TARGET OUTPUT: ${input.output}
TONE: ${input.tone}
SOURCE: ${input.sourceText?.slice(0, 5000) || '[Blank page]'}
${input.prizeLens ? `QUALITY LENS: ${input.prizeLens}` : ''}

${engineRulesForMode(input.mode)}

${nf ? `NON-FICTION STRUCTURE — DO NOT NOVELISE
Use these concepts:
- thesis / central question
- reader need
- section job / claim sequence
- evidence required
- definitions / mechanisms
- counterargument / limitation
- examples / case studies
- reader promises and where they are paid
- research gaps
- visual opportunities where a table/diagram/timeline/map/chart/checklist/decision tree beats prose

Legacy JSON field mapping (for compatibility only):
- characterWoundMap = thesis + argument/evidence ledger, NOT a fictional wound
- scenePlan = ordered section jobs / claim turns, NOT invented scenes
- characters = real voices/actors/sources only when actually relevant; otherwise []
- setting = factual context / jurisdiction / population / period, not atmospheric scenery
` : `FICTION STRUCTURE
Map the locked dramatic spine, chronology, characters, planted threads and expected pay-offs before prose.`}

Return JSON only (no markdown) with:
premise, genre, tone, intendedAudience, formatDecision, characterWoundMap,
scenePlan (array of 6-12 structural jobs), characters (array of {name, role, wound, desire}),
setting, themes (array), structure, sourceNotes, styleRules (array of 3-6 active rules).

In structure/sourceNotes explicitly record unresolved threads, promises, evidence dependencies and anything the next draft must not forget.`;
}

export function buildFirstDraftPrompt(input: NovelWriteProPromptInput, plan: StructuredPlan): string {
  const nf = isNonfiction(input);
  const plot = input.plotHoldBlock?.trim() ? `\nLOCKED SPINE / LEDGER\n${input.plotHoldBlock.trim()}\n` : '';
  const focus = input.focusBeat?.trim() ? `\nCURRENT STRUCTURAL JOB\n${input.focusBeat.trim()}\n` : '';
  const sectionTarget = typeof input.sectionWordTarget === 'number' && input.sectionWordTarget > 0
    ? Math.round(input.sectionWordTarget)
    : null;
  const min = Math.round(input.sectionWordMin || (sectionTarget ? sectionTarget * 0.97 : 0));
  const lengthLock = sectionTarget
    ? `\nWORD COUNT CONTRACT: write ~${sectionTarget.toLocaleString()} substantive words (minimum ${min.toLocaleString()}). Earn length through missing structure/evidence/pay-off, never padding.\n`
    : '';

  return `You are Caspa — FIRST DRAFT PHASE.

${STRUCTURE_FIRST_CONTRACT}

FORMAT DECISION: ${plan.formatDecision}
PREMISE: ${plan.premise}
${nf ? 'FACTUAL CONTEXT' : 'SETTING'}: ${plan.setting}
STRUCTURAL PLAN:
${plan.scenePlan.map((s, i) => `${i + 1}. ${s}`).join('\n')}

${nf ? 'THESIS / ARGUMENT / EVIDENCE LEDGER' : 'CHARACTER / WOUND / THREAD MAP'}:
${plan.characterWoundMap}

STRUCTURE NOTES:
${plan.structure}
${plan.sourceNotes}

STYLE RULES:
${plan.styleRules.map((r) => `- ${r}`).join('\n') || '- Clarity and structural function first'}
${plot}${focus}${lengthLock}
${engineRulesForMode(input.mode)}
${qualityBarForMode(input.mode)}
${ARTEFACT_FIRST}

${nf ? `NON-FICTION OUTPUT RULES
- Write exposition as exposition. Do not manufacture cinematic scenes, internal thoughts or dialogue.
- Distinguish verified fact, testimony, interpretation, inference and recommendation.
- Never invent references or source metadata.
- Where a visual is clearly superior, insert a concise production marker: [FIGURE SUGGESTION: type | purpose | placement].
` : ''}

Before returning, silently verify continuity, unresolved threads, due promises and the assigned structural job.
Write the ${input.output} for ${input.modeTitle}. Return usable material only.`;
}

export function buildCriticPrompt(plan: StructuredPlan, draft: string, mode: NovelWriteProPromptInput['mode'] = 'novel'): string {
  const nf = mode === 'nonfiction' || mode === 'essay';
  return `You are Caspa's internal ${nf ? 'non-fiction editorial board' : 'critic room'}.
STRUCTURE AND INTEGRITY OUTRANK PROSE POLISH.

${STRUCTURE_FIRST_CONTRACT}

PLAN SUMMARY
Premise: ${plan.premise}
Format: ${plan.formatDecision}
${nf ? 'Thesis / argument ledger' : 'Wound / thread map'}: ${plan.characterWoundMap}
Structure: ${plan.structure}
Source notes: ${plan.sourceNotes}

DRAFT
${draft.slice(0, 16000)}

${criticRoomForMode(mode)}

Report in this order:
1. STRUCTURAL JOB — did the draft perform what this unit is for?
2. CONTINUITY / THREADS — contradictions, forgotten dependencies or loops.
3. PROMISES — debts created, due, paid, broken or accidentally abandoned.
4. ${nf ? 'FACTS / EVIDENCE / PROVENANCE — unsupported claims, invented-looking facts or citations, missing limits.' : 'CAUSATION / CHARACTER — motivation, chronology, knowledge and planted/payoff logic.'}
5. AI NONSENSE — generic fog, semantic repetition, fake profundity, padding.
6. PROSE / COPY — only after 1-5.
7. TOP FIXES — numbered, concrete, structural fixes first.

If the draft is fluent but structurally wrong, say so plainly. No flattery.`;
}

export function buildRewritePrompt(
  input: NovelWriteProPromptInput,
  plan: StructuredPlan,
  draft: string,
  criticReport: string
): string {
  const nf = isNonfiction(input);
  const sectionTarget = typeof input.sectionWordTarget === 'number' && input.sectionWordTarget > 0
    ? Math.round(input.sectionWordTarget)
    : null;
  const min = Math.round(input.sectionWordMin || (sectionTarget ? sectionTarget * 0.97 : 0));
  const lengthLock = sectionTarget
    ? `\nWORD COUNT CONTRACT: finished rewrite near ${sectionTarget.toLocaleString()} words; do not shrink below ${min.toLocaleString()}. Add missing substance, not padding.\n`
    : '';

  return `You are Caspa — STRUCTURAL REPAIR AND REWRITE PASS.

${STRUCTURE_FIRST_CONTRACT}

Apply the critic report in priority order. Structural defects, continuity, promises and factual integrity must be repaired BEFORE sentence polish.

CRITIC REPORT
${criticReport.slice(0, 8000)}

ORIGINAL DRAFT
${draft.slice(0, 16000)}

PLAN
${plan.premise} · ${plan.formatDecision}
Structure: ${plan.structure}
Ledger: ${plan.characterWoundMap}
${input.prizeLens ? `QUALITY LENS: ${input.prizeLens}` : ''}
${lengthLock}
${engineRulesForMode(input.mode)}
${qualityBarForMode(input.mode)}
${ARTEFACT_FIRST}

${nf ? '- Keep non-fiction expository rather than novelistic. Never invent evidence/citations. Preserve useful figure suggestions.' : ''}

FINAL GATE: no forgotten thread, unpaid due promise, contradiction, unsupported invention, semantic loop or fluent-but-useless paragraph.
Return the improved ${input.output} only. No commentary.`;
}

export function parseStructuredPlan(text: string, fallback: Partial<StructuredPlan> = {}): StructuredPlan {
  const parsed = parseJson(text);
  return {
    premise: pickString(parsed.premise, fallback.premise ?? ''),
    genre: pickString(parsed.genre, fallback.genre ?? ''),
    tone: pickString(parsed.tone, fallback.tone ?? ''),
    intendedAudience: pickString(parsed.intendedAudience, fallback.intendedAudience ?? ''),
    formatDecision: pickString(parsed.formatDecision, fallback.formatDecision ?? 'chapter / section'),
    characterWoundMap: pickString(parsed.characterWoundMap, fallback.characterWoundMap ?? ''),
    scenePlan: pickArray(parsed.scenePlan, fallback.scenePlan ?? []),
    characters: pickCharacters(parsed.characters, fallback.characters ?? []),
    setting: pickString(parsed.setting, fallback.setting ?? ''),
    themes: pickArray(parsed.themes, fallback.themes ?? []),
    structure: pickString(parsed.structure, fallback.structure ?? ''),
    sourceNotes: pickString(parsed.sourceNotes, fallback.sourceNotes ?? ''),
    styleRules: pickArray(parsed.styleRules, fallback.styleRules ?? []),
  };
}

function parseJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed) as Record<string, unknown>; }
  catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      try { return JSON.parse(fence[1].trim()) as Record<string, unknown>; } catch { /* continue */ }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>; } catch { /* continue */ }
    }
  }
  return {};
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function pickArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const items = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (items.length) return items;
  }
  return fallback;
}

function pickCharacters(value: unknown, fallback: StructuredPlan['characters']): StructuredPlan['characters'] {
  if (!Array.isArray(value)) return fallback;
  const rows = value.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) return null;
    return {
      name,
      role: typeof row.role === 'string' ? row.role : '',
      wound: typeof row.wound === 'string' ? row.wound : '',
      desire: typeof row.desire === 'string' ? row.desire : '',
    };
  }).filter((row): row is StructuredPlan['characters'][number] => Boolean(row));
  return rows.length ? rows : fallback;
}
