export const HYBRID_STAGES = ['draft', 'workshop', 'revise', 'finish', 'publish'] as const;
export type HybridStage = typeof HYBRID_STAGES[number];

const transitions: Record<HybridStage, readonly HybridStage[]> = {
  draft: ['workshop', 'finish'],
  workshop: ['draft', 'revise', 'finish'],
  revise: ['draft', 'workshop', 'finish'],
  finish: ['draft', 'workshop', 'revise', 'publish'],
  publish: ['draft', 'workshop', 'revise', 'finish'],
};

export function canMoveBetweenStages(from: HybridStage, to: HybridStage): boolean {
  return from === to || transitions[from].includes(to);
}

export function nextHybridStage(stage: HybridStage): HybridStage {
  const index = HYBRID_STAGES.indexOf(stage);
  return HYBRID_STAGES[Math.min(index + 1, HYBRID_STAGES.length - 1)];
}

export function contextualTools(stage: HybridStage): string[] {
  if (stage === 'draft') return ['Research', 'Story bible', 'Psychology', 'Style profile'];
  if (stage === 'workshop') return ['Diagnosis', 'Reader review', 'Continuity', 'Fact check'];
  if (stage === 'revise') return ['Revision plan', 'Gold Refinery', 'Red Pen', 'Version compare'];
  if (stage === 'finish') return ['Final QA', 'Recovery', 'Export preflight'];
  return ['Book design', 'Cover', 'Layout', 'Proof', 'Export'];
}
