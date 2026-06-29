/**
 * Kesper Commission Service
 * Diagnose manuscripts → structured recommendations → one-click execution
 */

import { AIService } from './ai';
import type { Chapter, Project, ProjectType, ResearchNote, ExternalReview } from '../types';
import type {
  CommissionProgress,
  CommissionScope,
  Diagnosis,
  Recommendation,
  ChapterSummary,
} from '../types/commission';

export interface ProjectBriefLike {
  title: string;
  mode: string;
  idea: string;
  tone: string;
  output: string;
  audience: string;
}

function briefToProjectType(mode: string): ProjectType {
  if (mode === 'script') return 'stageplay';
  if (mode === 'musical') return 'stageplay';
  if (mode === 'adaptation') return 'novel';
  return 'novel';
}

export function briefToProject(brief: ProjectBriefLike): Project {
  return {
    id: 'local-commission',
    title: brief.title,
    type: briefToProjectType(brief.mode),
    maturity: 'standard',
    genre: brief.mode,
    premise: brief.idea,
    tone: brief.tone,
    ownerId: 'local',
    collaborators: [],
    lastModified: Date.now(),
    createdAt: Date.now(),
    targetWordCount: 80000,
  };
}

export async function ingestManuscript(
  text: string,
  brief: ProjectBriefLike,
  onProgress?: (message: string) => void
): Promise<{ chapters: Chapter[]; inputType: 'manuscript' | 'plan' }> {
  const projectType = briefToProjectType(brief.mode);
  onProgress?.('Recognising input type…');

  const detected = await AIService.detectIngestionType(text);
  const isPlan = detected === 'plan';
  onProgress?.(isPlan ? 'Book plan detected — extracting structure…' : 'Manuscript detected — splitting chapters…');

  let segments: { title: string; summary: string; marker: string; directives?: string[] }[] = [];

  try {
    segments = await AIService.splitManuscript(text, projectType, isPlan);
  } catch {
    segments = [];
  }

  if (segments.length === 0) {
    const chapterRegex =
      /(?:Chapter|CHAPTER|SECTION|Section|Part|PART)\s+([0-9A-Z]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)|(?:\n\n|^)(?:\* \* \*|# |### |---)(?:\n\n|$)/g;
    const matches = [...text.matchAll(chapterRegex)];

    if (matches.length >= 2) {
      segments = matches.map((m, i) => ({
        title: m[1] ? `Chapter ${m[1]}` : `Section ${i + 1}`,
        summary: 'Imported via pattern matching.',
        marker: text.slice(m.index ?? 0, (m.index ?? 0) + 120),
      }));
    } else {
      segments = [{ title: brief.title || 'Full Manuscript', summary: brief.idea, marker: text.slice(0, 200) }];
    }
  }

  const parts = splitTextByMarkers(text, segments.map((s) => s.marker));

  const chapters: Chapter[] = segments.map((seg, i) => {
    let content = isPlan ? '' : (parts[i] || '').trim();
    if (!isPlan && segments.length === 1) content = text.trim();
    return {
      id: crypto.randomUUID(),
      title: seg.title,
      summary: seg.summary,
      content,
      order: i,
      plotNodeIds: [],
      tags: [],
      isPlan,
      directives: seg.directives || [],
      updatedAt: Date.now(),
      wordCount: content.split(/\s+/).filter(Boolean).length,
    };
  });

  return { chapters, inputType: isPlan ? 'plan' : 'manuscript' };
}

function splitTextByMarkers(fullText: string, markers: string[]): string[] {
  if (markers.length <= 1) return [fullText];

  const parts: string[] = [];
  let cursor = 0;

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const idx = fullText.indexOf(marker, cursor);
    if (idx === -1) {
      parts.push(i === 0 ? fullText : '');
      continue;
    }
    if (i > 0) {
      parts.push(fullText.slice(cursor, idx).trim());
    }
    cursor = idx;
  }
  parts.push(fullText.slice(cursor).trim());
  return parts.length === markers.length ? parts : [fullText];
}

