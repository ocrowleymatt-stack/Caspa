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

export interface Project {
  id: string;
  title: string;
  genre: string;
  description: string;
  targetWordCount: number;
  currentWordCount: number;
  status: 'draft' | 'in-progress' | 'complete' | 'published';
  workType?: WorkType;
  fictionality?: Fictionality;
  form?: WorkForm;
  subgenre?: string;
  targetAudience?: string;
  targetPrizeIds?: string[];
  targetMarket?: TargetMarket;
  structureType?: StructureType;
  workflowStage?: WorkflowStage;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
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

export function structureLabel(structureType?: StructureType): string {
  if (!structureType) return 'Structure';
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

export function workTypeLabel(workType?: WorkType): string {
  if (!workType) return 'Work';
  return WORK_TYPE_LABELS[workType] ?? workType;
}
