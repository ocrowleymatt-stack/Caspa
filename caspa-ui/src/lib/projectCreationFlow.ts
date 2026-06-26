import type { CreateProjectInput } from '../api/projects';
import type {
  Fictionality,
  TargetMarket,
  WorkForm,
  WorkflowStage,
  WorkType,
} from './workModel';
import { WORK_TYPE_LABELS } from './workModel';

export type CreationLengthPreset = 'short' | 'standard' | 'long' | 'custom';

export type TargetFormIntent =
  | 'manuscript'
  | 'script'
  | 'submission-package'
  | 'show-package'
  | 'research-draft'
  | 'publication-ready';

export type TargetShelfChoice = 'none' | 'choose-awards' | 'genre-lens' | 'custom';

export type StartingPoint =
  | 'blank'
  | 'upload'
  | 'paste'
  | 'import-research'
  | 'start-plot'
  | 'start-character'
  | 'start-premise';

export const CREATION_WORK_TYPES: { value: WorkType; label: string }[] = [
  { value: 'novel', label: 'Novel' },
  { value: 'novella', label: 'Novella' },
  { value: 'short-story-collection', label: 'Short story' },
  { value: 'stage-play', label: 'Play' },
  { value: 'screenplay', label: 'Screenplay' },
  { value: 'musical', label: 'Musical' },
  { value: 'memoir', label: 'Memoir' },
  { value: 'business-book', label: 'Nonfiction book' },
  { value: 'essay-collection', label: 'Essay collection' },
  { value: 'poetry-collection', label: 'Poetry collection' },
  { value: 'academic-research', label: 'Research / academic work' },
  { value: 'young-adult', label: 'Children / YA' },
  { value: 'other', label: 'Other' },
];

export const FICTIONALITY_OPTIONS: { value: Fictionality; label: string }[] = [
  { value: 'fiction', label: 'Fiction' },
  { value: 'nonfiction', label: 'Nonfiction' },
  { value: 'hybrid', label: 'Hybrid / based on true events' },
];

export const TARGET_FORM_OPTIONS: { value: TargetFormIntent; label: string; hint: string }[] = [
  { value: 'manuscript', label: 'Manuscript', hint: 'Book-length prose or longform draft' },
  { value: 'script', label: 'Script', hint: 'Stage, screen, or broadcast script form' },
  { value: 'submission-package', label: 'Submission package', hint: 'Query-ready sample plus support material' },
  { value: 'show-package', label: 'Show package', hint: 'Musical, theatre, or performance bundle' },
  { value: 'research-draft', label: 'Research draft', hint: 'Argument-led or evidence-first work' },
  { value: 'publication-ready', label: 'Publication-ready book', hint: 'Polished book target from the start' },
];

export const LENGTH_PRESETS: {
  value: CreationLengthPreset;
  label: string;
  hint: string;
}[] = [
  { value: 'short', label: 'Short', hint: 'Novella, single act, or focused draft' },
  { value: 'standard', label: 'Standard', hint: 'Typical length for this work type' },
  { value: 'long', label: 'Long', hint: 'Epic or expanded target' },
  { value: 'custom', label: 'Custom', hint: 'Set your own word count' },
];

export const TARGET_MARKET_OPTIONS: {
  value: TargetMarket | 'custom';
  label: string;
}[] = [
  { value: 'literary', label: 'Literary' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'theatre', label: 'Theatre' },
  { value: 'film', label: 'Film / TV' },
  { value: 'academic', label: 'Academic' },
  { value: 'children', label: 'Children' },
  { value: 'niche', label: 'Niche / community' },
  { value: 'custom', label: 'Custom' },
];

export const SHELF_CHOICES: { value: TargetShelfChoice; label: string; hint: string }[] = [
  { value: 'none', label: 'None yet', hint: 'Choose awards later in the workbench' },
  { value: 'choose-awards', label: 'Choose awards', hint: 'Pick target prize lenses now' },
  { value: 'genre-lens', label: 'Genre / market lens', hint: 'One inspired-by rubric matched to your market' },
  { value: 'custom', label: 'Custom rubric', hint: 'Create a custom lens after opening the project' },
];

export const STARTING_POINTS: { value: StartingPoint; label: string; hint: string }[] = [
  { value: 'blank', label: 'Blank room', hint: 'Empty project — structure comes first' },
  { value: 'upload', label: 'Upload manuscript', hint: 'Analyse structure before import' },
  { value: 'paste', label: 'Paste text', hint: 'Drop prose in without a file' },
  { value: 'import-research', label: 'Import research', hint: 'Open Research Desk first' },
  { value: 'start-plot', label: 'Start from plot', hint: 'Place structural poles in Pier Builder' },
  { value: 'start-character', label: 'Start from character', hint: 'Open character room' },
  { value: 'start-premise', label: 'Start from premise', hint: 'Launch Casper with this project' },
];

const WORD_COUNT_BY_TYPE: Partial<Record<WorkType, { short: number; standard: number; long: number }>> = {
  novel: { short: 50000, standard: 80000, long: 120000 },
  novella: { short: 15000, standard: 25000, long: 40000 },
  'short-story-collection': { short: 8000, standard: 20000, long: 45000 },
  'stage-play': { short: 12000, standard: 20000, long: 35000 },
  screenplay: { short: 15000, standard: 25000, long: 40000 },
  musical: { short: 15000, standard: 30000, long: 50000 },
  memoir: { short: 40000, standard: 70000, long: 100000 },
  'business-book': { short: 35000, standard: 60000, long: 90000 },
  'essay-collection': { short: 25000, standard: 50000, long: 80000 },
  'poetry-collection': { short: 10000, standard: 25000, long: 50000 },
  'academic-research': { short: 40000, standard: 80000, long: 120000 },
  'young-adult': { short: 45000, standard: 65000, long: 90000 },
  other: { short: 30000, standard: 60000, long: 100000 },
};

