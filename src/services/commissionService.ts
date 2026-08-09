/**
 * Caspa Commission Service
 * Diagnose manuscripts → structured recommendations → one-click execution
 */

import {
  getProjectKey,
  loadLibrary,
  findRelevantForChapter,
  suggestResearchTopics,
  deepResearchTopic,
  addNote,
} from './researchLibraryService';
import {
  loadPromises,
  savePromises,
  extractPromises,
  auditPromises,
  formatPromisesForDraft,
} from './promiseRegistryService';
import { loadBlueprint, formatPsychologyForChapter } from './psychologyEngineService';
import { AIService } from './ai';
import type { Chapter, Project, ProjectType, ResearchNote, ExternalReview } from '../types';
import type {
  CommissionProgress,
  CommissionScope,
  Diagnosis,
  Recommendation,
  ChapterSummary,
} from '../types/commission';
import type { StoryPromise } from '../types/promise';
import { formatShowPackForWriting } from './showBoxService';

export interface ProjectBriefLike {
  title: string;
  mode: string;
  idea: string;
  tone: string;
  output: string;
  audience: string;
  targetWordCount?: number;
}

const FINISH_FLOOR = 0.95;
const FINISH_CEILING = 1.05;
const CHECKPOINT_PREFIX = 'caspa.commission.checkpoint:';

function countWords(text: string | undefined | null): number {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function totalWords(chapters: Chapter[]): number {
  return chapters.reduce((sum, c) => sum + countWords(c.content), 0);
}

function isNonfictionBrief(brief: ProjectBriefLike): boolean {
  return ['nonfiction', 'essay'].includes((brief.mode || '').toLowerCase());
}

function briefToProjectType(mode: string): ProjectType {
  if (mode === 'script') return 'stageplay';
  if (mode === 'musical') return 'stageplay';
  if (mode === 'picture') return 'illustrated';
  if (mode === 'nonfiction' || mode === 'essay') return 'academic';
  if (mode === 'poetry') return 'experimental';
  if (mode === 'adaptation') return 'novel';
  return 'novel';
}

function nonfictionDraftContract(brief: ProjectBriefLike): string {
  if (!isNonfictionBrief(brief)) return '';
  return `NONFICTION GUIDE CONTRACT — THIS OVERRIDES FICTION/NARRATIVE DEFAULTS WHERE THEY CONFLICT:
- Write as authoritative, lucid guide/reference material for ${brief.audience || 'the intended reader'}, not as a novel, memoir-like scene sequence, or collection of literary essays.
- Structure first, prose second. Every chapter must have a clear instructional/intellectual purpose and advance the governing thesis or reader task.
- Use descriptive headings and subheadings, definitions, explanatory sequences, examples, worked scenarios, checklists, decision aids, tables, summaries and practical takeaways where they genuinely help.
- Do not force wounds, dramatic turns, sensory immersion, dialogue, subtext, cinematic openings or image-led endings into factual guide prose.
- Distinguish fact, interpretation, professional judgement, lived-experience material and speculation.
- Never invent citations, studies, statistics, organisations, quotations, dates or authorities. If a claim needs support and the source material does not support it, write [CITATION NEEDED] rather than fabricate.
- Where research notes contain usable provenance, use Harvard-style author-date citations in prose and preserve enough source detail for a reference list.
- Avoid repetition disguised as emphasis. Expand by adding missing substance, evidence, explanation, examples and reader utility — never padding.
- Suggest useful visual material inline as [FIGURE: concise description], [TABLE: concise description] or [BOX: concise description] only where it materially improves comprehension.
- Deliver on every promise made in the introduction and chapter openings. Flag glossary, appendix, resources, index or further-reading opportunities where appropriate.
- The result must feel like a coherent professionally edited book-length guide, not disconnected essays.`;
}

function checkpointSignature(
  brief: ProjectBriefLike,
  diagnosis: Diagnosis,
  ids: string[],
  scope: CommissionScope
): string {
  return JSON.stringify({
    title: brief.title,
    mode: brief.mode,
    target: brief.targetWordCount || null,
    diagnosisWords: diagnosis.wordCount,
    ids: [...ids].sort(),
    scope,
  });
}

function checkpointKey(brief: ProjectBriefLike): string {
  return `${CHECKPOINT_PREFIX}${getProjectKey(brief)}`;
}

function loadCheckpoint(
  brief: ProjectBriefLike,
  signature: string
): Chapter[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(checkpointKey(brief));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.signature !== signature || !Array.isArray(parsed?.chapters)) return null;
    return parsed.chapters as Chapter[];
  } catch {
    return null;
  }
}

