import { aiWithFallback } from '../../shared/elevationHelpers';

export interface RevisionRung {
  stage: number;
  name: string;
  focus: string;
  tasks: string[];
  estimatedHours: number;
}

export interface RevisionLadderResult {
  rungs: RevisionRung[];
  totalEstimatedHours: number;
  summary: string;
  generatedAt: string;
}

const DEFAULT_RUNGS: RevisionRung[] = [
  { stage: 1, name: 'Structure Pass', focus: 'Plot and pacing', tasks: ['Map act breaks', 'Verify inciting incident', 'Check climax payoff'], estimatedHours: 8 },
  { stage: 2, name: 'Character Pass', focus: 'Motivation and voice', tasks: ['Audit want/need', 'Distinct dialogue', 'Relationship arcs'], estimatedHours: 10 },
  { stage: 3, name: 'Scene Pass', focus: 'Enter late, leave early', tasks: ['Cut redundant scenes', 'Raise stakes per scene', 'Visual openings'], estimatedHours: 12 },
  { stage: 4, name: 'Line Pass', focus: 'Prose and rhythm', tasks: ['Cut adverbs', 'Vary sentence length', 'Sharpen verbs'], estimatedHours: 8 },
  { stage: 5, name: 'Polish Pass', focus: 'Final emotional truth', tasks: ['Read aloud', 'Motif consistency', 'Opening/closing echo'], estimatedHours: 6 },
];

export class RevisionLadder {
  async build(text: string, projectId?: string): Promise<RevisionLadderResult> {
    const { text: summary } = await aiWithFallback(
      'Suggest a 5-rung revision ladder for this manuscript.',
      text.slice(0, 4000),
      'Follow structure → character → scene → line → polish sequence.',
      projectId,
    );

    return {
      rungs: DEFAULT_RUNGS,
      totalEstimatedHours: DEFAULT_RUNGS.reduce((s, r) => s + r.estimatedHours, 0),
      summary,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const revisionLadder = new RevisionLadder();
