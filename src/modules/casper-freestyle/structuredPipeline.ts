import {
  NOVEL_WRITE_PRO_CRITIC_PERSONAS,
  NOVEL_WRITE_PRO_LITERARY_ENGINE_RULES,
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

export function buildPlanningPrompt(input: NovelWriteProPromptInput): string {
  return `You are Caspa Novel Write Pro — planning phase only.

PROJECT TYPE: ${input.modeTitle} / ${input.genre}
USER BRIEF: ${input.premise || '[Invent a fresh premise]'}
TARGET OUTPUT: ${input.output}
TONE: ${input.tone}
SOURCE: ${input.sourceText?.slice(0, 4000) || '[Blank page — invent]'}

${NOVEL_WRITE_PRO_LITERARY_ENGINE_RULES}

Return JSON only (no markdown) with:
premise, genre, tone, intendedAudience, formatDecision, characterWoundMap,
scenePlan (array of 6-12 beats), characters (array of {name, role, wound, desire}),
setting, themes (array), structure, sourceNotes, styleRules (array of 3-6 active rules)`;
}

export function buildFirstDraftPrompt(
  input: NovelWriteProPromptInput,
  plan: StructuredPlan,
): string {
  return `You are Caspa Novel Write Pro — first draft phase.

FORMAT DECISION: ${plan.formatDecision}
PREMISE: ${plan.premise}
SCENE PLAN:
${plan.scenePlan.map((s, i) => `${i + 1}. ${s}`).join('\n')}

CHARACTER / WOUND MAP:
${plan.characterWoundMap}

${NOVEL_WRITE_PRO_LITERARY_ENGINE_RULES}

Write the ${input.output} for ${input.modeTitle}. Return creative material only — no process notes.`;
}

export function buildCriticPrompt(plan: StructuredPlan, draft: string): string {
  return `You are Caspa critic room. Review this draft against the project plan.

PLAN SUMMARY
Premise: ${plan.premise}
Format: ${plan.formatDecision}
Wound map: ${plan.characterWoundMap}

DRAFT
${draft.slice(0, 12000)}

${NOVEL_WRITE_PRO_CRITIC_PERSONAS}

Write a structured critic-room report with sections:
1. Structural Architect
2. Vocal Stylist
3. Literary Agent
4. Beta Reader
5. Top 5 concrete fixes (numbered)

Be specific. No flattery.`;
}

export function buildRewritePrompt(
  input: NovelWriteProPromptInput,
  plan: StructuredPlan,
  draft: string,
  criticReport: string,
): string {
  return `You are Caspa Novel Write Pro — award-pass rewrite.

Apply the critic report and improve the draft while preserving voice and intent.

CRITIC REPORT
${criticReport.slice(0, 6000)}

ORIGINAL DRAFT
${draft.slice(0, 12000)}

PLAN
${plan.premise} · ${plan.formatDecision}

${NOVEL_WRITE_PRO_LITERARY_ENGINE_RULES}

Return the improved ${input.output} only. No commentary.`;
}

export function parseStructuredPlan(text: string, fallback: Partial<StructuredPlan>): StructuredPlan {
  const parsed = parseJson(text);
  return {
    premise: pickString(parsed.premise, fallback.premise ?? ''),
    genre: pickString(parsed.genre, fallback.genre ?? ''),
    tone: pickString(parsed.tone, fallback.tone ?? ''),
    intendedAudience: pickString(parsed.intendedAudience, fallback.intendedAudience ?? ''),
    formatDecision: pickString(parsed.formatDecision, fallback.formatDecision ?? ''),
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
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1].trim()) as Record<string, unknown>;
      } catch {
        /* continue */
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        /* continue */
      }
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

function pickCharacters(
  value: unknown,
  fallback: StructuredPlan['characters'],
): StructuredPlan['characters'] {
  if (!Array.isArray(value)) return fallback;
  const rows = value
    .map((item) => {
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
    })
    .filter((item): item is StructuredPlan['characters'][number] => item !== null);
  return rows.length ? rows : fallback;
}
