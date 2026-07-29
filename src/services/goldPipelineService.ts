/**
 * Gold Pipeline — multi-pass refinement definitions and execution
 */

import { randomUUID } from 'crypto';
import type { GoldPassDefinition, GoldPassId, GoldPassResult } from '../types/gold';
import { GOLD_PASS_DEFINITIONS } from '../types/gold';
import { callServerAi } from './serverAiHelper';
import {
  LITERARY_ENGINE_RULES,
  ARTEFACT_FIRST,
  AWARD_BAR,
  engineRulesForMode,
  type NovelWriteProMode,
} from './literary/novelWritePro';
import { buildServerPlotHoldBlock, type ServerPlotHold } from './literary/plotHoldServer';

export const GOLD_PASSES = GOLD_PASS_DEFINITIONS;

export type GoldMeta = {
  title: string;
  tone: string;
  mode?: NovelWriteProMode | string;
  targetWordCount?: number | null;
  plotHold?: ServerPlotHold | null;
};

function passPrompt(passId: GoldPassId, text: string, meta: GoldMeta): string {
  const sample = text.slice(0, 12000);
  const plot = buildServerPlotHoldBlock(meta.plotHold);
  const mode = (meta.mode || 'novel') as NovelWriteProMode;
  const nonfiction = mode === 'nonfiction' || mode === 'essay';
  const rules = engineRulesForMode(mode);
  const target =
    typeof meta.targetWordCount === 'number' && meta.targetWordCount > 0
      ? `Aspire-to length: ~${Math.round(meta.targetWordCount).toLocaleString()} words.`
      : '';
  const base = [
    rules,
    ARTEFACT_FIRST,
    AWARD_BAR,
    plot,
    `Project: "${meta.title}"`,
    `Mode: ${mode}`,
    `Tone target: ${meta.tone}`,
    target,
    '',
    'MANUSCRIPT:',
    sample,
  ]
    .filter(Boolean)
    .join('\n');

  switch (passId) {
    case 'structure':
      return nonfiction
        ? `${base}\n\nSTRUCTURE PASS: Analyse argument spine / section turns against the hold (if any). Check claim→evidence→consequence escalation. Same thesis only. Return JSON:\n{"notes":"markdown bullet findings","revisedText":null}`
        : `${base}\n\nSTRUCTURE PASS: Analyse spine against the plot hold (if any). Check scene turns and escalation. Same story only. Return JSON:\n{"notes":"markdown bullet findings","revisedText":null}`;
    case 'depth':
      return nonfiction
        ? `${base}\n\nDEPTH PASS: Analyse thesis pressure, evidence specificity, counterpoints, and honest limits. Honour locked claims. Return JSON:\n{"notes":"markdown bullet findings","revisedText":null}`
        : `${base}\n\nDEPTH PASS: Analyse character want, pressure, stakes, world specificity. Honour locked wounds/desires. Return JSON:\n{"notes":"markdown bullet findings","revisedText":null}`;
    case 'subtext':
      return nonfiction
        ? `${base}\n\nCOUNTERPOINT PASS: Where does the text evade a hard fact, soften a claim, or bury a necessary counterargument? Return JSON:\n{"notes":"markdown bullet findings","revisedText":null}`
        : `${base}\n\nSUBTEXT PASS: Where are characters lying, evading, or leaking truth through behaviour? Return JSON:\n{"notes":"markdown bullet findings","revisedText":null}`;
    case 'line-edit':
      return `${base}\n\nLINE EDIT: Tighten rhythm and voice. Do not change ${nonfiction ? 'argument' : 'plot'}. Return JSON:\n{"notes":"specific line-level fixes","revisedText":"polished excerpt of key paragraph(s) — max 800 words"}`;
    case 'final-cut':
      return `${base}\n\nQUALITY FINAL CUT: Rewrite the full excerpt. Cut only what weakens the product — no percentage quota. Preserve ${nonfiction ? 'claims, evidence, and section turns' : 'story beats and plot hold'}. Return revised text first. Return JSON:\n{"notes":"what you cut and why","revisedText":"full polished text"}`;
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
  meta: GoldMeta
): Promise<GoldPassResult> {
  const def = GOLD_PASSES.find((p) => p.id === passId)!;
  const started = Date.now();
  const raw = await callServerAi(passPrompt(passId, text, meta), true);
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
  meta: GoldMeta,
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
