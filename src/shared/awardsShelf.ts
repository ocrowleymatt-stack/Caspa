/**
 * Awards Shelf — target lenses and assessment rubrics (Phase 7).
 * Uses "inspired-by" framing; not official prize criteria unless sourced.
 */

import type { WorkType } from './workModel';

export type AwardLensCategory =
  | 'literary'
  | 'genre'
  | 'theatre'
  | 'screen'
  | 'children'
  | 'nonfiction'
  | 'commercial'
  | 'custom';

export type AssessmentStage = 'draft' | 'revision' | 'submission';

export interface AwardLens {
  id: string;
  name: string;
  category: AwardLensCategory;
  description: string;
  inspiredBy: string;
  rubricFocus: string[];
  disclaimer: string;
  suggestedWorkTypes?: WorkType[];
  custom?: boolean;
}

export interface CustomAwardInput {
  name: string;
  description: string;
  rubricFocus: string[];
  inspiredBy?: string;
  category?: AwardLensCategory;
}

export interface ProseAssessment {
  voice: number;
  control: number;
  originality: number;
  structure: number;
  emotionalForce: number;
  language: number;
  pace: number;
  depth: number;
}

export interface AwardFitResult {
  awardId: string;
  awardName: string;
  score: number;
  strengths: string[];
  risks: string[];
  judgeComments: string;
  recommendedRevisions: string[];
  disqualificationOrMismatchRisks: string[];
}

export interface AwardAssessmentResult {
  outputId: string;
  projectId: string;
  overallReadiness: number;
  awardFit: AwardFitResult[];
  proseAssessment: ProseAssessment;
  stage: AssessmentStage;
  workType?: string;
  disclaimer: string;
  createdAt: string;
}

export interface ProjectAwardsShelf {
  projectId: string;
  selectedAwardIds: string[];
  awards: AwardLens[];
}

export const AWARDS_SHELF_DISCLAIMER =
  'Assessments use inspired-by target lenses — not official judging criteria unless you attach verified source rubrics.';

export const BUILTIN_AWARD_LENSES: AwardLens[] = [
  {
    id: 'booker-literary',
    name: 'Booker-style literary fiction',
    category: 'literary',
    inspiredBy: 'Booker Prize-style lens',
    description: 'Serious literary prose, moral pressure, and sustained authorial control.',
    rubricFocus: ['voice', 'depth', 'moral complexity', 'sentence craft'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
    suggestedWorkTypes: ['literary-fiction', 'novel'],
  },
  {
    id: 'womens-prize-crossover',
    name: "Women's Prize-style crossover",
    category: 'literary',
    inspiredBy: "Women's Prize-style lens",
    description: 'Readable literary work with emotional accessibility and strong character interiority.',
    rubricFocus: ['emotional force', 'accessibility', 'character depth'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
  },
  {
    id: 'costa-readability',
    name: 'Costa-style readability',
    category: 'commercial',
    inspiredBy: 'Costa Book Awards-style lens',
    description: 'Warmth, momentum, and reader engagement without sacrificing craft.',
    rubricFocus: ['pace', 'warmth', 'hook', 'payoff'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
  },
  {
    id: 'goldsmiths-innovation',
    name: 'Goldsmiths-style innovation',
    category: 'literary',
    inspiredBy: 'Goldsmiths Prize-style lens',
    description: 'Formal innovation, risk-taking structure, and distinctive narrative architecture.',
    rubricFocus: ['originality', 'structure', 'formal risk'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
  },
  {
    id: 'hugo-nebula-spec',
    name: 'Hugo/Nebula-style speculative',
    category: 'genre',
    inspiredBy: 'Hugo / Nebula-style lens',
    description: 'Speculative worldbuilding with idea-driven payoff and genre contract clarity.',
    rubricFocus: ['worldbuilding', 'idea payoff', 'genre contract'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
    suggestedWorkTypes: ['science-fiction', 'fantasy'],
  },
  {
    id: 'edgar-crime',
    name: 'Edgar/Dagger-style crime',
    category: 'genre',
    inspiredBy: 'Edgar / Dagger-style lens',
    description: 'Plot engineering, clue integrity, tension management, and fair-play mystery craft.',
    rubricFocus: ['plotting', 'clue integrity', 'tension', 'pacing'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
    suggestedWorkTypes: ['crime-thriller'],
  },
  {
    id: 'stoker-horror',
    name: 'Bram Stoker-style horror',
    category: 'genre',
    inspiredBy: 'Bram Stoker Award-style lens',
    description: 'Dread architecture, visceral stakes, and sustained unease.',
    rubricFocus: ['dread', 'atmosphere', 'escalation'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
    suggestedWorkTypes: ['horror'],
  },
  {
    id: 'carnegie-children',
    name: 'Carnegie-style children/YA',
    category: 'children',
    inspiredBy: 'Carnegie Medal-style lens',
    description: 'Young reader clarity, emotional honesty, and age-appropriate thematic weight.',
    rubricFocus: ['clarity', 'emotional honesty', 'age fit'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
    suggestedWorkTypes: ['young-adult', 'children-fiction'],
  },
  {
    id: 'olivier-tony-stage',
    name: 'Olivier/Tony-style stage craft',
    category: 'theatre',
    inspiredBy: 'Olivier / Tony Awards-style lens',
    description: 'Stageable scenes, actor leverage, and production-aware writing.',
    rubricFocus: ['stageability', 'scene turns', 'actor moments'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
    suggestedWorkTypes: ['stage-play', 'musical'],
  },
  {
    id: 'fringe-festival',
    name: 'Fringe festival readiness',
    category: 'theatre',
    inspiredBy: 'Fringe / festival readiness lens',
    description: 'Portable production, clear hook, and audience energy in limited runtime.',
    rubricFocus: ['hook', 'portability', 'audience energy'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
  },
  {
    id: 'screenwriting-contest',
    name: 'Screenwriting contest coverage',
    category: 'screen',
    inspiredBy: 'Screenwriting contest coverage lens',
    description: 'Visual writing, act structure, and cinematic scene pressure.',
    rubricFocus: ['visual writing', 'act structure', 'scene pressure'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
    suggestedWorkTypes: ['screenplay', 'tv-pilot'],
  },
  {
    id: 'nonfiction-award',
    name: 'Nonfiction award standard',
    category: 'nonfiction',
    inspiredBy: 'General nonfiction award lens',
    description: 'Argument clarity, evidence discipline, and narrative propulsion in true material.',
    rubricFocus: ['argument', 'evidence', 'narrative propulsion'],
    disclaimer: AWARDS_SHELF_DISCLAIMER,
    suggestedWorkTypes: ['memoir', 'biography', 'longform-journalism', 'academic-research'],
  },
];
