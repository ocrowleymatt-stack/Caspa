import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Feather, FileClock, HelpCircle, Loader, Save, ShieldCheck } from 'lucide-react';
import { contextualTools } from '../services/hybridWorkflow';
import {
  DESK_STAGES,
  STAGE_HELP,
  findWorkspaceTool,
  toolsForStage,
  type DeskStage,
  type WorkspaceToolId,
} from '../services/workspaceCatalog';
import { briefFromProject, collectToolCache, hydrateToolCache, type WorkspaceProject } from '../services/workspaceProjectBridge';
import { extractImageViaVision, readIngestFile } from '../services/workspaceIngest';
import { splitRebuildChapters } from '../services/workspaceRebuild';
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

async function api(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...activeProjectHeader(), ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (response.status === 409 && (body.code === 'REVISION_CONFLICT' || body.code === 'VERSION_CONFLICT')) {
    const error = new Error(body.message || 'Project changed in another session');
    (error as any).code = body.code;
    throw error;
  }
  if (!response.ok) throw new Error(body.message || `Caspa request failed (${response.status})`);
  return body.data;
}

function initialManuscript(project: WorkspaceProject): string {
  return String(project.state?.commission?.artefact || project.state?.manuscript || project.state?.manuscriptSource || project.state?.whitePage || '');
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
  const [draftTitle, setDraftTitle] = useState('Opening chapter');
  const [preview, setPreview] = useState<any | null>(null);
  const [diagnosis, setDiagnosis] = useState<any | null>(null);
  const [rebuild, setRebuild] = useState<any | null>(null);
  const [finishedJobs, setFinishedJobs] = useState<any[]>([]);
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
  const knownVersion = useRef(0);
  const knownProjectRevision = useRef(0);

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
      setConflict(`Another session saved immutable version ${snap.latestVersion.revision}. Reload this desk before saving or accepting changes.`);
    }
    if (snap.project?.revision && knownProjectRevision.current && snap.project.revision !== knownProjectRevision.current) {
      setConflict((current) => current || 'This project changed in another tab. Reload before saving artefacts. Local revision was not advanced.');
    }
  };

  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(() => void refreshSnapshot(selected.id), 20000);
    return () => window.clearInterval(timer);
  }, [selected?.id]);

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
      const [draftData, diagnosisData, rebuildData] = await Promise.all([
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/draft-preview`).catch(() => null),
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/diagnosis`).catch(() => null),
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/rebuild`).catch(() => null),
      ]);
      setPreview(draftData);
      setDiagnosis(diagnosisData);
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
        ? 'Reloaded the server project. Specialist work in this tool was kept so you can save it against the current revision.'
        : 'Reloaded the current server project and artefacts.');
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
      setMessage('Project created on the server. Nothing has been written into a manuscript yet.');
      await openProject(project, 'Idea');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create the project.'); setBusy(false); }
  };

  const ingestFile = async (file: File | undefined, promote = false) => {
    if (!file) return;
    if (!selected) {
      if (file.type.startsWith('image/')) {
        setNewIdea((current) => current || `Image ready after create: ${file.name}`);
        setMessage('Create the server project first, then attach the image so Caspa can extract its text.');
        return;
      }
      const read = await readIngestFile(file);
      setNewIdea(read.text.slice(0, 4000));
      setMessage(`Loaded ${file.name}. Create the server project to keep it.`);
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
      setMessage(`${file.name} attached with extracted text. The manuscript was not overwritten.`);
      if (promote && read.text.trim()) {
        await saveVersion(read.text, `Imported · ${file.name}`, 'ingest-promoted');
      }
    } catch (error) {
      handleConflict(error, 'Could not ingest that file.');
    } finally { setBusy(false); }
  };

  const handleConflict = (error: unknown, fallback: string) => {
    const err = error as any;
    if (err?.code === 'REVISION_CONFLICT' || err?.code === 'VERSION_CONFLICT') {
      setConflict(err.message || 'This project changed in another tab. Reload before saving again. Nothing was overwritten.');
    }
    setMessage(err instanceof Error ? err.message : fallback);
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
      handleConflict(error, 'Could not save project artefacts. The specialist tool stays open so the work is not discarded.');
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
    if (!tool || !selected) { setMessage('That control is already represented on this desk.'); return; }
    if (activeTool && activeTool !== tool.id) {
      const saved = await persistArtefacts();
      if (!saved.ok) return;
    }
    if (tool.id === 'workshop') { setStage('Workshop'); setActiveTool(null); return; }
    if (tool.id === 'rebuild') { setStage('Revise'); setActiveTool(null); return; }
    if (tool.id === 'recovery') { setStage('Finish'); setActiveTool(null); return; }
    if (tool.id === 'preflight' || tool.id === 'publish') { setStage('Publish'); setActiveTool(null); return; }
    if (tool.id === 'compare') { setStage('Revise'); setActiveTool('compare'); return; }
    const project = selected;
    hydrateToolCache(project, manuscript);
    setActiveTool(tool.id);
  };

  const closeTool = async () => {
    const saved = await persistArtefacts();
    if (!saved.ok) return;
    setActiveTool(null);
  };

  const prepareDraft = async () => {
    if (!selected || !draftTitle.trim()) return;
    setBusy(true); setMessage('Preparing a private continuity-checked preview…');
    try {
      const result = await api(`/api/v2/projects/${encodeURIComponent(selected.id)}/draft-preview`, {
        method: 'POST', body: JSON.stringify({ mode: manuscript.trim() ? 'append' : 'opening', chapterTitle: draftTitle, targetWords: 1200 }),
      });
      setPreview(result); setMessage('Preview ready. The manuscript has not changed.');
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
        setMessage(`Accepted as immutable version ${version.revision}.`);
        setPreview(null);
      } else {
        await api(`/api/v2/draft-previews/${preview.id}/reject`, { method: 'POST', body: '{}' }); setMessage('Preview rejected. The manuscript was not changed.');
        setPreview(null);
      }
    } catch (error) { handleConflict(error, 'Could not handle the preview.'); }
    finally { setBusy(false); }
  };

  const runDiagnosis = async () => {
    if (!selected) return;
    setBusy(true); setMessage('Workshop is examining the current immutable manuscript…');
    try { const result = await api(`/api/v2/projects/${selected.id}/diagnosis`, { method: 'POST', body: '{}' }); setDiagnosis(result); setMessage('Evidence-backed diagnosis completed. The manuscript is unchanged.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Diagnosis failed.'); }
    finally { setBusy(false); }
  };

  const analyzeRebuild = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api(`/api/v2/projects/${selected.id}/rebuild/analyze`, { method: 'POST', body: '{}' });
      setRebuild(result);
      setMessage('Rebuild analysis complete. No text was changed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Rebuild analysis failed.'); }
    finally { setBusy(false); }
  };

  const planRebuild = async (chapterTitle?: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api(`/api/v2/projects/${selected.id}/rebuild/plan`, { method: 'POST', body: JSON.stringify({ chapterTitle }) });
      setRebuild(result);
      setMessage('Reconstruction plan ready. Preview the replacement before accepting.');
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
        setMessage(`Accepted rebuild as immutable version ${result.version.revision}.`);
      } else {
        const plan = await api(`/api/v2/rebuild-plans/${rebuild.id}/changes/${changeId}/reject`, { method: 'POST', body: '{}' });
        setRebuild(plan);
        setMessage('Change rejected. The manuscript was not changed.');
      }
    } catch (error) { handleConflict(error, 'Could not handle that rebuild change.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (stage !== 'Finish') return;
    api(`/api/jobs?limit=20&status=complete&projectId=${encodeURIComponent(selected?.id || '')}`)
      .then((data) => setFinishedJobs((data.jobs || []).filter((job: any) => job.resultAvailable && (!selected || job.projectId === selected.id))))
      .catch(() => setFinishedJobs([]));
  }, [stage, selected?.id]);

  const recoverJob = async (jobId: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      const version = await api(`/api/v2/projects/${selected.id}/recover-job/${jobId}`, { method: 'POST', body: '{}' });
      setVersions((current) => current.some((item) => item.id === version.id) ? current : [version, ...current]);
      setManuscript(version.content); knownVersion.current = version.revision;
      setMessage(`Finish result secured as immutable version ${version.revision}.`);
    } catch (error) { handleConflict(error, 'Could not recover the finished job.'); }
    finally { setBusy(false); }
  };

  const runPreflight = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api(`/api/v2/projects/${selected.id}/export-preflight`, { method: 'POST', body: '{}' });
      setPreflight(result);
      setMessage(result.passed ? 'Publish preflight passed. The current immutable version is ready to download.' : 'Publish preflight found items to resolve.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Publish preflight failed.'); }
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
      setMessage(`Saved immutable version ${version.revision}.`);
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
  const chapterCount = useMemo(() => splitRebuildChapters(manuscript).length, [manuscript]);
  const brief = selected ? briefFromProject(selected) : null;
  const stageTools = toolsForStage(stage);
  const hybridTools = stage === 'Library' ? [] : contextualTools(stage === 'Idea' || stage === 'Structure' ? 'draft' : stage.toLowerCase() as any);
  const leftVersion = versions.find((item) => item.id === compareLeft) || versions[1];
  const rightVersion = versions.find((item) => item.id === compareRight) || versions[0];

  return (
    <div className="hybrid-workspace caspa-desk">
      <header className="hybrid-header desk-header">
        <div className="desk-brand">
          <span className="desk-mark"><Feather size={16} /></span>
          <div>
            <div className="eyebrow">CASPA · Manuscript development</div>
            <h1>Private writing desk</h1>
          </div>
        </div>
        <div className="desk-header-actions">
          {busy && <span className="desk-busy" role="status"><Loader className="spin" size={14} /> Working</span>}
          <button type="button" className="desk-ghost" data-testid="desk-help-toggle" onClick={() => setHelpOpen((value) => !value)}><HelpCircle size={14} /> Help</button>
          <a href="/legacy" className="desk-ghost">Previous studio</a>
        </div>
      </header>

      {selected && (
        <div className="desk-status" data-testid="desk-status">
          <span>Stage <strong>{stage}</strong></span>
          <span>Last server save <strong>{lastSave ? new Date(lastSave).toLocaleString() : 'none yet'}</strong></span>
          <span>{wordCount.toLocaleString()} words · {chapterCount} chapter{chapterCount === 1 ? '' : 's'}</span>
          <span>{versions.length} version{versions.length === 1 ? '' : 's'}</span>
          <span>Recovery <strong>{recoveryAvailable ? 'available' : 'idle'}</strong></span>
          <span>Model / cost <strong>shown only after an author-started run</strong></span>
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
          >
            <span>{stage === item || (selected && DESK_STAGES.indexOf(stage) > index) ? <Check size={12} /> : index + 1}</span>
            {item}
          </button>
        ))}
      </nav>

      {helpOpen && (
        <aside className="literary-card desk-help" data-testid="desk-help">
          <p className="eyebrow">This stage</p>
          <p>{STAGE_HELP[stage]}</p>
          <div className="gold-rule" />
          {stageTools.map((tool) => <p key={tool.id}><strong>{tool.label}.</strong> {tool.help}</p>)}
        </aside>
      )}

      {message && <div className="desk-banner" role="status">{message}</div>}
      {conflict && <div className="desk-banner is-conflict" role="alert">{conflict} <button type="button" className="desk-ghost" onClick={() => void reloadProject()}>Reload project</button></div>}

      <main className="hybrid-main desk-main">
        {stage === 'Library' || !selected ? (
          <div className="desk-library">
            <div className="desk-library-head">
              <div>
                <p className="eyebrow">Author workspace</p>
                <h2>Your work</h2>
                <p className="desk-muted">Every project is loaded from PostgreSQL. Browser storage is only a cache.</p>
              </div>
              <div className="desk-row">
                <button type="button" className="desk-ghost" onClick={() => { setShowNewProject(true); setActiveTool(null); }}>New project</button>
                <button type="button" className="desk-ghost" onClick={() => { setShowNewProject(true); fileInput.current?.click(); }}>Ingest a file</button>
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
                  <button type="button" className="desk-primary" disabled={busy} onClick={() => void createNewProject()}>Create server project</button>
                  <button type="button" className="desk-ghost" onClick={() => fileInput.current?.click()}>Attach text, manuscript or image</button>
                </div>
              </section>
            )}

            <div className="hybrid-library-grid">
              {projects.map((project) => (
                <button className="hybrid-project-card literary-card" key={project.id} onClick={() => void openProject(project)}>
                  <BookOpen size={18} />
                  <h3>{project.title}</h3>
                  <div className="desk-muted">{project.mode} · project revision {project.revision}</div>
                  <div className="desk-muted">{new Date(project.updatedAt).toLocaleString()}</div>
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
                    <textarea className="hybrid-manuscript manuscript-page" value={manuscript} onChange={(event) => setManuscript(event.target.value)} aria-label="Manuscript" />
                  </section>
                )}

                {proposal && (
                  <section className="literary-card desk-proposal" data-testid="manuscript-proposal">
                    <p className="eyebrow">Proposed manuscript change</p>
                    <p>A specialist tool produced replacement text. Accepting creates a new immutable version. Rejecting leaves the canonical manuscript untouched.</p>
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
                  <div className="desk-card-kicker"><ShieldCheck size={14} /> Server checkpoint</div>
                  <div className="desk-metric">{wordCount.toLocaleString()} words</div>
                  <p className="desk-muted">{chapterCount} chapters · {versions.length ? `${versions.length} immutable versions` : 'Ready for a first version'}</p>
                </section>

                <section className="literary-card">
                  <div className="desk-card-kicker"><FileClock size={14} /> Version history</div>
                  {versions.slice(0, 8).map((version) => (
                    <button key={version.id} type="button" className="desk-version" onClick={() => void revealVersion(version.id)}>
                      <strong>v{version.revision} · {version.name}</strong>
                      <span>{version.wordCount.toLocaleString()} words · {new Date(version.createdAt).toLocaleString()}</span>
                    </button>
                  ))}
                </section>

                {stage === 'Idea' && (
                  <section className="literary-card">
                    <p className="eyebrow">Idea / ingest</p>
                    <p className="desk-muted">Attach notes or a manuscript. Images are OCR’d on attach; if extraction fails, nothing is stored. Promotion into the manuscript is explicit.</p>
                    <button type="button" className="desk-ghost" onClick={() => fileInput.current?.click()}>Attach file or image</button>
                    <button type="button" className="desk-primary" disabled={!manuscript.trim()} onClick={() => void saveVersion(manuscript, 'Imported manuscript', 'ingest-promoted')}>Save current text as first version</button>
                    <button type="button" className="desk-ghost" onClick={() => void openTool('research')}>Open Research Desk</button>
                  </section>
                )}

                {stage === 'Structure' && (
                  <section className="literary-card">
                    <p className="eyebrow">Structure</p>
                    <p className="desk-muted">These engines read this PostgreSQL project and write artefacts back to it.</p>
                    {['Brainstorm', 'Story Bible', 'Character Forge', 'Psychology Studio', 'Plot Architect'].map((label) => (
                      <button key={label} type="button" className="desk-ghost" onClick={() => void openTool(label)}>{label}</button>
                    ))}
                  </section>
                )}

                {stage === 'Draft' && (
                  <section className="literary-card">
                    <p className="eyebrow">Draft with Caspa</p>
                    <p className="desk-muted">Caspa prepares a private preview. Only explicit acceptance creates a version.</p>
                    {preview?.status === 'previewed' ? (
                      <>
                        <h4>{preview.chapterTitle}</h4>
                        <div className="desk-preview">{preview.content}</div>
                        <p className="desk-muted">{preview.grounding?.summary}</p>
                        <div className="desk-row">
                          <button type="button" className="desk-ghost" onClick={() => void handlePreview(false)}>Reject</button>
                          <button type="button" className="desk-primary" onClick={() => void handlePreview(true)}>Accept version</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <input aria-label="Chapter title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                        <button type="button" className="desk-primary" disabled={busy} onClick={() => void prepareDraft()}>Prepare preview</button>
                      </>
                    )}
                  </section>
                )}

                {stage === 'Workshop' && (
                  <section className="literary-card">
                    <p className="eyebrow">Workshop diagnosis</p>
                    {diagnosis ? (
                      <>
                        <p>{diagnosis.summary}</p>
                        {(diagnosis.findings || []).slice(0, 8).map((finding: any, index: number) => (
                          <div key={index} className="desk-finding"><strong>{finding.category} · {finding.severity}</strong><span>{finding.recommendation || finding.rationale}</span></div>
                        ))}
                      </>
                    ) : <p className="desk-muted">Run a server-owned diagnosis against the current version.</p>}
                    <button type="button" className="desk-ghost" disabled={busy} onClick={() => void runDiagnosis()}>{diagnosis ? 'Run new diagnosis' : 'Diagnose manuscript'}</button>
                    <button type="button" className="desk-ghost" onClick={() => void openTool('Critic Swarm')}>Critic Swarm</button>
                  </section>
                )}

                {stage === 'Revise' && (
                  <section className="literary-card" data-testid="rebuild-panel">
                    <p className="eyebrow">Rip up and rebuild</p>
                    <p className="desk-muted">Analyse without modifying. Then plan one chapter, preview it, and accept or reject that change.</p>
                    <button type="button" className="desk-ghost" disabled={busy} onClick={() => void analyzeRebuild()}>1. Analyse structure</button>
                    {rebuild?.analysis?.summary && <p>{rebuild.analysis.summary}</p>}
                    <button type="button" className="desk-ghost" disabled={busy} onClick={() => void planRebuild()}>2. Plan one chapter</button>
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
                    <p className="eyebrow">Recovery Centre</p>
                    <p className="desk-muted">Promote a completed server job into immutable history without running AI again.</p>
                    {finishedJobs.length ? finishedJobs.map((job) => (
                      <button key={job.id} type="button" className="desk-ghost" onClick={() => void recoverJob(job.id)}>
                        <strong>{job.type}</strong>
                        <span>{job.stage} · {new Date(job.updatedAt).toLocaleString()}</span>
                      </button>
                    )) : <p className="desk-muted">No unrecovered completed jobs found.</p>}
                  </section>
                )}

                {stage === 'Publish' && (
                  <section className="literary-card">
                    <p className="eyebrow">Publish gate</p>
                    <p className="desk-muted">The export gate checks the current immutable version. Any later save requires a fresh preflight.</p>
                    {preflight?.checks?.map((check: any) => (
                      <div key={check.id} className={check.passed ? 'desk-check is-pass' : 'desk-check is-fail'}>
                        <strong>{check.passed ? '✓' : '✗'} {check.label}</strong>
                        <span>{check.detail}</span>
                      </div>
                    ))}
                    <button type="button" className="desk-ghost" disabled={busy} onClick={() => void runPreflight()}>Run publish preflight</button>
                    {preflight?.passed && selected && <a className="desk-primary" href={`/api/v2/projects/${encodeURIComponent(selected.id)}/export.txt`}>Download verified manuscript</a>}
                    <button type="button" className="desk-ghost" onClick={() => void openTool('design')}>Design</button>
                  </section>
                )}

                <section className="literary-card">
                  <p className="eyebrow">Contextual tools</p>
                  <div className="desk-chips">
                    {(stageTools.length ? stageTools.map((tool) => tool.label) : hybridTools).map((tool) => (
                      <button key={tool} type="button" onClick={() => void openTool(tool)}>{tool}</button>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
      <input ref={fileInput} type="file" className="sr-only" accept=".txt,.md,text/plain,text/markdown,image/*" onChange={(event) => void ingestFile(event.target.files?.[0])} />
    </div>
  );
}
