import { loadLibrary } from './researchLibraryService';
import type { ProjectBriefLike } from './commissionService';
import {
  ACTIVE_HYBRID_PROJECT_KEY,
  scopedCacheKey,
} from './workspaceCacheKeys';
import { assembleManuscript, detectManuscriptProposal, splitManuscript, splitManuscriptChapters } from './workspaceRebuild';

export type WorkspaceProject = {
  id: string;
  title: string;
  mode: string;
  revision: number;
  updatedAt: string;
  state: Record<string, any>;
};

export type WorkspaceArtefacts = {
  brief?: Record<string, unknown>;
  canon?: {
    characters: unknown[];
    plotNodes: unknown[];
    sourceMaterials: unknown[];
    critiques: Record<string, unknown>;
  };
  research?: unknown[];
  psychology?: unknown;
  ingest?: { sources: IngestSource[] };
  tools?: Record<string, unknown>;
  commission?: Record<string, unknown>;
};

export type IngestSource = {
  id: string;
  kind: 'text' | 'file' | 'image';
  title: string;
  text: string;
  filename?: string;
  mimeType?: string;
  extracted?: boolean;
  createdAt: string;
};

export { ACTIVE_HYBRID_PROJECT_KEY, clearSensitiveProjectCaches, scopedCacheKey } from './workspaceCacheKeys';

const MANUSCRIPT_STATE_KEYS = ['manuscript', 'whitePage', 'manuscriptSource'] as const;

function writeScopedManuscript(projectId: string, manuscript: string): void {
  localStorage.setItem(scopedCacheKey('caspa.whitePage', projectId), manuscript);
  localStorage.setItem(scopedCacheKey('caspa.manuscriptSource', projectId), manuscript);
  localStorage.setItem(ACTIVE_HYBRID_PROJECT_KEY, projectId);
}

function writeScopedCommission(projectId: string, commission: unknown): void {
  localStorage.setItem(scopedCacheKey('caspa.commission', projectId), JSON.stringify(commission));
  localStorage.setItem(ACTIVE_HYBRID_PROJECT_KEY, projectId);
}

function readScopedItem(projectId: string, base: 'caspa.whitePage' | 'caspa.manuscriptSource' | 'caspa.commission'): string | null {
  return localStorage.getItem(scopedCacheKey(base, projectId));
}

export function briefFromProject(project: WorkspaceProject): ProjectBriefLike {
  const brief = (project.state?.brief || {}) as Record<string, unknown>;
  return {
    projectId: project.id,
    title: project.title,
    mode: project.mode,
    idea: String(brief.idea || project.state?.hybrid?.startingIdea || ''),
    tone: String(brief.tone || ''),
    output: String(brief.output || 'A complete, author-controlled manuscript.'),
    audience: String(brief.audience || ''),
    targetWordCount: Number(brief.targetWordCount || 80000),
  };
}

export function mergeWorkspaceArtefacts(current: Record<string, any>, artefacts: WorkspaceArtefacts): Record<string, any> {
  const next = { ...current, ...artefacts };
  for (const key of MANUSCRIPT_STATE_KEYS) {
    next[key] = current[key];
  }
  const currentCommission = current.commission && typeof current.commission === 'object' ? current.commission : {};
  const incomingCommission = artefacts.commission && typeof artefacts.commission === 'object' ? artefacts.commission : {};
  next.commission = {
    ...currentCommission,
    ...incomingCommission,
    artefact: currentCommission.artefact,
  };
  if (artefacts.brief) next.brief = { ...(current.brief || {}), ...artefacts.brief };
  if (artefacts.ingest) {
    const existing = Array.isArray(current.ingest?.sources) ? current.ingest.sources : [];
    const incoming = Array.isArray(artefacts.ingest.sources) ? artefacts.ingest.sources : [];
    const seen = new Set(existing.map((item: IngestSource) => item.id));
    next.ingest = { sources: [...existing, ...incoming.filter((item) => item.id && !seen.has(item.id))] };
  }
  return next;
}

export function hydrateToolCache(project: WorkspaceProject, manuscript: string): ProjectBriefLike {
  const brief = briefFromProject(project);
  if (typeof localStorage === 'undefined') return brief;
  const key = project.id;
  localStorage.setItem(scopedCacheKey('caspa.currentBrief', key), JSON.stringify({ ...brief, createdAt: new Date().toISOString() }));
  writeScopedManuscript(project.id, manuscript);
  const canon = project.state?.canon || {};
  localStorage.setItem(scopedCacheKey('caspa.studioCanon', key), JSON.stringify({
    characters: canon.characters || [],
    plotNodes: canon.plotNodes || [],
    sourceMaterials: canon.sourceMaterials || [],
    critiques: canon.critiques || {},
  }));
  if (project.state?.research) {
    localStorage.setItem(scopedCacheKey('caspa.research', key), JSON.stringify(project.state.research));
  }
  if (project.state?.psychology) {
    localStorage.setItem(scopedCacheKey('caspa.psychology', key), JSON.stringify(project.state.psychology));
  }
  const chapters = Array.isArray(project.state?.commission?.chapters) && project.state.commission.chapters.length
    ? project.state.commission.chapters
    : splitManuscriptChapters(manuscript).map((chapter, index) => ({
      id: `server-ch-${index + 1}`,
      title: chapter.title,
      summary: chapter.body.slice(0, 160),
      content: chapter.body,
      order: index + 1,
      plotNodeIds: [],
      tags: [],
      updatedAt: Date.now(),
    }));
  writeScopedCommission(project.id, {
    ...(project.state?.commission || {}),
    chapters,
    artefact: manuscript,
  });
  return brief;
}

export function collectToolCache(project: WorkspaceProject, canonicalManuscript: string): {
  artefacts: WorkspaceArtefacts;
  manuscriptProposal: string | null;
} {
  const brief = briefFromProject(project);
  if (typeof localStorage === 'undefined') {
    return { artefacts: {}, manuscriptProposal: null };
  }
  const key = project.id;
  let canon = project.state?.canon;
  let research = project.state?.research;
  let psychology = project.state?.psychology;
  let commission = project.state?.commission;
  let draft = canonicalManuscript;
  try {
    const rawCanon = localStorage.getItem(scopedCacheKey('caspa.studioCanon', key));
    if (rawCanon) canon = JSON.parse(rawCanon);
    research = loadLibrary(key);
    const rawPsych = localStorage.getItem(scopedCacheKey('caspa.psychology', key));
    if (rawPsych) psychology = JSON.parse(rawPsych);
    const rawCommission = readScopedItem(project.id, 'caspa.commission');
    if (rawCommission) commission = JSON.parse(rawCommission);
    draft = readScopedItem(project.id, 'caspa.whitePage')
      || readScopedItem(project.id, 'caspa.manuscriptSource')
      || draft;
    if (commission?.chapters?.length) {
      const { preamble } = splitManuscript(draft);
      const assembled = assembleManuscript(
        preamble,
        commission.chapters
          .slice()
          .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
          .map((chapter: any) => ({ title: String(chapter.title || 'Chapter'), body: String(chapter.content || '') })),
      );
      if (assembled.trim()) draft = assembled;
    }
  } catch {
    /* keep server artefacts */
  }
  const manuscriptProposal = detectManuscriptProposal(canonicalManuscript, draft) ? draft : null;
  return {
    artefacts: {
      brief: { ...brief },
      canon,
      research,
      psychology,
      commission: commission ? { ...commission, artefact: undefined } : undefined,
    },
    manuscriptProposal,
  };
}
