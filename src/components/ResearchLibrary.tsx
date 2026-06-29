/**
 * Caspa Research Library — independent deep research, stored per project
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Globe,
  Loader,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wind,
} from 'lucide-react';
import type { ProjectBriefLike } from '../services/commissionService';
import {
  addNote,
  deepResearchTopic,
  getProjectKey,
  loadLibrary,
  removeNote,
  searchLibrary,
  suggestResearchTopics,
  type StoredResearchNote,
} from '../services/researchLibraryService';

interface Props {
  brief: ProjectBriefLike;
  manuscriptText?: string;
}

export default function ResearchLibrary({ brief, manuscriptText = '' }: Props) {
  const projectKey = getProjectKey(brief);
  const [notes, setNotes] = useState<StoredResearchNote[]>(() => loadLibrary(projectKey));
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTopic, setLoadingTopic] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setNotes(loadLibrary(projectKey));
  }, [projectKey]);

  const filtered = useMemo(() => searchLibrary(notes, query), [notes, query]);

  const refreshSuggestions = useCallback(async () => {
    const text = manuscriptText || brief.idea;
    if (!text.trim()) return;
    setStatus('Scanning for research gaps…');
    try {
      const topics = await suggestResearchTopics(brief, text);
      setSuggested(topics);
      setStatus('');
    } catch {
      setStatus('');
    }
  }, [brief, manuscriptText]);

  useEffect(() => {
    refreshSuggestions();
  }, [refreshSuggestions]);

  const runDeepResearch = async (researchTopic: string) => {
    if (!researchTopic.trim()) return;
    setLoading(true);
    setLoadingTopic(researchTopic);
    setStatus(`Deep research: ${researchTopic}`);

    try {
      const note = await deepResearchTopic(researchTopic, brief, manuscriptText.slice(0, 8000));
      const next = addNote(projectKey, note);
      setNotes(next);
      setTopic('');
      setSuggested((prev) => prev.filter((t) => t !== researchTopic));
      setStatus('Research note saved to library.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setLoading(false);
      setLoadingTopic(null);
    }
  };

  const handleDelete = (id: string) => {
    setNotes(removeNote(projectKey, id));
  };

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <div style={kicker}>Research Library</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
            Facts that don&apos;t lie
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: '#73695d', fontSize: 18, lineHeight: 1.5 }}>
            Research places, smells, road names, and niche knowledge. Notes are injected into every Caspa draft for
            this project.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 0.85fr)', gap: 20 }} className="research-grid">
          <div style={{ display: 'grid', gap: 16 }}>
            <article style={card}>
              <h2 style={sectionTitle}>Commission research</h2>
              <p style={{ color: '#73695d', marginTop: 0, lineHeight: 1.5 }}>
                Example: &quot;Edinburgh Old Town street names and smells, 1880s&quot; or &quot;Milton Keynes theatre
                district layout&quot;
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What should Caspa research?"
                  style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                  onKeyDown={(e) => e.key === 'Enter' && runDeepResearch(topic)}
                />
                <button type="button" onClick={() => runDeepResearch(topic)} disabled={loading || !topic.trim()} style={primaryBtn}>
                  {loading && loadingTopic === topic ? <Loader size={18} className="spin" /> : <Globe size={18} />}
                  Deep search
                </button>
              </div>
              {status && (
                <p style={{ marginTop: 12, color: '#9b6d16', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {loading && <Loader size={14} className="spin" />}
                  {status}
                </p>
              )}
            </article>

            <article style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ ...sectionTitle, margin: 0 }}>Library ({filtered.length})</h2>
                <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a7a66' }} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter notes…"
                    style={{ ...inputStyle, paddingLeft: 36 }}
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <p style={{ color: '#8a7a66', marginTop: 16 }}>No research notes yet. Commission a deep search above.</p>
              ) : (
                <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                  {filtered.map((note) => (
                    <ResearchNoteCard key={note.id} note={note} onDelete={() => handleDelete(note.id)} />
                  ))}
                </div>
              )}
            </article>
          </div>

          <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <article style={card}>
              <h2 style={sectionTitle}>Project</h2>
              <p style={{ fontWeight: 700, margin: '0 0 6px' }}>{brief.title}</p>
              <p style={{ color: '#73695d', margin: 0, lineHeight: 1.5, fontSize: 14 }}>{brief.idea}</p>
            </article>

            <article style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ ...sectionTitle, margin: 0 }}>Suggested topics</h2>
                <button type="button" onClick={refreshSuggestions} style={ghostBtn}>
                  <Sparkles size={14} /> Scan
                </button>
              </div>
              {suggested.length === 0 ? (
                <p style={{ color: '#8a7a66', fontSize: 14, margin: 0 }}>Paste a manuscript in Workshop to auto-detect gaps.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {suggested.map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={loading}
                      onClick={() => runDeepResearch(t)}
                      style={{
                        textAlign: 'left',
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid #eadfce',
                        background: '#fffdf8',
                        cursor: loading ? 'wait' : 'pointer',
                        fontSize: 13,
                        lineHeight: 1.45,
                      }}
                    >
                      <Plus size={14} style={{ verticalAlign: -2, marginRight: 6, color: '#9b6d16' }} />
                      {loadingTopic === t ? 'Researching…' : t}
                    </button>
                  ))}
                </div>
              )}
            </article>

            <article style={card}>
              <h2 style={sectionTitle}>Draft injection</h2>
              <p style={{ color: '#73695d', fontSize: 14, lineHeight: 1.55, margin: 0 }}>
                {notes.length} note{notes.length !== 1 ? 's' : ''} will be matched to each chapter during Workshop
                commissions. Verified geography and sensory detail are prioritised.
              </p>
            </article>
          </aside>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; } @media (max-width: 900px) { .research-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

function ResearchNoteCard({ note, onDelete }: { note: StoredResearchNote; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const statusColor = {
    verified: '#15803d',
    unverified: '#b45309',
    contradicted: '#b91c1c',
  }[note.verificationStatus || 'unverified'];

  return (
    <div style={{ border: '1px solid #eadfce', borderRadius: 16, background: '#fffdf8', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: 14,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <BookOpen size={16} color="#9b6d16" />
              <strong style={{ fontSize: 15 }}>{note.title}</strong>
              {note.isDeepResearch && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#dbeafe', color: '#1e40af' }}>
                  DEEP
                </span>
              )}
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#f3f4f6', color: statusColor }}>
                {note.verificationStatus || 'unverified'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#8a7a66', marginTop: 4 }}>
              {note.category} · {note.tags.slice(0, 3).join(', ')}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#b91c1c', padding: 4 }}
            aria-label="Delete note"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #f0e6d4' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, margin: '12px 0' }}>
            {note.content}
          </pre>
          {note.sensoryDetails && (
            <div style={{ display: 'grid', gap: 8, fontSize: 13, color: '#5b4724' }}>
              {(['visuals', 'smells', 'sounds', 'textures'] as const).map((key) => {
                const items = note.sensoryDetails?.[key];
                if (!items?.length) return null;
                return (
                  <div key={key}>
                    <Wind size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                    <strong>{key}:</strong> {items.join('; ')}
                  </div>
                );
              })}
            </div>
          )}
          {note.sources?.length ? (
            <p style={{ fontSize: 12, color: '#8a7a66', marginTop: 12 }}>
              <strong>Sources:</strong> {note.sources.join(' · ')}
            </p>
          ) : null}
          {note.verificationNotes && (
            <p style={{ fontSize: 12, color: '#b45309', marginTop: 8 }}>{note.verificationNotes}</p>
          )}
        </div>
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
  whiteSpace: 'nowrap',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid #d8c9b4',
  borderRadius: 10,
  padding: '8px 12px',
  background: '#fffaf2',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};
