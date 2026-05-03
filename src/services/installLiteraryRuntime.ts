import { AIService } from './ai';
import { buildAlwaysOnLiteraryInjection } from './literaryEngine';
import { Project, ProjectType, ResearchNote, ExternalReview, PlotNode, Chapter } from '../types';

let installed = false;

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
}) {
  return `\n\n=== ALWAYS-ON LITERARY RUNTIME — NON-NEGOTIABLE ===\n${buildAlwaysOnLiteraryInjection(args)}\n=== END ALWAYS-ON LITERARY RUNTIME ===\n\n`;
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
          projectType: 'novel',
          sceneText: options.prompt.slice(0, 8000),
          chapterTitle: 'Direct Creative Call'
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
        project: { title, type, maturity: maturity as any, genre: type, tone: 'restrained literary' },
        projectType: type,
        research,
        sceneText: `${summary}\n\n${context}`.slice(0, 12000),
        chapterTitle: title,
        targetWordDelta: targetDelta
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

  const originalBrainstorm = service.brainstorm?.bind(service);
  if (originalBrainstorm) {
    service.brainstorm = async (
      premise: string,
      genre: string,
      tone: string,
      type: ProjectType,
      research: ResearchNote[] = [],
      maturity = 'standard',
      externalReviews: ExternalReview[] = []
    ) => {
      const runtime = buildRuntimeLayer({
        project: { title: 'Brainstorm', type, maturity: maturity as any, genre, tone },
        projectType: type,
        research,
        sceneText: premise,
        chapterTitle: 'Brainstorm'
      });
      return originalBrainstorm(`${runtime}\n\n${premise}`, genre, tone, type, research, maturity, externalReviews);
    };
  }

  const originalOutlinePlotNodes = service.outlinePlotNodes?.bind(service);
  if (originalOutlinePlotNodes) {
    service.outlinePlotNodes = async (project: Project, chapters: Chapter[] = [], research: ResearchNote[] = []) => {
      const runtime = buildRuntimeLayer({
        project,
        projectType: project.type,
        research,
        sceneText: chapters.map(c => `${c.title}\n${c.summary}`).join('\n\n').slice(0, 12000),
        chapterTitle: 'Structure'
      });
      return originalOutlinePlotNodes({ ...project, premise: `${runtime}\n\n${project.premise || ''}` }, chapters, research);
    };
  }

  const originalReconcileChapters = service.reconcileChapters?.bind(service);
  if (originalReconcileChapters) {
    service.reconcileChapters = async (project: Project, nodes: PlotNode[], chapters: Chapter[], research: ResearchNote[] = []) => {
      const runtime = buildRuntimeLayer({
        project,
        projectType: project.type,
        research,
        sceneText: chapters.map(c => `${c.title}\n${c.summary}`).join('\n\n').slice(0, 12000),
        chapterTitle: 'Chapter Reconciliation'
      });
      return originalReconcileChapters({ ...project, premise: `${runtime}\n\n${project.premise || ''}` }, nodes, chapters, research);
    };
  }

  console.info('Always-on literary runtime installed.');
}
