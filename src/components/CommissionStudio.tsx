/**
 * Kesper Commission Studio — Inbox → Recommendations → Workshop
 * Paste a manuscript, get recommendations, click Write it.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  FileText,
  Hammer,
  Loader,
  PenLine,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import type { Chapter } from '../types';
import type {
  CommissionScope,
  CommissionState,
  Diagnosis,
  Recommendation,
} from '../types/commission';
import { defaultCommissionState, defaultCommissionScope } from '../types/commission';
import {
  briefToProject,
  chaptersFromStorage,
  chaptersToStorage,
  diagnoseManuscript,
  executeCommission,
  ingestManuscript,
} from '../services/commissionService';

export interface ProjectBriefLike {
  title: string;
  mode: string;
  idea: string;
  tone: string;
  output: string;
  audience: string;
}

interface Props {
  brief: ProjectBriefLike;
  draftPage: string;
  onArtefactReady: (text: string) => void;
}

type StudioTab = 'inbox' | 'recommendations' | 'workshop';

const STORAGE_KEY = 'caspa.commission';

function loadState(): CommissionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultCommissionState };
    const parsed = JSON.parse(raw);
    return { ...defaultCommissionState, ...parsed, progress: null, error: null, phase: parsed.chapters?.length ? 'ready' : 'idle' };
  } catch {
    return { ...defaultCommissionState };
  }
}

function saveState(state: CommissionState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      rawInput: state.rawInput,
      chapters: state.chapters,
      diagnosis: state.diagnosis,
      selectedRecommendationIds: state.selectedRecommendationIds,
      scope: state.scope,
      artefact: state.artefact,
    })
  );
}

export default function CommissionStudio({ brief, draftPage, onArtefactReady }: Props) {
  const [tab, setTab] = useState<StudioTab>('inbox');
  const [state, setState] = useState<CommissionState>(loadState);
  const [inboxText, setInboxText] = useState(state.rawInput || draftPage || '');
  const [statusLine, setStatusLine] = useState('');

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (draftPage && !state.rawInput && tab === 'inbox') {
      setInboxText(draftPage);
    }
  }, [draftPage, state.rawInput, tab]);

  const selectedRecs = useMemo(
    () => state.diagnosis?.recommendations.filter((r) => state.selectedRecommendationIds.includes(r.id)) ?? [],
    [state.diagnosis, state.selectedRecommendationIds]
  );

  const update = useCallback((patch: Partial<CommissionState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleIngest = async () => {
    if (!inboxText.trim()) return;

    update({ phase: 'diagnosing', error: null, rawInput: inboxText });
    setStatusLine('Reading your manuscript…');

    try {
      const { chapters, inputType } = await ingestManuscript(inboxText, brief, setStatusLine);
      setStatusLine('Editorial diagnosis in progress…');

      const diagnosis = await diagnoseManuscript(chapters, brief, inputType);
      const defaultSelected = diagnosis.recommendations
        .filter((r) => r.defaultSelected)
        .map((r) => r.id);

      update({
        chapters,
        diagnosis,
        selectedRecommendationIds: defaultSelected,
        phase: 'ready',
        scope: diagnosis.suggestRebuild ? { type: 'whole' } : defaultCommissionScope,
      });

      setTab('recommendations');
      setStatusLine('');
    } catch (err) {
      update({
        phase: 'error',
        error: err instanceof Error ? err.message : 'Diagnosis failed',
      });
      setStatusLine('');
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setInboxText(text);
    };
    reader.readAsText(file);
  };

  const toggleRecommendation = (id: string) => {
    const ids = state.selectedRecommendationIds.includes(id)
      ? state.selectedRecommendationIds.filter((x) => x !== id)
      : [...state.selectedRecommendationIds, id];
    update({ selectedRecommendationIds: ids });
  };

  const handleWriteIt = async () => {
    if (!state.diagnosis || state.chapters.length === 0) return;

    let scope = { ...state.scope };
    if (state.selectedRecommendationIds.includes('rec-rebuild')) {
      scope = { type: 'rebuild' as const };
    }

    update({ phase: 'executing', progress: { phase: 'start', message: 'Commission accepted…', percent: 5 }, error: null });
    setTab('workshop');

    try {
      const result = await executeCommission(
        brief,
        state.chapters,
        state.diagnosis,
        state.selectedRecommendationIds,
        scope,
        (p) => update({ progress: p })
      );

      update({
        chapters: result.chapters,
        artefact: result.artefact,
        phase: 'complete',
        progress: { phase: 'complete', message: 'Done.', percent: 100 },
      });

      onArtefactReady(result.artefact);
    } catch (err) {
      update({
        phase: 'error',
        error: err instanceof Error ? err.message : 'Commission failed',
        progress: null,
      });
    }
  };

  const chapterMax = state.chapters.length || 1;

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <div style={kicker}>Kesper Workshop</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
            Paste. Diagnose. Write it.
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: '#73695d', fontSize: 18, lineHeight: 1.5 }}>
            Drop a crap manuscript. Kesper tells you what&apos;s wrong. You tick what you agree with and click Write it.
          </p>
        </header>

        <nav style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {(
            [
              ['inbox', 'Inbox', Upload],
              ['recommendations', 'Recommendations', AlertCircle],
              ['workshop', 'Workshop', Hammer],
            ] as const
          ).map(([id, label, Icon]) => {
            const active = tab === id;
            const disabled = id === 'recommendations' && !state.diagnosis;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => setTab(id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 18px',
                  borderRadius: 14,
                  border: `1px solid ${active ? '#d6a846' : '#e0d3bf'}`,
                  background: active ? '#fff8ea' : '#fffaf2',
                  color: disabled ? '#b8aa96' : active ? '#5b4724' : '#3b3126',
                  fontWeight: 700,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <Icon size={16} />
                {label}
                {id === 'recommendations' && state.diagnosis && (
                  <span style={{ background: '#d6a846', color: '#1d1408', borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>
                    {state.diagnosis.recommendations.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {tab === 'inbox' && (
          <InboxPanel
            brief={brief}
            inboxText={inboxText}
            setInboxText={setInboxText}
            onIngest={handleIngest}
            onFileUpload={handleFileUpload}
            loading={state.phase === 'diagnosing'}
            statusLine={statusLine}
            error={state.error}
          />
        )}

        {tab === 'recommendations' && state.diagnosis && (
          <RecommendationsPanel
            brief={brief}
            diagnosis={state.diagnosis}
            chapters={state.chapters}
            selectedIds={state.selectedRecommendationIds}
            scope={state.scope}
            onToggle={toggleRecommendation}
            onScopeChange={(scope) => update({ scope })}
            onWriteIt={handleWriteIt}
            executing={state.phase === 'executing'}
            chapterMax={chapterMax}
          />
        )}

        {tab === 'workshop' && (
          <WorkshopPanel
            progress={state.progress}
            artefact={state.artefact}
            chapters={state.chapters}
            phase={state.phase}
            error={state.error}
            onUseArtefact={() => onArtefactReady(state.artefact)}
          />
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </section>
  );
}

function InboxPanel({
  brief,
  inboxText,
  setInboxText,
  onIngest,
  onFileUpload,
  loading,
  statusLine,
  error,
}: {
  brief: ProjectBriefLike;
  inboxText: string;
  setInboxText: (v: string) => void;
  onIngest: () => void;
  onFileUpload: (f: File) => void;
  loading: boolean;
  statusLine: string;
  error: string | null;
}) {
  const wordCount = inboxText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)', gap: 20 }} className="commission-grid">
      <article style={card}>
        <h2 style={sectionTitle}>Drop your manuscript</h2>
        <p style={{ color: '#73695d', marginTop: 0 }}>
          Paste prose, a book plan, a treatment — or upload a .txt / .md file. Kesper will recognise what it is.
        </p>
        <textarea
          value={inboxText}
          onChange={(e) => setInboxText(e.target.value)}
          placeholder="Paste your manuscript or plan here…"
          style={{
            width: '100%',
            minHeight: 420,
            boxSizing: 'border-box',
            border: '1px solid #e2d6c3',
            borderRadius: 16,
            padding: 20,
            fontSize: 16,
            lineHeight: 1.65,
            fontFamily: 'Georgia, Cambria, serif',
            background: '#fffdf8',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={onIngest} disabled={loading || !inboxText.trim()} style={primaryBtn}>
            {loading ? <Loader size={18} className="spin" /> : <Sparkles size={18} />}
            {loading ? 'Analysing…' : 'Analyse manuscript'}
          </button>
          <label style={{ ...ghostBtn, cursor: 'pointer' }}>
            <Upload size={16} /> Upload file
            <input
              type="file"
              accept=".txt,.md,.markdown,text/plain"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0])}
            />
          </label>
          <span style={{ color: '#8a7a66', fontSize: 14 }}>{wordCount.toLocaleString()} words</span>
        </div>
        {statusLine && (
          <p style={{ color: '#9b6d16', marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader size={16} className="spin" /> {statusLine}
          </p>
        )}
        {error && <p style={{ color: '#b91c1c', marginTop: 12 }}>{error}</p>}
      </article>

      <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <article style={card}>
          <h2 style={sectionTitle}>Project</h2>
          <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>{brief.title}</p>
          <p style={{ color: '#73695d', margin: 0, lineHeight: 1.5 }}>{brief.idea}</p>
        </article>
        <article style={card}>
          <h2 style={sectionTitle}>What happens next</h2>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, color: '#4a3b28' }}>
            <li>Kesper recognises plan vs manuscript</li>
            <li>Structured recommendations — not a wall of text</li>
            <li>You pick scope and click Write it</li>
            <li>Finished prose lands in Workshop</li>
          </ol>
        </article>
      </aside>
      <style>{`@media (max-width: 900px) { .commission-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function RecommendationsPanel({
  brief,
  diagnosis,
  chapters,
  selectedIds,
  scope,
  onToggle,
  onScopeChange,
  onWriteIt,
  executing,
  chapterMax,
}: {
  brief: ProjectBriefLike;
  diagnosis: Diagnosis;
  chapters: Chapter[];
  selectedIds: string[];
  scope: CommissionScope;
  onToggle: (id: string) => void;
  onScopeChange: (s: CommissionScope) => void;
  onWriteIt: () => void;
  executing: boolean;
  chapterMax: number;
}) {
  const viabilityColor =
    diagnosis.viabilityScore >= 70 ? '#15803d' : diagnosis.viabilityScore >= 40 ? '#b45309' : '#b91c1c';

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <article style={{ ...card, borderLeft: `4px solid ${viabilityColor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={kicker}>Verdict</div>
            <p style={{ fontSize: 22, lineHeight: 1.45, margin: '8px 0', maxWidth: 800 }}>{diagnosis.verdict}</p>
          </div>
          <div style={{ textAlign: 'center', minWidth: 100 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: viabilityColor }}>{diagnosis.viabilityScore}%</div>
            <div style={{ fontSize: 12, color: '#8a7a66', textTransform: 'uppercase', letterSpacing: 1 }}>Viability</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 14, color: '#6f6252' }}>
          <span><BookOpen size={14} style={{ verticalAlign: -2 }} /> {diagnosis.chapterCount} chapters</span>
          <span><FileText size={14} style={{ verticalAlign: -2 }} /> {diagnosis.wordCount.toLocaleString()} words</span>
          <span>Type: {diagnosis.inputType}</span>
        </div>
      </article>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, 0.8fr)', gap: 20 }} className="commission-grid">
        <article style={card}>
          <h2 style={sectionTitle}>Recommendations</h2>
          <p style={{ color: '#73695d', marginTop: 0 }}>Tick what you agree with. Kesper executes only approved fixes.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {diagnosis.recommendations.map((rec) => (
              <RecommendationRow
                key={rec.id}
                rec={rec}
                selected={selectedIds.includes(rec.id)}
                onToggle={() => onToggle(rec.id)}
              />
            ))}
          </div>
        </article>

        <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <article style={card}>
            <h2 style={sectionTitle}>Scope</h2>
            <ScopePicker scope={scope} chapterMax={chapterMax} onChange={onScopeChange} />
          </article>

          <button type="button" onClick={onWriteIt} disabled={executing || selectedIds.length === 0} style={primaryBtn}>
            {executing ? <Loader size={20} className="spin" /> : <Wand2 size={20} />}
            {executing ? 'Writing…' : 'Write it'}
          </button>

          {diagnosis.suggestRebuild && (
            <p style={{ fontSize: 13, color: '#b45309', margin: 0, lineHeight: 1.5 }}>
              Kesper thinks this needs a full restructure. Tick &quot;Rip up and rebuild&quot; if you agree.
            </p>
          )}
        </aside>
      </div>

      {diagnosis.editorNotes && (
        <article style={card}>
          <h2 style={sectionTitle}>Editor notes</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, lineHeight: 1.6, color: '#4a3b28' }}>
            {diagnosis.editorNotes}
          </pre>
        </article>
      )}
    </div>
  );
}

function RecommendationRow({
  rec,
  selected,
  onToggle,
}: {
  rec: Recommendation;
  selected: boolean;
  onToggle: () => void;
}) {
  const severityColor = {
    critical: '#fecaca',
    major: '#fde68a',
    minor: '#e5e7eb',
  }[rec.severity];

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        gap: 12,
        textAlign: 'left',
        width: '100%',
        padding: 14,
        borderRadius: 14,
        border: `2px solid ${selected ? '#d6a846' : '#eadfce'}`,
        background: selected ? '#fff8ea' : '#fffdf8',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `2px solid ${selected ? '#d6a846' : '#d8c9b4'}`,
          background: selected ? '#d6a846' : 'transparent',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {selected && <Check size={14} color="#1d1408" />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15 }}>{rec.title}</strong>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: severityColor, textTransform: 'uppercase' }}>
            {rec.severity}
          </span>
        </div>
        <p style={{ margin: '6px 0 0', color: '#6f6252', lineHeight: 1.5, fontSize: 14 }}>{rec.detail}</p>
      </div>
    </button>
  );
}

function ScopePicker({
  scope,
  chapterMax,
  onChange,
}: {
  scope: CommissionScope;
  chapterMax: number;
  onChange: (s: CommissionScope) => void;
}) {
  const options: { type: CommissionScope['type']; label: string; detail: string }[] = [
    { type: 'whole', label: 'Whole manuscript', detail: 'Improve all chapters that need work' },
    { type: 'chapters', label: 'Chapter range', detail: 'Rewrite a run of chapters' },
    { type: 'single', label: 'Single chapter', detail: 'One chapter only' },
    { type: 'autowrite', label: 'Auto-write all', detail: 'From plan or direction — draft everything' },
    { type: 'rebuild', label: 'Rip up & rebuild', detail: 'Liquidate structure, start fresh' },
  ];

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {options.map((opt) => {
        const active = scope.type === opt.type;
        return (
          <button
            key={opt.type}
            type="button"
            onClick={() =>
              onChange({
                type: opt.type,
                chapterFrom: 1,
                chapterTo: chapterMax,
                singleChapter: 1,
              })
            }
            style={{
              textAlign: 'left',
              padding: 12,
              borderRadius: 12,
              border: `1px solid ${active ? '#d6a846' : '#eadfce'}`,
              background: active ? '#fff8ea' : '#fffdf8',
              cursor: 'pointer',
            }}
          >
            <strong style={{ display: 'block', fontSize: 14 }}>{opt.label}</strong>
            <small style={{ color: '#8a7a66' }}>{opt.detail}</small>
          </button>
        );
      })}

      {scope.type === 'chapters' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <label style={{ fontSize: 13 }}>
            From{' '}
            <input
              type="number"
              min={1}
              max={chapterMax}
              value={scope.chapterFrom ?? 1}
              onChange={(e) => onChange({ ...scope, chapterFrom: Number(e.target.value) })}
              style={numInput}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            To{' '}
            <input
              type="number"
              min={1}
              max={chapterMax}
              value={scope.chapterTo ?? chapterMax}
              onChange={(e) => onChange({ ...scope, chapterTo: Number(e.target.value) })}
              style={numInput}
            />
          </label>
        </div>
      )}

      {scope.type === 'single' && (
        <label style={{ fontSize: 13, marginTop: 4 }}>
          Chapter{' '}
          <input
            type="number"
            min={1}
            max={chapterMax}
            value={scope.singleChapter ?? 1}
            onChange={(e) => onChange({ ...scope, singleChapter: Number(e.target.value) })}
            style={numInput}
          />
        </label>
      )}
    </div>
  );
}

function WorkshopPanel({
  progress,
  artefact,
  chapters,
  phase,
  error,
  onUseArtefact,
}: {
  progress: CommissionState['progress'];
  artefact: string;
  chapters: Chapter[];
  phase: CommissionState['phase'];
  error: string | null;
  onUseArtefact: () => void;
}) {
  const totalWords = chapters.reduce(
    (sum, c) => sum + (c.content?.split(/\s+/).filter(Boolean).length || 0),
    0
  );

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {progress && phase === 'executing' && (
        <article style={card}>
          <h2 style={sectionTitle}>Commission in progress</h2>
          <div style={{ background: '#eadfce', borderRadius: 999, height: 10, overflow: 'hidden', marginBottom: 12 }}>
            <div
              style={{
                width: `${progress.percent}%`,
                height: '100%',
                background: '#d6a846',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#5b4724' }}>
            <Loader size={18} className="spin" /> {progress.message}
          </p>
        </article>
      )}

      {error && (
        <article style={{ ...card, borderColor: '#fecaca' }}>
          <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
        </article>
      )}

      {phase === 'complete' && artefact && (
        <>
          <article style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ ...sectionTitle, margin: 0 }}>Your manuscript</h2>
                <p style={{ color: '#73695d', margin: '8px 0 0' }}>
                  {chapters.length} chapters · {totalWords.toLocaleString()} words
                </p>
              </div>
              <button type="button" onClick={onUseArtefact} style={{ ...primaryBtn, width: 'auto' }}>
                <PenLine size={18} /> Open in White Page
              </button>
            </div>
          </article>

          <article style={card}>
            <textarea
              readOnly
              value={artefact}
              style={{
                width: '100%',
                minHeight: '60vh',
                boxSizing: 'border-box',
                border: '1px solid #e2d6c3',
                borderRadius: 16,
                padding: 24,
                fontSize: 17,
                lineHeight: 1.75,
                fontFamily: 'Georgia, Cambria, serif',
                background: '#fffdf8',
              }}
            />
          </article>
        </>
      )}

      {phase !== 'complete' && !progress && (
        <article style={card}>
          <p style={{ color: '#73695d', margin: 0 }}>
            Commissions appear here with live progress. Analyse a manuscript and click Write it to start.
          </p>
        </article>
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

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  border: 'none',
  borderRadius: 16,
  padding: '14px 20px',
  background: '#d6a846',
  color: '#1d1408',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 15,
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderRadius: 14,
  border: '1px solid #d8c9b4',
  background: '#fffaf2',
  color: '#3b3126',
  fontWeight: 600,
  fontSize: 14,
};

const numInput: React.CSSProperties = {
  width: 56,
  marginLeft: 4,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #e2d6c3',
};

export { chaptersFromStorage, chaptersToStorage };
