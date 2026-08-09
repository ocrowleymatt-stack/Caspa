/**
 * Caspa Workshop — deliberately simple finish-the-book flow.
 * 1. Add manuscript → 2. Accept/edit Caspa's plan → 3. Finish book → 4. Review result.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  Link2,
  Loader,
  PenLine,
  Sparkles,
  Upload,
  Wand2,
  Zap,
} from 'lucide-react';
import type { StoryPromise } from '../types/promise';
import { computePromiseHealth } from '../types/promise';
import type { Chapter } from '../types';
import type { CommissionScope, CommissionState, Diagnosis, Recommendation } from '../types/commission';
import { defaultCommissionState } from '../types/commission';
import { diagnoseManuscript, executeCommission, ingestManuscript } from '../services/commissionService';
import {
  AI_FETCH_TIMEOUT_MS,
  AI_LONG_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  friendlyFetchError,
} from '../lib/fetchWithTimeout';
import {
  addNote,
  deepResearchTopic,
  getProjectKey,
  loadLibrary,
  suggestResearchTopics,
} from '../services/researchLibraryService';
import { extractPromises, openPromiseWarnings, savePromises } from '../services/promiseRegistryService';
import { ingestKnowledgeFile } from '../services/knowledgeClient';

export interface ProjectBriefLike {
  title: string;
  mode: string;
  idea: string;
  tone: string;
  output: string;
  audience: string;
  targetWordCount?: number;
}

export type StudioTab = 'inbox' | 'recommendations' | 'commission' | 'promises' | 'workshop';
export type ArtefactLeave = 'write' | 'quickwrite';

interface Props {
  brief: ProjectBriefLike;
  draftPage: string;
  onArtefactReady: (text: string, leave?: ArtefactLeave | null) => void;
  onManuscriptChange?: (text: string) => void;
  onBriefChange?: (patch: Partial<ProjectBriefLike>) => void;
  initialTab?: StudioTab;
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

function resolveInitialTab(requested: StudioTab | undefined, state: CommissionState): StudioTab {
  const hasDiagnosis = Boolean(state.diagnosis);
  if (requested === 'workshop' && (state.artefact || state.phase === 'complete' || state.phase === 'executing')) return 'workshop';
  if (requested === 'promises' && hasDiagnosis) return 'promises';
  if ((requested === 'recommendations' || requested === 'commission') && hasDiagnosis) return 'recommendations';
  if (requested === 'inbox') return 'inbox';
  if (state.phase === 'complete' && state.artefact) return 'workshop';
  if (state.phase === 'executing') return 'workshop';
  if (hasDiagnosis) return 'recommendations';
  return 'inbox';
}

function recommendedIds(diagnosis: Diagnosis): string[] {
  const defaults = diagnosis.recommendations.filter((r) => r.defaultSelected).map((r) => r.id);
  if (defaults.length) return defaults;
  const important = diagnosis.recommendations.filter((r) => r.severity !== 'minor').map((r) => r.id);
  return important.length ? important : diagnosis.recommendations.map((r) => r.id);
}

function recommendedScope(diagnosis: Diagnosis): CommissionScope {
  if (diagnosis.suggestRebuild) return { type: 'rebuild' };
  if (diagnosis.inputType === 'plan') return { type: 'autowrite' };
  return { type: 'whole' };
}

function scopeLabel(scope: CommissionScope, chapterMax: number) {
  if (scope.type === 'whole') return 'Whole manuscript';
  if (scope.type === 'rebuild') return 'Rip up & rebuild';
  if (scope.type === 'autowrite') return 'Write the whole book from the plan';
  if (scope.type === 'single') return `Chapter ${scope.singleChapter ?? 1}`;
  return `Chapters ${scope.chapterFrom ?? 1}–${scope.chapterTo ?? chapterMax}`;
}

function canReadAsText(file: File) {
  return file.type.startsWith('text/') || /\.(txt|md|markdown|rtf|csv|json|xml|html?|css|js|jsx|ts|tsx|yaml|yml|log|ini|conf|tex|bib|srt|vtt)$/i.test(file.name);
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
  const initialState = useMemo(() => loadState(), []);
  const [state, setState] = useState<CommissionState>(initialState);
  const [tab, setTab] = useState<StudioTab>(() => resolveInitialTab(initialTab, initialState));
  const [visitChapter, setVisitChapter] = useState<number | null>(focusChapter ?? null);
  const [inboxText, setInboxText] = useState(() => {
    const fromJam = localStorage.getItem('caspa.manuscriptSource');
    return initialState.rawInput || fromJam || draftPage || '';
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

  const update = useCallback((patch: Partial<CommissionState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ }
  }, [tab]);
  useEffect(() => {
    if (!ideaDirty) setDirectedIdea(brief.idea || '');
  }, [brief.idea, ideaDirty]);
  useEffect(() => {
    if (draftPage && !state.rawInput && tab === 'inbox') setInboxText(draftPage);
  }, [draftPage, state.rawInput, tab]);

  useEffect(() => {
    if (!initialTab && focusChapter == null) return;
    setTab(resolveInitialTab(initialTab, state));
    if (focusChapter != null && focusChapter >= 0 && state.diagnosis) {
      setVisitChapter(focusChapter);
      update({ scope: { type: 'single', singleChapter: focusChapter } });
    }
    onDeepLinkConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab, focusChapter]);

  const applyDirectedIdea = useCallback((nextIdea: string) => {
    const idea = nextIdea.trim();
    if (!idea) return false;
    setDirectedIdea(idea);
    setIdeaDirty(false);
    onBriefChange?.({ idea });
    setIdeaStatus('Direction saved.');
    try {
      const raw = localStorage.getItem('caspa.plotHold');
      if (raw) {
        const hold = JSON.parse(raw);
        hold.premise = idea;
        hold.updatedAt = new Date().toISOString();
        localStorage.setItem('caspa.plotHold', JSON.stringify(hold));
      }
    } catch { /* optional */ }
    return true;
  }, [onBriefChange]);

  const handleIngest = async () => {
    if (!inboxText.trim()) return;
    update({ phase: 'diagnosing', error: null, rawInput: inboxText });
    setStatusLine('Reading the manuscript…');
    try {
      const { chapters, inputType } = await ingestManuscript(inboxText, brief, setStatusLine);
      setStatusLine('Working out what actually needs fixing…');
      const diagnosis = await diagnoseManuscript(chapters, brief, inputType);
      let promises: StoryPromise[] = [];
      try {
        promises = await extractPromises(chapters, brief);
        savePromises(projectKey, promises);
      } catch { promises = []; }

      const ids = recommendedIds(diagnosis);
      const scope = recommendedScope(diagnosis);
      update({
        chapters,
        diagnosis,
        promises,
        selectedRecommendationIds: ids,
        scope,
        phase: 'ready',
        artefact: '',
      });
      onManuscriptChange?.(inboxText);
      setLibraryCount(loadLibrary(projectKey).length);
      try {
        const topics = await suggestResearchTopics(brief, inboxText);
        setSuggestedResearch(topics.slice(0, 6));
      } catch { setSuggestedResearch([]); }
      setTab('recommendations');
      setStatusLine('');
    } catch (err) {
      update({ phase: 'error', error: friendlyFetchError(err, 'Diagnosis failed') });
      setStatusLine('');
    }
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setStatusLine(`Ingesting ${files.length} file${files.length === 1 ? '' : 's'}…`);
    try {
      const chunks = await Promise.all(files.map(async (file, index) => {
        const heading = `\n\n===== SOURCE: ${file.name} =====\n\n`;
        const data = await ingestKnowledgeFile(file, `workshop:${Date.now()}:${index}:${file.name}`);
        const extracted = String(data?.extractedText || '').trim();
        const warning = String(data?.extractionWarning || '').trim();
        return `${heading}${extracted || `[File accepted: ${file.name} · ${file.type || 'unknown type'} · ${file.size.toLocaleString()} bytes${warning ? ` · extraction warning: ${warning}` : ''}]`}`;
      }));
      setInboxText((prev) => `${prev.trim()}${chunks.join('')}`.trim());
    } finally {
      setStatusLine('');
    }
  };

  const handleSuggestIdea = async () => {
    const seed = directedIdea.trim() || brief.idea || inboxText.slice(0, 2000);
    if (!seed.trim()) {
      setIdeaStatus('Add a rough direction first.');
      return;
    }
    setIdeaBusy(true);
    setIdeaStatus('Sharpening the direction…');
    try {
      const res = await fetchWithTimeout('/api/caspa/write/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed, mode: brief.mode || 'novel' }),
      }, AI_FETCH_TIMEOUT_MS);
      const json = await res.json();
      if (res.ok && json.success && json.data?.premise) {
        setDirectedIdea(String(json.data.premise));
        setIdeaDirty(true);
        setIdeaStatus('Suggested direction ready.');
        return;
      }
      const aiRes = await fetchWithTimeout('/api/ai/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Sharpen this ${brief.mode} book premise in 2–5 sentences. Preserve intent; make the governing thesis or dramatic engine concrete. Return premise only.\n\n${seed}`,
          maxTokens: 600,
        }),
      }, AI_LONG_FETCH_TIMEOUT_MS);
      const aiJson = await aiRes.json();
      if (!aiRes.ok || !aiJson.result) throw new Error(aiJson.message || 'Direction failed');
      setDirectedIdea(String(aiJson.result).trim());
      setIdeaDirty(true);
      setIdeaStatus('Suggested direction ready.');
    } catch (err) {
      setIdeaStatus(friendlyFetchError(err, 'Could not suggest a direction'));
    } finally {
      setIdeaBusy(false);
    }
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

  const runCommission = async (ids: string[], scope: CommissionScope) => {
    if (!state.diagnosis || state.chapters.length === 0 || ids.length === 0) return;
    const nextIdea = directedIdea.trim() || brief.idea;
    const writeBrief = { ...brief, idea: nextIdea };
    if (ideaDirty && nextIdea) applyDirectedIdea(nextIdea);

    update({
      selectedRecommendationIds: ids,
      scope,
      phase: 'executing',
      progress: { phase: 'start', message: 'Plan accepted. Finishing the book…', percent: 5 },
      error: null,
    });
    setTab('workshop');

    try {
      const result = await executeCommission(
        writeBrief,
        state.chapters,
        state.diagnosis,
        ids,
        scope,
        (p) => update({ progress: p }),
        { autoResearch, promises: state.promises }
      );
      update({
        chapters: result.chapters,
        artefact: result.artefact,
        promises: result.promises,
        phase: 'complete',
        progress: { phase: 'complete', message: 'Book finished.', percent: 100 },
      });
      onArtefactReady(result.artefact, null);
    } catch (err) {
      update({ phase: 'error', error: friendlyFetchError(err, 'Finishing the book failed'), progress: null });
    }
  };

  const handleQuickFinish = async () => {
    if (!state.diagnosis) return;
    await runCommission(recommendedIds(state.diagnosis), recommendedScope(state.diagnosis));
  };

  const chapterMax = Math.max(1, state.chapters.length);
  const promiseHealth = useMemo(() => computePromiseHealth(state.promises), [state.promises]);
  const currentStep = tab === 'inbox' ? 1 : tab === 'workshop' ? 3 : 2;

  return (
    <section className="commission-simple" style={{ minHeight: '100vh', padding: '42px clamp(18px, 4vw, 60px)', background: '#160d1d' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <div style={kicker}>Caspa Workshop</div>
          <h1 style={{ margin: '7px 0 8px', fontSize: 'clamp(36px, 5vw, 58px)', lineHeight: 1.02, letterSpacing: -2 }}>
            Finish the book.
          </h1>
          <p style={{ margin: 0, maxWidth: 760, fontSize: 18, lineHeight: 1.5 }}>
            Three steps. Add the manuscript, approve Caspa&apos;s plan, then review the finished result.
          </p>
        </header>

        <div className="finish-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 24 }}>
          {[
            [1, 'Manuscript', 'Add or replace the text'],
            [2, 'Fix & finish', 'Approve what Caspa should do'],
            [3, 'Review', 'Read the resulting book'],
          ].map(([n, title, detail]) => {
            const active = currentStep === n;
            const done = currentStep > Number(n);
            return (
              <button
                key={String(n)}
                type="button"
                disabled={Number(n) === 2 && !state.diagnosis || Number(n) === 3 && !state.artefact && state.phase !== 'executing' && state.phase !== 'error'}
                onClick={() => setTab(Number(n) === 1 ? 'inbox' : Number(n) === 2 ? 'recommendations' : 'workshop')}
                style={{ ...stepButton, borderColor: active ? '#c98cf4' : done ? '#70d8bd' : '#483550', background: active ? '#35203f' : '#211329' }}
              >
                <span style={{ ...stepNumber, background: done ? '#70d8bd' : active ? '#c98cf4' : '#493650', color: done || active ? '#160d1d' : '#eee7f2' }}>
                  {done ? <Check size={15} /> : n}
                </span>
                <span><strong style={{ display: 'block' }}>{title}</strong><small>{detail}</small></span>
              </button>
            );
          })}
        </div>

        {tab === 'inbox' && (
          <InboxPanel
            brief={brief}
            inboxText={inboxText}
            setInboxText={setInboxText}
            onFiles={handleFiles}
            onIngest={handleIngest}
            loading={state.phase === 'diagnosing'}
            statusLine={statusLine}
            error={state.error}
            directedIdea={directedIdea}
            onDirectedIdeaChange={(v) => { setDirectedIdea(v); setIdeaDirty(true); setIdeaStatus(''); }}
            onSuggestIdea={handleSuggestIdea}
            onApplyIdea={() => applyDirectedIdea(directedIdea)}
            ideaBusy={ideaBusy}
            ideaDirty={ideaDirty}
            ideaStatus={ideaStatus}
          />
        )}

        {(tab === 'recommendations' || tab === 'commission') && state.diagnosis && (
          <FinishPlan
            diagnosis={state.diagnosis}
            chapters={state.chapters}
            selectedIds={state.selectedRecommendationIds}
            scope={state.scope}
            visitChapter={visitChapter}
            onVisitChapter={(n) => setVisitChapter(n)}
            onSelectedChange={(ids) => update({ selectedRecommendationIds: ids })}
            onScopeChange={(scope) => update({ scope })}
            onFinish={() => runCommission(state.selectedRecommendationIds, state.scope)}
            onQuickFinish={handleQuickFinish}
            executing={state.phase === 'executing'}
            autoResearch={autoResearch}
            onAutoResearchChange={setAutoResearch}
            suggestedResearch={suggestedResearch}
            onResearchTopic={handleResearchTopic}
            researchLoading={researchLoading}
            libraryCount={libraryCount}
            directedIdea={directedIdea}
            onDirectedIdeaChange={(v) => { setDirectedIdea(v); setIdeaDirty(true); setIdeaStatus(''); }}
            onSuggestIdea={handleSuggestIdea}
            onApplyIdea={() => applyDirectedIdea(directedIdea)}
            ideaBusy={ideaBusy}
            ideaDirty={ideaDirty}
            ideaStatus={ideaStatus}
            onOpenPromises={() => setTab('promises')}
          />
        )}

        {tab === 'promises' && state.diagnosis && (
          <PromisesPanel promises={state.promises} health={promiseHealth} onBack={() => setTab('recommendations')} />
        )}

        {tab === 'workshop' && (
          <ReviewPanel
            progress={state.progress}
            artefact={state.artefact}
            chapters={state.chapters}
            phase={state.phase}
            error={state.error}
            promises={state.promises}
            visitChapter={visitChapter}
            onVisitChapter={setVisitChapter}
            onOpenWhitePage={() => onArtefactReady(state.artefact, 'write')}
            onOpenJustWrite={() => onArtefactReady(state.artefact, 'quickwrite')}
            onRetry={() => setTab('recommendations')}
            onDiagnoseAgain={() => {
              if (state.artefact.trim()) setInboxText(state.artefact);
              setTab('inbox');
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .commission-simple button { transition: border-color .15s ease, background .15s ease, transform .15s ease; }
        .commission-simple button:not(:disabled):hover { transform: translateY(-1px); }
        @media (max-width: 860px) {
          .finish-steps, .finish-grid { grid-template-columns: 1fr !important; }
          .finish-sticky { position: static !important; }
        }
      `}</style>
    </section>
  );
}

function InboxPanel({
  brief,
  inboxText,
  setInboxText,
  onFiles,
  onIngest,
  loading,
  statusLine,
  error,
  directedIdea,
  onDirectedIdeaChange,
  onSuggestIdea,
  onApplyIdea,
  ideaBusy,
  ideaDirty,
  ideaStatus,
}: {
  brief: ProjectBriefLike;
  inboxText: string;
  setInboxText: (v: string) => void;
  onFiles: (files: File[]) => void;
  onIngest: () => void;
  loading: boolean;
  statusLine: string;
  error: string | null;
  directedIdea: string;
  onDirectedIdeaChange: (v: string) => void;
  onSuggestIdea: () => void;
  onApplyIdea: () => void;
  ideaBusy: boolean;
  ideaDirty: boolean;
  ideaStatus: string;
}) {
  const words = inboxText.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="finish-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.45fr) minmax(280px,.7fr)', gap: 18 }}>
      <article style={card}>
        <h2 style={sectionTitle}>1. Add the manuscript</h2>
        <p style={muted}>Paste it, replace it, or add any files. Any file type is accepted. Text/documents are extracted, audio/video is transcribed, and other binary formats are registered rather than rejected.</p>
        <textarea value={inboxText} onChange={(e) => setInboxText(e.target.value)} placeholder="Paste manuscript, plan or source material here…" style={manuscriptBox} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
          <button type="button" onClick={onIngest} disabled={loading || !inboxText.trim()} style={primaryBtn}>
            {loading ? <Loader size={18} className="spin" /> : <Sparkles size={18} />}
            {loading ? 'Analysing…' : 'Analyse & make a finish plan'}
          </button>
          <label style={{ ...ghostBtn, cursor: 'pointer' }}>
            <Upload size={16} /> Add files
            <input type="file" multiple style={{ display: 'none' }} onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))} />
          </label>
          <span style={muted}>{words.toLocaleString()} words</span>
        </div>
        {statusLine && <p style={{ ...muted, display: 'flex', gap: 8, alignItems: 'center' }}><Loader size={15} className="spin" />{statusLine}</p>}
        {error && <p style={{ color: '#ffb4b4' }}>{error}</p>}
      </article>

      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <article style={card}>
          <div style={kicker}>Project</div>
          <h3 style={{ margin: '7px 0 6px', fontSize: 20 }}>{brief.title || 'Untitled book'}</h3>
          <p style={muted}>{brief.mode || 'Book'} · {brief.audience || 'General reader'}</p>
        </article>
        <details style={card}>
          <summary style={summaryStyle}>Change the book direction <ChevronDown size={16} /></summary>
          <IdeaEditor directedIdea={directedIdea} onChange={onDirectedIdeaChange} onSuggest={onSuggestIdea} onApply={onApplyIdea} busy={ideaBusy} dirty={ideaDirty} status={ideaStatus} />
        </details>
      </aside>
    </div>
  );
}

function FinishPlan({
  diagnosis,
  chapters,
  selectedIds,
  scope,
  visitChapter,
  onVisitChapter,
  onSelectedChange,
  onScopeChange,
  onFinish,
  onQuickFinish,
  executing,
  autoResearch,
  onAutoResearchChange,
  suggestedResearch,
  onResearchTopic,
  researchLoading,
  libraryCount,
  directedIdea,
  onDirectedIdeaChange,
  onSuggestIdea,
  onApplyIdea,
  ideaBusy,
  ideaDirty,
  ideaStatus,
  onOpenPromises,
}: {
  diagnosis: Diagnosis;
  chapters: Chapter[];
  selectedIds: string[];
  scope: CommissionScope;
  visitChapter: number | null;
  onVisitChapter: (n: number) => void;
  onSelectedChange: (ids: string[]) => void;
  onScopeChange: (s: CommissionScope) => void;
  onFinish: () => void;
  onQuickFinish: () => void;
  executing: boolean;
  autoResearch: boolean;
  onAutoResearchChange: (v: boolean) => void;
  suggestedResearch: string[];
  onResearchTopic: (topic: string) => void;
  researchLoading: boolean;
  libraryCount: number;
  directedIdea: string;
  onDirectedIdeaChange: (v: string) => void;
  onSuggestIdea: () => void;
  onApplyIdea: () => void;
  ideaBusy: boolean;
  ideaDirty: boolean;
  ideaStatus: string;
  onOpenPromises: () => void;
}) {
  const recommended = recommendedIds(diagnosis);
  const recScope = recommendedScope(diagnosis);
  const allSelected = selectedIds.length === diagnosis.recommendations.length;
  const chapterMax = Math.max(1, chapters.length);

  const toggle = (id: string) => {
    onSelectedChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <article style={{ ...card, borderColor: '#74518a' }}>
        <div style={kicker}>Caspa&apos;s diagnosis</div>
        <p style={{ margin: '8px 0 10px', fontSize: 21, lineHeight: 1.5 }}>{diagnosis.verdict}</p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', ...muted }}>
          <span><BookOpen size={14} style={{ verticalAlign: -2 }} /> {diagnosis.chapterCount} chapters</span>
          <span><FileText size={14} style={{ verticalAlign: -2 }} /> {diagnosis.wordCount.toLocaleString()} words</span>
          <span>{diagnosis.viabilityScore}% viability</span>
        </div>
      </article>

      <article style={{ ...card, borderColor: '#9569ae', background: '#281730' }}>
        <div className="finish-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 18, alignItems: 'center' }}>
          <div>
            <h2 style={{ ...sectionTitle, marginBottom: 6 }}>Fastest route: accept Caspa&apos;s plan</h2>
            <p style={{ ...muted, margin: 0 }}>
              {recommended.length} recommended fix{recommended.length === 1 ? '' : 'es'} · {scopeLabel(recScope, chapterMax)} · research gaps {autoResearch ? 'on' : 'off'}.
            </p>
          </div>
          <button type="button" onClick={onQuickFinish} disabled={executing} style={{ ...primaryBtn, minWidth: 220 }}>
            <Wand2 size={19} /> Accept plan & finish book
          </button>
        </div>
      </article>

      <div className="finish-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(300px,.75fr)', gap: 18, alignItems: 'start' }}>
        <article style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h2 style={{ ...sectionTitle, marginBottom: 4 }}>2. Fixes</h2>
              <p style={{ ...muted, margin: 0 }}>Selected fixes are what Caspa will actually execute.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={miniBtn} onClick={() => onSelectedChange(recommended)}>Recommended</button>
              <button type="button" style={miniBtn} onClick={() => onSelectedChange(allSelected ? [] : diagnosis.recommendations.map((r) => r.id))}>{allSelected ? 'Clear all' : 'Select all'}</button>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 9, marginTop: 15 }}>
            {diagnosis.recommendations.map((rec) => (
              <RecommendationRow key={rec.id} rec={rec} selected={selectedIds.includes(rec.id)} onToggle={() => toggle(rec.id)} onVisitChapter={onVisitChapter} />
            ))}
          </div>
        </article>

        <aside className="finish-sticky" style={{ position: 'sticky', top: 18, display: 'grid', gap: 14 }}>
          <article style={card}>
            <h2 style={{ ...sectionTitle, marginBottom: 4 }}>3. Scope</h2>
            <p style={{ ...muted, margin: '0 0 12px' }}>Currently: <strong>{scopeLabel(scope, chapterMax)}</strong></p>
            <ScopePicker scope={scope} chapterMax={chapterMax} chapters={chapters} visitChapter={visitChapter} onVisitChapter={onVisitChapter} onChange={onScopeChange} />
          </article>

          <label style={{ ...card, padding: 16, display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={autoResearch} onChange={(e) => onAutoResearchChange(e.target.checked)} style={{ marginTop: 3 }} />
            <span><strong style={{ display: 'block' }}>Fill research gaps automatically</strong><small style={muted}>Use the research layer before drafting where needed.</small></span>
          </label>

          <button type="button" onClick={onFinish} disabled={executing || selectedIds.length === 0} style={{ ...primaryBtn, width: '100%', minHeight: 54, fontSize: 16 }}>
            {executing ? <Loader size={19} className="spin" /> : <Wand2 size={19} />}
            {executing ? 'Finishing…' : `Finish book with ${selectedIds.length} fix${selectedIds.length === 1 ? '' : 'es'}`}
          </button>
          {selectedIds.length === 0 && <p style={{ color: '#ffcf8f', fontSize: 13, margin: 0 }}>Select at least one fix, or use “Accept plan & finish book”.</p>}
        </aside>
      </div>

      <details style={card}>
        <summary style={summaryStyle}>Optional controls: direction, research, promises <ChevronDown size={16} /></summary>
        <div className="finish-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 16 }}>
          <div>
            <h3 style={{ marginTop: 0 }}>Book direction</h3>
            <IdeaEditor directedIdea={directedIdea} onChange={onDirectedIdeaChange} onSuggest={onSuggestIdea} onApply={onApplyIdea} busy={ideaBusy} dirty={ideaDirty} status={ideaStatus} />
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Research gaps</h3>
            <p style={muted}>{libraryCount} research note{libraryCount === 1 ? '' : 's'} saved.</p>
            {suggestedResearch.length ? suggestedResearch.map((topic) => (
              <button key={topic} type="button" disabled={researchLoading} onClick={() => onResearchTopic(topic)} style={{ ...ghostBtn, width: '100%', marginBottom: 7, justifyContent: 'flex-start' }}>
                {researchLoading ? 'Researching…' : `Research: ${topic}`}
              </button>
            )) : <p style={muted}>No suggested gaps waiting.</p>}
            <button type="button" style={{ ...ghostBtn, marginTop: 8 }} onClick={onOpenPromises}><Link2 size={15} /> Check reader promises</button>
          </div>
        </div>
      </details>

      {diagnosis.editorNotes && (
        <details style={card}>
          <summary style={summaryStyle}>Editor notes <ChevronDown size={16} /></summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '14px 0 0', lineHeight: 1.6 }}>{diagnosis.editorNotes}</pre>
        </details>
      )}
    </div>
  );
}

function RecommendationRow({ rec, selected, onToggle, onVisitChapter }: {
  rec: Recommendation;
  selected: boolean;
  onToggle: () => void;
  onVisitChapter: (order: number) => void;
}) {
  return (
    <div style={{ border: `2px solid ${selected ? '#c98cf4' : '#483550'}`, background: selected ? '#382145' : '#211329', borderRadius: 14, padding: 14 }}>
      <button type="button" onClick={onToggle} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 11, width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, display: 'grid', placeItems: 'center', border: `2px solid ${selected ? '#c98cf4' : '#80668d'}`, background: selected ? '#c98cf4' : 'transparent', color: '#160d1d', marginTop: 1 }}>
          {selected && <Check size={15} />}
        </span>
        <span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>{rec.title}</strong>
            <small style={{ ...pill, background: rec.severity === 'critical' ? '#81464f' : rec.severity === 'major' ? '#765e33' : '#4e4652' }}>{rec.severity}</small>
          </span>
          <small style={{ display: 'block', marginTop: 6, lineHeight: 1.5, color: '#d6cbdc' }}>{rec.detail}</small>
        </span>
      </button>
      {rec.chapterRefs?.length ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '9px 0 0 39px' }}>
          {rec.chapterRefs.map((n) => <button key={n} type="button" onClick={() => onVisitChapter(n)} style={chapterChip}>Ch.{n}</button>)}
        </div>
      ) : null}
    </div>
  );
}

function ScopePicker({ scope, chapterMax, chapters, visitChapter, onVisitChapter, onChange }: {
  scope: CommissionScope;
  chapterMax: number;
  chapters: Chapter[];
  visitChapter: number | null;
  onVisitChapter: (order: number) => void;
  onChange: (s: CommissionScope) => void;
}) {
  const options: { type: CommissionScope['type']; label: string; detail: string }[] = [
    { type: 'whole', label: 'Whole book', detail: 'Improve the manuscript without demolishing its structure' },
    { type: 'rebuild', label: 'Rip up & rebuild', detail: 'Keep the material; rebuild the structure and flow' },
    { type: 'autowrite', label: 'Write whole book from plan', detail: 'Use when the input is mainly a plan or treatment' },
    { type: 'chapters', label: 'Chapter range', detail: 'Only rewrite a run of chapters' },
    { type: 'single', label: 'One chapter', detail: 'Only work on one chapter' },
  ];
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {options.map((opt) => {
        const active = scope.type === opt.type;
        return (
          <button key={opt.type} type="button" onClick={() => onChange({ type: opt.type, chapterFrom: 1, chapterTo: chapterMax, singleChapter: visitChapter ?? 1 })} style={{ textAlign: 'left', padding: 11, borderRadius: 12, border: `2px solid ${active ? '#c98cf4' : '#483550'}`, background: active ? '#382145' : '#211329', cursor: 'pointer' }}>
            <strong style={{ display: 'block', fontSize: 14 }}>{opt.label}{active ? ' ✓' : ''}</strong>
            <small style={{ color: '#cfc3d5' }}>{opt.detail}</small>
          </button>
        );
      })}

      {scope.type === 'chapters' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <label style={muted}>From <input type="number" min={1} max={chapterMax} value={scope.chapterFrom ?? 1} onChange={(e) => onChange({ ...scope, chapterFrom: Number(e.target.value) })} style={numInput} /></label>
          <label style={muted}>To <input type="number" min={1} max={chapterMax} value={scope.chapterTo ?? chapterMax} onChange={(e) => onChange({ ...scope, chapterTo: Number(e.target.value) })} style={numInput} /></label>
        </div>
      )}
      {scope.type === 'single' && (
        <label style={muted}>Chapter <input type="number" min={1} max={chapterMax} value={scope.singleChapter ?? 1} onChange={(e) => { const n = Number(e.target.value); onChange({ ...scope, singleChapter: n }); onVisitChapter(n); }} style={numInput} /></label>
      )}
      {(scope.type === 'single' || scope.type === 'chapters') && chapters.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 130, overflow: 'auto' }}>
          {chapters.slice().sort((a,b) => a.order - b.order).map((ch) => (
            <button key={ch.id || ch.order} type="button" style={chapterChip} onClick={() => { if (scope.type === 'single') onChange({ ...scope, singleChapter: ch.order }); onVisitChapter(ch.order); }}>Ch.{ch.order} {ch.title}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function IdeaEditor({ directedIdea, onChange, onSuggest, onApply, busy, dirty, status }: {
  directedIdea: string;
  onChange: (v: string) => void;
  onSuggest: () => void;
  onApply: () => void;
  busy: boolean;
  dirty: boolean;
  status: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      <textarea value={directedIdea} onChange={(e) => onChange(e.target.value)} rows={6} placeholder="What is this book really trying to do?" style={{ ...manuscriptBox, minHeight: 120, fontFamily: 'inherit', fontSize: 14 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy || !directedIdea.trim()} onClick={onSuggest} style={ghostBtn}>{busy ? <Loader size={14} className="spin" /> : <Sparkles size={14} />} Suggest</button>
        <button type="button" disabled={busy || !dirty || !directedIdea.trim()} onClick={onApply} style={ghostBtn}><PenLine size={14} /> Save direction</button>
      </div>
      {status && <small style={muted}>{status}</small>}
    </div>
  );
}

function PromisesPanel({ promises, health, onBack }: { promises: StoryPromise[]; health: ReturnType<typeof computePromiseHealth>; onBack: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <button type="button" onClick={onBack} style={{ ...ghostBtn, width: 'fit-content' }}>← Back to finish plan</button>
      <article style={card}>
        <h2 style={sectionTitle}>Reader promises</h2>
        <p style={muted}>Open {health.open} · Paid off {health.paidOff} · Broken {health.broken} · High risk {health.overdue}</p>
      </article>
      {promises.map((p) => (
        <article key={p.id} style={card}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><small style={pill}>{p.type}</small><small style={pill}>{p.status.replace('_',' ')}</small><small style={pill}>risk {p.riskScore}%</small></div>
          <p style={{ marginBottom: 0 }}>{p.statement}</p>
        </article>
      ))}
      {!promises.length && <article style={card}><p style={muted}>No explicit promises were extracted.</p></article>}
    </div>
  );
}

function ReviewPanel({ progress, artefact, chapters, phase, error, promises, visitChapter, onVisitChapter, onOpenWhitePage, onOpenJustWrite, onRetry, onDiagnoseAgain }: {
  progress: CommissionState['progress'];
  artefact: string;
  chapters: Chapter[];
  phase: CommissionState['phase'];
  error: string | null;
  promises: StoryPromise[];
  visitChapter: number | null;
  onVisitChapter: (order: number | null) => void;
  onOpenWhitePage: () => void;
  onOpenJustWrite: () => void;
  onRetry: () => void;
  onDiagnoseAgain: () => void;
}) {
  const sorted = chapters.slice().sort((a,b) => a.order - b.order);
  const totalWords = chapters.reduce((sum, c) => sum + (c.content?.split(/\s+/).filter(Boolean).length || 0), 0);
  const active = visitChapter != null ? sorted.find((c) => c.order === visitChapter) : null;
  const text = active?.content?.trim() ? `# ${active.title}\n\n${active.content}` : artefact;
  const warnings = openPromiseWarnings(promises);

  if (phase === 'executing' && progress) {
    return (
      <article style={{ ...card, maxWidth: 760, margin: '0 auto' }}>
        <h2 style={sectionTitle}>Finishing the book…</h2>
        <div style={{ height: 12, borderRadius: 999, background: '#33213c', overflow: 'hidden', margin: '18px 0' }}><div style={{ width: `${progress.percent}%`, height: '100%', background: '#c98cf4', transition: 'width .3s ease' }} /></div>
        <p style={{ ...muted, display: 'flex', gap: 8, alignItems: 'center' }}><Loader size={17} className="spin" /> {progress.message}</p>
        <p style={muted}>You can leave this screen open; progress is saved as each stage completes.</p>
      </article>
    );
  }

  if (error) {
    return <article style={card}><h2 style={sectionTitle}>The finish run stopped</h2><p style={{ color: '#ffb4b4' }}>{error}</p><button type="button" onClick={onRetry} style={primaryBtn}>Return to finish plan</button></article>;
  }

  if (phase !== 'complete' || !artefact) {
    return <article style={card}><p style={muted}>Nothing has been finished yet.</p><button type="button" onClick={onRetry} style={primaryBtn}>Go to finish plan</button></article>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <article style={card}>
        <div className="finish-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
          <div>
            <div style={kicker}>Finished artefact</div>
            <h2 style={{ ...sectionTitle, margin: '7px 0 5px' }}>Read it before you leave</h2>
            <p style={{ ...muted, margin: 0 }}>{chapters.length} chapters · {totalWords.toLocaleString()} words{active ? ` · viewing ch.${active.order}` : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onOpenJustWrite} style={ghostBtn}><Zap size={16} /> Just write</button>
            <button type="button" onClick={onOpenWhitePage} style={primaryBtn}><PenLine size={16} /> White Page</button>
          </div>
        </div>
      </article>

      {warnings.length > 0 && <article style={{ ...card, borderColor: '#9d6870' }}><h3 style={{ marginTop: 0 }}>Still worth checking</h3><ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul></article>}

      {sorted.length > 0 && (
        <article style={card}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onVisitChapter(null)} style={chapterChip}>Whole book</button>
            {sorted.map((ch) => <button key={ch.id || ch.order} type="button" onClick={() => onVisitChapter(ch.order)} style={chapterChip}>Ch.{ch.order} {ch.title}</button>)}
          </div>
        </article>
      )}

      <article style={card}><textarea readOnly value={text} style={{ ...manuscriptBox, minHeight: '60vh' }} /></article>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" onClick={onRetry} style={ghostBtn}><Wand2 size={16} /> Improve again</button><button type="button" onClick={onDiagnoseAgain} style={ghostBtn}><AlertCircle size={16} /> Diagnose finished version</button></div>
    </div>
  );
}

const kicker: React.CSSProperties = { color: '#d8a25b', fontSize: 12, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase' };
const card: React.CSSProperties = { borderRadius: 22, padding: 22, background: '#211329', border: '1px solid #483550', boxShadow: '0 18px 50px rgba(0,0,0,.15)' };
const sectionTitle: React.CSSProperties = { margin: '0 0 12px', fontSize: 21, letterSpacing: -.3 };
const muted: React.CSSProperties = { color: '#d0c6d7', fontSize: 14, lineHeight: 1.5 };
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, borderRadius: 14, padding: '13px 17px', background: '#c98cf4', color: '#170e1d', fontWeight: 800, cursor: 'pointer', fontSize: 15 };
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 14px', borderRadius: 12, border: '1px solid #60486c', background: '#2a1832', color: '#f8f3fb', fontWeight: 650, fontSize: 14, cursor: 'pointer' };
const miniBtn: React.CSSProperties = { ...ghostBtn, padding: '8px 10px', fontSize: 12 };
const manuscriptBox: React.CSSProperties = { width: '100%', minHeight: 400, boxSizing: 'border-box', border: '1px solid #5a4464', borderRadius: 14, padding: 18, fontSize: 16, lineHeight: 1.65, fontFamily: 'Georgia, Cambria, serif', background: '#130b18', color: '#f8f3fb', resize: 'vertical' };
const summaryStyle: React.CSSProperties = { cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 };
const stepButton: React.CSSProperties = { display: 'grid', gridTemplateColumns: '34px 1fr', gap: 10, alignItems: 'center', textAlign: 'left', border: '2px solid', borderRadius: 14, padding: 13, color: '#f8f3fb', cursor: 'pointer' };
const stepNumber: React.CSSProperties = { width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center', fontWeight: 900 };
const pill: React.CSSProperties = { display: 'inline-block', borderRadius: 999, padding: '3px 8px', background: '#493650', color: '#f8f3fb', textTransform: 'uppercase', fontSize: 10 };
const chapterChip: React.CSSProperties = { border: '1px solid #60486c', background: '#2a1832', color: '#f8f3fb', borderRadius: 999, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 };
const numInput: React.CSSProperties = { width: 58, marginLeft: 4, padding: '6px 8px', borderRadius: 8, border: '1px solid #60486c', background: '#130b18', color: '#fff' };