export async function diagnoseManuscript(
  chapters: Chapter[],
  brief: ProjectBriefLike,
  inputType: 'manuscript' | 'plan'
): Promise<Diagnosis> {
  const project = briefToProject(brief);
  const fullText = chapters
    .map((c) => `[CHAPTER ${c.order + 1}: ${c.title}]\n${c.summary}\n${c.content}`)
    .join('\n\n');

  const wordCount = chapters.reduce(
    (sum, c) => sum + (c.content?.split(/\s+/).filter(Boolean).length || 0),
    0
  );

  const chapterSummaries: ChapterSummary[] = chapters.map((c) => {
    const wc = c.content?.split(/\s+/).filter(Boolean).length || 0;
    return {
      order: c.order,
      title: c.title,
      summary: c.summary || 'No summary',
      wordCount: wc,
      needsWork: wc < 200 || !c.content?.trim(),
    };
  });

  const prompt = `You are Kesper's Master Editor. Analyse this ${inputType} for "${brief.title}" (${project.type}).

${LITERARY_BRIEF}

INPUT TYPE: ${inputType}
TONE TARGET: ${brief.tone}
PREMISE: ${brief.idea}

MANUSCRIPT / PLAN:
${fullText.slice(0, 90000)}

Return JSON only:
{
  "verdict": "2-3 sentence editorial verdict — be direct, not polite",
  "viabilityScore": 0-100,
  "suggestRebuild": boolean,
  "editorNotes": "markdown summary of key issues",
  "recommendations": [
    {
      "id": "rec-1",
      "title": "short action title",
      "detail": "specific editorial instruction",
      "severity": "critical|major|minor",
      "defaultSelected": true/false,
      "actionType": "cut|restructure|rewrite|research|rebuild",
      "chapterRefs": [1, 2]
    }
  ]
}

Rules:
- Give 3-6 concrete recommendations, not vague advice
- Flag abandoned subplots, broken promises, pacing collapse
- If the work is unsalvageable without full restructure, set suggestRebuild true and include a rebuild recommendation
- Be willing to say the idea isn't working
${inputType === 'plan' ? '- This is a PLAN not prose — recommend structure fixes and drafting order, not line edits' : ''}`;

  const raw = await AIService.callAI({
    prompt,
    json: true,
    model: 'gemini-2.0-flash',
    maxTokens: 4096,
  });

  const parsed = safeParseJSON(raw, {});

  const recommendations: Recommendation[] = (parsed.recommendations || []).map(
    (r: Partial<Recommendation>, i: number) => ({
      id: r.id || `rec-${i + 1}`,
      title: r.title || 'Improvement',
      detail: r.detail || '',
      severity: r.severity || 'major',
      defaultSelected: r.defaultSelected !== false,
      actionType: r.actionType || 'rewrite',
      chapterRefs: r.chapterRefs,
    })
  );

  if (parsed.suggestRebuild && !recommendations.some((r) => r.actionType === 'rebuild')) {
    recommendations.unshift({
      id: 'rec-rebuild',
      title: 'Rip up and rebuild from premise',
      detail: 'Liquidate current structure. Salvage the dramatic wound, rebuild spine and chapter map.',
      severity: 'critical',
      defaultSelected: false,
      actionType: 'rebuild',
    });
  }

  return {
    verdict: parsed.verdict || 'Analysis complete.',
    inputType: inputType === 'plan' ? 'plan' : chapters.some((c) => c.content?.trim()) ? 'manuscript' : 'plan',
    wordCount,
    chapterCount: chapters.length,
    viabilityScore: typeof parsed.viabilityScore === 'number' ? parsed.viabilityScore : 50,
    suggestRebuild: Boolean(parsed.suggestRebuild),
    recommendations,
    chapterSummaries,
    editorNotes: parsed.editorNotes || '',
  };
}

const LITERARY_BRIEF = `Apply prize-calibre editorial standards. Cut weak ideas. Protect the reader from unfulfilled promises.`;

function safeParseJSON(text: string, fallback: Record<string, unknown>) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) return JSON.parse(match[1]);
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* fall through */
    }
    return fallback;
  }
}

function chaptersInScope(chapters: Chapter[], scope: CommissionScope): Chapter[] {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);

  switch (scope.type) {
    case 'single':
      return sorted.filter((c) => c.order + 1 === (scope.singleChapter ?? 1));
    case 'chapters':
      return sorted.filter(
        (c) =>
          c.order + 1 >= (scope.chapterFrom ?? 1) &&
          c.order + 1 <= (scope.chapterTo ?? sorted.length)
      );
    case 'rebuild':
    case 'autowrite':
    case 'whole':
    default:
      return sorted;
  }
}

