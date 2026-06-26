import type { CreateProjectInput } from '../api/projects';
import type { WorkType } from './workModel';

type CasperMode = 'novel' | 'script' | 'musical' | 'adaptation' | 'polish' | 'chaos';

const MODE_TO_WORK_TYPE: Record<CasperMode, WorkType> = {
  novel: 'novel',
  script: 'stage-play',
  musical: 'musical',
  adaptation: 'experimental-hybrid',
  polish: 'literary-fiction',
  chaos: 'experimental-hybrid',
};

export function workModelFromCasperMode(
  mode: CasperMode,
  options?: { hasUploadedManuscript?: boolean },
): Pick<
  CreateProjectInput,
  'workType' | 'fictionality' | 'form' | 'structureType' | 'targetMarket' | 'workflowStage'
> {
  const workType = MODE_TO_WORK_TYPE[mode];
  const imported = Boolean(options?.hasUploadedManuscript);

  if (mode === 'script') {
    return {
      workType: 'screenplay',
      fictionality: 'fiction',
      form: 'screenplay',
      structureType: 'acts-scenes',
      targetMarket: 'film',
      workflowStage: imported ? 'imported' : 'blank',
    };
  }

  if (mode === 'adaptation') {
    return {
      workType: 'experimental-hybrid',
      fictionality: 'hybrid',
      form: 'book',
      structureType: 'chapters',
      targetMarket: 'literary',
      workflowStage: imported ? 'imported' : 'blank',
    };
  }

  if (mode === 'polish') {
    return {
      workType: 'literary-fiction',
      fictionality: 'fiction',
      form: 'book',
      structureType: 'chapters',
      targetMarket: 'literary',
      workflowStage: imported ? 'imported' : 'drafting',
    };
  }

  if (mode === 'musical') {
    return {
      workType: 'musical',
      fictionality: 'fiction',
      form: 'musical',
      structureType: 'acts-scenes',
      targetMarket: 'theatre',
      workflowStage: imported ? 'imported' : 'blank',
    };
  }

  return {
    workType,
    fictionality: 'fiction',
    form: 'book',
    structureType: 'chapters',
    targetMarket: mode === 'chaos' ? 'niche' : 'literary',
    workflowStage: imported ? 'imported' : 'blank',
  };
}

export function workModelFromPrimaryType(
  workType: WorkType,
  options?: { hasImportedManuscript?: boolean },
): Pick<
  CreateProjectInput,
  'workType' | 'fictionality' | 'form' | 'structureType' | 'targetMarket' | 'workflowStage' | 'genre'
> {
  const imported = Boolean(options?.hasImportedManuscript);
  const genre = workType.replace(/-/g, ' ');

  const map: Partial<Record<WorkType, Pick<CreateProjectInput, 'fictionality' | 'form' | 'structureType' | 'targetMarket'>>> = {
    novel: { fictionality: 'fiction', form: 'book', structureType: 'chapters', targetMarket: 'literary' },
    novella: { fictionality: 'fiction', form: 'book', structureType: 'chapters', targetMarket: 'literary' },
    'short-story-collection': { fictionality: 'fiction', form: 'book', structureType: 'sections', targetMarket: 'literary' },
    'stage-play': { fictionality: 'fiction', form: 'play', structureType: 'acts-scenes', targetMarket: 'theatre' },
    screenplay: { fictionality: 'fiction', form: 'screenplay', structureType: 'acts-scenes', targetMarket: 'film' },
    musical: { fictionality: 'fiction', form: 'musical', structureType: 'acts-scenes', targetMarket: 'theatre' },
    memoir: { fictionality: 'nonfiction', form: 'book', structureType: 'sections', targetMarket: 'literary' },
    'essay-collection': { fictionality: 'nonfiction', form: 'essay', structureType: 'essays', targetMarket: 'literary' },
    'poetry-collection': { fictionality: 'fiction', form: 'poetry', structureType: 'poems', targetMarket: 'literary' },
    'academic-research': { fictionality: 'nonfiction', form: 'research', structureType: 'research-arguments', targetMarket: 'academic' },
    'young-adult': { fictionality: 'fiction', form: 'book', structureType: 'chapters', targetMarket: 'children' },
    'experimental-hybrid': { fictionality: 'hybrid', form: 'other', structureType: 'sections', targetMarket: 'literary' },
    other: { fictionality: 'fiction', form: 'book', structureType: 'chapters', targetMarket: 'other' },
  };

  const defaults = map[workType] ?? map.other!;

  return {
    workType,
    genre,
    ...defaults,
    workflowStage: imported ? 'imported' : 'blank',
  };
}
