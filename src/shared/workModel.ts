/**
 * Canonical CASPA work model — single source of truth for project typing.
 * Used by manuscript services, import analyser (Phase 3), and UI workbench.
 */

export type Fictionality = 'fiction' | 'nonfiction' | 'hybrid';

export type WorkForm =
  | 'book'
  | 'play'
  | 'screenplay'
  | 'musical'
  | 'essay'
  | 'poetry'
  | 'research'
  | 'other';

export type TargetMarket =
  | 'literary'
  | 'commercial'
  | 'theatre'
  | 'film'
  | 'academic'
  | 'children'
  | 'niche'
  | 'other';

export type StructureType =
  | 'chapters'
  | 'acts-scenes'
  | 'sections'
  | 'essays'
  | 'poems'
  | 'episodes'
  | 'parts'
  | 'research-arguments';

/** Pier / production workflow stage (distinct from publication lifecycle status). */
export type WorkflowStage =
  | 'blank'
  | 'imported'
  | 'analysing'
  | 'drafting'
  | 'revising'
  | 'expanding'
  | 'polishing'
  | 'submission-ready';

export type WorkType =
  | 'novel'
  | 'novella'
  | 'short-story-collection'
  | 'literary-fiction'
  | 'commercial-fiction'
  | 'crime-thriller'
  | 'horror'
  | 'fantasy'
  | 'science-fiction'
  | 'romance'
  | 'historical-fiction'
  | 'young-adult'
  | 'children-fiction'
  | 'memoir'
  | 'biography'
  | 'autobiography'
  | 'essay-collection'
  | 'longform-journalism'
  | 'history'
  | 'true-crime'
  | 'self-help'
  | 'academic-research'
  | 'spiritual-philosophical'
  | 'technical-manual'
  | 'business-book'
  | 'stage-play'
  | 'screenplay'
  | 'tv-pilot'
  | 'radio-drama'
  | 'musical'
  | 'cabaret-revue'
  | 'stand-up-satirical'
  | 'interactive-theatre'
  | 'children-show'
  | 'poetry-collection'
  | 'verse-novel'
  | 'spoken-word'
  | 'experimental-hybrid'
  | 'other';

export interface WorkModelFields {
  workType: WorkType;
  fictionality: Fictionality;
  form: WorkForm;
  subgenre?: string;
  targetAudience?: string;
  targetPrizeIds: string[];
  targetMarket: TargetMarket;
  structureType: StructureType;
  workflowStage: WorkflowStage;
}

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  novel: 'Novel',
  novella: 'Novella',
  'short-story-collection': 'Short story collection',
  'literary-fiction': 'Literary fiction',
  'commercial-fiction': 'Commercial fiction',
  'crime-thriller': 'Crime / thriller',
  horror: 'Horror',
  fantasy: 'Fantasy',
  'science-fiction': 'Science fiction',
  romance: 'Romance',
  'historical-fiction': 'Historical fiction',
  'young-adult': 'Young adult',
  'children-fiction': "Children's fiction",
  memoir: 'Memoir',
  biography: 'Biography',
  autobiography: 'Autobiography',
  'essay-collection': 'Essay collection',
  'longform-journalism': 'Longform journalism',
  history: 'History',
  'true-crime': 'True crime',
  'self-help': 'Self-help',
  'academic-research': 'Academic / research-led',
  'spiritual-philosophical': 'Spiritual / philosophical',
  'technical-manual': 'Technical / manual',
  'business-book': 'Business book',
  'stage-play': 'Stage play',
  screenplay: 'Screenplay',
  'tv-pilot': 'TV pilot',
  'radio-drama': 'Radio drama',
  musical: 'Musical',
  'cabaret-revue': 'Cabaret / revue',
  'stand-up-satirical': 'Stand-up / satirical show',
  'interactive-theatre': 'Interactive theatre',
  'children-show': "Children's show",
  'poetry-collection': 'Poetry collection',
  'verse-novel': 'Verse novel',
  'spoken-word': 'Spoken word',
  'experimental-hybrid': 'Experimental / hybrid',
  other: 'Other',
};

