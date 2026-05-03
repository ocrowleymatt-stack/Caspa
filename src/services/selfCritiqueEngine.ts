import { Chapter, Project, ResearchNote, Character, PlotNode } from '../types';

function wordCount(text = ''): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function firstLine(text = ''): string {
  return text.split('\n').map(l => l.trim()).find(Boolean)?.slice(0, 180) || '';
}

function repeatedOpenings(chapters: Chapter[] = []) {
  const openings = chapters.map(c => firstLine(c.content || c.summary || '')).filter(Boolean);
  const heads = openings.map(o => o.toLowerCase().split(/\s+/).slice(0, 4).join(' '));
  const seen = new Map<string, number>();
  heads.forEach(h => seen.set(h, (seen.get(h) || 0) + 1));
  return [...seen.entries()].filter(([, count]) => count > 1).map(([h]) => h).slice(0, 8);
}

function detectWeaknesses(chapters: Chapter[] = []) {
  const recent = chapters.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).slice(-10);
  const shortChapters = recent.filter(c => wordCount(c.content || '') < 1800).map(c => c.title);
  const longSummaryChapters = recent.filter(c => (c.summary || '').length > 1000 && wordCount(c.content || '') < 2500).map(c => c.title);
  const duplicateOpenings = repeatedOpenings(recent);

  return {
    shortChapters,
    longSummaryChapters,
    duplicateOpenings
  };
}

export function buildNarrativeSelfCritiqueInjection(args: {
  project?: Partial<Project>;
  chapters?: Chapter[];
  research?: ResearchNote[];
  characters?: Character[];
  plotNodes?: PlotNode[];
  currentTask?: string;
} = {}) {
  const chapters = args.chapters || [];
  const weaknesses = detectWeaknesses(chapters);
  const totalWords = chapters.reduce((acc, ch) => acc + wordCount(ch.content || ''), 0);
  const targetWords = args.project?.targetWordCount || 50000;
  const currentTask = args.currentTask || 'creative generation';

  return `
NARRATIVE SELF-CRITIQUE LOOP — ALWAYS ACTIVE:
Current task: ${currentTask}
Current manuscript words: ${totalWords}
Project target words: ${targetWords}
Recent weak/short chapters: ${weaknesses.shortChapters.length ? weaknesses.shortChapters.join(', ') : 'none detected'}
Chapters with summary-heavy / scene-light risk: ${weaknesses.longSummaryChapters.length ? weaknesses.longSummaryChapters.join(', ') : 'none detected'}
Repeated opening patterns to avoid: ${weaknesses.duplicateOpenings.length ? weaknesses.duplicateOpenings.join(', ') : 'none detected'}

Self-critique procedure before final output:
1. Diagnose the scene's dramatic job: what turns, what changes, what pressure rises?
2. Detect dead prose: summary, exposition, generic feeling, repeated cadence, decorative metaphor.
3. Revive weak material through live scene action, dialogue friction, contradiction, object-pressure, and changed stakes.
4. Check character continuity: no reset, no generic dialogue, no unexplained behavioural jump.
5. Check chapter-scale contribution: this output must move plot, theme, character, or pressure.
6. Check word target honestly: if expansion is required, add earned scene material; do not pad.
7. Final pass: remove cliché, flattening explanation, moralising, repeated openings, and symmetrical AI paragraphing.

Output discipline:
- Do not reveal this self-critique unless explicitly asked.
- Apply the critique silently and return only the requested creative/prose/structural output.
`;
}
