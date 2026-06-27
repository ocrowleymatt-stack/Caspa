import { getProjectChapters, getProjectFullText } from '../../shared/elevationHelpers';
import { extractOutputText } from '../../shared/outputSemantics';
import { projectBibleService } from '../manuscript/ProjectBibleService';
import { ProjectService } from '../manuscript/ProjectService';
import { ResearchService } from '../manuscript/ResearchService';
import { outputRegistry } from '../outputs';
import { bookMapService } from './BookMapService';
import { projectMemoryService } from './ProjectMemoryService';

export interface BookContextBundle {
  projectId: string;
  projectTitle: string;
  bibleBlock: string;
  bookMapBlock: string;
  structureBlock: string;
  outputsBlock: string;
  swarmBlock: string;
  researchBlock: string;
  goldBlock: string;
  memoryBlock: string;
  summaryBlock: string;
  sourceText: string;
}

export class BookContextLoader {
  private readonly projectService = new ProjectService();
  private readonly researchService = new ResearchService();

  async load(projectId: string, user?: import('../auth/types').UserPublic): Promise<BookContextBundle> {
    const project = await this.projectService.getProject(projectId, user);
    const [bible, bookMap, chapters, notes, memory, outputs] = await Promise.all([
      projectBibleService.get(projectId),
      bookMapService.get(projectId, user),
      getProjectChapters(projectId),
      this.researchService.listNotes(projectId),
      projectMemoryService.get(projectId, user),
      outputRegistry.list({ projectId }),
    ]);

    const sourceText = chapters
      .filter((c) => c.sourceRole === 'original' || c.unitStatus === 'source')
      .map((c) => c.content)
      .join('\n\n')
      || chapters.map((c) => c.content).join('\n\n');

    const latestSwarm = outputs.find((o) => o.type === 'agent-swarm');
    const latestGold = outputs.find((o) => o.type === 'gold-pass');
    const latestResearch = outputs.find((o) =>
      o.type === 'research-depth-pass' || o.metadata?.kind === 'research-answer',
    );

    const bibleBlock = [
      `Premise: ${bible.premise || '(empty)'}`,
      `Genre: ${bible.genre}`,
      `Tone: ${bible.tone}`,
      `Structure: ${bible.structure}`,
      `Themes: ${bible.themes.join(', ') || 'none'}`,
      `Scene plan: ${bible.scenePlan.slice(0, 5).join(' · ') || 'none'}`,
      `Style rules: ${bible.styleRules.join('; ') || 'none'}`,
    ].join('\n');

    const bookMapBlock = bookMap
      ? [
          `Working title: ${bookMap.workingTitle}`,
          `Completion: ${bookMap.completionPercentage}% (${bookMap.totalWords}/${bookMap.targetWordCount} words)`,
          `Next chapter: ${bookMap.nextRecommendedChapter}`,
          `Missing: ${bookMap.missingSections.join('; ') || 'none flagged'}`,
          `Finish roadmap: ${bookMap.finishRoadmap.slice(0, 4).join(' → ')}`,
        ].join('\n')
      : 'Book Map not generated yet.';

    const structureBlock = chapters.length
      ? chapters.map((c, i) => `${i + 1}. ${c.title} (${c.wordCount ?? 0} words, ${c.unitType ?? 'unit'})`).join('\n')
      : 'No chapters yet.';

    const outputsBlock = outputs.slice(0, 5).map((o) =>
      `- ${o.title} (${o.metadata?.kind ?? o.type})`,
    ).join('\n') || 'No saved outputs yet.';

    const swarmBlock = latestSwarm
      ? `Swarm: ${latestSwarm.title}\n${(latestSwarm.metadata?.consensus as { summary?: string })?.summary ?? ''}`
      : 'No swarm report.';

    const researchBlock = notes.length
      ? notes.slice(0, 5).map((n) => `- [${n.verificationStatus}] ${n.title}`).join('\n')
      : 'No research notes.';

    const goldBlock = latestGold
      ? `Latest Gold: ${latestGold.title}\n${extractOutputText(latestGold.metadata).slice(0, 500)}`
      : 'No gold pass yet.';

    const memoryBlock = [
      memory.preferredStyle ? `Style: ${memory.preferredStyle}` : '',
      memory.alwaysWriteRules.length ? `Always: ${memory.alwaysWriteRules.join('; ')}` : '',
      memory.neverAgainRules.length ? `Never: ${memory.neverAgainRules.join('; ')}` : '',
      memory.priorSwarmConsensus.slice(0, 3).join('; '),
    ].filter(Boolean).join('\n') || 'No canon memory yet.';

    const summaryBlock = [
      `PROJECT: ${project.title}`,
      `Work type: ${project.workType ?? project.genre} · Form: ${project.form ?? 'book'}`,
      `--- PROJECT BIBLE ---\n${bibleBlock}`,
      `--- BOOK MAP ---\n${bookMapBlock}`,
      `--- STRUCTURE (${chapters.length} units) ---\n${structureBlock}`,
      `--- MEMORY ---\n${memoryBlock}`,
      `--- RECENT OUTPUTS ---\n${outputsBlock}`,
      `--- SWARM ---\n${swarmBlock}`,
      `--- RESEARCH ---\n${researchBlock}`,
      `--- GOLD ---\n${goldBlock}`,
    ].join('\n\n');

    return {
      projectId,
      projectTitle: project.title,
      bibleBlock,
      bookMapBlock,
      structureBlock,
      outputsBlock,
      swarmBlock,
      researchBlock,
      goldBlock,
      memoryBlock,
      summaryBlock,
      sourceText: sourceText.slice(0, 120_000),
    };
  }

  async loadSourceExcerpt(projectId: string, maxChars = 8000): Promise<string> {
    const bundle = await this.load(projectId);
    if (bundle.sourceText.trim()) {
      return bundle.sourceText.slice(0, maxChars);
    }
    return getProjectFullText(projectId, maxChars);
  }
}

export const bookContextLoader = new BookContextLoader();
