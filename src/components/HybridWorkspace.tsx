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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open this project.');
    } finally {
      setBusy(false);
    }
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
              <div style={{ border: '1px solid #4b3e31', background: '#201a15', borderRadius: 12, padding: 18 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#c9a768' }}><Wrench size={16} /> Tools when needed</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, margin: '14px 0' }}>{tools.map((tool) => <span key={tool} style={{ border: '1px solid #514230', borderRadius: 20, padding: '6px 9px', color: '#cbbda8', fontSize: 11 }}>{tool}</span>)}</div><p style={{ color: '#a99b89', fontSize: 13, lineHeight: 1.6 }}>Specialist capabilities appear for the current stage instead of competing with the manuscript.</p><button onClick={() => { window.location.href = '/'; }} style={{ width: '100%', border: '1px solid #655137', background: '#2a2118', color: '#eee3d2', padding: 10, borderRadius: 8 }}><Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 7 }} /> Open current specialist tools</button></div>
            </aside>
          </div>
        </>}
      </main>
    </div>
  );
}
