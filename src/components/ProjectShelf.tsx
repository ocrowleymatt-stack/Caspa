/**
 * Caspa Project Shelf — open projects, library, list/gallery views
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Grid3X3,
  Hammer,
  LayoutList,
  Loader,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ProjectBriefLike } from '../services/commissionService';
import {
  completeProject,
  deleteProject,
  loadLibraryManuscripts,
  loadOpenProjects,
  loadShelf,
  pruneStaleProjects,
  recordProjectSnapshot,
  reopenProject,
  switchToProject,
  type ShelfProject,
} from '../services/projectShelfService';

type ShelfTab = 'open' | 'library';
type ViewMode = 'grid' | 'list';

interface Props {
  brief: ProjectBriefLike;
  onOpenWorkshop: () => void;
  onOpenPublish: () => void;
  onSwitchProject: (key: string) => void;
  onProjectCompleted: () => void;
  onNewProject: () => void;
}

export default function ProjectShelf({
  brief,
  onOpenWorkshop,
  onOpenPublish,
  onSwitchProject,
  onProjectCompleted,
  onNewProject,
}: Props) {
  const [tab, setTab] = useState<ShelfTab>('open');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [projects, setProjects] = useState<ShelfProject[]>(() => loadShelf());
  const [query, setQuery] = useState('');
  const [doctorStatus, setDoctorStatus] = useState<string | null>(null);
  const [checkingDoctor, setCheckingDoctor] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const refresh = useCallback(() => {
    recordProjectSnapshot(brief);
    setProjects(loadShelf());
  }, [brief]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const displayed = useMemo(() => {
    const base = tab === 'open' ? loadOpenProjects() : loadLibraryManuscripts();
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.mode.toLowerCase().includes(q) ||
        p.idea.toLowerCase().includes(q)
    );
  }, [projects, tab, query]);

  const handleSwitch = (key: string) => {
    const snap = switchToProject(key);
    if (snap) {
      onSwitchProject(key);
      setStatusMsg(`Opened "${snap.brief.title}"`);
    }
  };

  const handleComplete = (key: string, title: string) => {
    if (!window.confirm(`Move "${title}" to the library? It will leave your active workbench.`)) return;
    completeProject(key);
    refresh();
    onProjectCompleted();
    setTab('library');
    setStatusMsg(`"${title}" is now in your library.`);
  };

  const handleReopen = (key: string) => {
    const snap = reopenProject(key);
    if (snap) {
      onSwitchProject(key);
      setTab('open');
      setStatusMsg(`"${snap.brief.title}" is active again.`);
    }
  };

  const handleCleanup = () => {
    const removed = pruneStaleProjects();
    refresh();
    setStatusMsg(removed > 0 ? `Removed ${removed} empty test project${removed !== 1 ? 's' : ''}.` : 'Nothing to clean up.');
  };

  const checkDoctor = async () => {
    setCheckingDoctor(true);
    setDoctorStatus(null);
    try {
      const res = await fetch('/api/doctor');
      const data = (await res.json()) as {
        success?: boolean;
        data?: { status?: string; aiProviders?: { ollama?: { available?: boolean } } };
      };
      if (data.success && data.data?.status === 'ok') {
        const ollama = data.data.aiProviders?.ollama?.available ? 'Ollama online' : 'Ollama offline';
        setDoctorStatus(`Engine healthy · ${ollama}`);
      } else {
        setDoctorStatus('Doctor returned an unexpected response.');
      }
    } catch {
      setDoctorStatus('Could not reach /api/doctor.');
    } finally {
      setCheckingDoctor(false);
    }
  };

  const openCount = loadOpenProjects().length;
  const libraryCount = loadLibraryManuscripts().length;

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <div style={kicker}>{tab === 'open' ? 'Projects' : 'Library'}</div>
            <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
              {tab === 'open' ? 'Open work' : 'Finished manuscripts'}
            </h1>
            <p style={{ margin: 0, maxWidth: 640, color: '#73695d', fontSize: 17, lineHeight: 1.5 }}>
              {tab === 'open'
                ? 'Active projects on your workbench. One is live at a time — finish it, then move it to the library.'
                : 'Completed work lives here. Reopen if you need another pass, or export from the shelf.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={onNewProject} style={primaryBtn}>
              <Sparkles size={16} /> New project
            </button>
            <button type="button" onClick={refresh} style={ghostBtn}>
              <RefreshCw size={16} /> Refresh
            </button>
            <button type="button" onClick={handleCleanup} style={ghostBtn}>
              <Trash2 size={16} /> Tidy test projects
            </button>
          </div>
        </header>

        {statusMsg && (
          <div style={{ ...card, marginBottom: 16, padding: '12px 18px', fontSize: 14, color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' }}>
            {statusMsg}
          </div>
        )}

        {doctorStatus && (
          <div style={{ ...card, marginBottom: 16, padding: '12px 18px', fontSize: 14, color: '#5c5146' }}>
            {doctorStatus}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 6, background: '#fffaf2', border: '1px solid #eadfce', borderRadius: 14, padding: 4 }}>
            <TabButton active={tab === 'open'} onClick={() => setTab('open')} label={`Open (${openCount})`} />
            <TabButton active={tab === 'library'} onClick={() => setTab('library')} label={`Library (${libraryCount})`} />
          </div>
          <div style={{ display: 'flex', gap: 6, background: '#fffaf2', border: '1px solid #eadfce', borderRadius: 14, padding: 4 }}>
            <IconTab active={viewMode === 'list'} onClick={() => setViewMode('list')} icon={LayoutList} title="List view" />
            <IconTab active={viewMode === 'grid'} onClick={() => setViewMode('grid')} icon={Grid3X3} title="Gallery view" />
          </div>
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 360 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#8b806f' }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'open' ? 'Find open project…' : 'Find in library…'}
              style={{ ...inputStyle, paddingLeft: 42 }}
            />
          </div>
          <button type="button" onClick={checkDoctor} disabled={checkingDoctor} style={{ ...ghostBtn, marginLeft: 'auto' }}>
            {checkingDoctor ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
            Engine
          </button>
        </div>

        {displayed.length === 0 ? (
          <article style={card}>
            <BookOpen size={40} style={{ color: '#d6a846', marginBottom: 12 }} />
            <h2 style={sectionTitle}>{tab === 'open' ? 'No open projects' : 'Library is empty'}</h2>
            <p style={{ color: '#73695d', lineHeight: 1.6 }}>
              {tab === 'open'
                ? 'Start something new in Launchpad, or complete a manuscript to see it in the library.'
                : 'When a manuscript is finished, use "Move to library" from your guided workflow or Publish Pack.'}
            </p>
            <button type="button" onClick={tab === 'open' ? onNewProject : () => setTab('open')} style={{ ...primaryBtn, marginTop: 16 }}>
              {tab === 'open' ? <><Sparkles size={18} /> New project</> : <><BookOpen size={18} /> View open projects</>}
            </button>
          </article>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {displayed.map((proj) => (
              <ProjectCard
                key={proj.key}
                project={proj}
                tab={tab}
                onOpen={() => handleSwitch(proj.key)}
                onComplete={() => handleComplete(proj.key, proj.title)}
                onReopen={() => handleReopen(proj.key)}
                onPublish={onOpenPublish}
                onWorkshop={onOpenWorkshop}
                onDelete={() => {
                  if (window.confirm(`Delete "${proj.title}" from this device?`)) {
                    deleteProject(proj.key);
                    refresh();
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {displayed.map((proj) => (
              <ProjectRow
                key={proj.key}
                project={proj}
                tab={tab}
                onOpen={() => handleSwitch(proj.key)}
                onComplete={() => handleComplete(proj.key, proj.title)}
                onReopen={() => handleReopen(proj.key)}
                onPublish={onOpenPublish}
                onWorkshop={onOpenWorkshop}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        borderRadius: 10,
        padding: '8px 14px',
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
        background: active ? '#d6a846' : 'transparent',
        color: active ? '#1d1408' : '#5c5146',
      }}
    >
      {label}
    </button>
  );
}

function IconTab({
  active,
  onClick,
  icon: Icon,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        border: 'none',
        borderRadius: 10,
        padding: '8px 10px',
        cursor: 'pointer',
        background: active ? '#d6a846' : 'transparent',
        color: active ? '#1d1408' : '#5c5146',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Icon size={16} />
    </button>
  );
}

function ProjectCard({
  project,
  tab,
  onOpen,
  onComplete,
  onReopen,
  onPublish,
  onWorkshop,
  onDelete,
}: {
  project: ShelfProject;
  tab: ShelfTab;
  onOpen: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onPublish: () => void;
  onWorkshop: () => void;
  onDelete: () => void;
}) {
  return (
    <article style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#9b6d16', fontWeight: 800 }}>
            {project.mode}
            {project.isActive ? ' · live' : ''}
          </div>
          <h2 style={{ ...sectionTitle, margin: '4px 0 6px', fontSize: 18 }}>{project.title}</h2>
        </div>
        {project.viabilityScore != null && (
          <div style={{ borderRadius: 12, padding: '6px 10px', background: project.viabilityScore >= 60 ? '#ecfdf5' : '#fff7ed', color: project.viabilityScore >= 60 ? '#047857' : '#b45309', fontSize: 13, fontWeight: 800 }}>
            {project.viabilityScore}%
          </div>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 14, color: '#73695d', lineHeight: 1.5, flex: 1 }}>
        {project.idea.slice(0, 140)}
        {project.idea.length > 140 ? '…' : ''}
      </p>
      <div style={{ fontSize: 12, color: '#8a7a66' }}>
        {project.wordCount.toLocaleString()} words · Phase: <strong>{project.phase}</strong>
      </div>
      <ProjectActions tab={tab} isActive={project.isActive} onOpen={onOpen} onComplete={onComplete} onReopen={onReopen} onPublish={onPublish} onWorkshop={onWorkshop} onDelete={onDelete} />
    </article>
  );
}

function ProjectRow({
  project,
  tab,
  onOpen,
  onComplete,
  onReopen,
  onPublish,
  onWorkshop,
}: {
  project: ShelfProject;
  tab: ShelfTab;
  onOpen: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onPublish: () => void;
  onWorkshop: () => void;
}) {
  return (
    <article
      style={{
        ...card,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 16,
        alignItems: 'center',
        padding: '16px 20px',
        borderLeft: project.isActive ? '4px solid #d6a846' : '4px solid transparent',
      }}
    >
      <div>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#9b6d16', fontWeight: 800 }}>
          {project.mode}
          {project.isActive ? ' · live now' : ''}
        </div>
        <h2 style={{ margin: '4px 0 4px', fontSize: 17 }}>{project.title}</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#73695d' }}>
          {project.wordCount.toLocaleString()} words · {project.phase}
          {project.viabilityScore != null ? ` · ${project.viabilityScore}% viability` : ''}
        </p>
      </div>
      <ProjectActions tab={tab} isActive={project.isActive} compact onOpen={onOpen} onComplete={onComplete} onReopen={onReopen} onPublish={onPublish} onWorkshop={onWorkshop} />
    </article>
  );
}

function ProjectActions({
  tab,
  isActive,
  compact,
  onOpen,
  onComplete,
  onReopen,
  onPublish,
  onWorkshop,
  onDelete,
}: {
  tab: ShelfTab;
  isActive: boolean;
  compact?: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onReopen: () => void;
  onPublish: () => void;
  onWorkshop: () => void;
  onDelete?: () => void;
}) {
  if (tab === 'library') {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onReopen} style={compact ? smallGhost : ghostBtn}>
          <BookOpen size={14} /> Reopen
        </button>
        <button type="button" onClick={onPublish} style={compact ? smallPrimary : primaryBtn}>
          <Archive size={14} /> Export
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {!isActive && (
        <button type="button" onClick={onOpen} style={compact ? smallPrimary : primaryBtn}>
          Open
        </button>
      )}
      {isActive && (
        <>
          <button type="button" onClick={onWorkshop} style={compact ? smallGhost : ghostBtn}>
            <Hammer size={14} /> Workshop
          </button>
          <button type="button" onClick={onComplete} style={compact ? smallPrimary : primaryBtn}>
            <CheckCircle2 size={14} /> To library
          </button>
        </>
      )}
      {onDelete && !isActive && (
        <button type="button" onClick={onDelete} style={compact ? smallGhost : ghostBtn}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

const kicker: React.CSSProperties = {
  color: '#9b6d16',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
};

const card: React.CSSProperties = {
  borderRadius: 26,
  padding: 24,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid #eadfce',
  boxShadow: '0 18px 50px rgba(40, 29, 12, 0.06)',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 20,
  letterSpacing: -0.3,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #e2d6c3',
  borderRadius: 14,
  padding: '12px 14px',
  background: '#fffdf8',
  fontSize: 15,
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  borderRadius: 14,
  padding: '12px 18px',
  background: '#d6a846',
  color: '#1d1408',
  fontWeight: 800,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid #d8c9b4',
  borderRadius: 12,
  padding: '10px 14px',
  background: '#fffaf2',
  cursor: 'pointer',
  fontWeight: 700,
  color: '#3d3428',
};

const smallPrimary: React.CSSProperties = { ...primaryBtn, padding: '8px 12px', fontSize: 13 };
const smallGhost: React.CSSProperties = { ...ghostBtn, padding: '8px 12px', fontSize: 13 };
