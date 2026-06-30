/**
 * Gold Pipeline — multi-pass refinement definitions and execution
 */

import { randomUUID } from 'crypto';
import type { GoldPassDefinition, GoldPassId, GoldPassResult } from '../types/gold';
import { GOLD_PASS_DEFINITIONS } from '../types/gold';
import { callServerAi } from './serverAiHelper';

export const GOLD_PASSES = GOLD_PASS_DEFINITIONS;

function passPrompt(passId: GoldPassId, text: string, title: string, tone: string): string {
  const sample = text.slice(0, 12000);
  const base = `Project: "${title}"\nTone target: ${tone}\n\nMANUSCRIPT:\n${sample}`;

  switch (passId) {
    case 'structure':
      return `${base}\n\nSTRUCTURE PASS: Analyse spine, scene turns, and escalation. Return JSON:\n{"notes":"markdown bullet findings","revisedText":null}`;
    case 'depth':
      return `${base}\n\nDEPTH PASS: Analyse character want, pressure, stakes, world specificity. Return JSON:\n{"notes":"markdown bullet findings","revisedText":null}`;
    case 'subtext':
      return `${base}\n\nSUBTEXT PASS: Where are characters lying, evading, or leaking truth through behaviour? Return JSON:\n{"notes":"markdown bullet findings","revisedText":null}`;
    case 'line-edit':
      return `${base}\n\nLINE EDIT: Tighten rhythm and voice. Return JSON:\n{"notes":"specific line-level fixes","revisedText":"polished excerpt of key paragraph(s) — max 800 words"}`;
    case 'final-cut':
      return `${base}\n\nRUTHLESS FINAL CUT: Rewrite the full excerpt. Cut sludge. Preserve story beats. Return JSON:\n{"notes":"what you cut and why","revisedText":"full polished text"}`;
  }
}

function parsePassJson(raw: string): { notes: string; revisedText?: string } {
  try {
    const parsed = JSON.parse(raw);
    return {
      notes: String(parsed.notes || parsed.summary || raw).trim(),
      revisedText: parsed.revisedText ? String(parsed.revisedText).trim() : undefined,
    };
  } catch {
    return { notes: raw.trim() };
  }
}

export async function runGoldPass(
  passId: GoldPassId,
  text: string,
  meta: { title: string; tone: string }
): Promise<GoldPassResult> {
  const def = GOLD_PASSES.find((p) => p.id === passId)!;
  const started = Date.now();
  const raw = await callServerAi(passPrompt(passId, text, meta.title, meta.tone), true);
  const parsed = parsePassJson(raw);

  return {
    passId,
    name: def.name,
    notes: parsed.notes,
    revisedText: parsed.revisedText,
    durationMs: Date.now() - started,
  };
}

export async function runGoldPipeline(
  text: string,
  meta: { title: string; tone: string },
  onProgress?: (passId: GoldPassId, status: 'running' | 'done', result?: GoldPassResult) => void
): Promise<{ jobId: string; passes: GoldPassResult[]; finalText: string }> {
  const jobId = randomUUID();
  const passes: GoldPassResult[] = [];
  let workingText = text;

  for (const def of GOLD_PASSES) {
    onProgress?.(def.id, 'running');
    const result = await runGoldPass(def.id, workingText, meta);
    passes.push(result);
    if (result.revisedText?.trim()) {
      workingText = result.revisedText;
    }
    onProgress?.(def.id, 'done', result);
  }

  return { jobId, passes, finalText: workingText };
}

export function createJobId(): string {
  return randomUUID();
}
