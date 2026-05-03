import { AIService } from './ai';
import { updateNarrativeRuntimeMemory } from './installLiteraryRuntime';
import { Chapter, Character, PlotNode, Project, ResearchNote, SourceMaterial, ExternalReview } from '../types';

export type BookOptimisationReport = {
  overallScore: number;
  structuralScore: number;
  proseScore: number;
  characterScore: number;
  themeScore: number;
  continuityScore: number;
  prizeFitScore: number;
  weakChapters: string[];
  redundantChapters: string[];
  missingScenes: string[];
  themeDensityFixes: string[];
  characterArcFixes: string[];
  priorityRewriteQueue: string[];
  executiveDiagnosis: string;
};

function safeParseJSON(text: string, fallback: any) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      try { return JSON.parse(match[1]); } catch {}
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch {}
    }
    return fallback;
  }
}

function clamp(n: any, fallback = 60) {
  const value = Number(n);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function chapterDigest(chapters: Chapter[] = []) {
  return chapters
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(ch => {
      const words = (ch.content || '').trim().split(/\s+/).filter(Boolean).length;
      return `# ${ch.order + 1}. ${ch.title}\nSummary: ${ch.summary}\nWords: ${words}\nOpening: ${(ch.content || '').split('\n').find(Boolean) || ''}\nSample: ${(ch.content || '').slice(0, 1800)}`;
    })
    .join('\n\n---\n\n')
    .slice(0, 90000);
}

function normaliseReport(raw: any): BookOptimisationReport {
  return {
    overallScore: clamp(raw.overallScore ?? raw.overall),
    structuralScore: clamp(raw.structuralScore ?? raw.structure),
    proseScore: clamp(raw.proseScore ?? raw.prose),
    characterScore: clamp(raw.characterScore ?? raw.character),
    themeScore: clamp(raw.themeScore ?? raw.theme),
    continuityScore: clamp(raw.continuityScore ?? raw.continuity),
    prizeFitScore: clamp(raw.prizeFitScore ?? raw.prizeFit),
    weakChapters: Array.isArray(raw.weakChapters) ? raw.weakChapters.map(String).slice(0, 20) : [],
    redundantChapters: Array.isArray(raw.redundantChapters) ? raw.redundantChapters.map(String).slice(0, 20) : [],
    missingScenes: Array.isArray(raw.missingScenes) ? raw.missingScenes.map(String).slice(0, 20) : [],
    themeDensityFixes: Array.isArray(raw.themeDensityFixes) ? raw.themeDensityFixes.map(String).slice(0, 20) : [],
    characterArcFixes: Array.isArray(raw.characterArcFixes) ? raw.characterArcFixes.map(String).slice(0, 20) : [],
    priorityRewriteQueue: Array.isArray(raw.priorityRewriteQueue) ? raw.priorityRewriteQueue.map(String).slice(0, 20) : [],
    executiveDiagnosis: String(raw.executiveDiagnosis || raw.diagnosis || 'No diagnosis returned.')
  };
}

export async function runBookOptimisationPass(args: {
  project: Project;
  chapters: Chapter[];
  characters?: Character[];
  plotNodes?: PlotNode[];
  research?: ResearchNote[];
  sourceMaterials?: SourceMaterial[];
  externalReviews?: ExternalReview[];
}): Promise<BookOptimisationReport> {
  updateNarrativeRuntimeMemory({
    project: args.project,
    chapters: args.chapters,
    characters: args.characters || []
  });

  const prompt = `
You are a whole-book optimisation engine for a serious literary manuscript.
Return ONLY valid JSON.

Assess the manuscript as a complete book, not chapter-by-chapter trivia.

Project:
- title: ${args.project.title}
- type: ${args.project.type}
- genre: ${args.project.genre}
- tone: ${args.project.tone}
- premise: ${args.project.premise}
- target prize/standard: ${args.project.targetPrize || 'serious literary fiction'}
- target word count: ${args.project.targetWordCount || 50000}

Plot nodes:
${(args.plotNodes || []).map(n => `- ${n.title}: ${n.description}`).join('\n').slice(0, 20000)}

Characters:
${(args.characters || []).map(c => `- ${c.name}: ${c.role}; goals=${(c.goals || []).join(', ')}; fears=${(c.fears || []).join(', ')}`).join('\n').slice(0, 20000)}

Research anchors:
${(args.research || []).map(r => `- ${r.title}: ${r.content.slice(0, 800)}`).join('\n').slice(0, 20000)}

External reviews:
${(args.externalReviews || []).map(r => `- ${r.source}: ${r.content}`).join('\n').slice(0, 15000)}

Chapter digest:
${chapterDigest(args.chapters)}

Return JSON shape:
{
  "overallScore": 0,
  "structuralScore": 0,
  "proseScore": 0,
  "characterScore": 0,
  "themeScore": 0,
  "continuityScore": 0,
  "prizeFitScore": 0,
  "weakChapters": ["chapter title + reason"],
  "redundantChapters": ["chapter title + reason"],
  "missingScenes": ["needed scene + why"],
  "themeDensityFixes": ["fix"],
  "characterArcFixes": ["fix"],
  "priorityRewriteQueue": ["ordered rewrite target"],
  "executiveDiagnosis": "short brutal diagnosis"
}`;

  const raw = await AIService.callAI({ prompt, json: true, model: 'gemini-3.1-pro-preview' } as any);
  return normaliseReport(safeParseJSON(raw || '{}', {}));
}