export async function executeCommission(
  brief: ProjectBriefLike,
  chapters: Chapter[],
  diagnosis: Diagnosis,
  selectedRecommendationIds: string[],
  scope: CommissionScope,
  onProgress: (p: CommissionProgress) => void
): Promise<{ chapters: Chapter[]; artefact: string }> {
  const project = briefToProject(brief);
  let working = [...chapters].sort((a, b) => a.order - b.order);

  const selectedRecs = diagnosis.recommendations.filter((r) =>
    selectedRecommendationIds.includes(r.id)
  );

  const directiveBlock = selectedRecs.map((r) => `- ${r.title}: ${r.detail}`).join('\n');

  const analysisReview: ExternalReview = {
    id: 'commission-diagnosis',
    source: 'Kesper Diagnosis',
    content: `${diagnosis.verdict}\n\n${diagnosis.editorNotes}\n\nApproved fixes:\n${directiveBlock}`,
    date: Date.now(),
    isImplemented: true,
  };

  if (scope.type === 'rebuild' || selectedRecs.some((r) => r.actionType === 'rebuild')) {
    onProgress({ phase: 'rebuild', message: 'Rip up and rebuild — restructuring spine…', percent: 10 });

    const research: ResearchNote[] = [];
    const result = await AIService.ripUpAndRestart(project, working, research);

    working = result.chapters.map((c, i) => ({
      id: crypto.randomUUID(),
      title: c.title,
      summary: c.summary,
      content: '',
      order: i,
      plotNodeIds: c.plotNodeIds || [],
      tags: ['rebuilt'],
      isPlan: true,
      directives: [],
      updatedAt: Date.now(),
    }));

    onProgress({ phase: 'rebuild', message: `New structure: ${working.length} chapters`, percent: 30 });

    if (scope.type !== 'rebuild') {
      scope = { type: 'autowrite' };
    }
  }

  const targets =
    scope.type === 'autowrite'
      ? working.filter((c) => !c.content?.trim() || c.content.split(/\s+/).filter(Boolean).length < 200)
      : chaptersInScope(working, scope).filter(
          (c) =>
            scope.type === 'whole' ||
            !c.content?.trim() ||
            c.content.split(/\s+/).filter(Boolean).length < 500 ||
            selectedRecs.some((r) => r.chapterRefs?.includes(c.order + 1))
        );

  if (targets.length === 0 && scope.type !== 'rebuild') {
    targets.push(...chaptersInScope(working, scope));
  }

  const total = targets.length || 1;
  let completed = 0;

  for (const chap of targets) {
    completed += 1;
    const pct = 30 + Math.round((completed / total) * 65);
    onProgress({
      phase: 'draft',
      message: `Writing "${chap.title}" (${completed}/${total})…`,
      percent: pct,
    });

    const earlierContent = working
      .filter((c) => c.order < chap.order)
      .map((c) => c.content)
      .join('\n\n')
      .slice(-5000);

    const mergedDirectives = [...(chap.directives || []), ...selectedRecs.map((r) => r.detail)];

    try {
      const content = await AIService.writeDraft(
        chap.title,
        chap.summary,
        earlierContent,
        project.type,
        [],
        [],
        project.maturity,
        [],
        mergedDirectives,
        project.targetWordCount,
        [analysisReview],
        project.draftStage,
        working.length,
        project.cutMode
      );

      working = working.map((c) =>
        c.order === chap.order
          ? {
              ...c,
              content,
              isPlan: false,
              wordCount: content.split(/\s+/).filter(Boolean).length,
              updatedAt: Date.now(),
            }
          : c
      );
    } catch (err) {
      onProgress({
        phase: 'draft',
        message: `Warning: "${chap.title}" failed — continuing…`,
        percent: pct,
      });
      console.error(err);
    }
  }

  const artefact = working
    .sort((a, b) => a.order - b.order)
    .map((c) => `# ${c.title}\n\n${c.content}`)
    .join('\n\n---\n\n');

  onProgress({ phase: 'complete', message: 'Commission complete.', percent: 100 });

  return { chapters: working, artefact };
}

export function chaptersToStorage(chapters: Chapter[]): string {
  return JSON.stringify(chapters);
}

export function chaptersFromStorage(raw: string | null): Chapter[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Chapter[];
  } catch {
    return [];
  }
}
