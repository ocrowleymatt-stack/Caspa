export interface BookMapChapterEntry {
  unitId?: string;
  order: number;
  title: string;
  summary: string;
  wordCount: number;
  status: 'draft' | 'outline' | 'complete' | 'missing' | 'weak';
}

export interface BookMap {
  projectId: string;
  workingTitle: string;
  projectType: string;
  genre: string;
  premise: string;
  totalWords: number;
  targetWordCount: number;
  completionPercentage: number;
  chapters: BookMapChapterEntry[];
  arcSummary: string;
  characterArcs: string[];
  unresolvedThreads: string[];
  duplicatedMaterial: string[];
  weakSections: string[];
  missingSections: string[];
  continuityWarnings: string[];
  nextRecommendedChapter: string;
  finishRoadmap: string[];
  updatedAt: string;
  generatedFromOutputId?: string;
}
