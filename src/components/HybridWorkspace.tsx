import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Feather, FileClock, HelpCircle, Loader, Save, ShieldCheck } from 'lucide-react';
import { contextualTools } from '../services/hybridWorkflow';
import {
  DESK_STAGES,
  STAGE_HELP,
  STAGE_NEXT,
  findWorkspaceTool,
  toolsForStage,
  type DeskStage,
  type WorkspaceToolId,
} from '../services/workspaceCatalog';
import { briefFromProject, collectToolCache, hydrateToolCache, type WorkspaceProject } from '../services/workspaceProjectBridge';
import { extractImageViaVision, readIngestFile } from '../services/workspaceIngest';
import { splitManuscript, splitRebuildChapters } from '../services/workspaceRebuild';
import type { WorkshopCouncil } from '../services/workspaceCouncil';
import { fetchWithTimeout, AI_FETCH_TIMEOUT_MS, friendlyFetchError } from '../lib/fetchWithTimeout';
import WorkspaceToolHost from './WorkspaceToolHost';

type Version = {
  id: string; revision: number; name: string; trigger: string; content?: string;
  wordCount: number; chapterCount: number; checksum?: string; createdAt: string;
};

const FORMATS = [
  { id: 'novel', label: 'Fiction', note: 'Novels and short fiction' },
  { id: 'nonfiction', label: 'Non-fiction', note: 'Ideas, argument, evidence' },
  { id: 'essay', label: 'Essay', note: 'Focused long-form' },
  { id: 'poetry', label: 'Poetry', note: 'Sequence, image, voice' },
  { id: 'script', label: 'Script', note: 'Stage or screen' },
  { id: 'picture', label: 'Picture book', note: 'Page turns and rhythm' },
  { id: 'adaptation', label: 'Adaptation', note: 'A source already exists' },
] as const;

function activeProjectHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const projectId = window.localStorage.getItem('caspa.activeHybridProject');
  return projectId ? { 'x-caspa-project-id': projectId } : {};
}

async function api(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<any> {
  const { timeoutMs, headers, ...rest } = init || {};
  try {
    const response = await fetchWithTimeout(url, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...activeProjectHeader(), ...(headers || {}) },
    }, timeoutMs || AI_FETCH_TIMEOUT_MS);
    const body = await response.json().catch(() => ({}));
    if (response.status === 409 && (body.code === 'REVISION_CONFLICT' || body.code === 'VERSION_CONFLICT')) {
      const error = new Error(body.message || 'Project changed in another session');
      (error as any).code = body.code;
      throw error;
    }
    if (!response.ok) throw new Error(body.message || `Caspa request failed (${response.status})`);
    return body.data;
  } catch (error) {
    if ((error as any)?.code === 'REVISION_CONFLICT' || (error as any)?.code === 'VERSION_CONFLICT') throw error;
    throw new Error(friendlyFetchError(error, 'Caspa request failed'));
  }
}

function initialManuscript(project: WorkspaceProject): string {
  return String(project.state?.commission?.artefact || project.state?.manuscript || project.state?.manuscriptSource || project.state?.whitePage || '');
}

function JobIdentity({ job }: { job: any }) {
  const provenance = job.provenance || {};
  return (
    <>
      <strong>{provenance.title || 'Untitled finished job'}</strong>
      <span>{job.type} · {job.stage} · {new Date(job.updatedAt).toLocaleString()}</span>
      <span>
        {Number.isFinite(provenance.wordCount) ? `${Number(provenance.wordCount).toLocaleString()} words` : 'Length unknown'}
      </span>
      {provenance.brief ? <span>{provenance.brief}</span> : null}
    </>
  );
}


