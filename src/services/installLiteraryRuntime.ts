import { AIService } from './ai';
import { buildAlwaysOnLiteraryInjection } from './literaryEngine';
import { buildCharacterPsychologyInjection, buildCharacterEvolutionInjection } from './characterEngine';
import { Project, ProjectType, ResearchNote, ExternalReview, PlotNode, Chapter } from '../types';

let installed = false;
let runtimeChapters: Chapter[] = [];
let runtimeProject: Partial<Project> | undefined;
let runtimeCharacters: any[] = [];

export function updateNarrativeRuntimeMemory(args: {
  project?: Partial<Project>;
  chapters?: Chapter[];
  characters?: any[];
} = {}) {
  if (args.project) runtimeProject = args.project;
  if (Array.isArray(args.chapters)) runtimeChapters = args.chapters.slice(0, 80);
  if (Array.isArray(args.characters)) runtimeCharacters = args.characters.slice(0, 40);
}

function isProbablyCreativePrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return /write|rewrite|draft|chapter|scene|prose|synthesi[sz]e|manuscript|narrative|dialogue|story|fiction|literary|brainstorm|outline/.test(lower)
    && !/return only valid json|response must be valid json|return json|json schema/.test(lower);
}

function buildRuntimeLayer(args: {
  project?: Partial<Project>;
  projectType?: ProjectType;
  research?: ResearchNote[];
  sceneText?: string;
  chapterTitle?: string;
  targetWordDelta?: number;
  chapters?: Chapter[];
}) {
  const chapters = args.chapters?.length ? args.chapters : runtimeChapters;
  const project = args.project || runtimeProject;

  const literary = buildAlwaysOnLiteraryInjection({
    ...args,
    project,
    chapters
  });
  const character = buildCharacterPsychologyInjection({
    chapters,
    characters: runtimeCharacters as any,
    sceneText: args.sceneText
  });
  const evolution = buildCharacterEvolutionInjection({
    chapters,
    characters: runtimeCharacters as any
  });

  return `\n\n=== FULL NARRATIVE RUNTIME — NON-NEGOTIABLE ===\n${literary}\n${character}\n${evolution}\n=== END RUNTIME ===\n\n`;
}

export function installLiteraryRuntime() {
  if (installed) return;
  installed = true;

  const service: any = AIService as any;

  const originalCallAI = service.callAI?.bind(service);
  if (originalCallAI) {
    service.callAI = async (options: any) => {
      if (options?.prompt && !options?.json && isProbablyCreativePrompt(options.prompt)) {
        const runtime = buildRuntimeLayer({
          project: runtimeProject,
          projectType: (runtimeProject?.type as ProjectType) || 'novel',
          sceneText: options.prompt.slice(0, 8000),
          chapterTitle: 'Direct Creative Call',
          chapters: runtimeChapters
        });
        return originalCallAI({ ...options, prompt: `${runtime}${options.prompt}` });
      }
      return originalCallAI(options);
    };
  }

  const originalWriteDraft = service.writeDraft?.bind(service);
  if (originalWriteDraft) {
    service.writeDraft = async (
      title: string,
      summary: string,
      context: string,
      type: ProjectType,
      activeNodes: PlotNode[],
      research: ResearchNote[] = [],
      maturity = 'standard',
      sourceMaterials: { name: string; content: string }[] = [],
      directives: string[] = [],
      projectTargetWords?: number,
      externalReviews: ExternalReview[] = []
    ) => {
      const targetWords = projectTargetWords || 50000;
      const currentWords = (context || '').trim().split(/\s+/).filter(Boolean).length;
      const targetDelta = Math.max(3000, Math.min(4000, Math.round(targetWords / 15) - currentWords));

      const runtime = buildRuntimeLayer({
        project: runtimeProject || { title, type, maturity: maturity as any, genre: type, tone: 'restrained literary' },
        projectType: type,
        research,
        sceneText: `${summary}\n\n${context}`.slice(0, 12000),
        chapterTitle: title,
        targetWordDelta: targetDelta,
        chapters: runtimeChapters
      });

      const runtimeDirectives = [
        runtime,
        `WORD TARGET CONTROLLER: expand by roughly 3,000–4,000 words where the chapter is thin. Expansion must come from scene action, dialogue pressure, contradiction, setting, motif mutation and interiority. Padding is forbidden.`,
        ...directives
      ];

      return originalWriteDraft(
        title,
        `${runtime}\n\n${summary}`,
        context,
        type,
        activeNodes,
        research,
        maturity,
        sourceMaterials,
        runtimeDirectives,
        projectTargetWords,
        externalReviews
      );
    };
  }

  console.info('Full narrative runtime (literary + character + evolution + real memory) installed.');
}
