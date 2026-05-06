import { AIService } from './ai';
import { evaluateStructuralProgression } from './structuralGate';
import { runNarrativeQualityCycle } from './narrativeOrchestrator';
import { backupProjectSnapshotToDropbox, backupEmergencyToDropbox } from './dropboxBackup';
import { Chapter, Character, PlotNode, Project } from '../types';

export type AutoRebuildFragment = {
  id: string;
  title: string;
  content: string;
  structuralScore: number;
  warnings: string[];
};

export type AutoRebuildChapter = {
  title: string;
  summary: string;
  sourceFragmentIds: string[];
  content: string;
};

export type AutoRebuildResult = {
  status: 'complete' | 'partial' | 'failed';
  chapters: Chapter[];
  discardedFragments: number;
  keptFragments: number;
  notes: string[];
};

function normaliseForSimilarity(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 .,'-]/g, '')
    .trim();
}

function fingerprint(text: string) {
  const normalised = normaliseForSimilarity(text);
  return normalised.slice(0, 900);
}

function roughSimilarity(a: string, b: string) {
  const fa = fingerprint(a);
  const fb = fingerprint(b);
  if (!fa || !fb) return 0;
  if (fa === fb) return 1;
  if (fa.length > 250 && fb.includes(fa.slice(0, 250))) return 0.92;
  if (fb.length > 250 && fa.includes(fb.slice(0, 250))) return 0.92;
  const aWords = new Set(fa.split(' ').slice(0, 120));
  const bWords = new Set(fb.split(' ').slice(0, 120));
  const overlap = [...aWords].filter(w => bWords.has(w)).length;
  return overlap / Math.max(1, Math.min(aWords.size, bWords.size));
}

function splitIntoFragments(rawText: string): AutoRebuildFragment[] {
  const parts = rawText
    .split(/(?=^#{1,3}\s+.+$)|(?=^Chapter\s+\d+[:.\s-].+$)|(?=^CHAPTER\s+\d+[:.\s-].+$)/gim)
    .map(s => s.trim())
    .filter(s => s.length > 700);

  return parts.map((content, index) => {
    const title = content.split('\n').map(l => l.trim()).find(Boolean)?.replace(/^#{1,3}\s+/, '').slice(0, 120) || `Fragment ${index + 1}`;
    const report = evaluateStructuralProgression({ chapterTitle: title, draft: content, previousChapters: [] });
    return {
      id: `frag_${index + 1}`,
      title,
      content,
      structuralScore: report.score,
      warnings: report.warnings
    };
  });
}

function dedupeFragments(fragments: AutoRebuildFragment[]) {
  const kept: AutoRebuildFragment[] = [];
  let discarded = 0;

  for (const fragment of fragments) {
    const duplicate = kept.some(existing => roughSimilarity(existing.content, fragment.content) >= 0.86);
    if (duplicate) {
      discarded += 1;
      continue;
    }
    kept.push(fragment);
  }

  return { kept, discarded };
}

function selectViableFragments(fragments: AutoRebuildFragment[], maxFragments = 80) {
  return fragments
    .filter(f => f.structuralScore >= 45 || /velvet orchid|scott|key|flat|hardman|estate|astaroth|recording|evidence|testimony/i.test(`${f.title}\n${f.content}`))
    .sort((a, b) => b.structuralScore - a.structuralScore)
    .slice(0, maxFragments);
}

function parseClusterJSON(text: string): AutoRebuildChapter[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.chapters)) return parsed.chapters;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        if (Array.isArray(parsed?.chapters)) return parsed.chapters;
      } catch {}
    }
  }
  return [];
}

