/**
 * Awards Shelf — inspired-by prize lenses (from caspa-studio).
 * Not official judging criteria.
 */

export const AWARDS_SHELF_DISCLAIMER =
  'Assessments use inspired-by target lenses — not official judging criteria.';

export interface AwardLens {
  id: string;
  name: string;
  category: 'literary' | 'commercial' | 'theatre' | 'screen' | 'nonfiction';
  description: string;
  inspiredBy: string;
  rubricFocus: string[];
  wordTargetHint?: string;
}

export const BUILTIN_AWARD_LENSES: AwardLens[] = [
  {
    id: 'booker-literary',
    name: 'Booker-style literary fiction',
    category: 'literary',
    inspiredBy: 'Booker Prize-style lens',
    description: 'Serious literary prose, moral pressure, sustained authorial control.',
    rubricFocus: ['voice', 'depth', 'moral complexity', 'sentence craft'],
    wordTargetHint: '70000–90000',
  },
  {
    id: 'womens-prize-crossover',
    name: "Women's Prize-style crossover",
    category: 'literary',
    inspiredBy: "Women's Prize-style lens",
    description: 'Readable literary work with emotional accessibility and strong interiority.',
    rubricFocus: ['emotional force', 'accessibility', 'character depth'],
    wordTargetHint: '70000–100000',
  },
  {
    id: 'costa-readability',
    name: 'Costa-style readability',
    category: 'commercial',
    inspiredBy: 'Costa Book Awards-style lens',
    description: 'Warmth, momentum, and reader engagement without sacrificing craft.',
    rubricFocus: ['pace', 'warmth', 'hook', 'payoff'],
    wordTargetHint: '60000–90000',
  },
  {
    id: 'goldsmiths-innovation',
    name: 'Goldsmiths-style innovation',
    category: 'literary',
    inspiredBy: 'Goldsmiths Prize-style lens',
    description: 'Formal innovation, risk-taking structure, distinctive architecture.',
    rubricFocus: ['originality', 'structure', 'formal risk'],
  },
  {
    id: 'pulitzer-nonfiction',
    name: 'Pulitzer-style non-fiction',
    category: 'nonfiction',
    inspiredBy: 'Pulitzer non-fiction-style lens',
    description: 'Evidence-led clarity, moral seriousness, and reporting that earns its claims.',
    rubricFocus: ['claim precision', 'evidence', 'structure', 'clarity', 'consequence'],
    wordTargetHint: '60000–100000',
  },
  {
    id: 'baillie-gifford-nonfiction',
    name: 'Baillie Gifford-style non-fiction',
    category: 'nonfiction',
    inspiredBy: 'Baillie Gifford Prize-style lens',
    description: 'Ambitious non-fiction with narrative drive and intellectual bite.',
    rubricFocus: ['ambition', 'narrative drive', 'research integrity', 'readability'],
    wordTargetHint: '70000–120000',
  },
  {
    id: 'essay-orwell',
    name: 'Orwell-style essay clarity',
    category: 'nonfiction',
    inspiredBy: 'Orwell Prize / essay craft lens',
    description: 'Plain speech, moral pressure, and argument that turns.',
    rubricFocus: ['clarity', 'argument turn', 'honesty', 'language'],
    wordTargetHint: '1500–8000',
  },
  {
    id: 'stage-play-sharp',
    name: 'Stage-play sharpness',
    category: 'theatre',
    inspiredBy: 'Contemporary new-writing theatre lens',
    description: 'Playable scenes, subtext in dialogue, production-minded stakes.',
    rubricFocus: ['dialogue', 'stageability', 'scene turns', 'subtext'],
  },
];

export function getAwardLens(id?: string): AwardLens {
  return BUILTIN_AWARD_LENSES.find((l) => l.id === id) || BUILTIN_AWARD_LENSES[0];
}

export function awardLensPromptBlock(lens: AwardLens): string {
  return [
    `Prize lens: ${lens.name} (inspired by ${lens.inspiredBy})`,
    lens.description,
    `Rubric focus: ${lens.rubricFocus.join(', ')}`,
    lens.wordTargetHint ? `Typical scale: ${lens.wordTargetHint} words` : '',
    AWARDS_SHELF_DISCLAIMER,
  ]
    .filter(Boolean)
    .join('\n');
}
