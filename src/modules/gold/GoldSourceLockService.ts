import { createHash } from 'crypto';
import { generateId, writeJsonFile, readJsonFile } from '../../shared/fileStore';
import { extractOutputText } from '../../shared/outputSemantics';
import { ChapterService } from '../manuscript/ChapterService';
import { ProjectService } from '../manuscript/ProjectService';
import { outputRegistry } from '../outputs';
import { projectAssetService } from '../studio/ProjectAssetService';

export type GoldSourceType =
  | 'current-manuscript'
  | 'structure-unit'
  | 'chapter'
  | 'selected-text'
  | 'pasted-text'
  | 'output'
  | 'research-note'
  | 'custom';

export type GoldPassMode =
  | 'improve-same-story'
  | 'line-edit-only'
  | 'cut-tighten-same-story'
  | 'structural-critique-only'
  | 'rewrite-literary'
  | 'rewrite-commercial'
  | 'adapt-reinvent';

export interface GoldSourceLock {
  sourceLockId: string;
  projectId: string;
  sourceType: GoldSourceType;
  sourceId?: string;
  unitId?: string;
  outputId?: string;
  title: string;
  wordCount: number;
  sourceHash: string;
  sourcePreviewStart: string;
  sourcePreviewEnd: string;
  mode: GoldPassMode;
  preserveStory: boolean;
  preserveCharacters: boolean;
  preserveEvents: boolean;
  preserveChronology: boolean;
  preserveVoice: boolean;
  allowAdaptation: boolean;
  sourceText: string;
  createdAt: string;
}

export type GoldFidelityVerdict =
  | 'safe-revision'
  | 'minor-drift'
  | 'major-drift'
  | 'different-story'
  | 'source-missing';

export interface GoldFidelityReport {
  sameStoryScore: number;
  characterPreservationScore: number;
  eventPreservationScore: number;
  settingPreservationScore: number;
  chronologyPreservationScore: number;
  voicePreservationScore: number;
  driftWarnings: string[];
  verdict: GoldFidelityVerdict;
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function modeDefaults(mode: GoldPassMode): Pick<GoldSourceLock, 'preserveStory' | 'preserveCharacters' | 'preserveEvents' | 'preserveChronology' | 'preserveVoice' | 'allowAdaptation'> {
  if (mode === 'adapt-reinvent') {
    return {
      preserveStory: false,
      preserveCharacters: false,
      preserveEvents: false,
      preserveChronology: false,
      preserveVoice: false,
      allowAdaptation: true,
    };
  }
  if (mode === 'structural-critique-only') {
    return {
      preserveStory: true,
      preserveCharacters: true,
      preserveEvents: true,
      preserveChronology: true,
      preserveVoice: true,
      allowAdaptation: false,
    };
  }
  return {
    preserveStory: true,
    preserveCharacters: true,
    preserveEvents: true,
    preserveChronology: true,
    preserveVoice: true,
    allowAdaptation: false,
  };
}

export class GoldSourceLockService {
  private readonly projectService = new ProjectService();
  private readonly chapterService = new ChapterService();

  async createLock(input: {
    projectId: string;
    sourceType: GoldSourceType;
    sourceId?: string;
    unitId?: string;
    chapterId?: string;
    outputId?: string;
    pastedText?: string;
    mode?: GoldPassMode;
    user?: import('../auth/types').UserPublic;
  }): Promise<GoldSourceLock> {
    await this.projectService.getProject(input.projectId, input.user);
    const mode = input.mode ?? 'improve-same-story';
    const { sourceText, title } = await this.resolveSourceText(input);

    if (!sourceText.trim()) {
      throw new Error('Source text is empty — select a chapter, output, or paste manuscript text.');
    }

    const lock: GoldSourceLock = {
      sourceLockId: generateId(),
      projectId: input.projectId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      unitId: input.unitId ?? input.chapterId,
      outputId: input.outputId,
      title,
      wordCount: sourceText.trim().split(/\s+/).filter(Boolean).length,
      sourceHash: hashText(sourceText),
      sourcePreviewStart: sourceText.slice(0, 300),
      sourcePreviewEnd: sourceText.slice(-300),
      mode,
      sourceText,
      createdAt: new Date().toISOString(),
      ...modeDefaults(mode),
    };

    await writeJsonFile('gold-source-locks', `${lock.sourceLockId}.json`, lock);
    return lock;
  }

  async getLock(sourceLockId: string, projectId: string): Promise<GoldSourceLock> {
    const lock = await readJsonFile<GoldSourceLock>('gold-source-locks', `${sourceLockId}.json`);
    if (!lock) throw new Error('Source lock not found');
    if (lock.projectId !== projectId) {
      throw new Error('Selected source does not belong to this project.');
    }
    return lock;
  }

  async verifyLock(sourceLockId: string, projectId: string, sourceText?: string): Promise<GoldSourceLock> {
    const lock = await this.getLock(sourceLockId, projectId);
    if (sourceText?.trim()) {
      const hash = hashText(sourceText);
      if (hash !== lock.sourceHash) {
        throw new Error('Source text changed since lock was created. Create a new source lock.');
      }
    }
    return lock;
  }