/** Primary work types shown in New Project flow (Phase 11). */
export const PRIMARY_WORK_TYPES: WorkType[] = [
  'novel',
  'novella',
  'short-story-collection',
  'stage-play',
  'screenplay',
  'musical',
  'memoir',
  'essay-collection',
  'poetry-collection',
  'academic-research',
  'young-adult',
  'experimental-hybrid',
  'other',
];

const WORK_TYPE_DEFAULTS: Record<WorkType, Omit<WorkModelFields, 'subgenre' | 'targetAudience' | 'targetPrizeIds'>> = {
  novel: { workType: 'novel', fictionality: 'fiction', form: 'book', targetMarket: 'literary', structureType: 'chapters', workflowStage: 'blank' },
  novella: { workType: 'novella', fictionality: 'fiction', form: 'book', targetMarket: 'literary', structureType: 'chapters', workflowStage: 'blank' },
  'short-story-collection': { workType: 'short-story-collection', fictionality: 'fiction', form: 'book', targetMarket: 'literary', structureType: 'sections', workflowStage: 'blank' },
  'literary-fiction': { workType: 'literary-fiction', fictionality: 'fiction', form: 'book', targetMarket: 'literary', structureType: 'chapters', workflowStage: 'blank' },
  'commercial-fiction': { workType: 'commercial-fiction', fictionality: 'fiction', form: 'book', targetMarket: 'commercial', structureType: 'chapters', workflowStage: 'blank' },
  'crime-thriller': { workType: 'crime-thriller', fictionality: 'fiction', form: 'book', targetMarket: 'commercial', structureType: 'chapters', workflowStage: 'blank' },
  horror: { workType: 'horror', fictionality: 'fiction', form: 'book', targetMarket: 'commercial', structureType: 'chapters', workflowStage: 'blank' },
  fantasy: { workType: 'fantasy', fictionality: 'fiction', form: 'book', targetMarket: 'commercial', structureType: 'chapters', workflowStage: 'blank' },
  'science-fiction': { workType: 'science-fiction', fictionality: 'fiction', form: 'book', targetMarket: 'commercial', structureType: 'chapters', workflowStage: 'blank' },
  romance: { workType: 'romance', fictionality: 'fiction', form: 'book', targetMarket: 'commercial', structureType: 'chapters', workflowStage: 'blank' },
  'historical-fiction': { workType: 'historical-fiction', fictionality: 'fiction', form: 'book', targetMarket: 'literary', structureType: 'chapters', workflowStage: 'blank' },
  'young-adult': { workType: 'young-adult', fictionality: 'fiction', form: 'book', targetMarket: 'children', structureType: 'chapters', workflowStage: 'blank' },
  'children-fiction': { workType: 'children-fiction', fictionality: 'fiction', form: 'book', targetMarket: 'children', structureType: 'chapters', workflowStage: 'blank' },
  memoir: { workType: 'memoir', fictionality: 'nonfiction', form: 'book', targetMarket: 'literary', structureType: 'sections', workflowStage: 'blank' },
  biography: { workType: 'biography', fictionality: 'nonfiction', form: 'book', targetMarket: 'literary', structureType: 'chapters', workflowStage: 'blank' },
  autobiography: { workType: 'autobiography', fictionality: 'nonfiction', form: 'book', targetMarket: 'literary', structureType: 'chapters', workflowStage: 'blank' },
  'essay-collection': { workType: 'essay-collection', fictionality: 'nonfiction', form: 'essay', targetMarket: 'literary', structureType: 'essays', workflowStage: 'blank' },
  'longform-journalism': { workType: 'longform-journalism', fictionality: 'nonfiction', form: 'book', targetMarket: 'commercial', structureType: 'sections', workflowStage: 'blank' },
  history: { workType: 'history', fictionality: 'nonfiction', form: 'book', targetMarket: 'academic', structureType: 'parts', workflowStage: 'blank' },
  'true-crime': { workType: 'true-crime', fictionality: 'nonfiction', form: 'book', targetMarket: 'commercial', structureType: 'chapters', workflowStage: 'blank' },
  'self-help': { workType: 'self-help', fictionality: 'nonfiction', form: 'book', targetMarket: 'commercial', structureType: 'sections', workflowStage: 'blank' },
  'academic-research': { workType: 'academic-research', fictionality: 'nonfiction', form: 'research', targetMarket: 'academic', structureType: 'research-arguments', workflowStage: 'blank' },
  'spiritual-philosophical': { workType: 'spiritual-philosophical', fictionality: 'nonfiction', form: 'book', targetMarket: 'niche', structureType: 'sections', workflowStage: 'blank' },
  'technical-manual': { workType: 'technical-manual', fictionality: 'nonfiction', form: 'book', targetMarket: 'niche', structureType: 'sections', workflowStage: 'blank' },
  'business-book': { workType: 'business-book', fictionality: 'nonfiction', form: 'book', targetMarket: 'commercial', structureType: 'sections', workflowStage: 'blank' },
  'stage-play': { workType: 'stage-play', fictionality: 'fiction', form: 'play', targetMarket: 'theatre', structureType: 'acts-scenes', workflowStage: 'blank' },
  screenplay: { workType: 'screenplay', fictionality: 'fiction', form: 'screenplay', targetMarket: 'film', structureType: 'acts-scenes', workflowStage: 'blank' },
  'tv-pilot': { workType: 'tv-pilot', fictionality: 'fiction', form: 'screenplay', targetMarket: 'film', structureType: 'episodes', workflowStage: 'blank' },
  'radio-drama': { workType: 'radio-drama', fictionality: 'fiction', form: 'play', targetMarket: 'niche', structureType: 'acts-scenes', workflowStage: 'blank' },
  musical: { workType: 'musical', fictionality: 'fiction', form: 'musical', targetMarket: 'theatre', structureType: 'acts-scenes', workflowStage: 'blank' },
  'cabaret-revue': { workType: 'cabaret-revue', fictionality: 'hybrid', form: 'musical', targetMarket: 'theatre', structureType: 'acts-scenes', workflowStage: 'blank' },
  'stand-up-satirical': { workType: 'stand-up-satirical', fictionality: 'hybrid', form: 'other', targetMarket: 'theatre', structureType: 'sections', workflowStage: 'blank' },
  'interactive-theatre': { workType: 'interactive-theatre', fictionality: 'fiction', form: 'play', targetMarket: 'theatre', structureType: 'acts-scenes', workflowStage: 'blank' },
  'children-show': { workType: 'children-show', fictionality: 'fiction', form: 'musical', targetMarket: 'children', structureType: 'acts-scenes', workflowStage: 'blank' },
  'poetry-collection': { workType: 'poetry-collection', fictionality: 'fiction', form: 'poetry', targetMarket: 'literary', structureType: 'poems', workflowStage: 'blank' },
  'verse-novel': { workType: 'verse-novel', fictionality: 'fiction', form: 'poetry', targetMarket: 'literary', structureType: 'poems', workflowStage: 'blank' },
  'spoken-word': { workType: 'spoken-word', fictionality: 'hybrid', form: 'poetry', targetMarket: 'niche', structureType: 'poems', workflowStage: 'blank' },
  'experimental-hybrid': { workType: 'experimental-hybrid', fictionality: 'hybrid', form: 'other', targetMarket: 'literary', structureType: 'sections', workflowStage: 'blank' },
  other: { workType: 'other', fictionality: 'fiction', form: 'book', targetMarket: 'other', structureType: 'chapters', workflowStage: 'blank' },
};

