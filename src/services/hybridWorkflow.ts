export const HYBRID_STAGES = ['idea', 'structure', 'draft', 'workshop', 'revise', 'finish', 'publish'] as const;
export type HybridStage = typeof HYBRID_STAGES[number];

export function canMoveBetweenStages(from: HybridStage, to: HybridStage): boolean {
  return HYBRID_STAGES.includes(from) && HYBRID_STAGES.includes(to);
}

export function nextHybridStage(stage: HybridStage): HybridStage {
  const index = HYBRID_STAGES.indexOf(stage);
  return HYBRID_STAGES[Math.min(index + 1, HYBRID_STAGES.length - 1)];
}

export function contextualTools(stage: HybridStage): string[] {
  if (stage === 'idea') return ['Research Desk', 'Intelligence Lab', 'Brainstorm'];
  if (stage === 'structure') return ['Brainstorm', 'Story Bible', 'Character Forge', 'Psychology Studio', 'Plot Architect'];
  if (stage === 'draft') return ['Research Desk', 'Story Bible', 'Writing Studio', 'Auto Drafter'];
  if (stage === 'workshop') return ['Workshop diagnosis', 'Critic Swarm', 'Intelligence Lab', 'Red Pen'];
  if (stage === 'revise') return ['Rip up and rebuild', 'Rip & Fix', 'Auto Drafter', 'Scalpel', 'Gold Refinery', 'Version compare'];
  if (stage === 'finish') return ['Gold Refinery', 'Prize Calibration', 'Recovery', 'Proof / preflight'];
  return ['Design', 'Red Pen', 'Export and publishing'];
}