export default function HybridWorkspace() {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [selected, setSelected] = useState<WorkspaceProject | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [manuscript, setManuscript] = useState('');
  const [stage, setStage] = useState<DeskStage>('Library');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [diagnosis, setDiagnosis] = useState<any | null>(null);
  const [council, setCouncil] = useState<(WorkshopCouncil & { id?: string }) | null>(null);
  const [rebuild, setRebuild] = useState<any | null>(null);
  const [finishedJobs, setFinishedJobs] = useState<any[]>([]);
  const [unboundJobs, setUnboundJobs] = useState<any[]>([]);
  const [assignPreviewId, setAssignPreviewId] = useState('');
  const [rebuildChapterIndex, setRebuildChapterIndex] = useState<number | ''>('');
  const [preflight, setPreflight] = useState<any | null>(null);
  const [showNewProject, setShowNewProject] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [newMode, setNewMode] = useState('novel');
  const [activeTool, setActiveTool] = useState<WorkspaceToolId | null>(null);
  const [proposal, setProposal] = useState<string | null>(null);
  const [conflict, setConflict] = useState('');
  const [compareLeft, setCompareLeft] = useState('');
  const [compareRight, setCompareRight] = useState('');
  const [lastSave, setLastSave] = useState('');
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLElement | null>(null);
  const knownVersion = useRef(0);
  const knownProjectRevision = useRef(0);
  const readingHolding = busy && /Reading the page/i.test(message);
  const readingCritics = busy && /critics/i.test(message);
  const workshopNotesOpen = Boolean(diagnosis || council || readingHolding || readingCritics);

  useEffect(() => {
    api('/api/v2/migration/import-legacy', { method: 'POST', body: '{}' })
      .catch(() => null)
      .then(() => api('/api/projects'))
      .then((data) => setProjects(data.projects || []))
      .catch((error) => setMessage(error.message))
      .finally(() => setBusy(false));
  }, []);

  const refreshSnapshot = async (projectId: string) => {
    const snap = await api(`/api/v2/projects/${encodeURIComponent(projectId)}/workspace`).catch(() => null);
    if (!snap) return;
    setLastSave(snap.lastSave || '');
    setRecoveryAvailable(Boolean(snap.recovery?.available));
    if (snap.latestVersion?.revision && knownVersion.current && snap.latestVersion.revision > knownVersion.current) {
      setConflict(`Another window saved version ${snap.latestVersion.revision}. Reload before you save or accept changes.`);
    }
    if (snap.project?.revision && knownProjectRevision.current && snap.project.revision !== knownProjectRevision.current) {
      setConflict((current) => current || 'This book changed in another tab. Reload before you save.');
    }
  };

  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(() => void refreshSnapshot(selected.id), 20000);
    return () => window.clearInterval(timer);
  }, [selected?.id]);

  useEffect(() => {
    setRebuildChapterIndex('');
    setUnboundJobs([]);
    setFinishedJobs([]);
    setAssignPreviewId('');
  }, [selected?.id]);

  useEffect(() => {
    if (rebuildChapterIndex === '') return;
    const chapters = splitManuscript(manuscript, { projectTitle: selected?.title }).chapters;
    if (!chapters.some((chapter) => chapter.index === rebuildChapterIndex && chapter.rebuildable)) {
      setRebuildChapterIndex('');
    }
  }, [manuscript, rebuildChapterIndex, selected?.title]);

  useEffect(() => {
    if (!selected?.id) return;
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (!headers.has('x-caspa-project-id')) headers.set('x-caspa-project-id', selected.id);
      return original(input, { ...(init || {}), headers });
    };
    return () => {
      window.fetch = original;
    };
  }, [selected?.id]);

  const loadProject = async (project: WorkspaceProject, nextStage: DeskStage, options?: { keepTool?: boolean; preserveToolCache?: boolean }) => {
    if (!options?.keepTool) setActiveTool(null);
    setSelected(project);
    setStage(nextStage);
    setCouncil(null);
    setDiagnosis(null);
    setBusy(true);
    try {
      const [list, latest] = await Promise.all([
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/versions`),
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/versions/latest`).catch(() => null),
      ]);
      const next = list.versions || [];
      setVersions(next);
      const text = latest?.content || initialManuscript(project);
      setManuscript(text);
      knownVersion.current = latest?.revision || next[0]?.revision || 0;
      knownProjectRevision.current = project.revision;
      if (!options?.preserveToolCache) hydrateToolCache(project, text);
      const [draftData, diagnosisData, critiqueData, rebuildData] = await Promise.all([
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/draft-preview`).catch(() => null),
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/diagnosis`).catch(() => null),
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/critique`).catch(() => null),
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/rebuild`).catch(() => null),
      ]);
      setPreview(draftData);
      setDiagnosis(diagnosisData);
      setCouncil(critiqueData);
      setRebuild(rebuildData);
      setPreflight(null);
      setProposal(null);
      setConflict('');
      await refreshSnapshot(project.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open this project.');
    } finally {
      setBusy(false);
    }
  };

  const openProject = async (project: WorkspaceProject, nextStage: DeskStage = 'Draft') => {
    await loadProject(project, nextStage);
  };

  const reloadProject = async () => {
    if (!selected) return;
    try {
      const fresh = await api(`/api/projects/${encodeURIComponent(selected.id)}`);
      setProjects((current) => current.map((item) => item.id === fresh.id ? fresh : item));
      await loadProject(fresh, stage, { keepTool: Boolean(activeTool), preserveToolCache: Boolean(activeTool) });
      setMessage(activeTool
        ? 'Reloaded the book. Work in this room was kept so you can save it.'
        : 'Reloaded this book.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not reload this project.');
    }
  };

  const createNewProject = async () => {
    const title = newTitle.trim() || newIdea.trim().slice(0, 72) || 'Untitled manuscript';
    const idea = newIdea.trim();
    if (idea.length < 8) { setMessage('Give Caspa at least one rough sentence, note, or observation.'); return; }
    setBusy(true);
    try {
      const project = await api('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          projectKey: `hybrid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title,
          mode: newMode,
          state: {
            brief: { title, mode: newMode, idea, tone: '', audience: '', output: 'A complete, author-controlled manuscript.', targetWordCount: 80000, createdAt: new Date().toISOString() },
            hybrid: { startingIdea: idea, createdIn: 'caspa-integrated' },
            whitePage: '', manuscriptSource: '', ingest: { sources: [] },
          },
        }),
      });
      setProjects((current) => [project, ...current]);
      setShowNewProject(false); setNewTitle(''); setNewIdea('');
      setMessage('Project ready. The page is empty until you write, paste, or ask Caspa.');
      await openProject(project, 'Idea');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create the project.'); setBusy(false); }
  };

  const ingestFile = async (file: File | undefined, promote = false) => {
    if (!file) return;
    if (!selected) {
      if (file.type.startsWith('image/')) {
        setNewIdea((current) => current || `Image ready after create: ${file.name}`);
        setMessage('Create the book first, then attach the image.');
        return;
      }
      const read = await readIngestFile(file);
      setNewIdea(read.text.slice(0, 4000));
      setMessage(`Loaded ${file.name}. Create the book to keep it.`);
      return;
    }
    setBusy(true);
    try {
      const read = await readIngestFile(file, { extractImage: extractImageViaVision });
      const result = await api(`/api/v2/projects/${encodeURIComponent(selected.id)}/ingest`, {
        method: 'POST',
        headers: { 'If-Match': `"${selected.revision}"` },
        body: JSON.stringify({
          kind: read.kind,
          title: file.name,
          filename: file.name,
          mimeType: read.mimeType,
          extracted: read.extracted,
          text: read.text,
          revision: selected.revision,
        }),
      });
      setSelected(result.project);
      knownProjectRevision.current = result.project.revision;
      setMessage(`${file.name} attached. The page was not overwritten.`);
      if (promote && read.text.trim()) {
        await saveVersion(read.text, `Imported · ${file.name}`, 'ingest-promoted');
      }
    } catch (error) {
      handleConflict(error, 'Could not open that file.');
    } finally { setBusy(false); }
  };

  const handleConflict = (error: unknown, fallback: string) => {
    const err = error as any;
    if (err?.code === 'REVISION_CONFLICT' || err?.code === 'VERSION_CONFLICT') {
      setConflict(err.message || 'This project changed in another tab. Reload before saving again. Nothing was overwritten.');
    }
    setMessage(err instanceof Error ? err.message : fallback);
  };

  const revealNotes = () => {
    window.requestAnimationFrame(() => {
      reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const persistArtefacts = async (): Promise<{ ok: true; project: WorkspaceProject } | { ok: false }> => {
    if (!selected) return { ok: false };
    const { artefacts, manuscriptProposal } = collectToolCache(selected, manuscript);
    try {
      const result = await api(`/api/v2/projects/${encodeURIComponent(selected.id)}/artefacts`, {
        method: 'POST',
        headers: { 'If-Match': `"${selected.revision}"` },
        body: JSON.stringify({ revision: selected.revision, artefacts }),
      });
      setSelected(result.project);
      knownProjectRevision.current = result.project.revision;
      if (manuscriptProposal) setProposal(manuscriptProposal);
      return { ok: true, project: result.project };
    } catch (error) {
      handleConflict(error, 'Could not save that work. The room stays open so nothing is lost.');
      return { ok: false };
    }
  };

  const changeStage = async (next: DeskStage) => {
    if (activeTool && next !== stage) {
      const saved = await persistArtefacts();
      if (!saved.ok) return;
      setActiveTool(null);
    }
    setStage(next);
  };

  const openTool = async (labelOrId: string) => {
    const tool = findWorkspaceTool(labelOrId);
    if (!selected) { setMessage('Open a project first.'); return; }
    if (!tool) { setMessage(`No room named “${labelOrId}”.`); return; }
    if (tool.id === 'workshop') { setStage('Workshop'); setActiveTool(null); return; }
    if (tool.id === 'rebuild') { setStage('Revise'); setActiveTool(null); return; }
    if (tool.id === 'recovery') { setStage('Finish'); setActiveTool(null); return; }
    if (tool.id === 'preflight' || tool.id === 'publish') { setStage('Publish'); setActiveTool(null); return; }
    if (tool.id === 'compare') { setStage('Revise'); setActiveTool('compare'); return; }
    const project = selected;
    hydrateToolCache(project, manuscript);
    setActiveTool(tool.id);
    if (activeTool && activeTool !== tool.id) {
      void persistArtefacts();
    }
  };

  const closeTool = async () => {
    const saved = await persistArtefacts();
    if (!saved.ok) return;
    setActiveTool(null);
  };

  const prepareDraft = async () => {
    if (!selected || !draftTitle.trim()) return;
    setBusy(true); setMessage('Writing a private preview…');
    try {
      const result = await api(`/api/v2/projects/${encodeURIComponent(selected.id)}/draft-preview`, {
        method: 'POST', body: JSON.stringify({ mode: manuscript.trim() ? 'append' : 'opening', chapterTitle: draftTitle, targetWords: 1200 }),
      });
      setPreview(result); setMessage('Preview ready. The page has not changed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Draft preview failed.'); }
    finally { setBusy(false); }
  };

  const handlePreview = async (accept: boolean) => {
    if (!preview) return;
    setBusy(true);
    try {
      if (accept) {
        const version = await api(`/api/v2/draft-previews/${preview.id}/accept`, { method: 'POST', body: JSON.stringify({ authorConfirmed: true }) });
        setVersions((current) => [version, ...current]); setManuscript(version.content); knownVersion.current = version.revision;
        setMessage(`Kept as version ${version.revision}.`);
        setPreview(null);
      } else {
        await api(`/api/v2/draft-previews/${preview.id}/reject`, { method: 'POST', body: '{}' }); setMessage('Preview thrown away. The page is unchanged.');
        setPreview(null);
      }
    } catch (error) { handleConflict(error, 'Could not handle the preview.'); }
    finally { setBusy(false); }
  };

  const runDiagnosis = async () => {
    if (!selected) return;
    if (!manuscript.trim()) { setMessage('Write on the page first.'); return; }
    setBusy(true); setMessage('Reading the page…');
    try {
      const result = await api(`/api/v2/projects/${selected.id}/diagnosis`, {
        method: 'POST',
        body: JSON.stringify({ manuscript }),
      });
      setDiagnosis(result);
      setMessage('Notes are ready. They are on the paper above the page.');
      revealNotes();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read the page.'); }
    finally { setBusy(false); }
  };

  const runDeskSwarm = async () => {
    if (!selected) return;
    if (!manuscript.trim()) { setMessage('Write on the page first.'); return; }
    setBusy(true);
    setMessage('The critics are reading the page…');
    try {
      const result = await api(`/api/v2/projects/${selected.id}/critique`, {
        method: 'POST',
        body: JSON.stringify({ manuscript }),
      });
      setCouncil(result);
      setMessage(result?.critics?.length
        ? 'The critics have spoken. Their notes are on the paper above the page.'
        : 'The critics returned nothing. Try again in a moment.');
      revealNotes();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The critics could not finish. The page is unchanged.');
    } finally {
      setBusy(false);
    }
  };

  const analyzeRebuild = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api(`/api/v2/projects/${selected.id}/rebuild/analyze`, { method: 'POST', body: '{}' });
      setRebuild(result);
      setMessage('Looked at the structure. No text was changed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Rebuild analysis failed.'); }
    finally { setBusy(false); }
  };

  const planRebuild = async () => {
    if (!selected || rebuildChapterIndex === '') return;
    const chapter = splitManuscript(manuscript, { projectTitle: selected?.title }).chapters.find((item) => item.index === rebuildChapterIndex);
    if (!chapter?.rebuildable) {
      setMessage('Choose a chapter to rewrite.');
      return;
    }
    setBusy(true);
    try {
      const result = await api(`/api/v2/projects/${selected.id}/rebuild/plan`, {
        method: 'POST',
        body: JSON.stringify({ chapterIndex: chapter.index, chapterTitle: chapter.title }),
      });
      setRebuild(result);
      setMessage('Rewrite ready. Read it before you keep it.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Rebuild plan failed.'); }
    finally { setBusy(false); }
  };

  const handleRebuildChange = async (changeId: string, accept: boolean) => {
    if (!rebuild) return;
    setBusy(true);
    try {
      if (accept) {
        const result = await api(`/api/v2/rebuild-plans/${rebuild.id}/changes/${changeId}/accept`, { method: 'POST', body: JSON.stringify({ authorConfirmed: true }) });
        setRebuild(result.plan);
        setVersions((current) => [result.version, ...current]);
        setManuscript(result.version.content);
        knownVersion.current = result.version.revision;
        setMessage(`Kept the rewrite as version ${result.version.revision}.`);
      } else {
        const plan = await api(`/api/v2/rebuild-plans/${rebuild.id}/changes/${changeId}/reject`, { method: 'POST', body: '{}' });
        setRebuild(plan);
        setMessage('Rewrite thrown away. The page is unchanged.');
      }
    } catch (error) { handleConflict(error, 'Could not handle that rebuild change.'); }
    finally { setBusy(false); }
  };

  const refreshFinishJobs = () => {
    if (stage !== 'Finish' || !selected) {
      setFinishedJobs([]);
      setUnboundJobs([]);
      return;
    }
    Promise.all([
      api(`/api/jobs?limit=20&status=complete&projectId=${encodeURIComponent(selected.id)}`),
      api(`/api/jobs?limit=20&status=complete&unbound=1`),
    ]).then(([bound, unbound]) => {
      setFinishedJobs((bound.jobs || []).filter((job: any) => job.resultAvailable && job.projectId === selected.id));
      setUnboundJobs((unbound.jobs || []).filter((job: any) => job.resultAvailable && !job.projectId));
    }).catch(() => {
      setFinishedJobs([]);
      setUnboundJobs([]);
    });
  };

  useEffect(() => {
    refreshFinishJobs();
  }, [stage, selected?.id]);

  const recoverJob = async (jobId: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      const version = await api(`/api/v2/projects/${selected.id}/recover-job/${jobId}`, { method: 'POST', body: '{}' });
      setVersions((current) => current.some((item) => item.id === version.id) ? current : [version, ...current]);
      setManuscript(version.content); knownVersion.current = version.revision;
      setMessage(`Kept as version ${version.revision}.`);
    } catch (error) { handleConflict(error, 'Could not recover the finished job.'); }
    finally { setBusy(false); }
  };

  const assignJob = async (jobId: string) => {
    if (!selected || assignPreviewId !== jobId) {
      setMessage('Look at the finished work before you attach it.');
      return;
    }
    setBusy(true);
    try {
      await api(`/api/v2/projects/${selected.id}/jobs/${jobId}/assign`, { method: 'POST', body: JSON.stringify({ authorConfirmed: true }) });
      setAssignPreviewId('');
      setMessage('Attached to this book. Keep it if you want a version.');
      refreshFinishJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not assign that job.');
    } finally {
      setBusy(false);
    }
  };

  const runPreflight = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api(`/api/v2/projects/${selected.id}/export-preflight`, { method: 'POST', body: '{}' });
      setPreflight(result);
      setMessage(result.passed ? 'This version is ready to download.' : 'A few things still need attention before you export.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not check this version.'); }
    finally { setBusy(false); }
  };

  const saveVersion = async (content = manuscript, name = `Author save · ${new Date().toLocaleString()}`, trigger = 'manual-save') => {
    if (!selected || !content.trim()) return;
    setBusy(true);
    try {
      const version = await api(`/api/v2/projects/${encodeURIComponent(selected.id)}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          trigger,
          content,
          sourceVersionId: versions[0]?.id || null,
          expectedSourceVersionId: versions[0]?.id || null,
        }),
      });
      setVersions((current) => [version, ...current]);
      setManuscript(version.content);
      knownVersion.current = version.revision;
      setProposal(null);
      setLastSave(version.createdAt);
      setMessage(`Saved as version ${version.revision}.`);
    } catch (error) {
      handleConflict(error, 'Could not save this version.');
    } finally {
      setBusy(false);
    }
  };

  const revealVersion = async (versionId: string) => {
    if (!selected) return;
    const cached = versions.find((item) => item.id === versionId);
    if (cached?.content) { setManuscript(cached.content); return; }
    try {
      const version = await api(`/api/v2/projects/${encodeURIComponent(selected.id)}/versions/${encodeURIComponent(versionId)}`);
      setVersions((current) => current.map((item) => item.id === version.id ? { ...item, content: version.content } : item));
      setManuscript(version.content);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load that version.');
    }
  };

  const wordCount = useMemo(() => manuscript.trim().split(/\s+/).filter(Boolean).length, [manuscript]);
  const chapterCount = useMemo(() => splitRebuildChapters(manuscript, { projectTitle: selected?.title }).length, [manuscript, selected?.title]);
  const manuscriptChapters = useMemo(() => splitManuscript(manuscript, { projectTitle: selected?.title }).chapters, [manuscript, selected?.title]);
  const selectedRebuildChapter = rebuildChapterIndex === ''
    ? null
    : manuscriptChapters.find((chapter) => chapter.index === rebuildChapterIndex) || null;
  const brief = selected ? briefFromProject(selected) : null;
  const stageTools = toolsForStage(stage);
  const hybridTools = stage === 'Library' ? [] : contextualTools(stage === 'Idea' || stage === 'Structure' ? 'draft' : stage.toLowerCase() as any);
  const leftVersion = versions.find((item) => item.id === compareLeft) || versions[1];
  const rightVersion = versions.find((item) => item.id === compareRight) || versions[0];
  const stageGuide = STAGE_NEXT[stage];
  const formatLabel = FORMATS.find((item) => item.id === selected?.mode)?.label || selected?.mode || '';
  const shownTools = new Set(
    stage === 'Idea' ? ['Research Desk']
      : stage === 'Structure' ? ['Brainstorm', 'Story Bible', 'Character Forge', 'Psychology Studio', 'Plot Architect']
      : stage === 'Draft' ? ['Writing Studio', 'Auto Drafter']
      : stage === 'Workshop' ? ['Critic Swarm']
      : stage === 'Revise' ? ['Rip & Fix', 'Auto Drafter', 'Scalpel', 'Gold Refinery', 'Version compare']
      : stage === 'Publish' ? ['Imagine']
      : []
  );
  const extraTools = (stageTools.length ? stageTools.map((tool) => tool.label) : hybridTools)
    .filter((label, index, list) => list.indexOf(label) === index && !shownTools.has(label));
  const stageComplete: Record<DeskStage, boolean> = {
    Library: projects.length > 0,
    Idea: Boolean(manuscript.trim()),
    Structure: Boolean(manuscript.trim()),
    Draft: versions.length > 0,
    Workshop: Boolean(diagnosis?.summary || council?.critics?.length),
    Revise: Boolean((rebuild?.changes || []).some((change: any) => change.status === 'accepted')),
    Finish: Boolean(finishedJobs.length),
    Publish: Boolean(preflight?.passed),
  };

  return (
    <div className="hybrid-workspace caspa-desk">
      <header className="hybrid-header desk-header">
        <div className="desk-brand">
          <span className="desk-mark"><Feather size={16} /></span>
          <div>
            <div className="eyebrow">Caspa</div>
            <h1>Writing desk</h1>
          </div>
        </div>
        <div className="desk-header-actions">
          {busy && <span className="desk-busy" role="status"><Loader className="spin" size={14} /> Working</span>}
          <button type="button" className="desk-ghost" data-testid="desk-help-toggle" onClick={() => setHelpOpen((value) => !value)}><HelpCircle size={14} /> Help</button>
        </div>
      </header>

      {selected && (
        <div className="desk-status" data-testid="desk-status">
          <span><strong>{selected.title}</strong></span>
          <span>{wordCount.toLocaleString()} words</span>
          <span>{versions.length ? `${versions.length} saved version${versions.length === 1 ? '' : 's'}` : 'Not saved yet'}</span>
          {lastSave && <span>Saved {new Date(lastSave).toLocaleString()}</span>}
          {recoveryAvailable && <span>A finished job is waiting</span>}
        </div>
      )}

      <nav className="desk-rail" aria-label="Project workflow">
        {DESK_STAGES.map((item, index) => (
          <button
            key={item}
            type="button"
            disabled={!selected && item !== 'Library'}
            onClick={() => selected || item === 'Library' ? void changeStage(item) : undefined}
            className={stage === item ? 'is-active' : ''}
            data-testid={`desk-stage-${item.toLowerCase()}`}
          >
            <span>{stageComplete[item] ? <Check size={12} /> : index + 1}</span>
            {item}
          </button>
        ))}
      </nav>

      {helpOpen && (
        <aside className="literary-card desk-help" data-testid="desk-help">
          <p className="eyebrow">Where you are</p>
          <p>{STAGE_HELP[stage]}</p>
          <p className="desk-muted">{stageGuide.hint}</p>
        </aside>
      )}

      {message && <div className="desk-banner" role="status">{message}</div>}
      {conflict && <div className="desk-banner is-conflict" role="alert">{conflict} <button type="button" className="desk-ghost" onClick={() => void reloadProject()}>Reload project</button></div>}

      <main className="hybrid-main desk-main">
        {stage === 'Library' || !selected ? (
          <div className="desk-library">
            <div className="desk-library-head">
              <div>
                <p className="eyebrow">Your desk</p>
                <h2>Your work</h2>
                <p className="desk-muted">Open a book, or start from a sentence.</p>
              </div>
              <div className="desk-row">
                <button type="button" className="desk-ghost" onClick={() => { setShowNewProject(true); setActiveTool(null); }}>New book</button>
                <button type="button" className="desk-ghost" onClick={() => { setShowNewProject(true); fileInput.current?.click(); }}>Open a file</button>
              </div>
            </div>

            {showNewProject && (
              <section className="literary-card" data-testid="new-project-form">
                <p className="eyebrow">New project</p>
                <h3>What are you making?</h3>
                <div className="desk-formats">
                  {FORMATS.map((item) => (
                    <button key={item.id} type="button" className={newMode === item.id ? 'is-active' : ''} onClick={() => setNewMode(item.id)}>
                      <strong>{item.label}</strong>
                      <span>{item.note}</span>
                    </button>
                  ))}
                </div>
                <label className="desk-field">Working title
                  <input aria-label="New project title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Optional — Caspa can derive one" />
                </label>
                <label className="desk-field">A sentence, note, or half-formed thought
                  <textarea aria-label="Rough project idea" value={newIdea} onChange={(event) => setNewIdea(event.target.value)} placeholder="Paste or type the rough idea here…" />
                </label>
                <div className="desk-row">
                  <button type="button" className="desk-primary" disabled={busy} onClick={() => void createNewProject()}>Create project</button>
                  <button type="button" className="desk-ghost" onClick={() => fileInput.current?.click()}>Attach a file</button>
                </div>
              </section>
            )}

            <div className="hybrid-library-grid">
              {projects.map((project) => (
                <button className="hybrid-project-card literary-card" key={project.id} onClick={() => void openProject(project)}>
                  <BookOpen size={18} />
                  <h3>{project.title}</h3>
                  <div className="desk-muted">{FORMATS.find((item) => item.id === project.mode)?.label || project.mode}</div>
                  <div className="desk-muted">{new Date(project.updatedAt).toLocaleDateString()}</div>
                </button>
              ))}
              {!projects.length && !busy && <div className="literary-card desk-empty">Your desk is clear. Start with a sentence.</div>}
            </div>
          </div>
        ) : (
          <>
            <button type="button" className="desk-back" onClick={() => void changeStage('Library')}><ArrowLeft size={14} /> All projects</button>
            <div className="hybrid-editor-grid">
              <div className="desk-primary-column">
                {activeTool && brief && !['compare'].includes(activeTool) ? (
                  <WorkspaceToolHost
                    tool={activeTool}
                    brief={brief}
                    manuscript={manuscript}
                    onBriefChange={(patch) => setSelected((current) => current ? { ...current, state: { ...current.state, brief: { ...current.state.brief, ...patch } }, title: patch.title || current.title } : current)}
                    onManuscriptProposal={setProposal}
                    onNavigate={(next) => void openTool(String(next))}
                    onSave={() => void persistArtefacts()}
                    onClose={() => void closeTool()}
                  />
                ) : (
                  <section className="hybrid-editor-panel literary-card">
                    <div className="desk-editor-bar">
                      <div>
                        <p className="eyebrow">{stage}</p>
                        <h2>{selected.title}</h2>
                      </div>
                      <button type="button" className="desk-primary" disabled={busy || !manuscript.trim()} onClick={() => void saveVersion()}><Save size={14} /> Save version</button>
                    </div>
                    {stage === 'Workshop' && workshopNotesOpen && (
                      <section ref={reportRef} className="desk-report" data-testid="workshop-report">
                        {readingHolding || readingCritics ? (
                          <div className="desk-report-block">
                            <p className="eyebrow">{readingCritics ? 'The critics' : "What's holding"}</p>
                            <p>{readingCritics ? 'The critics are reading this page…' : 'Reading the page…'}</p>
                          </div>
                        ) : null}
                        {diagnosis && (
                          <div className="desk-report-block">
                            <p className="eyebrow">What's holding</p>
                            <p>{diagnosis.summary}</p>
                            {(diagnosis.findings || []).slice(0, 8).map((finding: any, index: number) => (
                              <div key={index} className="desk-critic">
                                <strong>{finding.category} · {finding.severity}</strong>
                                {finding.evidence ? <p className="desk-evidence">{finding.evidence}</p> : null}
                                <p>{finding.recommendation || finding.rationale}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {council && (
                          <div className="desk-report-block" data-testid="workshop-council">
                            <p className="eyebrow">The critics</p>
                            <p>{council.summary}</p>
                            {(council.critics || []).map((critic, index) => (
                              <div key={`${critic.role}-${index}`} className="desk-critic" data-testid="desk-critique">
                                <strong>{critic.name} · {critic.severity}</strong>
                                <p>{critic.finding}</p>
                                {critic.evidence ? <p className="desk-evidence">{critic.evidence}</p> : null}
                                {critic.fix ? <p>{critic.fix}</p> : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    )}
                    <textarea
                      className={`hybrid-manuscript manuscript-page${stage === 'Workshop' && workshopNotesOpen ? ' has-workshop-report' : ''}`}
                      value={manuscript}
                      onChange={(event) => setManuscript(event.target.value)}
                      aria-label="Manuscript"
                      placeholder="Write here. A sentence is enough to start."
                    />
                  </section>
                )}

                {proposal && (
                  <section className="literary-card desk-proposal" data-testid="manuscript-proposal">
                    <p className="eyebrow">Caspa wrote a replacement</p>
                    <p>Keep it as a new version, or throw it away. The page does not change until you keep it.</p>
                    <div className="desk-preview">{proposal.slice(0, 4000)}</div>
                    <div className="desk-row">
                      <button type="button" className="desk-ghost" onClick={() => setProposal(null)}>Reject proposal</button>
                      <button type="button" className="desk-primary" onClick={() => void saveVersion(proposal, `Accepted tool proposal · ${new Date().toLocaleString()}`, 'tool-accepted')}>Accept as new version</button>
                    </div>
                  </section>
                )}
              </div>

              <aside className="hybrid-sidebar">
                <section className="literary-card">
                  <div className="desk-card-kicker"><ShieldCheck size={14} /> This book</div>
                  <div className="desk-metric">{wordCount.toLocaleString()} words</div>
                  <p className="desk-muted">{formatLabel}{chapterCount ? ` · ${chapterCount} chapter${chapterCount === 1 ? '' : 's'}` : ''}{versions.length ? ` · ${versions.length} saved` : ' · not saved yet'}</p>
                  <p className="desk-muted">{stageGuide.hint}</p>
                  {stageGuide.next && (
                    <button type="button" className="desk-primary" onClick={() => void changeStage(stageGuide.next!)}>{stageGuide.nextLabel}</button>
                  )}
                </section>

                <section className="literary-card">
                  <div className="desk-card-kicker"><FileClock size={14} /> Saved versions</div>
                  {versions.slice(0, 8).map((version) => (
                    <button key={version.id} type="button" className="desk-version" onClick={() => void revealVersion(version.id)}>
                      <strong>v{version.revision} · {version.name}</strong>
                      <span>{version.wordCount.toLocaleString()} words · {new Date(version.createdAt).toLocaleDateString()}</span>
                    </button>
                  ))}
                  {!versions.length && <p className="desk-muted">Nothing saved yet. Write, then save a version.</p>}
                </section>

                {stage === 'Idea' && (
                  <section className="literary-card">
                    <p className="eyebrow">Get it down</p>
                    <p className="desk-muted">Type on the page, or attach notes. Saving makes this the first version of the book.</p>
                    <button type="button" className="desk-ghost" onClick={() => fileInput.current?.click()}>Attach a file</button>
                    <button type="button" className="desk-primary" disabled={!manuscript.trim()} onClick={() => void saveVersion(manuscript, 'First version', 'ingest-promoted')}>Save as first version</button>
                    <button type="button" className="desk-ghost" onClick={() => void openTool('research')}>Research Desk</button>
                  </section>
                )}

                {stage === 'Structure' && (
                  <section className="literary-card">
                    <p className="eyebrow">People and spine</p>
                    <p className="desk-muted">Open a room when you need it. Nothing here overwrites the page until you accept a change.</p>
                    {['Brainstorm', 'Story Bible', 'Character Forge', 'Psychology Studio', 'Plot Architect'].map((label) => (
                      <button key={label} type="button" className="desk-ghost" onClick={() => void openTool(label)}>{label}</button>
                    ))}
                  </section>
                )}

                {stage === 'Draft' && (
                  <section className="literary-card" data-testid="draft-with-caspa">
                    <p className="eyebrow">Ask Caspa for a chapter</p>
                    <p className="desk-muted">
                      Name the chapter you want written. Caspa prepares a private preview. Accepting creates a new version. Rejecting leaves the manuscript untouched.
                    </p>
                    {preview?.status === 'previewed' ? (
                      <>
                        <h4>{preview.chapterTitle}</h4>
                        <div className="desk-preview">{preview.content}</div>
                        <p className="desk-muted">{preview.grounding?.summary}</p>
                        <div className="desk-row">
                          <button type="button" className="desk-ghost" onClick={() => void handlePreview(false)}>Reject</button>
                          <button type="button" className="desk-primary" onClick={() => void handlePreview(true)}>Keep as a version</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="desk-field">
                          Chapter title
                          <input
                            aria-label="Chapter title"
                            value={draftTitle}
                            onChange={(event) => setDraftTitle(event.target.value)}
                            placeholder="e.g. The harbour window"
                          />
                        </label>
                        <button type="button" className="desk-primary" disabled={busy || !draftTitle.trim()} onClick={() => void prepareDraft()}>
                          Write a private preview
                        </button>
                      </>
                    )}
                  </section>
                )}

                {stage === 'Workshop' && (
                  <section className="literary-card" data-testid="workshop-panel">
                    <p className="eyebrow">Workshop</p>
                    <p className="desk-muted">Two jobs. Neither rewrites the page.</p>
                    <p className="desk-field"><span>What's holding</span></p>
                    <p className="desk-muted">A short note on the stuck places. Reads the page you can see.</p>
                    {diagnosis ? (
                      <>
                        <p>{diagnosis.summary}</p>
                        {(diagnosis.findings || []).slice(0, 8).map((finding: any, index: number) => (
                          <div key={index} className="desk-finding"><strong>{finding.category} · {finding.severity}</strong><span>{finding.recommendation || finding.rationale}</span></div>
                        ))}
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="desk-ghost"
                      data-testid="desk-whats-holding"
                      disabled={busy || !manuscript.trim()}
                      onClick={() => void runDiagnosis()}
                    >
                      {diagnosis ? 'Look again' : "What's holding?"}
                    </button>
                    <div className="gold-rule" />
                    <p className="desk-field"><span>Critics</span></p>
                    <p className="desk-muted">Four specialists read this page. Their notes appear on the paper above the page. The page does not change.</p>
                    {council?.summary ? <p>{council.summary}</p> : null}
                    {(council?.critics || []).slice(0, 4).map((critic, index) => (
                      <div key={`${critic.role}-${index}`} className="desk-finding" data-testid="rail-critique">
                        <strong>{critic.name} · {critic.severity}</strong>
                        <span>{critic.finding || critic.fix}</span>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="desk-primary"
                      data-testid="desk-critic-swarm"
                      disabled={busy || !manuscript.trim()}
                      onClick={() => void runDeskSwarm()}
                    >
                      {readingCritics ? 'Reading…' : council ? 'Ask again' : 'Ask the critics'}
                    </button>
                    {!manuscript.trim() && <p className="desk-muted">Write on the page first.</p>}
                  </section>
                )}

                {stage === 'Revise' && (
                  <section className="literary-card" data-testid="rebuild-panel">
                    <p className="eyebrow">One chapter at a time</p>
                    <p className="desk-muted">Look first. Then choose a chapter, see the rewrite, and keep it only if it is better.</p>
                    <button type="button" className="desk-ghost" disabled={busy} onClick={() => void analyzeRebuild()}>1. Look at the structure</button>
                    {rebuild?.analysis?.summary && <p>{rebuild.analysis.summary}</p>}
                    <label className="desk-field">
                      <span>Chapter to rebuild</span>
                      <select
                        aria-label="Chapter to rebuild"
                        data-testid="rebuild-chapter-select"
                        value={rebuildChapterIndex === '' ? '' : String(rebuildChapterIndex)}
                        onChange={(event) => setRebuildChapterIndex(event.target.value === '' ? '' : Number(event.target.value))}
                      >
                        <option value="">Choose a chapter</option>
                        {manuscriptChapters.map((chapter) => (
                          <option key={chapter.index} value={chapter.index} disabled={!chapter.rebuildable}>
                            {chapter.rebuildable ? chapter.title : `${chapter.title} — structure`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="desk-ghost" disabled={busy || !selectedRebuildChapter?.rebuildable} onClick={() => void planRebuild()}>2. Rewrite this chapter</button>
                    {(rebuild?.changes || []).map((change: any) => (
                      <div key={change.id} className="desk-change">
                        <strong>{change.chapterTitle} · {change.status}</strong>
                        <p>{change.rationale}</p>
                        <div className="desk-preview">{change.proposed}</div>
                        {change.status === 'pending' && (
                          <div className="desk-row">
                            <button type="button" className="desk-ghost" onClick={() => void handleRebuildChange(change.id, false)}>Reject change</button>
                            <button type="button" className="desk-primary" onClick={() => void handleRebuildChange(change.id, true)}>Accept as new version</button>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="gold-rule" />
                    {['Rip & Fix', 'Auto Drafter', 'Scalpel', 'Gold Refinery', 'Version compare'].map((label) => (
                      <button key={label} type="button" className="desk-ghost" onClick={() => void openTool(label)}>{label}</button>
                    ))}
                  </section>
                )}

                {activeTool === 'compare' && (
                  <section className="literary-card">
                    <p className="eyebrow">Version compare</p>
                    <select aria-label="Earlier version" value={compareLeft} onChange={(event) => setCompareLeft(event.target.value)}>
                      {versions.map((version) => <option key={version.id} value={version.id}>v{version.revision} · {version.name}</option>)}
                    </select>
                    <select aria-label="Later version" value={compareRight} onChange={(event) => setCompareRight(event.target.value)}>
                      {versions.map((version) => <option key={version.id} value={version.id}>v{version.revision} · {version.name}</option>)}
                    </select>
                    <p className="desk-muted">{leftVersion ? `${leftVersion.wordCount} words` : '—'} → {rightVersion ? `${rightVersion.wordCount} words` : '—'}</p>
                    <button type="button" className="desk-ghost" onClick={() => setActiveTool(null)}>Close compare</button>
                  </section>
                )}

                {stage === 'Finish' && (
                  <section className="literary-card">
                    <p className="eyebrow">Finished work</p>
                    <p className="desk-muted">If Caspa already finished a chapter for this book, you can keep it as a version here.</p>
                    <div data-testid="finish-recover-panel">
                      {finishedJobs.length ? finishedJobs.map((job) => (
                        <button key={job.id} type="button" className="desk-ghost" onClick={() => void recoverJob(job.id)}>
                          <JobIdentity job={job} />
                        </button>
                      )) : <p className="desk-muted">Nothing waiting for this book.</p>}
                    </div>
                    <div className="gold-rule" />
                    <p className="eyebrow">Unattached work</p>
                    <p className="desk-muted">Look before you attach. Attaching does not change the page.</p>
                    <div data-testid="finish-assign-panel">
                      {unboundJobs.length ? unboundJobs.map((job) => (
                        <div key={job.id} className="desk-change" data-testid="unbound-job">
                          <JobIdentity job={job} />
                          {assignPreviewId === job.id ? (
                            <>
                              {job.provenance?.excerpt ? <div className="desk-preview">{job.provenance.excerpt}</div> : <p className="desk-muted">No excerpt is stored for this job.</p>}
                              <div className="desk-row">
                                <button type="button" className="desk-ghost" onClick={() => setAssignPreviewId('')}>Cancel</button>
                                <button type="button" className="desk-primary" disabled={busy} onClick={() => void assignJob(job.id)}>Assign to this project</button>
                              </div>
                            </>
                          ) : (
                            <button type="button" className="desk-ghost" onClick={() => setAssignPreviewId(job.id)}>Preview before assigning</button>
                          )}
                        </div>
                      )) : <p className="desk-muted">Nothing left unattached.</p>}
                    </div>
                  </section>
                )}

                {stage === 'Publish' && (
                  <section className="literary-card">
                    <p className="eyebrow">Take it home</p>
                    <p className="desk-muted">Check the saved version, then download that copy. If you keep writing, check again.</p>
                    {preflight?.checks?.map((check: any) => (
                      <div key={check.id} className={check.passed ? 'desk-check is-pass' : 'desk-check is-fail'}>
                        <strong>{check.passed ? '✓' : '✗'} {check.label}</strong>
                        <span>{check.detail}</span>
                      </div>
                    ))}
                    <button type="button" className="desk-ghost" disabled={busy} onClick={() => void runPreflight()}>Check this version</button>
                    {preflight?.passed && selected && <a className="desk-primary" href={`/api/v2/projects/${encodeURIComponent(selected.id)}/export.txt`}>Download the book</a>}
                    <button type="button" className="desk-ghost" onClick={() => void openTool('design')}>Imagine</button>
                  </section>
                )}

                {extraTools.length > 0 && (
                  <details className="literary-card desk-more">
                    <summary>More for this stage</summary>
                    <div className="desk-chips">
                      {extraTools.map((tool) => (
                        <button key={tool} type="button" onClick={() => void openTool(tool)}>{tool}</button>
                      ))}
                    </div>
                  </details>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
      <input ref={fileInput} type="file" className="sr-only" accept=".txt,.md,text/plain,text/markdown,image/*" onChange={(event) => void ingestFile(event.target.files?.[0])} />
    </div>
  );
}