export function getDefaultsForWorkType(workType: WorkType): WorkModelFields {
  const base = WORK_TYPE_DEFAULTS[workType] ?? WORK_TYPE_DEFAULTS.other;
  return { ...base, targetPrizeIds: [] };
}

/** Map legacy genre strings and Casper modes to canonical work model. */
export function inferWorkModelFromLegacy(input: {
  genre?: string;
  description?: string;
  hasImportedManuscript?: boolean;
}): WorkModelFields {
  const genre = (input.genre ?? '').toLowerCase();
  const desc = (input.description ?? '').toLowerCase();
  const imported = input.hasImportedManuscript
    || desc.includes('uploaded manuscript')
    || desc.includes('imported manuscript')
    || genre.includes('manuscript polish');

  if (genre.includes('script') || genre.includes('screen')) {
    return {
      ...getDefaultsForWorkType('screenplay'),
      workflowStage: imported ? 'imported' : 'blank',
      subgenre: input.genre,
    };
  }
  if (genre.includes('stage') || genre.includes('play')) {
    return {
      ...getDefaultsForWorkType('stage-play'),
      workflowStage: imported ? 'imported' : 'blank',
      subgenre: input.genre,
    };
  }
  if (genre.includes('musical') || genre.includes('show')) {
    return {
      ...getDefaultsForWorkType('musical'),
      workflowStage: imported ? 'imported' : 'blank',
      subgenre: input.genre,
    };
  }
  if (genre.includes('memoir')) {
    return { ...getDefaultsForWorkType('memoir'), workflowStage: imported ? 'imported' : 'blank', subgenre: input.genre };
  }
  if (genre.includes('adaptation')) {
    return {
      ...getDefaultsForWorkType('experimental-hybrid'),
      fictionality: 'hybrid',
      workflowStage: imported ? 'imported' : 'blank',
      subgenre: input.genre,
    };
  }
  if (genre.includes('manuscript polish') || genre.includes('polish')) {
    return {
      ...getDefaultsForWorkType('literary-fiction'),
      workflowStage: imported ? 'imported' : 'drafting',
      subgenre: input.genre,
    };
  }
  if (genre.includes('thriller') || genre.includes('crime')) {
    return { ...getDefaultsForWorkType('crime-thriller'), workflowStage: imported ? 'imported' : 'blank', subgenre: input.genre };
  }
  if (genre.includes('historical')) {
    return { ...getDefaultsForWorkType('historical-fiction'), workflowStage: imported ? 'imported' : 'blank', subgenre: input.genre };
  }
  if (genre.includes('comedy') || genre.includes('experimental')) {
    return { ...getDefaultsForWorkType('experimental-hybrid'), workflowStage: imported ? 'imported' : 'blank', subgenre: input.genre };
  }
  if (genre.includes('essay')) {
    return { ...getDefaultsForWorkType('essay-collection'), workflowStage: imported ? 'imported' : 'blank', subgenre: input.genre };
  }
  if (genre.includes('poetry')) {
    return { ...getDefaultsForWorkType('poetry-collection'), workflowStage: imported ? 'imported' : 'blank', subgenre: input.genre };
  }
  if (genre.includes('research') || genre.includes('academic')) {
    return { ...getDefaultsForWorkType('academic-research'), workflowStage: imported ? 'imported' : 'blank', subgenre: input.genre };
  }

  return {
    ...getDefaultsForWorkType('novel'),
    workflowStage: imported ? 'imported' : 'blank',
    subgenre: input.genre || undefined,
  };
}

export function structureLabel(structureType: StructureType): string {
  const labels: Record<StructureType, string> = {
    chapters: 'Chapters',
    'acts-scenes': 'Acts & scenes',
    sections: 'Sections',
    essays: 'Essays',
    poems: 'Poems',
    episodes: 'Episodes',
    parts: 'Parts',
    'research-arguments': 'Claims & evidence',
  };
  return labels[structureType];
}

export function workflowStageLabel(stage: WorkflowStage): string {
  return stage.replace(/-/g, ' ');
}
