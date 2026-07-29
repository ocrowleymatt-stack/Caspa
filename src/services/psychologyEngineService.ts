/**
 * Caspa Psychology Engine — design and enforce emotional arcs
 */

import { AIService } from './ai';
import type { ProjectBriefLike } from './commissionService';
import type { PsychologyBlueprint, EmotionalBeat, EmotionalVector } from '../types/psychology';

function storageKey(projectKey: string): string {
  return `caspa.psychology.${projectKey}`;
}

export function loadBlueprint(projectKey: string): PsychologyBlueprint | null {
  try {
    const raw = localStorage.getItem(storageKey(projectKey));
    return raw ? (JSON.parse(raw) as PsychologyBlueprint) : null;
  } catch {
    return null;
  }
}

export function saveBlueprint(projectKey: string, blueprint: PsychologyBlueprint): void {
  localStorage.setItem(storageKey(projectKey), JSON.stringify(blueprint));
}

function safeParseJSON(text: string, fallback: Record<string, unknown>) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) return JSON.parse(match[1]);
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* fall through */
    }
    return fallback;
  }
}

export async function designPsychologyBlueprint(
  userIntent: string,
  brief: ProjectBriefLike,
  manuscriptSample = ''
): Promise<PsychologyBlueprint> {
  const prompt = `You are Caspa's Psychology Engine — a prize-calibre emotional architect.

PROJECT: "${brief.title}"
PREMISE: ${brief.idea}
TONE: ${brief.tone}
AUDIENCE: ${brief.audience}

AUTHOR'S EMOTIONAL INTENT:
"${userIntent}"

${manuscriptSample ? `MANUSCRIPT SAMPLE:\n${manuscriptSample.slice(0, 8000)}` : ''}

Design a psychological journey for this work. Use real techniques (e.g. tragic irony, earned catharsis, delayed hope, grief-with-grace, reversal, subtextual wound).

Return JSON only:
{
  "journeySummary": "2-3 sentences on the emotional machine of this book",
  "hiddenMeaning": "optional thematic subtext to thread through",
  "twistReveal": "optional twist/reveal to foreshadow if applicable, or empty string",
  "endingTarget": { "hope": 0-100, "grief": 0-100, "tension": 0-100, "joy": 0-100, "catharsis": 0-100 },
  "beats": [
    {
      "act": 1,
      "label": "Act name",
      "target": { "hope": 0-100, "grief": 0-100, "tension": 0-100, "joy": 0-100, "catharsis": 0-100 },
      "techniques": ["technique1", "technique2"],
      "chapterFrom": 1,
      "chapterTo": 5,
      "notes": "what the reader should feel and why"
    }
  ]
}`;

  const raw = await AIService.callAI({
    prompt,
    json: true,
    model: 'gemini-2.0-flash',
    maxTokens: 4096,
  });

  const parsed = safeParseJSON(raw, {});

  const beats: EmotionalBeat[] = (parsed.beats || []).map((b: Partial<EmotionalBeat>, i: number) => ({
    act: b.act ?? i + 1,
    label: b.label || `Act ${i + 1}`,
    target: normalizeVector(b.target),
    techniques: Array.isArray(b.techniques) ? b.techniques : [],
    chapterFrom: b.chapterFrom,
    chapterTo: b.chapterTo,
    notes: b.notes,
  }));

  const blueprint: PsychologyBlueprint = {
    id: crypto.randomUUID(),
    userIntent,
    journeySummary: parsed.journeySummary || userIntent,
    beats,
    endingTarget: normalizeVector(parsed.endingTarget),
    hiddenMeaning: parsed.hiddenMeaning || undefined,
    twistReveal: parsed.twistReveal || undefined,
    createdAt: Date.now(),
  };

  return blueprint;
}

function normalizeVector(v: Partial<EmotionalVector> | undefined): EmotionalVector {
  return {
    hope: clamp(v?.hope ?? 50),
    grief: clamp(v?.grief ?? 30),
    tension: clamp(v?.tension ?? 40),
    joy: clamp(v?.joy ?? 35),
    catharsis: clamp(v?.catharsis ?? 45),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function formatPsychologyForChapter(blueprint: PsychologyBlueprint, chapterOrder: number): string[] {
  const chapterNum = chapterOrder + 1;
  const directives: string[] = [];

  directives.push(`PSYCHOLOGY ENGINE — Journey: ${blueprint.journeySummary}`);

  if (blueprint.hiddenMeaning) {
    directives.push(`Thread hidden meaning without stating it: ${blueprint.hiddenMeaning}`);
  }

  if (blueprint.twistReveal) {
    directives.push(`Foreshadow/reveal discipline for twist: ${blueprint.twistReveal}`);
  }

  const beat = blueprint.beats.find(
    (b) =>
      (b.chapterFrom != null && b.chapterTo != null && chapterNum >= b.chapterFrom && chapterNum <= b.chapterTo) ||
      (b.chapterFrom == null && b.act === Math.ceil(chapterNum / 10))
  ) || blueprint.beats[Math.min(Math.floor((chapterNum / 20) * blueprint.beats.length), blueprint.beats.length - 1)];

  if (beat) {
    const t = beat.target;
    directives.push(
      `[EMOTIONAL TARGET — ${beat.label}] Hope ${t.hope}%, Grief ${t.grief}%, Tension ${t.tension}%, Joy ${t.joy}%, Catharsis ${t.catharsis}%. Techniques: ${beat.techniques.join(', ')}.${beat.notes ? ` ${beat.notes}` : ''}`
    );
  }

  const totalChapters = 25;
  if (chapterNum >= totalChapters * 0.85) {
    const e = blueprint.endingTarget;
    directives.push(
      `[ENDING EMOTIONAL VECTOR] Deliver ending with Hope ${e.hope}%, Grief ${e.grief}%, Catharsis ${e.catharsis}% — must feel earned, not declared.`
    );
  }

  return directives;
}
