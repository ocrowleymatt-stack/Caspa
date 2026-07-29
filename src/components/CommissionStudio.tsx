/**
 * Caspa Commission Studio — Inbox → Recommendations → Workshop
 * Paste a manuscript, get recommendations, click Write it.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  FileText,
  Hammer,
  Link2,
  Loader,
  PenLine,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import type { StoryPromise } from '../types/promise';
import { computePromiseHealth } from '../types/promise';
import type { Chapter } from '../types';
import type {
  CommissionScope,
  CommissionState,
  Diagnosis,
  Recommendation,
} from '../types/commission';
import { defaultCommissionState, defaultCommissionScope } from '../types/commission';
import {
  diagnoseManuscript,
  executeCommission,
  ingestManuscript,
} from '../services/commissionService';
import {
  addNote,
  deepResearchTopic,
  getProjectKey,
  loadLibrary,
  suggestResearchTopics,
} from '../services/researchLibraryService';
import {
  extractPromises,
  savePromises,
  openPromiseWarnings,
} from '../services/promiseRegistryService';

export interface ProjectBriefLike {
  title: string;
  mode: string;
  idea: string;
  tone: string;
  output: string;
  audience: string;
}

export type StudioTab = 'inbox' | 'recommendations' | 'promises' | 'workshop';

interface Props {
  brief: ProjectBriefLike;
  draftPage: string;
  onArtefactReady: (text: string) => void;
  onManuscriptChange?: (text: string) => void;
  onBriefChange?: (patch: Partial<ProjectBriefLike>) => void;
  /** Deep-link from Full path / Next step — Diagnose vs Commission land on different tabs. */
  initialTab?: StudioTab;
  /** Open / select a chapter from diagnosis summaries or scope. */
  focusChapter?: number | null;
  onDeepLinkConsumed?: () => void;
}

const STORAGE_KEY = 'caspa.commission';
const TAB_KEY = 'caspa.commission.tab';

function loadState(): CommissionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultCommissionState };
    const parsed = JSON.parse(raw);
    const hasChapters = Boolean(parsed.chapters?.length);
    const hasArtefact = Boolean(parsed.artefact?.trim());
    return {
      ...defaultCommissionState,
      ...parsed,
      progress: null,
      error: null,
      phase: hasArtefact ? 'complete' : hasChapters ? 'ready' : 'idle',
    };
  } catch {
    return { ...defaultCommissionState };
  }
}

function resolveInitialTab(
  requested: StudioTab | undefined,
  state: CommissionState
): StudioTab {
  const hasDiagnosis = Boolean(state.diagnosis);
  if (requested === 'workshop' && (state.artefact || state.phase === 'complete' || state.phase === 'executing')) {
    return 'workshop';
  }
  if (requested === 'recommendations' || requested === 'promises') {
    return hasDiagnosis ? requested : 'inbox';
  }
  if (requested === 'inbox') return 'inbox';
  if (state.phase === 'complete' && state.artefact) return 'workshop';
  if (hasDiagnosis) return 'recommendations';
  try {
    const saved = localStorage.getItem(TAB_KEY) as StudioTab | null;
    if (saved === 'workshop' && state.artefact) return 'workshop';
    if ((saved === 'recommendations' || saved === 'promises') && hasDiagnosis) return saved;
    if (saved === 'inbox') return 'inbox';
  } catch {
    /* ignore */
  }
  return 'inbox';
}

function saveState(state: CommissionState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      rawInput: state.rawInput,
      chapters: state.chapters,
      diagnosis: state.diagnosis,
      promises: state.promises,
      selectedRecommendationIds: state.selectedRecommendationIds,
      scope: state.scope,
      artefact: state.artefact,
    })
  );
}

