/**
 * Caspa Project Shelf — Library view over local project storage
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Brain,
  FileText,
  Hammer,
  Loader,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import type { ProjectBriefLike } from '../services/commissionService';
import {
  loadShelf,
  recordProjectSnapshot,
  type ShelfProject,
} from '../services/projectShelfService';

interface Props {
  brief: ProjectBriefLike;
  onOpenWorkshop: () => void;
  onOpenPublish: () => void;
}

export default function ProjectShelf({ brief, onOpenWorkshop, onOpenPublish }: Props) {
  const [projects, setProjects] = useState<ShelfProject[]>(() => loadShelf());
  const [query, setQuery] = useState('');
  const [doctorStatus, setDoctorStatus] = useState<string | null>(null);
  const [checkingDoctor, setCheckingDoctor] = useState(false);

  const refresh = useCallback(() => {
    recordProjectSnapshot(brief);
    setProjects(loadShelf());
  }, [brief]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.mode.toLowerCase().includes(q) ||
        p.idea.toLowerCase().includes(q)
    );
  }, [projects, query]);

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

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <div style={kicker}>Library</div>
            <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
              Projects & shelves
            </h1>
            <p style={{ margin: 0, maxWidth: 640, color: '#73695d', fontSize: 17, lineHeight: 1.5 }}>
              Everything Caspa knows about your work — commissions, research, promises, and drafts — lives here on this device.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={refresh} style={ghostBtn}>
              <RefreshCw size={16} /> Refresh
            </button>
            <button type="button" onClick={checkDoctor} disabled={checkingDoctor} style={ghostBtn}>
              {checkingDoctor ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
              Engine check
            </button>
          </div>
        </div>

        {doctorStatus && (
          <div style={{ ...card, marginBottom: 20, padding: '14px 18px', fontSize: 14, color: '#5c5146' }}>
            {doctorStatus}
          </div>
        )}

        <div style={{ position: 'relative', maxWidth: 420, marginBottom: 24 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#8b806f' }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            style={{ ...inputStyle, paddingLeft: 42 }}
          />
        </div>

        {filtered.length === 0 ? (
          <article style={card}>
            <BookOpen size={40} style={{ color: '#d6a846', marginBottom: 12 }} />
            <h2 style={sectionTitle}>No projects yet</h2>
            <p style={{ color: '#73695d', lineHeight: 1.6 }}>
              Start in Launchpad or paste a manuscript in Workshop. Caspa will index it here automatically.
            </p>
            <button type="button" onClick={onOpenWorkshop} style={{ ...primaryBtn, marginTop: 16 }}>
              <Hammer size={18} /> Open Workshop
            </button>
          </article>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {filtered.map((proj) => (
              <ProjectCard
                key={proj.key}
                project={proj}
                onOpenWorkshop={onOpenWorkshop}
                onOpenPublish={onOpenPublish}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  onOpenWorkshop,
  onOpenPublish,
}: {
  project: ShelfProject;
  onOpenWorkshop: () => void;
  onOpenPublish: () => void;
}) {
  return (
    <article style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#9b6d16', fontWeight: 800 }}>
            {project.mode}
            {project.isActive ? ' · active' : ''}
          </div>
          <h2 style={{ ...sectionTitle, margin: '4px 0 6px', fontSize: 18 }}>{project.title}</h2>
        </div>
        {project.viabilityScore != null && (
          <div
            style={{
              borderRadius: 12,
              padding: '6px 10px',
              background: project.viabilityScore >= 60 ? '#ecfdf5' : '#fff7ed',
              color: project.viabilityScore >= 60 ? '#047857' : '#b45309',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {project.viabilityScore}%
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 14, color: '#73695d', lineHeight: 1.5, flex: 1 }}>
        {project.idea.slice(0, 140)}
        {project.idea.length > 140 ? '…' : ''}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#5c5146' }}>
        <Stat icon={FileText} label="Words" value={project.wordCount.toLocaleString()} />
        <Stat icon={BookOpen} label="Chapters" value={String(project.chapterCount)} />
        <Stat icon={Search} label="Research" value={String(project.researchCount)} />
        <Stat icon={Brain} label="Psychology" value={project.hasPsychology ? 'Yes' : '—'} />
      </div>

      <div style={{ fontSize: 12, color: '#8a7a66' }}>
        Phase: <strong>{project.phase}</strong>
        {project.promiseCount > 0 && <> · {project.promiseCount} promise{project.promiseCount !== 1 ? 's' : ''}</>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onOpenWorkshop} style={{ ...primaryBtn, flex: 1, justifyContent: 'center' }}>
          <Hammer size={16} /> Workshop
        </button>
        <button type="button" onClick={onOpenPublish} style={{ ...ghostBtn, flex: 1, justifyContent: 'center' }}>
          Export
        </button>
      </div>
    </article>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon size={14} />
      <span>
        {label}: <strong>{value}</strong>
      </span>
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