function saveCheckpoint(
  brief: ProjectBriefLike,
  signature: string,
  chapters: Chapter[]
) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      checkpointKey(brief),
      JSON.stringify({ signature, chapters, savedAt: Date.now() })
    );
  } catch {
    /* best effort — do not make drafting depend on browser storage */
  }
}

function clearCheckpoint(brief: ProjectBriefLike) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(checkpointKey(brief));
  } catch {
    /* ignore */
  }
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
    targetWordCount:
      typeof brief.targetWordCount === 'number' && brief.targetWordCount > 0
        ? brief.targetWordCount
        : brief.mode === 'essay'
          ? 3000
          : brief.mode === 'poetry'
            ? 800
            : brief.mode === 'nonfiction'
              ? 50000
              : brief.mode === 'script'
                ? 20000
                : brief.mode === 'musical'
                  ? 25000
                  : brief.mode === 'picture'
                    ? 500
                    : 80000,
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
      wordCount: countWords(content),
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

  const wordCount = totalWords(chapters);

  const chapterSummaries: ChapterSummary[] = chapters.map((c) => {
    const wc = countWords(c.content);
    return {
      order: c.order,
      title: c.title,
      summary: c.summary || 'No summary',
      wordCount: wc,
      needsWork: wc < 200 || !c.content?.trim(),
    };
  });

  const showPackContext = formatShowPackForWriting();
  const target = project.targetWordCount || 50000;
  const nonfictionDiagnosis = isNonfictionBrief(brief)
    ? `\nNONFICTION DIAGNOSIS CONTRACT:\n- Treat this as a guide/reference work, not fiction.\n- Assess coverage, factual support, reader navigation, chapter purpose, examples, practical utility, duplication, unsupported assertions, citation needs, glossary/index/resources opportunities, and useful figures/tables.\n- Identify material promised but not delivered.\n- Explicitly flag chapters that are too thin for a ${target.toLocaleString()}-word finished book.\n`
    : '';

  const prompt = `You are Caspa's Master Editor. Analyse this ${inputType} for "${brief.title}" (${project.type}).

${LITERARY_BRIEF}
TARGET FINISHED LENGTH: ${target.toLocaleString()} words (acceptable final range ${Math.round(target * FINISH_FLOOR).toLocaleString()}–${Math.round(target * FINISH_CEILING).toLocaleString()}).
${nonfictionDiagnosis}
INPUT TYPE: ${inputType}
TONE TARGET: ${brief.tone}
PREMISE: ${brief.idea}
${showPackContext ? `\n${showPackContext}\n` : ''}
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
- Flag abandoned threads/promises and structural collapse
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
      detail: 'Rebuild the structure while preserving valuable source material and reader promises.',
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

const LITERARY_BRIEF = `Apply prize-calibre editorial standards, but use measurable acceptance criteria rather than decorative ambition. Structure first, prose second. Protect the reader from unfulfilled promises, unsupported claims and unfinished work.`;

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
  onProgress: (p: CommissionProgress) => void,
  options?: { autoResearch?: boolean; promises?: StoryPromise[] }
): Promise<{ chapters: Chapter[]; artefact: string; promises: StoryPromise[] }> {
  const project = briefToProject(brief);
  const projectKey = getProjectKey(brief);
  const signature = checkpointSignature(brief, diagnosis, selectedRecommendationIds, scope);
  const resumed = loadCheckpoint(brief, signature);
  let working = (resumed || [...chapters]).sort((a, b) => a.order - b.order);

  if (resumed) {
    onProgress({ phase: 'resume', message: 'Resuming the saved finish run from the last completed chapter…', percent: 6 });
  }

  if (options?.autoResearch !== false) {
    onProgress({ phase: 'research', message: 'Checking research library…', percent: 8 });
    const library = loadLibrary(projectKey);
    const manuscriptSample = working.map((c) => c.content || c.summary).join('\n').slice(0, 12000);

    if (library.length < 3 && manuscriptSample.trim()) {
      onProgress({ phase: 'research', message: 'Detecting research gaps…', percent: 12 });
      try {
        const topics = (await suggestResearchTopics(brief, manuscriptSample)).slice(0, 3);
        for (const topic of topics) {
          onProgress({ phase: 'research', message: `Researching: ${topic.slice(0, 60)}…`, percent: 14 });
          const note = await deepResearchTopic(topic, brief, manuscriptSample);
          addNote(projectKey, note);
        }
      } catch (err) {
        console.warn('[Commission] Auto-research skipped:', err);
      }
    }
  }

  const researchLibrary = loadLibrary(projectKey);
  let activePromises = options?.promises ?? loadPromises(projectKey);
  const psychologyBlueprint = loadBlueprint(projectKey);

  const selectedRecs = diagnosis.recommendations.filter((r) =>
    selectedRecommendationIds.includes(r.id)
  );

  const directiveBlock = selectedRecs.map((r) => `- ${r.title}: ${r.detail}`).join('\n');

  const promiseBlock =
    activePromises.length > 0
      ? `\n\nREADER/STORY PROMISES (must honour, resolve or deliberately revise):\n${activePromises
          .filter((p) => p.status !== 'paid_off')
          .map((p) => `- [${p.type}] ${p.statement} (${p.status})`)
          .join('\n')}`
      : '';

  const analysisReview: ExternalReview = {
    id: 'commission-diagnosis',
    source: 'Caspa Diagnosis',
    content: `${diagnosis.verdict}\n\n${diagnosis.editorNotes}\n\nApproved fixes:\n${directiveBlock}${promiseBlock}`,
    date: Date.now(),
    isImplemented: true,
  };

  if (!resumed && (scope.type === 'rebuild' || selectedRecs.some((r) => r.actionType === 'rebuild'))) {
    onProgress({ phase: 'rebuild', message: 'Rebuilding the book architecture…', percent: 10 });

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

    saveCheckpoint(brief, signature, working);
    onProgress({ phase: 'rebuild', message: `New structure: ${working.length} chapters`, percent: 30 });
  }

  const checkpointed = new Set(
    working.filter((c) => (c.tags || []).includes('commission-checkpoint')).map((c) => c.id)
  );

  const scoped = scope.type === 'autowrite'
    ? working.filter((c) => !c.content?.trim() || countWords(c.content) < 200)
    : chaptersInScope(working, scope).filter(
        (c) =>
          scope.type === 'whole' ||
          !c.content?.trim() ||
          countWords(c.content) < 500 ||
          selectedRecs.some((r) => r.chapterRefs?.includes(c.order + 1))
      );

  const targets = scoped.filter((c) => !checkpointed.has(c.id));
  if (targets.length === 0 && !resumed && scope.type !== 'rebuild') {
    targets.push(...chaptersInScope(working, scope));
  }

  const total = targets.length || 1;
  let completed = 0;
  const failed: string[] = [];
  const guideContract = nonfictionDraftContract(brief);

  for (const chap of targets) {
    completed += 1;
    const pct = 30 + Math.round((completed / total) * 55);
    onProgress({
      phase: 'draft',
      message: `Writing "${chap.title}" (${completed}/${total})…`,
      percent: pct,
    });

    const earlierContent = working
      .filter((c) => c.order < chap.order)
      .map((c) => c.content)
      .join('\n\n')
      .slice(-9000);

    const showPackDirective = formatShowPackForWriting();
    const mergedDirectives = [
      ...(guideContract ? [guideContract] : []),
      ...(chap.directives || []),
      ...selectedRecs.map((r) => r.detail),
      ...formatPromisesForDraft(activePromises, chap.order),
      ...(!isNonfictionBrief(brief) && psychologyBlueprint ? formatPsychologyForChapter(psychologyBlueprint, chap.order) : []),
      ...(showPackDirective ? [showPackDirective] : []),
    ];

    const chapterResearch = findRelevantForChapter(researchLibrary, chap, brief);

    try {
      const content = await AIService.writeDraft(
        chap.title,
        chap.summary,
        earlierContent,
        project.type,
        [],
        chapterResearch,
        project.maturity,
        [],
        mergedDirectives,
        project.targetWordCount,
        [analysisReview],
        4,
        working.length,
        project.cutMode
      );

      working = working.map((c) =>
        c.order === chap.order
          ? {
              ...c,
              content,
              isPlan: false,
              tags: Array.from(new Set([...(c.tags || []), 'commission-checkpoint'])),
              wordCount: countWords(content),
              updatedAt: Date.now(),
            }
          : c
      );
      saveCheckpoint(brief, signature, working);
    } catch (err) {
      failed.push(chap.title);
      saveCheckpoint(brief, signature, working);
      onProgress({
        phase: 'draft',
        message: `Paused after "${chap.title}" failed. Completed chapters are saved for retry.`,
        percent: pct,
      });
      console.error(err);
      break;
    }
  }

  if (failed.length) {
    throw new Error(`Finish run paused at "${failed[0]}". Completed chapters are saved. Retry and Caspa will continue from the checkpoint instead of starting again.`);
  }

  const targetWords = project.targetWordCount || 50000;
  const minWords = Math.round(targetWords * FINISH_FLOOR);
  const maxWords = Math.round(targetWords * FINISH_CEILING);
  const perChapterTarget = Math.max(1, Math.round(targetWords / Math.max(1, working.length)));

  // Software, not the model, decides whether the book is long enough to be called finished.
  for (let pass = 1; pass <= 2 && totalWords(working) < minWords; pass += 1) {
    const currentTotal = totalWords(working);
    const deficit = minWords - currentTotal;
    onProgress({
      phase: 'length-audit',
      message: `Length audit: ${currentTotal.toLocaleString()} words. Expanding missing substance (${deficit.toLocaleString()} words short)…`,
      percent: 88 + pass * 2,
    });

    const candidates = working
      .map((c) => ({ c, words: countWords(c.content), deficit: Math.max(0, perChapterTarget - countWords(c.content)) }))
      .filter((x) => x.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit);

    for (const { c: chap } of candidates) {
      if (totalWords(working) >= minWords) break;
      const existing = working.find((c) => c.id === chap.id) || chap;
      const earlierContent = working
        .filter((c) => c.order < existing.order)
        .map((c) => c.content)
        .join('\n\n')
        .slice(-9000);
      const chapterResearch = findRelevantForChapter(researchLibrary, existing, brief);
      const expansionDirectives = [
        ...(guideContract ? [guideContract] : []),
        `LENGTH RECOVERY PASS ${pass}: This chapter is materially under its allocated share of the finished book. Expand with missing substance, evidence, explanation, examples, practical reader utility and unresolved approved fixes. Do not pad, repeat or waffle. Preserve all sound existing material while producing a complete final chapter.`,
        ...(existing.directives || []),
        ...selectedRecs.map((r) => r.detail),
      ];

      const content = await AIService.writeDraft(
        existing.title,
        existing.summary,
        earlierContent,
        project.type,
        [],
        chapterResearch,
        project.maturity,
        [],
        expansionDirectives,
        project.targetWordCount,
        [analysisReview],
        4,
        working.length,
        false
      );

      working = working.map((c) => c.id === existing.id ? {
        ...c,
        content,
        wordCount: countWords(content),
        updatedAt: Date.now(),
        tags: Array.from(new Set([...(c.tags || []), 'commission-checkpoint'])),
      } : c);
      saveCheckpoint(brief, signature, working);
    }
  }

  const finalCount = totalWords(working);
  if (finalCount < minWords) {
    saveCheckpoint(brief, signature, working);
    throw new Error(
      `Caspa has not finished this book: ${finalCount.toLocaleString()} words against a ${targetWords.toLocaleString()}-word target. The minimum acceptance threshold is ${minWords.toLocaleString()}. Progress is saved; retry will continue the expansion rather than falsely declaring completion.`
    );
  }

  onProgress({
    phase: 'qa',
    message: `Final QA: ${finalCount.toLocaleString()} words (${minWords.toLocaleString()}–${maxWords.toLocaleString()} acceptance range)…`,
    percent: 94,
  });

  const cleanedWorking = working.map((c) => ({
    ...c,
    tags: (c.tags || []).filter((tag) => tag !== 'commission-checkpoint'),
  }));

  const artefact = cleanedWorking
    .sort((a, b) => a.order - b.order)
    .map((c) => `# ${c.title}\n\n${c.content}`)
    .join('\n\n---\n\n');

  onProgress({ phase: 'promises', message: isNonfictionBrief(brief) ? 'Auditing reader promises and coverage…' : 'Auditing story promises…', percent: 96 });

  try {
    activePromises = await auditPromises(cleanedWorking, brief, activePromises);
    savePromises(projectKey, activePromises);
  } catch (err) {
    console.warn('[Commission] Promise audit skipped:', err);
  }

  clearCheckpoint(brief);
  onProgress({ phase: 'complete', message: `Commission complete at ${finalCount.toLocaleString()} words.`, percent: 100 });

  return { chapters: cleanedWorking, artefact, promises: activePromises };
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
