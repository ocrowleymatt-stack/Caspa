import React, { useEffect, useMemo, useState } from 'react';
import { Archive, BookOpen, Check, ChevronLeft, FileClock, Loader, Save, Sparkles, Wrench } from 'lucide-react';
import { contextualTools, type HybridStage } from '../services/hybridWorkflow';

type Project = {
  id: string; title: string; mode: string; revision: number; updatedAt: string;
  state: Record<string, any>;
};

type Version = {
  id: string; revision: number; name: string; trigger: string; content: string;
  wordCount: number; chapterCount: number; createdAt: string;
};

const stages = ['Library', 'Draft', 'Workshop', 'Revise', 'Finish', 'Publish'];

async function api(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Caspa request failed (${response.status})`);
  return body.data;
}

function initialManuscript(project: Project): string {
  return String(
    project.state?.commission?.artefact
      || project.state?.manuscript
      || project.state?.manuscriptSource
      || project.state?.whitePage
      || '',
  );
}

export default function HybridWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [manuscript, setManuscript] = useState('');
  const [stage, setStage] = useState('Library');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [draftTitle, setDraftTitle] = useState('Next chapter');
  const [preview, setPreview] = useState<any | null>(null);
  const [diagnosis, setDiagnosis] = useState<any | null>(null);
  const [finishedJobs, setFinishedJobs] = useState<any[]>([]);
  const [preflight, setPreflight] = useState<any | null>(null);

  useEffect(() => {
    api('/api/v2/migration/import-legacy', { method: 'POST', body: '{}' })
      .catch(() => null)
      .then(() => api('/api/projects'))
      .then((data) => setProjects(data.projects || []))
      .catch((error) => setMessage(error.message))
      .finally(() => setBusy(false));
  }, []);

  const openProject = async (project: Project) => {
    setSelected(project);
    setStage('Draft');
    setBusy(true);
    try {
      const data = await api(`/api/v2/projects/${encodeURIComponent(project.id)}/versions`);
      const next = data.versions || [];
      setVersions(next);
      setManuscript(next[0]?.content || initialManuscript(project));
      const [draftData, diagnosisData] = await Promise.all([
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/draft-preview`).catch(() => null),
        api(`/api/v2/projects/${encodeURIComponent(project.id)}/diagnosis`).catch(() => null),
      ]);
      setPreview(draftData);
      setDiagnosis(diagnosisData);
      setPreflight(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open this project.');
    } finally {
      setBusy(false);
    }
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
        setVersions((current) => [version, ...current]); setManuscript(version.content); setMessage(`Accepted as immutable version ${version.revision}.`);
      } else {
        await api(`/api/v2/draft-previews/${preview.id}/reject`, { method: 'POST', body: '{}' }); setMessage('Preview rejected. The manuscript was not changed.');
      }
      setPreview(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not handle the preview.'); }
    finally { setBusy(false); }
  };

  const runDiagnosis = async () => {
    if (!selected) return;
    setBusy(true); setMessage('Workshop is examining the current immutable manuscript…');
    try { const result = await api(`/api/v2/projects/${selected.id}/diagnosis`, { method: 'POST', body: '{}' }); setDiagnosis(result); setMessage('Evidence-backed diagnosis completed.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Diagnosis failed.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (stage !== 'Finish') return;
    api('/api/jobs?limit=20&status=complete')
      .then((data) => setFinishedJobs((data.jobs || []).filter((job: any) => job.resultAvailable)))
      .catch(() => setFinishedJobs([]));
  }, [stage]);

  const recoverJob = async (jobId: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      const version = await api(`/api/v2/projects/${selected.id}/recover-job/${jobId}`, { method: 'POST', body: '{}' });
      setVersions((current) => current.some((item) => item.id === version.id) ? current : [version, ...current]);
      setManuscript(version.content); setMessage(`Finish result secured as immutable version ${version.revision}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not recover the finished job.'); }
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

  const saveVersion = async () => {
    if (!selected || !manuscript.trim()) return;
    setBusy(true);
    try {
      const version = await api(`/api/v2/projects/${encodeURIComponent(selected.id)}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          name: `Author save · ${new Date().toLocaleString()}`,
          trigger: 'manual-save',
          content: manuscript,
          sourceVersionId: versions[0]?.id || null,
        }),
      });
      setVersions((current) => [version, ...current]);
      setMessage(`Saved immutable version ${version.revision}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this version.');
    } finally {
      setBusy(false);
    }
  };

  const wordCount = useMemo(() => manuscript.trim().split(/\s+/).filter(Boolean).length, [manuscript]);
  const tools = stage === 'Library' ? [] : contextualTools(stage.toLowerCase() as HybridStage);

  return (
    <div style={{ minHeight: '100vh', background: '#15110d', color: '#f6efe3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #514334', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ color: '#c9a768', letterSpacing: '.18em', fontSize: 11 }}>CASPA V2 · PRIVATE LITERARY ATELIER</div><h1 style={{ margin: '5px 0 0', fontFamily: 'Georgia, serif', fontSize: 28 }}>Make the thing first.</h1></div>
        <a href="/" style={{ color: '#d9c7a5', textDecoration: 'none', fontSize: 13 }}>Return to current Caspa</a>
      </header>
      <nav style={{ display: 'flex', gap: 8, padding: '14px 28px', borderBottom: '1px solid #372e25', overflowX: 'auto' }}>
        {stages.map((item, index) => <button key={item} onClick={() => selected || item === 'Library' ? setStage(item) : undefined} style={{ border: `1px solid ${stage === item ? '#c9a768' : '#493d31'}`, background: stage === item ? '#322719' : 'transparent', color: stage === item ? '#fff7e8' : '#a99b89', padding: '9px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>{index + 1}. {item}</button>)}
      </nav>
      {message && <div style={{ margin: '16px 28px 0', padding: 12, border: '1px solid #655137', background: '#2b2117', borderRadius: 8 }}>{message}</div>}
      {busy && <div style={{ position: 'fixed', right: 24, bottom: 24, padding: 12, background: '#2c231a', border: '1px solid #5c4934', borderRadius: 12 }}><Loader className="spin" size={18} /></div>}
      <main style={{ padding: '28px', maxWidth: 1500, margin: '0 auto' }}>
        {stage === 'Library' || !selected ? <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 24 }}><div><div style={{ color: '#c9a768', fontSize: 11, letterSpacing: '.16em' }}>CANONICAL SERVER LIBRARY</div><h2 style={{ fontFamily: 'Georgia, serif', fontSize: 42, margin: '6px 0' }}>Your work</h2><p style={{ color: '#b9aa98' }}>Every project is loaded from PostgreSQL, not a browser-only shelf.</p></div><Archive color="#c9a768" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
            {projects.map((project) => <button key={project.id} onClick={() => void openProject(project)} style={{ textAlign: 'left', padding: 20, minHeight: 170, border: '1px solid #4b3e31', background: '#201a15', color: '#f6efe3', borderRadius: 12 }}><BookOpen size={20} color="#c9a768" /><h3 style={{ fontFamily: 'Georgia, serif', fontSize: 23, margin: '16px 0 8px' }}>{project.title}</h3><div style={{ color: '#a99b89', fontSize: 12 }}>{project.mode} · project revision {project.revision}</div><div style={{ color: '#776b5e', fontSize: 11, marginTop: 8 }}>{new Date(project.updatedAt).toLocaleString()}</div></button>)}
          </div>
        </> : <>
          <button onClick={() => setStage('Library')} style={{ background: 'transparent', border: 0, color: '#c9a768', display: 'flex', gap: 7, alignItems: 'center', marginBottom: 18 }}><ChevronLeft size={16} /> Library</button>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20 }}>
            <section style={{ border: '1px solid #4b3e31', background: '#1d1813', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #3c3228', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ color: '#c9a768', fontSize: 11, letterSpacing: '.14em' }}>{stage.toUpperCase()}</div><h2 style={{ fontFamily: 'Georgia, serif', margin: '5px 0' }}>{selected.title}</h2></div><button onClick={() => void saveVersion()} disabled={busy || !manuscript.trim()} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#b89150', color: '#17110a', border: 0, padding: '10px 14px', borderRadius: 8, fontWeight: 700 }}><Save size={16} /> Save version</button></div>
              <textarea value={manuscript} onChange={(event) => setManuscript(event.target.value)} aria-label="Manuscript" style={{ boxSizing: 'border-box', width: '100%', minHeight: '68vh', resize: 'vertical', border: 0, outline: 0, padding: '32px clamp(24px,6vw,90px)', background: '#f1e8d8', color: '#251f19', font: '18px/1.75 Georgia, serif' }} />
            </section>
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ border: '1px solid #4b3e31', background: '#201a15', borderRadius: 12, padding: 18 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#c9a768' }}><Check size={16} /> Server checkpoint</div><div style={{ fontSize: 30, fontFamily: 'Georgia, serif', marginTop: 12 }}>{wordCount.toLocaleString()} words</div><div style={{ color: '#a99b89', fontSize: 12, marginTop: 5 }}>{versions.length ? `${versions.length} immutable version${versions.length === 1 ? '' : 's'}` : 'Legacy project ready for its first immutable version'}</div></div>
              <div style={{ border: '1px solid #4b3e31', background: '#201a15', borderRadius: 12, padding: 18 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#c9a768' }}><FileClock size={16} /> Version history</div>{versions.slice(0, 8).map((version) => <button key={version.id} onClick={() => setManuscript(version.content)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 0, borderTop: '1px solid #3b3128', color: '#eee3d2', padding: '12px 0' }}><strong>v{version.revision} · {version.name}</strong><div style={{ color: '#8f8171', fontSize: 11, marginTop: 4 }}>{version.wordCount.toLocaleString()} words · {new Date(version.createdAt).toLocaleString()}</div></button>)}</div>
              {stage === 'Draft' && <div style={{ border: '1px solid #6b5538', background: '#201a15', borderRadius: 12, padding: 18 }}><div style={{ color: '#c9a768', fontWeight: 700 }}>Draft with Caspa</div><p style={{ color: '#a99b89', fontSize: 12, lineHeight: 1.5 }}>Caspa prepares a private preview. Only explicit acceptance creates a version.</p>{preview?.status === 'previewed' ? <><h4>{preview.chapterTitle}</h4><div style={{ maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap', background: '#efe4d2', color: '#282018', padding: 12, borderRadius: 8, font: '13px/1.6 Georgia, serif' }}>{preview.content}</div><p style={{ color: '#a99b89', fontSize: 11 }}>{preview.grounding?.summary}</p><div style={{ display: 'flex', gap: 8 }}><button onClick={() => void handlePreview(false)} style={{ flex: 1, padding: 9, borderRadius: 7, border: '1px solid #66533d', background: 'transparent', color: '#eee3d2' }}>Reject</button><button onClick={() => void handlePreview(true)} style={{ flex: 1, padding: 9, borderRadius: 7, border: 0, background: '#b89150', color: '#17110a', fontWeight: 700 }}>Accept version</button></div></> : <><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} style={{ boxSizing: 'border-box', width: '100%', background: '#17120e', color: '#f4ebdc', border: '1px solid #514230', borderRadius: 7, padding: 10 }} /><button onClick={() => void prepareDraft()} disabled={busy} style={{ width: '100%', marginTop: 9, padding: 10, border: 0, borderRadius: 7, background: '#b89150', color: '#17110a', fontWeight: 700 }}>Prepare preview</button></>}</div>}
              {stage === 'Workshop' && <div style={{ border: '1px solid #6b5538', background: '#201a15', borderRadius: 12, padding: 18 }}><div style={{ color: '#c9a768', fontWeight: 700 }}>Workshop diagnosis</div>{diagnosis ? <><p style={{ color: '#d8cbb9', fontSize: 13, lineHeight: 1.55 }}>{diagnosis.summary}</p>{(diagnosis.findings || []).slice(0, 8).map((finding: any, index: number) => <div key={index} style={{ borderTop: '1px solid #41362b', padding: '10px 0' }}><strong style={{ fontSize: 12 }}>{finding.category} · {finding.severity}</strong><div style={{ color: '#a99b89', fontSize: 11, marginTop: 4 }}>{finding.recommendation || finding.rationale}</div></div>)}</> : <p style={{ color: '#a99b89', fontSize: 12 }}>Run a server-owned diagnosis against the current version.</p>}<button onClick={() => void runDiagnosis()} disabled={busy} style={{ width: '100%', marginTop: 9, padding: 10, border: '1px solid #66533d', borderRadius: 7, background: '#2a2118', color: '#eee3d2' }}>{diagnosis ? 'Run new diagnosis' : 'Diagnose manuscript'}</button></div>}
              {stage === 'Revise' && <div style={{ border: '1px solid #6b5538', background: '#201a15', borderRadius: 12, padding: 18 }}><div style={{ color: '#c9a768', fontWeight: 700 }}>Revision desk</div><p style={{ color: '#a99b89', fontSize: 12, lineHeight: 1.5 }}>Edit the manuscript directly. Workshop findings remain visible when you return there; Save version makes each deliberate revision recoverable.</p>{diagnosis?.findings?.length ? <div style={{ color: '#d8cbb9', fontSize: 12 }}>{diagnosis.findings.length} diagnosed item{diagnosis.findings.length === 1 ? '' : 's'} available as your revision checklist.</div> : <div style={{ color: '#8f8171', fontSize: 12 }}>Run Workshop diagnosis first for an evidence-backed checklist.</div>}</div>}
              {stage === 'Finish' && <div style={{ border: '1px solid #6b5538', background: '#201a15', borderRadius: 12, padding: 18 }}><div style={{ color: '#c9a768', fontWeight: 700 }}>Recovery Centre</div><p style={{ color: '#a99b89', fontSize: 12 }}>Promote a completed server job into immutable project history without running AI again.</p>{finishedJobs.length ? finishedJobs.map((job) => <button key={job.id} onClick={() => void recoverJob(job.id)} style={{ width: '100%', textAlign: 'left', marginTop: 7, padding: 9, border: '1px solid #514230', borderRadius: 7, background: '#2a2118', color: '#eee3d2' }}><strong>{job.type}</strong><div style={{ fontSize: 10, color: '#9e907f' }}>{job.stage} · {new Date(job.updatedAt).toLocaleString()}</div></button>) : <div style={{ color: '#8f8171', fontSize: 12 }}>No unrecovered completed jobs found.</div>}</div>}
              {stage === 'Publish' && <div style={{ border: '1px solid #6b5538', background: '#201a15', borderRadius: 12, padding: 18 }}><div style={{ color: '#c9a768', fontWeight: 700 }}>Publish gate</div><p style={{ color: '#a99b89', fontSize: 12, lineHeight: 1.5 }}>The export gate checks the current immutable version. Any later save requires a fresh preflight.</p>{preflight?.checks?.map((check: any) => <div key={check.id} style={{ display: 'flex', gap: 8, borderTop: '1px solid #41362b', padding: '9px 0', color: check.passed ? '#bdd6ad' : '#e5ae9e', fontSize: 12 }}><span>{check.passed ? '✓' : '✗'}</span><span><strong>{check.label}</strong><br />{check.detail}</span></div>)}<button onClick={() => void runPreflight()} disabled={busy} style={{ width: '100%', marginTop: 9, padding: 10, border: '1px solid #66533d', borderRadius: 7, background: '#2a2118', color: '#eee3d2' }}>Run publish preflight</button>{preflight?.passed && selected && <a href={`/api/v2/projects/${encodeURIComponent(selected.id)}/export.txt`} style={{ boxSizing: 'border-box', display: 'block', textAlign: 'center', textDecoration: 'none', width: '100%', marginTop: 9, padding: 10, borderRadius: 7, background: '#b89150', color: '#17110a', fontWeight: 700 }}>Download verified manuscript</a>}</div>}
              <div style={{ border: '1px solid #4b3e31', background: '#201a15', borderRadius: 12, padding: 18 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#c9a768' }}><Wrench size={16} /> Tools when needed</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: '14px 0' }}>{tools.map((tool) => <span key={tool} style={{ border: '1px solid #514230', borderRadius: 20, padding: '6px 9px', color: '#cbbda8', fontSize: 11 }}>{tool}</span>)}</div><p style={{ color: '#a99b89', fontSize: 13, lineHeight: 1.6 }}>Specialist capabilities appear for the current stage instead of competing with the manuscript.</p><button onClick={() => { window.location.href = '/'; }} style={{ width: '100%', border: '1px solid #655137', background: '#2a2118', color: '#eee3d2', padding: 10, borderRadius: 8 }}><Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 7 }} /> Open current specialist tools</button></div>
            </aside>
          </div>
        </>}
      </main>
    </div>
  );
}