async function clusterFragmentsIntoChapters(fragments: AutoRebuildFragment[], project: Project): Promise<AutoRebuildChapter[]> {
  const fragmentDigest = fragments.map(f => `ID: ${f.id}\nTITLE: ${f.title}\nSTRUCTURAL_SCORE: ${f.structuralScore}\nSAMPLE:\n${f.content.slice(0, 1800)}`).join('\n\n---\n\n');

  const raw = await AIService.callAI({
    json: true,
    model: 'gemini-2.5-pro-preview-05-06',
    prompt: `
You are rebuilding a damaged gothic queer occult thriller manuscript into a clean novel spine.
Return ONLY valid JSON.

Project title: ${project.title}
Goal: reduce fragments into 12-18 coherent chapters.

Rules:
- Each chapter must have a clear narrative change.
- Do not create vibe-only chapters.
- Keep the strongest elements: Velvet Orchid, Scott, flat, iron key, Hardman Estate, Astaroth mythology, testimony/exposure.
- Scott must become specific through behaviour, dialogue, leverage, lies and action.
- Matt must move from reaction toward investigation and public exposure.
- Discard duplicate ritual sludge.

Fragments:
${fragmentDigest.slice(0, 90000)}

JSON shape:
{
  "chapters": [
    {
      "title": "",
      "summary": "What changes because this chapter happens.",
      "sourceFragmentIds": ["frag_1"],
      "content": "A concise scene plan using selected fragment material, not full prose."
    }
  ]
}`
  } as any);

  const chapters = parseClusterJSON(raw || '');
  return chapters.slice(0, 18).filter(ch => ch.title && (ch.summary || ch.content));
}

export async function runAutoRebuild(args: {
  rawText: string;
  project: Project;
  characters?: Character[];
  plotNodes?: PlotNode[];
  maxFragments?: number;
  maxChapters?: number;
}): Promise<AutoRebuildResult> {
  const notes: string[] = [];
  const plotNodes = args.plotNodes || [];
  const characters = args.characters || (args.project as any).characters || [];

  try {
    const fragments = splitIntoFragments(args.rawText);
    notes.push(`Split raw manuscript into ${fragments.length} candidate fragments.`);

    const deduped = dedupeFragments(fragments);
    notes.push(`Removed ${deduped.discarded} duplicate/near-duplicate fragments.`);

    const viable = selectViableFragments(deduped.kept, args.maxFragments || 80);
    notes.push(`Selected ${viable.length} structurally viable/source-important fragments.`);

    const clustered = await clusterFragmentsIntoChapters(viable, args.project);
    const planned = clustered.slice(0, args.maxChapters || 18);
    notes.push(`Clustered into ${planned.length} planned chapters.`);

    const rebuilt: Chapter[] = [];

    for (let i = 0; i < planned.length; i++) {
      const plan = planned[i];
      const sourceText = plan.sourceFragmentIds
        .map(id => viable.find(f => f.id === id)?.content || '')
        .filter(Boolean)
        .join('\n\n---\n\n')
        .slice(0, 50000);

      const result = await runNarrativeQualityCycle({
        project: args.project,
        title: plan.title,
        summary: plan.summary,
        context: `${plan.content}\n\nSOURCE MATERIAL:\n${sourceText}`,
        activeNodes: plotNodes,
        chapters: rebuilt,
        characters,
        maxAttempts: 3
      } as any);

      if (!result.blocked) {
        rebuilt.push({
          id: crypto.randomUUID(),
          title: plan.title,
          summary: plan.summary,
          content: result.draft,
          order: rebuilt.length,
          plotNodeIds: [],
          tags: ['auto-rebuilt'],
          updatedAt: Date.now()
        } as Chapter);
      } else {
        notes.push(`Blocked chapter '${plan.title}': ${result.blockReason || result.score.overall}`);
      }
    }

    await backupProjectSnapshotToDropbox({
      project: args.project,
      chapters: rebuilt,
      characters,
      reason: 'auto-rebuild-complete',
      extra: { notes, keptFragments: viable.length, discardedFragments: deduped.discarded }
    });

    return {
      status: rebuilt.length >= 8 ? 'complete' : 'partial',
      chapters: rebuilt,
      discardedFragments: deduped.discarded + Math.max(0, deduped.kept.length - viable.length),
      keptFragments: viable.length,
      notes
    };
  } catch (error) {
    await backupEmergencyToDropbox({
      project: args.project,
      label: 'AUTO_REBUILD_CRASH',
      payload: { error: String(error), notes }
    });

    return {
      status: 'failed',
      chapters: [],
      discardedFragments: 0,
      keptFragments: 0,
      notes: [...notes, `Auto rebuild failed: ${String(error)}`]
    };
  }
}
