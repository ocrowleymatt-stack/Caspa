import { generateId } from '../../shared';
import { aiWithFallback, getProjectFullText, requireProject } from '../../shared/elevationHelpers';
import {
  RESEARCH_AI_DISCLAIMER,
  type AccuracyVerdict,
  type ClaimAccuracyStatus,
  type ExtractedResearchClaim,
  type ResearchDepthPassResult,
  type ResearchTopicSuggestion,
} from '../../shared/researchDesk';
import { ChapterService } from '../manuscript/ChapterService';
import { PlotService } from '../manuscript/PlotService';
import { ProjectService } from '../manuscript/ProjectService';
import { ResearchService } from '../manuscript/ResearchService';
import { outputRegistry } from '../outputs';
import { claimExtractor } from './ClaimExtractor';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3);
}

function overlapScore(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = tokenize(b);
  if (aTokens.size === 0 || bTokens.length === 0) return 0;
  let hits = 0;
  for (const token of bTokens) {
    if (aTokens.has(token)) hits += 1;
  }
  return hits / Math.max(bTokens.length, 1);
}

function looksFactual(claim: string): boolean {
  return /\b(was|were|is|are|born|died|built|founded|in \d{4}|percent|million|century)\b/i.test(claim);
}

export class ResearchDeskService {
  private readonly researchService = new ResearchService();
  private readonly projectService = new ProjectService();
  private readonly chapterService = new ChapterService();
  private readonly plotService = new PlotService();

  listNotes(projectId: string, tags?: string[]) {
    return this.researchService.listNotes(projectId, tags);
  }

  getNote(id: string) {
    return this.researchService.getNote(id);
  }

  createNote(data: Omit<import('../../shared').ResearchNote, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.researchService.createNote(data);
  }

  updateNote(id: string, data: Partial<import('../../shared').ResearchNote>) {
    return this.researchService.updateNote(id, data);
  }

  deleteNote(id: string) {
    return this.researchService.deleteNote(id);
  }

