import type { CreativeTarget, ProductionBrief } from '../modules/studio/types';

export function buildCreativeSpecPrompt(brief?: ProductionBrief | null): string {
  if (!brief) return '';

  const ct = brief.creativeTarget;
  const lines: string[] = ['CREATIVE SPECIFICATION'];

  if (brief.productType) lines.push(`Target product: ${brief.productType}`);
  if (brief.targetLength) lines.push(`Target word count: ${brief.targetLength}`);
  if (brief.successCriteria) lines.push(`Finish standard: ${brief.successCriteria}`);
  if (brief.audience) lines.push(`Audience: ${brief.audience}`);
  if (brief.tone) lines.push(`Tone: ${brief.tone}`);

  if (ct) {
    if (ct.lengthPreset) lines.push(`Length preset: ${ct.lengthPreset}`);
    if (ct.targetChapterCount) lines.push(`Target chapters/scenes: ${ct.targetChapterCount}`);
    if (ct.readerEffects?.length) lines.push(`Reader should feel: ${ct.readerEffects.join(', ')}`);
    if (ct.audienceAfterthought) lines.push(`Reader should think afterwards: ${ct.audienceAfterthought}`);
    if (ct.aftertaste) lines.push(`Desired aftertaste: ${ct.aftertaste}`);
    if (ct.intensity) lines.push(`Intensity: ${ct.intensity}/7`);
    if (ct.literaryBalance) lines.push(`Literary/commercial balance: ${ct.literaryBalance}`);
    if (ct.optimizeFor?.length) lines.push(`Optimise for: ${ct.optimizeFor.join(', ')}`);
    if (ct.avoid?.length) lines.push(`Avoid: ${ct.avoid.join(', ')}`);
    if (ct.sourceTruthMode) lines.push(`Source truth: ${ct.sourceTruthMode}`);
  }

  return lines.length > 1 ? lines.join('\n') : '';
}

export function expansionGapMessage(brief: ProductionBrief | null | undefined, currentWords: number): string | null {
  const target = brief?.targetLength ?? 0;
  if (!target || target <= 0) return null;
  const pct = Math.round((currentWords / target) * 100);
  if (pct >= 90) return null;
  return `You are around ${pct}% of target (${currentWords.toLocaleString()} / ${target.toLocaleString()} words). This is not finished — build expansion map or write missing chapters.`;
}

export type CreativeSpecification = CreativeTarget & {
  targetProduct?: ProductionBrief['productType'];
  targetWordCount?: number;
  targetWordCountRange?: { min: number; max: number };
};