export function defaultFictionalityForWorkType(workType: WorkType): Fictionality {
  const nonfiction: WorkType[] = [
    'memoir',
    'biography',
    'autobiography',
    'essay-collection',
    'longform-journalism',
    'history',
    'true-crime',
    'self-help',
    'academic-research',
    'spiritual-philosophical',
    'technical-manual',
    'business-book',
  ];
  if (nonfiction.includes(workType)) return 'nonfiction';
  if (workType === 'experimental-hybrid') return 'hybrid';
  return 'fiction';
}

export function resolveTargetWordCount(
  workType: WorkType,
  preset: CreationLengthPreset,
  customCount: number,
): number {
  if (preset === 'custom') {
    return Number.isFinite(customCount) && customCount > 0 ? customCount : 60000;
  }
  const table = WORD_COUNT_BY_TYPE[workType] ?? WORD_COUNT_BY_TYPE.other!;
  return table[preset];
}

export function mapTargetFormToWorkForm(intent: TargetFormIntent, workType: WorkType): WorkForm {
  if (intent === 'script') {
    if (workType === 'screenplay' || workType === 'tv-pilot') return 'screenplay';
    if (workType === 'musical') return 'musical';
    return 'play';
  }
  if (intent === 'research-draft' || workType === 'academic-research') return 'research';
  if (intent === 'show-package' || workType === 'musical') return 'musical';
  if (workType === 'essay-collection') return 'essay';
  if (workType === 'poetry-collection') return 'poetry';
  return 'book';
}

export function workflowStageForStartingPoint(
  startingPoint: StartingPoint,
  hasManuscript: boolean,
): WorkflowStage {
  if (hasManuscript) return 'imported';
  if (startingPoint === 'start-premise') return 'drafting';
  return 'blank';
}

export function postCreateRoute(projectId: string, startingPoint: StartingPoint): string {
  switch (startingPoint) {
    case 'import-research':
      return `/projects/${projectId}/research`;
    case 'start-plot':
      return `/projects/${projectId}/pier`;
    case 'start-character':
      return `/projects/${projectId}/characters`;
    case 'start-premise':
      return `/casper?projectId=${projectId}`;
    default:
      return `/projects/${projectId}`;
  }
}

export function buildProjectGenre(workType: WorkType, customMarketLabel?: string): string {
  if (customMarketLabel?.trim()) return customMarketLabel.trim();
  return WORK_TYPE_LABELS[workType] ?? workType.replace(/-/g, ' ');
}

export interface ProjectCreationDraft {
  title: string;
  description: string;
  workType: WorkType;
  fictionality: Fictionality;
  targetForm: TargetFormIntent;
  lengthPreset: CreationLengthPreset;
  customWordCount: number;
  targetMarket: TargetMarket;
  customMarketLabel: string;
  targetAudience: string;
  shelfChoice: TargetShelfChoice;
  targetPrizeIds: string[];
  startingPoint: StartingPoint;
  manuscriptText: string;
  uploadedName: string | null;
}

export function defaultCreationDraft(): ProjectCreationDraft {
  return {
    title: '',
    description: '',
    workType: 'novel',
    fictionality: 'fiction',
    targetForm: 'manuscript',
    lengthPreset: 'standard',
    customWordCount: 80000,
    targetMarket: 'literary',
    customMarketLabel: '',
    targetAudience: '',
    shelfChoice: 'none',
    targetPrizeIds: [],
    startingPoint: 'blank',
    manuscriptText: '',
    uploadedName: null,
  };
}

export function mergeCreationIntoProjectInput(
  draft: ProjectCreationDraft,
  base: Pick<
    CreateProjectInput,
    'workType' | 'fictionality' | 'form' | 'structureType' | 'targetMarket' | 'workflowStage' | 'genre'
  >,
): CreateProjectInput {
  const hasManuscript = Boolean(draft.manuscriptText.trim());
  const targetWordCount = resolveTargetWordCount(
    draft.workType,
    draft.lengthPreset,
    draft.customWordCount,
  );

  return {
    title: draft.title.trim() || draft.uploadedName?.replace(/\.[^.]+$/, '') || 'Untitled Room',
    description:
      draft.description.trim() ||
      (draft.uploadedName ? `Uploaded manuscript: ${draft.uploadedName.replace(/\.[^.]+$/, '')}` : 'A fresh blank room.'),
    genre: buildProjectGenre(draft.workType, draft.customMarketLabel),
    targetWordCount,
    hasImportedManuscript: hasManuscript,
    workType: draft.workType,
    fictionality: draft.fictionality,
    form: mapTargetFormToWorkForm(draft.targetForm, draft.workType),
    structureType: base.structureType,
    targetMarket: draft.targetMarket,
    targetAudience: draft.targetAudience.trim() || undefined,
    targetPrizeIds: draft.targetPrizeIds.length ? draft.targetPrizeIds : undefined,
    workflowStage: workflowStageForStartingPoint(draft.startingPoint, hasManuscript),
  };
}