  private async resolveSourceText(input: {
    projectId: string;
    sourceType: GoldSourceType;
    sourceId?: string;
    unitId?: string;
    chapterId?: string;
    outputId?: string;
    pastedText?: string;
    user?: import('../auth/types').UserPublic;
  }): Promise<{ sourceText: string; title: string }> {
    const chapterId = input.chapterId ?? input.unitId;

    if (input.sourceType === 'pasted-text' || input.sourceType === 'selected-text') {
      const text = input.pastedText?.trim() ?? '';
      return { sourceText: text, title: 'Pasted source' };
    }

    if (input.sourceType === 'chapter' || input.sourceType === 'structure-unit') {
      if (!chapterId) throw new Error('chapterId/unitId required for chapter source');
      const chapter = await this.chapterService.getChapter(chapterId);
      if (chapter.projectId !== input.projectId) {
        throw new Error('Selected source does not belong to this project.');
      }
      return { sourceText: chapter.content ?? '', title: chapter.title };
    }

    if (input.sourceType === 'output') {
      if (!input.outputId) throw new Error('outputId required for output source');
      const output = await outputRegistry.get(input.outputId);
      if (!output || output.projectId !== input.projectId) {
        throw new Error('Selected source does not belong to this project.');
      }
      const text = extractOutputText(output.metadata);
      return { sourceText: text, title: output.title };
    }

    if (input.sourceType === 'current-manuscript') {
      const chapters = await this.chapterService.listChapters(input.projectId);
      const text = chapters.map((c) => `# ${c.title}\n\n${c.content ?? ''}`).join('\n\n');
      return { sourceText: text, title: 'Current manuscript' };
    }

    if (input.sourceType === 'custom' && input.sourceId) {
      const asset = (await projectAssetService.list(input.projectId, input.user))
        .find((a) => a.id === input.sourceId);
      if (!asset) throw new Error('Selected source does not belong to this project.');
      return { sourceText: asset.extractedText ?? '', title: asset.title };
    }

    throw new Error('Unsupported source type');
  }
}

export function buildSourceFidelityContract(lock: GoldSourceLock): string {
  if (lock.allowAdaptation) {
    return 'ADAPTATION MODE (explicit opt-in): You may reinvent plot and characters as requested, but keep the user brief in mind.';
  }
  return [
    'SOURCE FIDELITY CONTRACT — IMPROVE SAME STORY ONLY',
    'Preserve: protagonist, named characters, relationships, setting, chronology, core events, genre lane, POV, emotional arc, chapter function, source facts.',
    'Allowed: prose improvement, rhythm, clarity, pacing, imagery, dialogue sharpness, transitions, line quality.',
    'NOT allowed: new plot, new protagonist, new setting, unrelated story, deleting core events, hallucinated replacement story.',
    `Mode: ${lock.mode}`,
  ].join('\n');
}

export function assessGoldFidelity(sourceText: string, generatedText: string, lock: GoldSourceLock): GoldFidelityReport {
  if (!generatedText.trim()) {
    return {
      sameStoryScore: 0,
      characterPreservationScore: 0,
      eventPreservationScore: 0,
      settingPreservationScore: 0,
      chronologyPreservationScore: 0,
      voicePreservationScore: 0,
      driftWarnings: ['No generated text to compare'],
      verdict: 'source-missing',
    };
  }

  if (lock.allowAdaptation) {
    return {
      sameStoryScore: 100,
      characterPreservationScore: 100,
      eventPreservationScore: 100,
      settingPreservationScore: 100,
      chronologyPreservationScore: 100,
      voicePreservationScore: 100,
      driftWarnings: [],
      verdict: 'safe-revision',
    };
  }

  const sourceWords = new Set(
    sourceText.toLowerCase().split(/\W+/).filter((w) => w.length > 4).slice(0, 400),
  );
  const genWords = generatedText.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
  const overlap = genWords.filter((w) => sourceWords.has(w)).length;
  const overlapRatio = genWords.length ? overlap / Math.min(genWords.length, 500) : 0;

  const sourceNames = [...sourceText.matchAll(/\b[A-Z][a-z]{2,}\b/g)].map((m) => m[0]);
  const uniqueNames = [...new Set(sourceNames)].slice(0, 12);
  const namesPreserved = uniqueNames.filter((name) => generatedText.includes(name)).length;
  const nameRatio = uniqueNames.length ? namesPreserved / uniqueNames.length : 1;

  const sameStoryScore = Math.round((overlapRatio * 0.55 + nameRatio * 0.45) * 100);
  const characterPreservationScore = Math.round(nameRatio * 100);
  const eventPreservationScore = Math.round(overlapRatio * 100);
  const settingPreservationScore = Math.round(overlapRatio * 90);
  const chronologyPreservationScore = Math.round(overlapRatio * 85);
  const voicePreservationScore = Math.round(overlapRatio * 80);

  const driftWarnings: string[] = [];
  if (nameRatio < 0.4 && uniqueNames.length >= 3) {
    driftWarnings.push('Named characters from source are largely absent in the revision.');
  }
  if (overlapRatio < 0.12 && sourceText.length > 2000) {
    driftWarnings.push('Very low lexical overlap — revision may be a different story.');
  }

  let verdict: GoldFidelityVerdict = 'safe-revision';
  if (sameStoryScore < 25) verdict = 'different-story';
  else if (sameStoryScore < 45) verdict = 'major-drift';
  else if (sameStoryScore < 65) verdict = 'minor-drift';

  return {
    sameStoryScore,
    characterPreservationScore,
    eventPreservationScore,
    settingPreservationScore,
    chronologyPreservationScore,
    voicePreservationScore,
    driftWarnings,
    verdict,
  };
}

export const goldSourceLockService = new GoldSourceLockService();
