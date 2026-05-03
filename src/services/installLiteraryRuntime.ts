import { AIService } from './ai';
import { buildAlwaysOnLiteraryInjection } from './literaryEngine';
import { buildCharacterPsychologyInjection, buildCharacterEvolutionInjection } from './characterEngine';
import { buildNarrativeSelfCritiqueInjection } from './selfCritiqueEngine';
import { Project, ProjectType, ResearchNote, ExternalReview, PlotNode, Chapter } from '../types';

let installed = false;
let runtimeChapters: Chapter[] = [];
let runtimeProject: Partial<Project> | undefined;
let runtimeCharacters: any[] = [];

type RuntimeRole = 'writer' | 'planner' | 'critic' | 'editor' | 'research' | 'general';

export function updateNarrativeRuntimeMemory(args: {
  project?: Partial<Project>;
  chapters?: Chapter[];
  characters?: any[];
} = {}) {
  if (args.project) runtimeProject = args.project;
  if (Array.isArray(args.chapters)) runtimeChapters = args.chapters.slice(0, 80);
  if (Array.isArray(args.characters)) runtimeCharacters = args.characters.slice(0, 40);
}

function isJSONPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return /return only valid json|response must be valid json|return json|json schema|valid json only/.test(lower);
}

function detectRole(prompt: string): RuntimeRole {
  const lower = prompt.toLowerCase();
  if (/research|sources|citation|verify|factual|find real-world|google search|knowledge vector/.test(lower)) return 'research';
  if (/critique|assess|review|score|evaluate|eligibility|rank severity|suggestions/.test(lower)) return 'critic';
  if (/fix|edit|refine|rewrite|improve|polish|overhaul|reconcile/.test(lower)) return 'editor';
  if (/outline|structure|plot|beat|architecture|roadmap|milestone/.test(lower)) return 'planner';
  if (/write|draft|chapter|scene|prose|dialogue|story|fiction|literary/.test(lower)) return 'writer';
  return 'general';
}

function isProbablyRuntimePrompt(prompt: string): boolean {
  return detectRole(prompt) !== 'research' && !isJSONPrompt(prompt);
}

function buildRuntimeLayer(args: {
  role?: RuntimeRole;
  project?: Partial<Project>;
  projectType?: ProjectType;
  research?: ResearchNote[];
  sceneText?: string;
  chapterTitle?: string;
  targetWordDelta?: number;
  chapters?: Chapter[];
}) {
  const role = args.role || 'general';
  const chapters = args.chapters?.length ? args.chapters : runtimeChapters;
  const project = args.project || runtimeProject;

  const character = buildCharacterPsychologyInjection({
    chapters,
    characters: runtimeCharacters as any,
    sceneText: args.sceneText
  });
  const evolution = buildCharacterEvolutionInjection({
    chapters,
    characters: runtimeCharacters as any
  });
  const critique = buildNarrativeSelfCritiqueInjection({
    project,
    chapters,
    characters: runtimeCharacters as any,
    currentTask: role
  });

  if (role === 'research') return '';

  if (role === 'planner') {
    return `\n\n=== PLANNER RUNTIME — STRUCTURE ONLY ===\n${character}\n${evolution}\n${critique}\nRules: design structure, pressure, escalation and consequences. Do not produce ornate prose.\n=== END RUNTIME ===\n\n`;
  }

  if (role === 'critic') {
    return `\n\n=== CRITIC RUNTIME — JUDGEMENT ONLY ===\n${critique}\n${character}\nRules: judge quality, continuity, character behaviour, scene function and prose weakness. Do not rewrite unless explicitly asked.\n=== END RUNTIME ===\n\n`;
  }

  if (role === 'editor') {
    return `\n\n=== EDITOR RUNTIME — PRECISION REVISION ===\n${critique}\n${character}\n${evolution}\nRules: revise deterministically. Preserve meaning. Improve prose, continuity and pressure. Avoid unnecessary variance.\n=== END RUNTIME ===\n\n`;
  }

  const literary = buildAlwaysOnLiteraryInjection({
    ...args,
    project,
    chapters
  });

  return `\n\n=== FULL NARRATIVE RUNTIME — NON-NEGOTIABLE ===\n${literary}\n${character}\n${evolution}\n${critique}\n=== END RUNTIME ===\n\n`;
}

export function installLiteraryRuntime() {
  if (installed) return;
  installed = true;

  const service: any = AIService as any;

  const originalCallAI = service.callAI?.bind(service);
  if (originalCallAI) {
    service.callAI = async (options: any) => {
      if (options?.prompt && !options?.json && isProbablyRuntimePrompt(options.prompt)) {
        const role = detectRole(options.prompt);
        const runtime = buildRuntimeLayer({
          role,
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
        role: 'writer',
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

  console.info('Full role-aware narrative runtime installed.');
}