  async suggestTopics(input: {
    projectId: string;
    sourceText?: string;
    query?: string;
  }): Promise<{
    topics: ResearchTopicSuggestion[];
    disclaimer: string;
  }> {
    const project = await this.projectService.getProject(input.projectId);
    const [notes, poles, chapters] = await Promise.all([
      this.researchService.listNotes(input.projectId),
      this.plotService.listPlotPoints(input.projectId),
      this.chapterService.listChapters(input.projectId),
    ]);

    const context = [
      `Project: ${project.title}`,
      `Work type: ${project.workType ?? project.genre}`,
      `Fictionality: ${project.fictionality ?? 'unknown'}`,
      `Existing tags: ${[...new Set(notes.flatMap((note) => note.tags))].join(', ') || 'none'}`,
      `Poles: ${poles.map((pole) => pole.title).join('; ') || 'none'}`,
      `Units: ${chapters.length}`,
      input.query ? `Author question: ${input.query}` : '',
      input.sourceText ? `Manuscript excerpt:\n${input.sourceText.slice(0, 1800)}` : '',
    ].filter(Boolean).join('\n');

    const fallbackTopics: ResearchTopicSuggestion[] = [
      {
        topic: 'Period and setting accuracy',
        reason: 'Verify historical or geographic details before expanding prose.',
        priority: 'high',
        verificationStatus: 'unverified',
        sourceType: 'ai-suggestion',
      },
      {
        topic: 'Character profession or role constraints',
        reason: 'Confirm what the protagonist can plausibly know or do.',
        priority: 'medium',
        verificationStatus: 'unverified',
        sourceType: 'ai-suggestion',
      },
    ];

    const { text } = await aiWithFallback(
      [
        'Suggest 3-5 research topics for this writing project.',
        'Return JSON array only: [{ "topic": "...", "reason": "...", "priority": "high|medium|low" }]',
        'Do not invent citations or claim facts are verified.',
      ].join('\n'),
      context,
      JSON.stringify(fallbackTopics.map(({ topic, reason, priority }) => ({ topic, reason, priority }))),
      input.projectId,
    );

    let parsed: Array<{ topic?: string; reason?: string; priority?: string }> = [];
    try {
      const match = text.match(/\[[\s\S]*\]/);
      parsed = match ? JSON.parse(match[0]) as typeof parsed : [];
    } catch {
      parsed = [];
    }

    const topics: ResearchTopicSuggestion[] = (parsed.length ? parsed : fallbackTopics).slice(0, 6).map((item, index) => ({
      topic: item.topic?.trim() || fallbackTopics[index % fallbackTopics.length].topic,
      reason: item.reason?.trim() || 'Suggested by Research Desk — verify before drafting.',
      priority: (item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium') as ResearchTopicSuggestion['priority'],
      verificationStatus: 'unverified',
      sourceType: 'ai-suggestion',
    }));

    return { topics, disclaimer: RESEARCH_AI_DISCLAIMER };
  }

  extractClaims(input: { projectId?: string; text: string }): {
    claims: ExtractedResearchClaim[];
    disclaimer: string;
  } {
    const base = claimExtractor.extract(input.text);
    const claims: ExtractedResearchClaim[] = base.map((claim) => ({
      ...claim,
      id: generateId(),
      verificationStatus: 'unverified',
      source: 'deterministic',
    }));

    return { claims, disclaimer: RESEARCH_AI_DISCLAIMER };
  }

  async checkAccuracy(input: {
    projectId: string;
    claims?: Array<{ id?: string; text: string }>;
    sourceText?: string;
  }): Promise<{
    verdicts: AccuracyVerdict[];
    disclaimer: string;
    confirmedLibraryUsed: boolean;
  }> {
    await this.projectService.getProject(input.projectId);
    const notes = await this.researchService.listNotes(input.projectId);
    const confirmed = this.researchService.listConfirmedNotes(notes);

    const claims = input.claims?.length
      ? input.claims
      : this.extractClaims({ projectId: input.projectId, text: input.sourceText ?? '' }).claims.map((claim) => ({
          id: claim.id,
          text: claim.text,
        }));

    if (claims.length === 0) {
      throw new Error('claims or sourceText is required');
    }

    const project = await requireProject(input.projectId);
    const verdicts: AccuracyVerdict[] = claims.map((claim, index) => {
      const claimText = claim.text.trim();
      const claimId = claim.id ?? `claim-${index + 1}`;

      if (confirmed.length === 0) {
        const status: ClaimAccuracyStatus = project.fictionality === 'fiction' && !looksFactual(claimText)
          ? 'fiction-canon'
          : 'missing-research';
        return {
          claimId,
          claimText,
          status,
          matchedNoteIds: [],
          explanation: status === 'missing-research'
            ? 'No confirmed research in the library yet — verify before presenting as fact.'
            : 'Treated as in-fiction material; not verified against external sources.',
          aiInference: true,
        };
      }

      const matches = confirmed
        .map((note) => ({
          note,
          score: Math.max(
            overlapScore(claimText, note.content),
            overlapScore(claimText, note.title),
          ),
        }))
        .filter((entry) => entry.score >= 0.18)
        .sort((a, b) => b.score - a.score);

      if (matches.length > 0) {
        return {
          claimId,
          claimText,
          status: 'confirmed',
          matchedNoteIds: matches.slice(0, 3).map((entry) => entry.note.id),
          explanation: `Supported by confirmed research: ${matches[0].note.title}`,
          aiInference: false,
        };
      }

      const contradicted = notes.find(
        (note) =>
          note.verificationStatus === 'contradicted'
          && overlapScore(claimText, note.content) >= 0.2,
      );
      if (contradicted) {
        return {
          claimId,
          claimText,
          status: 'contradicted',
          matchedNoteIds: [contradicted.id],
          explanation: `Marked contradicted in research library: ${contradicted.title}`,
          aiInference: false,
        };
      }

      return {
        claimId,
        claimText,
        status: 'unverified',
        matchedNoteIds: [],
        explanation: 'Not matched to confirmed research — treat as unverified.',
        aiInference: true,
      };
    });

    return {
      verdicts,
      disclaimer: RESEARCH_AI_DISCLAIMER,
      confirmedLibraryUsed: confirmed.length > 0,
    };
  }

  async depthPass(input: {
    projectId: string;
    topic?: string;
    unitId?: string;
  }): Promise<ResearchDepthPassResult> {
    const project = await this.projectService.getProject(input.projectId);
    const notes = await this.researchService.listNotes(input.projectId);
    const confirmed = this.researchService.listConfirmedNotes(notes);
    const topic = input.topic?.trim() || 'General project depth';

    let unitContext = '';
    if (input.unitId) {
      const unit = await this.chapterService.getChapter(input.unitId);
      unitContext = `\nUnit: ${unit.title}\n${unit.content.slice(0, 1500)}`;
    }

    const librarySummary = notes
      .slice(0, 8)
      .map((note) => `- [${note.verificationStatus}] ${note.title}: ${note.content.slice(0, 160)}`)
      .join('\n');

    const context = await getProjectFullText(input.projectId, 6000);
    const { text } = await aiWithFallback(
      [
        `Run a research depth pass on topic: ${topic}`,
        'Return JSON: { "summary": "...", "gaps": ["..."], "questions": [{ "topic": "...", "reason": "...", "priority": "high|medium|low" }] }',
        'Do not invent citations. Mark all suggestions as needing verification.',
      ].join('\n'),
      `${context}${unitContext}\n\nResearch library:\n${librarySummary || 'Empty'}`,
      JSON.stringify({
        summary: 'Research library is thin for this topic.',
        gaps: ['Primary sources not yet attached', 'Topic tags missing'],
        questions: [
          {
            topic: `${topic} — primary sources`,
            reason: 'Collect citable sources before drafting factual passages.',
            priority: 'high',
          },
        ],
      }),
      input.projectId,
    );

    let parsed: {
      summary?: string;
      gaps?: string[];
      questions?: Array<{ topic?: string; reason?: string; priority?: string }>;
    } = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) as typeof parsed : {};
    } catch {
      parsed = {};
    }

    const suggestedQuestions: ResearchTopicSuggestion[] = (parsed.questions ?? []).slice(0, 6).map((item) => ({
      topic: item.topic?.trim() || topic,
      reason: item.reason?.trim() || 'Suggested by depth pass — verify manually.',
      priority: (item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium') as ResearchTopicSuggestion['priority'],
      verificationStatus: 'unverified',
      sourceType: 'ai-suggestion',
    }));

    const result: ResearchDepthPassResult = {
      projectId: input.projectId,
      topic,
      summary: parsed.summary?.trim() || 'Research depth pass complete — gaps remain.',
      gaps: parsed.gaps?.filter(Boolean) ?? ['No confirmed notes matched this topic yet.'],
      suggestedQuestions,
      confirmedNoteCount: confirmed.length,
      unverifiedNoteCount: notes.filter((note) => note.verificationStatus === 'unverified').length,
      disclaimer: RESEARCH_AI_DISCLAIMER,
    };

    await outputRegistry.register({
      projectId: input.projectId,
      type: 'other',
      title: `Research depth pass — ${topic}`,
      path: '',
      metadata: {
        kind: 'research-depth-pass',
        ...result,
      },
    });

    return result;
  }
}

export const researchDeskService = new ResearchDeskService();
