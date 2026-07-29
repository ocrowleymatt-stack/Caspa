/**
 * Story Bible — aggregate canon from commission, promises, psychology, research
 */

import type { Diagnosis } from '../types/commission';
import type { Chapter } from '../types';
import type { StoryPromise } from '../types/promise';
import type { PsychologyBlueprint } from '../types/psychology';
import type { ProjectBriefLike } from './commissionService';
import { getProjectKey, loadLibrary } from './researchLibraryService';
import { loadPromises } from './promiseRegistryService';
import { computePromiseHealth } from '../types/promise';
import { loadBlueprint } from './psychologyEngineService';

const COMMISSION_KEY = 'caspa.commission';

export interface StoryCanon {
  projectKey: string;
  brief: ProjectBriefLike;
  diagnosis: Diagnosis | null;
  chapters: Chapter[];
  promises: StoryPromise[];
  promiseHealth: ReturnType<typeof computePromiseHealth>;
  psychology: PsychologyBlueprint | null;
  researchCount: number;
  wordCount: number;
  hasWorkshopData: boolean;
}

function loadCommissionSlice(): {
  diagnosis: Diagnosis | null;
  chapters: Chapter[];
} {
  try {
    const raw = localStorage.getItem(COMMISSION_KEY);
    if (!raw) return { diagnosis: null, chapters: [] };
    const parsed = JSON.parse(raw) as { diagnosis?: Diagnosis; chapters?: Chapter[] };
    return {
      diagnosis: parsed.diagnosis || null,
      chapters: parsed.chapters || [],
    };
  } catch {
    return { diagnosis: null, chapters: [] };
  }
}

export function loadStoryCanon(brief: ProjectBriefLike): StoryCanon {
  const projectKey = getProjectKey(brief);
  const { diagnosis, chapters } = loadCommissionSlice();
  const promises = loadPromises(projectKey);
  const psychology = loadBlueprint(projectKey);
  const researchCount = loadLibrary(projectKey).length;

  const wordCount = chapters.reduce(
    (sum, c) => sum + (c.content?.split(/\s+/).filter(Boolean).length || 0),
    0
  );

  return {
    projectKey,
    brief,
    diagnosis,
    chapters,
    promises,
    promiseHealth: computePromiseHealth(promises),
    psychology,
    researchCount,
    wordCount,
    hasWorkshopData: Boolean(diagnosis || chapters.length || promises.length),
  };
}