export default function CommissionStudio({
  brief,
  draftPage,
  onArtefactReady,
  onManuscriptChange,
  onBriefChange,
  initialTab,
  focusChapter = null,
  onDeepLinkConsumed,
}: Props) {
  const projectKey = getProjectKey(brief);
  const [state, setState] = useState<CommissionState>(loadState);
  const [tab, setTab] = useState<StudioTab>(() => resolveInitialTab(initialTab, loadState()));
  const [visitChapter, setVisitChapter] = useState<number | null>(focusChapter ?? null);
  const [inboxText, setInboxText] = useState(() => {
    const fromJam = localStorage.getItem('caspa.manuscriptSource');
    return state.rawInput || fromJam || draftPage || '';
  });
  const [statusLine, setStatusLine] = useState('');
  const [suggestedResearch, setSuggestedResearch] = useState<string[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [autoResearch, setAutoResearch] = useState(true);
  const [libraryCount, setLibraryCount] = useState(() => loadLibrary(projectKey).length);
  const [directedIdea, setDirectedIdea] = useState(brief.idea || '');
  const [ideaDirty, setIdeaDirty] = useState(false);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [ideaStatus, setIdeaStatus] = useState('');

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  useEffect(() => {
    // Keep local direction in sync when parent brief changes and user hasn't edited yet.
    if (!ideaDirty) setDirectedIdea(brief.idea || '');
  }, [brief.idea, ideaDirty]);

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

  const visitChapterSummary = useCallback(
    (order: number) => {
      setVisitChapter(order);
      update({
        scope: { type: 'single', singleChapter: order, chapterFrom: order, chapterTo: order },
      });
      if (state.diagnosis) setTab('recommendations');
    },
    [state.diagnosis, update]
  );

  // Honour Full path deep-links whenever parent asks to visit diagnose / commission.
  useEffect(() => {
    if (!initialTab && focusChapter == null) return;
    const next = resolveInitialTab(initialTab, state);
    setTab(next);
    if (focusChapter != null && focusChapter > 0) {
      setVisitChapter(focusChapter);
      if (state.diagnosis) {
        update({
          scope: { type: 'single', singleChapter: focusChapter, chapterFrom: focusChapter, chapterTo: focusChapter },
        });
      }
    }
    onDeepLinkConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link keys only
  }, [initialTab, focusChapter]);

  const applyDirectedIdea = useCallback(
    (nextIdea: string) => {
      const idea = nextIdea.trim();
      if (!idea) return false;
      setDirectedIdea(idea);
      setIdeaDirty(false);
      onBriefChange?.({ idea });
      setIdeaStatus('Idea applied to the project brief.');
      try {
        const raw = localStorage.getItem('caspa.plotHold');
        if (raw) {
          const hold = JSON.parse(raw);
          hold.premise = idea;
          hold.updatedAt = new Date().toISOString();
          localStorage.setItem('caspa.plotHold', JSON.stringify(hold));
        }
      } catch {
        /* plot hold optional */
      }
      return true;
    },
    [onBriefChange]
  );

  const handleIngest = async () => {
    if (!inboxText.trim()) return;

    update({ phase: 'diagnosing', error: null, rawInput: inboxText });
    setStatusLine('Reading your manuscript…');

    try {
      const { chapters, inputType } = await ingestManuscript(inboxText, brief, setStatusLine);
      setStatusLine('Editorial diagnosis in progress…');

      const diagnosis = await diagnoseManuscript(chapters, brief, inputType);
      setStatusLine('Tracking story promises…');

      let promises: StoryPromise[] = [];
      try {
        promises = await extractPromises(chapters, brief);
        savePromises(projectKey, promises);
      } catch {
        promises = [];
      }

      const defaultSelected = diagnosis.recommendations
        .filter((r) => r.defaultSelected)
        .map((r) => r.id);

      update({
        chapters,
        diagnosis,
        promises,
        selectedRecommendationIds: defaultSelected,
        phase: 'ready',
        scope: diagnosis.suggestRebuild ? { type: 'whole' } : defaultCommissionScope,
      });

      onManuscriptChange?.(inboxText);
      setLibraryCount(loadLibrary(projectKey).length);

      try {
        const topics = await suggestResearchTopics(brief, inboxText);
        setSuggestedResearch(topics.slice(0, 6));
      } catch {
        setSuggestedResearch([]);
      }

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

  const handleResearchTopic = async (topic: string) => {
    setResearchLoading(true);
    try {
      const note = await deepResearchTopic(topic, brief, inboxText.slice(0, 8000));
      addNote(projectKey, note);
      setLibraryCount(loadLibrary(projectKey).length);
      setSuggestedResearch((prev) => prev.filter((t) => t !== topic));
    } finally {
      setResearchLoading(false);
    }
  };

  const handleSuggestIdea = async () => {
    const seed = directedIdea.trim() || brief.idea || inboxText.slice(0, 2000);
    if (!seed.trim()) {
      setIdeaStatus('Add a rough idea first, then ask Caspa to sharpen it.');
      return;
    }
    setIdeaBusy(true);
    setIdeaStatus('Sharpening the book idea…');
    try {
      const res = await fetch('/api/caspa/write/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed, mode: brief.mode || 'novel' }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data?.premise) {
        setDirectedIdea(String(json.data.premise));
        setIdeaDirty(true);
        setIdeaStatus(
          json.data.title
            ? `Suggested direction (from seed expansion). Review, then Apply. Working title hint: ${json.data.title}`
            : 'Suggested direction ready. Review, then Apply.'
        );
        return;
      }

      const aiRes = await fetch('/api/ai/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are Caspa directing a book idea before drafting.

MODE: ${brief.mode}
CURRENT IDEA / PREMISE:
${seed}

Return ONLY a revised premise in 2–5 sentences: clearer wound/desire (or thesis for nonfiction), concrete place/pressure, and the dramatic or intellectual engine. No title. No bullet list. No preamble.`,
          maxTokens: 600,
        }),
      });
      const aiJson = await aiRes.json();
      if (!aiRes.ok || !aiJson.result) throw new Error(aiJson.message || json.message || 'Idea direction failed');
      setDirectedIdea(String(aiJson.result).trim());
      setIdeaDirty(true);
      setIdeaStatus('Suggested direction ready. Review, then Apply.');
    } catch (err) {
      setIdeaStatus(err instanceof Error ? err.message : 'Could not suggest a direction');
    } finally {
      setIdeaBusy(false);
    }
  };

  const handleWriteIt = async () => {
    if (!state.diagnosis || state.chapters.length === 0) return;

    const nextIdea = directedIdea.trim() || brief.idea;
    const writeBrief = { ...brief, idea: nextIdea };
    if (nextIdea && nextIdea !== brief.idea) {
      applyDirectedIdea(nextIdea);
    }

    let scope = { ...state.scope };
    if (state.selectedRecommendationIds.includes('rec-rebuild')) {
      scope = { type: 'rebuild' as const };
    }

    update({ phase: 'executing', progress: { phase: 'start', message: 'Commission accepted…', percent: 5 }, error: null });
    setTab('workshop');

    try {
      const result = await executeCommission(
        writeBrief,
        state.chapters,
        state.diagnosis,
        state.selectedRecommendationIds,
        scope,
        (p) => update({ progress: p }),
        { autoResearch, promises: state.promises }
      );

      update({
        chapters: result.chapters,
        artefact: result.artefact,
        promises: result.promises,
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
  const promiseHealth = useMemo(() => computePromiseHealth(state.promises), [state.promises]);

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <div style={kicker}>Caspa Workshop</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
            Paste. Direct the idea. Write it.
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: '#73695d', fontSize: 18, lineHeight: 1.5 }}>
            Drop a manuscript. Steer the premise before you commit. Tick what you agree with, then Write it.
          </p>
        </header>

        <nav style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {(
            [
              ['inbox', 'Inbox', Upload],
              ['recommendations', 'Recommendations', AlertCircle],
              ['promises', 'Promises', Link2],
              ['workshop', 'Workshop', Hammer],
            ] as const
          ).map(([id, label, Icon]) => {
            const active = tab === id;
            const disabled =
              (id === 'recommendations' || id === 'promises') && !state.diagnosis;
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
                {id === 'promises' && state.promises.length > 0 && (
                  <span
                    style={{
                      background: promiseHealth.broken > 0 ? '#fecaca' : '#d6a846',
                      color: '#1d1408',
                      borderRadius: 999,
                      padding: '2px 8px',
                      fontSize: 11,
                    }}
                  >
                    {promiseHealth.open} open
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {tab === 'inbox' && (
          <InboxPanel
            brief={brief}
            directedIdea={directedIdea}
            onDirectedIdeaChange={(value) => {
              setDirectedIdea(value);
              setIdeaDirty(true);
              setIdeaStatus('');
            }}
            onApplyIdea={() => applyDirectedIdea(directedIdea)}
            onSuggestIdea={handleSuggestIdea}
            ideaBusy={ideaBusy}
            ideaDirty={ideaDirty}
            ideaStatus={ideaStatus}
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
            diagnosis={state.diagnosis}
            chapters={state.chapters}
            selectedIds={state.selectedRecommendationIds}
            scope={state.scope}
            visitChapter={visitChapter}
            onVisitChapter={visitChapterSummary}
            onToggle={toggleRecommendation}
            onScopeChange={(scope) => update({ scope })}
            onWriteIt={handleWriteIt}
            executing={state.phase === 'executing'}
            chapterMax={chapterMax}
            suggestedResearch={suggestedResearch}
            onResearchTopic={handleResearchTopic}
            researchLoading={researchLoading}
            libraryCount={libraryCount}
            autoResearch={autoResearch}
            onAutoResearchChange={setAutoResearch}
            directedIdea={directedIdea}
            onDirectedIdeaChange={(value) => {
              setDirectedIdea(value);
              setIdeaDirty(true);
              setIdeaStatus('');
            }}
            onApplyIdea={() => applyDirectedIdea(directedIdea)}
            onSuggestIdea={handleSuggestIdea}
            ideaBusy={ideaBusy}
            ideaDirty={ideaDirty}
            ideaStatus={ideaStatus}
          />
        )}

        {tab === 'promises' && state.diagnosis && (
          <PromisesPanel promises={state.promises} health={promiseHealth} />
        )}

        {tab === 'workshop' && (
          <WorkshopPanel
            progress={state.progress}
            artefact={state.artefact}
            chapters={state.chapters}
            phase={state.phase}
            error={state.error}
            promises={state.promises}
            visitChapter={visitChapter}
            onVisitChapter={setVisitChapter}
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
  directedIdea,
  onDirectedIdeaChange,
  onApplyIdea,
  onSuggestIdea,
  ideaBusy,
  ideaDirty,
  ideaStatus,
  inboxText,
  setInboxText,
  onIngest,
  onFileUpload,
  loading,
  statusLine,
  error,
}: {
  brief: ProjectBriefLike;
  directedIdea: string;
  onDirectedIdeaChange: (v: string) => void;
  onApplyIdea: () => void;
  onSuggestIdea: () => void;
  ideaBusy: boolean;
  ideaDirty: boolean;
  ideaStatus: string;
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
          Paste prose, a book plan, a treatment — or upload a .txt / .md file. Caspa will recognise what it is.
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
          <p style={{ fontWeight: 700, fontSize: 18, margin: '0 0 12px' }}>{brief.title}</p>
          <IdeaDirectionCard
            directedIdea={directedIdea}
            onDirectedIdeaChange={onDirectedIdeaChange}
            onApplyIdea={onApplyIdea}
            onSuggestIdea={onSuggestIdea}
            ideaBusy={ideaBusy}
            ideaDirty={ideaDirty}
            ideaStatus={ideaStatus}
            compact
          />
        </article>
        <article style={card}>
          <h2 style={sectionTitle}>What happens next</h2>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, color: '#4a3b28' }}>
            <li>Direct or sharpen the book idea</li>
            <li>Caspa recognises plan vs manuscript</li>
            <li>You pick fixes and scope, then Write it</li>
            <li>Finished prose lands in Workshop</li>
          </ol>
        </article>
      </aside>
      <style>{`@media (max-width: 900px) { .commission-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function RecommendationsPanel({
  diagnosis,
  chapters,
  selectedIds,
  scope,
  visitChapter,
  onVisitChapter,
  onToggle,
  onScopeChange,
  onWriteIt,
  executing,
  chapterMax,
  suggestedResearch,
  onResearchTopic,
  researchLoading,
  libraryCount,
  autoResearch,
  onAutoResearchChange,
  directedIdea,
  onDirectedIdeaChange,
  onApplyIdea,
  onSuggestIdea,
  ideaBusy,
  ideaDirty,
  ideaStatus,
}: {
  diagnosis: Diagnosis;
  chapters: Chapter[];
  selectedIds: string[];
  scope: CommissionScope;
  visitChapter: number | null;
  onVisitChapter: (order: number) => void;
  onToggle: (id: string) => void;
  onScopeChange: (s: CommissionScope) => void;
  onWriteIt: () => void;
  executing: boolean;
  chapterMax: number;
  suggestedResearch: string[];
  onResearchTopic: (topic: string) => void;
  researchLoading: boolean;
  libraryCount: number;
  autoResearch: boolean;
  onAutoResearchChange: (v: boolean) => void;
  directedIdea: string;
  onDirectedIdeaChange: (v: string) => void;
  onApplyIdea: () => void;
  onSuggestIdea: () => void;
  ideaBusy: boolean;
  ideaDirty: boolean;
  ideaStatus: string;
}) {
  const viabilityColor =
    diagnosis.viabilityScore >= 70 ? '#15803d' : diagnosis.viabilityScore >= 40 ? '#b45309' : '#b91c1c';
  const visited =
    visitChapter != null
      ? chapters.find((c) => c.order === visitChapter) ||
        diagnosis.chapterSummaries.find((c) => c.order === visitChapter)
      : null;
  const visitedContent =
    visitChapter != null ? chapters.find((c) => c.order === visitChapter)?.content || '' : '';

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

      {diagnosis.chapterSummaries.length > 0 && (
        <article style={card}>
          <h2 style={sectionTitle}>Chapters — select & visit</h2>
          <p style={{ color: '#73695d', marginTop: 0, fontSize: 14 }}>
            Tap a chapter to open it and set commission scope to that chapter.
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {diagnosis.chapterSummaries.map((ch) => {
              const active = visitChapter === ch.order || scope.singleChapter === ch.order;
              return (
                <button
                  key={ch.order}
                  type="button"
                  onClick={() => onVisitChapter(ch.order)}
                  style={{
                    textAlign: 'left',
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${active ? '#d6a846' : ch.needsWork ? '#f5d0a9' : '#eadfce'}`,
                    background: active ? '#fff8ea' : '#fffdf8',
                    cursor: 'pointer',
                  }}
                >
                  <strong style={{ display: 'block', fontSize: 14 }}>
                    Ch.{ch.order} · {ch.title}
                    {ch.needsWork ? ' · needs work' : ''}
                  </strong>
                  <small style={{ color: '#8a7a66', lineHeight: 1.4 }}>
                    {ch.wordCount.toLocaleString()} words — {ch.summary || 'No summary yet'}
                  </small>
                </button>
              );
            })}
          </div>
          {visited && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 14,
                border: '1px solid #eadfce',
                background: '#fffaf2',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: '#8a6a28', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Visiting ch.{'order' in visited ? visited.order : visitChapter}
              </div>
              <p style={{ margin: '0 0 10px', fontWeight: 700 }}>
                {'title' in visited ? visited.title : `Chapter ${visitChapter}`}
              </p>
              <p style={{ margin: 0, color: '#6f6252', lineHeight: 1.55, fontSize: 14 }}>
                {'summary' in visited ? visited.summary : ''}
              </p>
              {visitedContent && (
                <pre
                  style={{
                    marginTop: 12,
                    maxHeight: 220,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'Georgia, Cambria, serif',
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: '#2f281f',
                  }}
                >
                  {visitedContent.slice(0, 2400)}
                  {visitedContent.length > 2400 ? '…' : ''}
                </pre>
              )}
            </div>
          )}
        </article>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, 0.8fr)', gap: 20 }} className="commission-grid">
        <article style={card}>
          <h2 style={sectionTitle}>Recommendations</h2>
          <p style={{ color: '#73695d', marginTop: 0 }}>Tick what you agree with. Caspa executes only approved fixes.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {diagnosis.recommendations.map((rec) => (
              <RecommendationRow
                key={rec.id}
                rec={rec}
                selected={selectedIds.includes(rec.id)}
                onToggle={() => onToggle(rec.id)}
                onVisitChapter={onVisitChapter}
              />
            ))}
          </div>
        </article>

        {suggestedResearch.length > 0 && (
          <article style={card}>
            <h2 style={sectionTitle}>Research gaps</h2>
            <p style={{ color: '#73695d', marginTop: 0, fontSize: 14 }}>
              {libraryCount} note{libraryCount !== 1 ? 's' : ''} in library. Commission research before writing so
              Edinburgh stays Edinburgh.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {suggestedResearch.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  disabled={researchLoading}
                  onClick={() => onResearchTopic(topic)}
                  style={{
                    textAlign: 'left',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #eadfce',
                    background: '#fffdf8',
                    cursor: researchLoading ? 'wait' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  {researchLoading ? 'Researching…' : `+ ${topic}`}
                </button>
              ))}
            </div>
          </article>
        )}

        <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <article style={card}>
            <h2 style={sectionTitle}>Direct the idea</h2>
            <p style={{ color: '#73695d', marginTop: 0, fontSize: 14, lineHeight: 1.5 }}>
              Steer the premise before you commit. Write it will follow this direction.
            </p>
            <IdeaDirectionCard
              directedIdea={directedIdea}
              onDirectedIdeaChange={onDirectedIdeaChange}
              onApplyIdea={onApplyIdea}
              onSuggestIdea={onSuggestIdea}
              ideaBusy={ideaBusy}
              ideaDirty={ideaDirty}
              ideaStatus={ideaStatus}
            />
          </article>

          <article style={card}>
            <h2 style={sectionTitle}>Scope</h2>
            <ScopePicker
              scope={scope}
              chapterMax={chapterMax}
              chapters={chapters}
              visitChapter={visitChapter}
              onVisitChapter={onVisitChapter}
              onChange={onScopeChange}
            />
          </article>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: '#5b4724', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoResearch}
              onChange={(e) => onAutoResearchChange(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>Auto-research gaps before drafting (uses deep web search when configured)</span>
          </label>

          <button type="button" onClick={onWriteIt} disabled={executing || selectedIds.length === 0} style={primaryBtn}>
            {executing ? <Loader size={20} className="spin" /> : <Wand2 size={20} />}
            {executing ? 'Writing…' : ideaDirty ? 'Apply idea & Write it' : 'Write it'}
          </button>

          {diagnosis.suggestRebuild && (
            <p style={{ fontSize: 13, color: '#b45309', margin: 0, lineHeight: 1.5 }}>
              Caspa thinks this needs a full restructure. Tick &quot;Rip up and rebuild&quot; if you agree.
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

function IdeaDirectionCard({
  directedIdea,
  onDirectedIdeaChange,
  onApplyIdea,
  onSuggestIdea,
  ideaBusy,
  ideaDirty,
  ideaStatus,
  compact = false,
}: {
  directedIdea: string;
  onDirectedIdeaChange: (v: string) => void;
  onApplyIdea: () => void;
  onSuggestIdea: () => void;
  ideaBusy: boolean;
  ideaDirty: boolean;
  ideaStatus: string;
  compact?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {!compact && null}
      <textarea
        value={directedIdea}
        onChange={(e) => onDirectedIdeaChange(e.target.value)}
        rows={compact ? 5 : 7}
        placeholder="What is this book really about? Wound, desire, place, pressure — or the nonfiction thesis."
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: `1px solid ${ideaDirty ? '#d6a846' : '#eadfce'}`,
          borderRadius: 12,
          padding: 12,
          fontSize: 14,
          lineHeight: 1.55,
          background: '#fffdf8',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={ideaBusy || !directedIdea.trim()}
          onClick={onSuggestIdea}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #eadfce',
            background: '#fffaf2',
            color: '#4a3b28',
            borderRadius: 12,
            padding: '10px 12px',
            cursor: ideaBusy ? 'wait' : 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {ideaBusy ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
          Suggest direction
        </button>
        <button
          type="button"
          disabled={ideaBusy || !directedIdea.trim() || !ideaDirty}
          onClick={onApplyIdea}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #eadfce',
            background: ideaDirty ? '#d6a846' : '#f3ecdf',
            color: '#1d1408',
            borderRadius: 12,
            padding: '10px 12px',
            cursor: !ideaDirty ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: 13,
            opacity: !ideaDirty ? 0.65 : 1,
          }}
        >
          <PenLine size={14} />
          Apply idea
        </button>
      </div>
      {ideaStatus && (
        <p style={{ margin: 0, fontSize: 13, color: '#6f6252', lineHeight: 1.45 }}>{ideaStatus}</p>
      )}
    </div>
  );
}

function RecommendationRow({
  rec,
  selected,
  onToggle,
  onVisitChapter,
}: {
  rec: Recommendation;
  selected: boolean;
  onToggle: () => void;
  onVisitChapter: (order: number) => void;
}) {
  const severityColor = {
    critical: '#fecaca',
    major: '#fde68a',
    minor: '#e5e7eb',
  }[rec.severity];

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        textAlign: 'left',
        width: '100%',
        padding: 14,
        borderRadius: 14,
        border: `2px solid ${selected ? '#d6a846' : '#eadfce'}`,
        background: selected ? '#fff8ea' : '#fffdf8',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={selected ? 'Deselect recommendation' : 'Select recommendation'}
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
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {selected && <Check size={14} color="#1d1408" />}
      </button>
      <div style={{ flex: 1 }}>
        <button
          type="button"
          onClick={onToggle}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 15 }}>{rec.title}</strong>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: severityColor, textTransform: 'uppercase' }}>
              {rec.severity}
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: '#6f6252', lineHeight: 1.5, fontSize: 14 }}>{rec.detail}</p>
        </button>
        {rec.chapterRefs && rec.chapterRefs.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {rec.chapterRefs.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onVisitChapter(n)}
                style={{
                  border: '1px solid #eadfce',
                  background: '#fffaf2',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: '#5b4724',
                }}
              >
                Visit ch.{n}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScopePicker({
  scope,
  chapterMax,
  chapters,
  visitChapter,
  onVisitChapter,
  onChange,
}: {
  scope: CommissionScope;
  chapterMax: number;
  chapters: Chapter[];
  visitChapter: number | null;
  onVisitChapter: (order: number) => void;
  onChange: (s: CommissionScope) => void;
}) {
  const options: { type: CommissionScope['type']; label: string; detail: string }[] = [
    { type: 'whole', label: 'Whole manuscript', detail: 'Improve all chapters that need work' },
    { type: 'chapters', label: 'Chapter range', detail: 'Rewrite a run of chapters' },
    { type: 'single', label: 'Single chapter', detail: 'One chapter only — pick below to visit' },
    { type: 'autowrite', label: 'Auto-write all', detail: 'From plan or direction — draft everything' },
    { type: 'rebuild', label: 'Rip up & rebuild', detail: 'Liquidate structure, start fresh' },
  ];

  const inRange = (order: number) => {
    if (scope.type === 'single') return order === (scope.singleChapter ?? visitChapter ?? 1);
    if (scope.type === 'chapters') {
      const from = scope.chapterFrom ?? 1;
      const to = scope.chapterTo ?? chapterMax;
      return order >= from && order <= to;
    }
    return false;
  };

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
                singleChapter: visitChapter ?? 1,
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
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ ...scope, singleChapter: n });
              onVisitChapter(n);
            }}
            style={numInput}
          />
        </label>
      )}

      {(scope.type === 'single' || scope.type === 'chapters') && chapters.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginTop: 6, maxHeight: 180, overflow: 'auto' }}>
          {chapters
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((ch) => {
              const active = inRange(ch.order) || visitChapter === ch.order;
              return (
                <button
                  key={ch.id || ch.order}
                  type="button"
                  onClick={() => {
                    if (scope.type === 'single') {
                      onChange({ ...scope, type: 'single', singleChapter: ch.order });
                    }
                    onVisitChapter(ch.order);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: `1px solid ${active ? '#d6a846' : '#eadfce'}`,
                    background: active ? '#fff8ea' : '#fffdf8',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  <strong>
                    Ch.{ch.order} {ch.title}
                  </strong>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

function PromisesPanel({
  promises,
  health,
}: {
  promises: StoryPromise[];
  health: ReturnType<typeof computePromiseHealth>;
}) {
  const statusColor: Record<string, string> = {
    paid_off: '#15803d',
    broken: '#b91c1c',
    cut_advised: '#b45309',
    planted: '#6366f1',
    developing: '#0891b2',
    open: '#8a7a66',
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <article style={card}>
        <h2 style={sectionTitle}>Promise health</h2>
        <p style={{ color: '#73695d', marginTop: 0, lineHeight: 1.55 }}>
          What the book promised the reader — and whether those promises are still alive.
        </p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 12 }}>
          <Stat label="Total" value={health.total} />
          <Stat label="Open" value={health.open} />
          <Stat label="Paid off" value={health.paidOff} color="#15803d" />
          <Stat label="Broken" value={health.broken} color="#b91c1c" />
          <Stat label="High risk" value={health.overdue} color="#b45309" />
        </div>
      </article>

      {promises.length === 0 ? (
        <article style={card}>
          <p style={{ margin: 0, color: '#8a7a66' }}>Analyse a manuscript to extract story promises.</p>
        </article>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {promises.map((p) => (
            <article key={p.id} style={{ ...card, borderLeft: `4px solid ${statusColor[p.status] || '#d6a846'}` }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#f3f4f6', textTransform: 'uppercase' }}>
                  {p.type}
                </span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: statusColor[p.status] + '33', color: statusColor[p.status] }}>
                  {p.status.replace('_', ' ')}
                </span>
                <span style={{ fontSize: 12, color: '#8a7a66' }}>Risk {p.riskScore}%</span>
                {p.setupChapter && <span style={{ fontSize: 12, color: '#8a7a66' }}>Setup ch.{p.setupChapter}</span>}
                {p.payoffChapter && <span style={{ fontSize: 12, color: '#8a7a66' }}>Payoff ch.{p.payoffChapter}</span>}
              </div>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: '#21180f' }}>{p.statement}</p>
              {p.notes && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6f6252' }}>{p.notes}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || '#21180f' }}>{value}</div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8a7a66' }}>{label}</div>
    </div>
  );
}

function WorkshopPanel({
  progress,
  artefact,
  chapters,
  phase,
  error,
  promises,
  visitChapter,
  onVisitChapter,
  onUseArtefact,
}: {
  progress: CommissionState['progress'];
  artefact: string;
  chapters: Chapter[];
  phase: CommissionState['phase'];
  error: string | null;
  promises: StoryPromise[];
  visitChapter: number | null;
  onVisitChapter: (order: number | null) => void;
  onUseArtefact: () => void;
}) {
  const totalWords = chapters.reduce(
    (sum, c) => sum + (c.content?.split(/\s+/).filter(Boolean).length || 0),
    0
  );
  const sorted = chapters.slice().sort((a, b) => a.order - b.order);
  const activeChapter =
    visitChapter != null ? sorted.find((c) => c.order === visitChapter) : null;
  const displayText = activeChapter?.content?.trim()
    ? `# ${activeChapter.title}\n\n${activeChapter.content}`
    : artefact;

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
          {openPromiseWarnings(promises).length > 0 && (
            <article style={{ ...card, borderColor: '#fecaca' }}>
              <h2 style={sectionTitle}>Open promises</h2>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, color: '#7f1d1d' }}>
                {openPromiseWarnings(promises).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </article>
          )}

          <article style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ ...sectionTitle, margin: 0 }}>Your manuscript</h2>
                <p style={{ color: '#73695d', margin: '8px 0 0' }}>
                  {chapters.length} chapters · {totalWords.toLocaleString()} words
                  {activeChapter ? ` · viewing ch.${activeChapter.order}` : ' · full artefact'}
                </p>
              </div>
              <button type="button" onClick={onUseArtefact} style={{ ...primaryBtn, width: 'auto' }}>
                <PenLine size={18} /> Open in White Page
              </button>
            </div>
          </article>

          {sorted.length > 0 && (
            <article style={card}>
              <h2 style={sectionTitle}>Visit chapters</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => onVisitChapter(null)}
                  style={{
                    border: `1px solid ${visitChapter == null ? '#d6a846' : '#eadfce'}`,
                    background: visitChapter == null ? '#fff8ea' : '#fffdf8',
                    borderRadius: 999,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Full artefact
                </button>
                {sorted.map((ch) => (
                  <button
                    key={ch.id || ch.order}
                    type="button"
                    onClick={() => onVisitChapter(ch.order)}
                    style={{
                      border: `1px solid ${visitChapter === ch.order ? '#d6a846' : '#eadfce'}`,
                      background: visitChapter === ch.order ? '#fff8ea' : '#fffdf8',
                      borderRadius: 999,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Ch.{ch.order} {ch.title}
                  </button>
                ))}
              </div>
            </article>
          )}

          <article style={card}>
            <textarea
              readOnly
              value={displayText}
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
