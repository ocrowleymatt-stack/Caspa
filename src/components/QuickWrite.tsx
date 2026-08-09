/**
 * Quick Write — five-step path: Seed → Spine → Draft → Cut → Pack.
 * Whole-book drafting runs as a server background job and is recovered by job id after reloads.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader, Sparkles, Wand2, Scissors, Download, PenLine, RotateCcw } from 'lucide-react';
import { BUILTIN_AWARD_LENSES, type AwardLens } from '../services/literary/awardsShelf';
import {
  loadPlotHold,
  plotHoldFromProposal,
  nextPendingBeat,
  markBeatDrafted,
  plotHoldSummary,
  savePlotHold,
  type PlotHold,
} from '../services/plotHoldService';
import {
  countWords,
  defaultTargetWordCount,
  planQualityCut,
  type CutPlan,
} from '../services/wordCountService';
import { formatShowPackForWriting, hasShowBoxContent } from '../services/showBoxService';
import {
  AI_FETCH_TIMEOUT_MS,
  AI_LONG_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  friendlyFetchError,
} from '../lib/fetchWithTimeout';
import { readApiJson } from '../services/apiJson';

type StepId = 'seed' | 'spine' | 'draft' | 'cut' | 'pack';
const WHOLE_BOOK_JOB_KEY = 'caspa.wholeBookJobId';

function writeModeForBrief(mode: string): string {
  if (mode === 'gold') return 'polish';
  if (mode === 'picture') return 'novel';
  if (['nonfiction', 'essay', 'poetry', 'script', 'musical', 'adaptation', 'chaos', 'novel'].includes(mode)) return mode;
  return 'novel';
}

function isNonfictionMode(mode: string): boolean {
  return mode === 'nonfiction' || mode === 'essay';
}

type Props = {
  brief: {
    title: string;
    mode: string;
    idea: string;
    tone: string;
    output: string;
    targetWordCount?: number;
  };
  draftPage: string;
  onDraftChange: (text: string) => void;
  onTargetWordCountChange?: (n: number) => void;
  onGoPublish: () => void;
  onGoWorkshop: () => void;
  onGoShowBox?: () => void;
};

function stepsForMode(mode: string): Array<{ id: StepId; label: string; detail: string }> {
  const nonfiction = isNonfictionMode(mode);
  return [
    { id: 'seed', label: 'Seed', detail: nonfiction ? 'Capture thesis and question' : 'Capture wound and desire' },
    { id: 'spine', label: 'Spine', detail: nonfiction ? 'Section turns, no prose' : 'Chapter turns, no prose' },
    { id: 'draft', label: 'Draft', detail: 'Write the held manuscript' },
    { id: 'cut', label: 'Cut', detail: nonfiction ? 'Cut what weakens the argument' : 'Cut what weakens the product' },
    { id: 'pack', label: 'Pack', detail: 'Export when ready' },
  ];
}

function sectionHeading(title: string, index: number, mode: string) {
  const kind = isNonfictionMode(mode) ? 'Section' : mode === 'script' || mode === 'musical' ? 'Scene' : 'Chapter';
  return `\n\n# ${title.trim() || `${kind} ${index + 1}`}\n\n`;
}

export default function QuickWrite({
  brief,
  draftPage,
  onDraftChange,
  onTargetWordCountChange,
  onGoPublish,
  onGoWorkshop,
  onGoShowBox,
}: Props) {
  const mode = writeModeForBrief(brief.mode);
  const nonfiction = isNonfictionMode(mode);
  const showPackLive = hasShowBoxContent();
  const STEPS = useMemo(() => stepsForMode(mode), [mode]);
  const [step, setStep] = useState<StepId>('seed');
  const [seed, setSeed] = useState(brief.idea || '');
  const [lenses, setLenses] = useState<AwardLens[]>(BUILTIN_AWARD_LENSES);
  const [prizeLensId, setPrizeLensId] = useState(mode === 'essay' ? 'essay-orwell' : nonfiction ? 'pulitzer-nonfiction' : 'booker-literary');
  const [proposal, setProposal] = useState<any>(null);
  const [critic, setCritic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [bookProgress, setBookProgress] = useState<{ done: number; total: number; title: string } | null>(null);
  const [plotHold, setPlotHold] = useState<PlotHold | null>(() => loadPlotHold());
  const [cutPlan, setCutPlan] = useState<CutPlan | null>(null);
  const [wholeBookJobId, setWholeBookJobId] = useState<string>(() => {
    try { return localStorage.getItem(WHOLE_BOOK_JOB_KEY) || ''; } catch { return ''; }
  });

  const targetWords = typeof brief.targetWordCount === 'number' && brief.targetWordCount > 0
    ? brief.targetWordCount
    : defaultTargetWordCount(brief.mode);
  const currentWords = useMemo(() => countWords(draftPage), [draftPage]);
  const wholeBookRunning = Boolean(wholeBookJobId);

  useEffect(() => {
    fetch('/api/caspa/write/awards')
      .then((r) => readApiJson<any>(r))
      .then((j) => {
        if (!j?.data?.lenses?.length) return;
        setLenses(j.data.lenses);
        const ids = j.data.lenses.map((l: AwardLens) => l.id) as string[];
        if (mode === 'essay' && ids.includes('essay-orwell')) setPrizeLensId((p) => p === 'booker-literary' ? 'essay-orwell' : p);
        else if (nonfiction && ids.includes('pulitzer-nonfiction')) setPrizeLensId((p) => p === 'booker-literary' ? 'pulitzer-nonfiction' : p);
      })
      .catch(() => {});
  }, [mode, nonfiction]);

  useEffect(() => {
    if (!draftPage.trim()) setCutPlan(null);
    else setCutPlan(planQualityCut(draftPage, { mode, targetWordCount: targetWords }));
  }, [draftPage, mode, targetWords]);

  useEffect(() => {
    if (!wholeBookJobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clearJob = () => {
      try { localStorage.removeItem(WHOLE_BOOK_JOB_KEY); } catch {}
      if (!cancelled) setWholeBookJobId('');
    };

    const poll = async () => {
      try {
        const response = await fetch(`/api/caspa/write/whole-book/job/${encodeURIComponent(wholeBookJobId)}`, { cache: 'no-store' });
        const json = await readApiJson<any>(response);
        if (!response.ok || !json.success) throw new Error(json.message || 'Could not read whole-book job.');
        const job = json.data;
        const result = job?.result || {};
        const done = Number(result.done || 0);
        const total = Math.max(1, Number(result.total || 1));
        const title = String(result.currentTitle || job.stage || 'Working');
        if (result.manuscript && typeof result.manuscript === 'string') onDraftChange(result.manuscript);
        if (result.plotHold?.beats) {
          const held = savePlotHold(result.plotHold as PlotHold);
          setPlotHold(held);
        }
        setBookProgress({ done, total, title });
        setStatus(`Background draft ${done}/${total} · ${Number(result.words || 0).toLocaleString()}/${targetWords.toLocaleString()} words · ${title}`);

        if (job.status === 'complete') {
          if (result.finalText || result.manuscript) onDraftChange(String(result.finalText || result.manuscript));
          if (result.score != null) setQualityScore(Number(result.score));
          setBookProgress({ done: total, total, title: 'Complete' });
          setStep('cut');
          setStatus(`Whole book drafted in the background: ${total}/${total} ${nonfiction ? 'sections' : 'chapters'} · ${Number(result.words || countWords(String(result.finalText || ''))).toLocaleString()} words.`);
          setBusy(false);
          clearJob();
          return;
        }
        if (job.status === 'failed') {
          setStep('draft');
          setBusy(false);
          setError(`${job.error || 'Whole-book job failed'} — completed material has been kept. Start again to continue remaining ${nonfiction ? 'sections' : 'chapters'}.`);
          clearJob();
          return;
        }
      } catch (err) {
        setStatus('Background draft is still registered. Reconnecting…');
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    };

    setBusy(true);
    setStep('draft');
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [wholeBookJobId, nonfiction, onDraftChange, targetWords]);

  const sharedWriteBody = (hold: PlotHold | null, focus?: { title: string; turn: string } | null) => {
    const basePremise = proposal?.premise || hold?.premise || seed || brief.idea;
    const showPack = mode === 'musical' || mode === 'script' ? formatShowPackForWriting() : '';
    return {
      mode,
      genre: proposal?.genre || hold?.genre || (nonfiction ? 'Creative Non-Fiction' : mode === 'musical' ? 'Musical / Show' : mode === 'script' ? 'Stage Play' : 'Literary fiction'),
      premise: showPack ? `${basePremise}\n\n${showPack}` : basePremise,
      tone: proposal?.tone || hold?.tone || brief.tone,
      prizeLensId,
      plotHold: hold || undefined,
      focusBeat: focus ? `${focus.title}: ${focus.turn}` : undefined,
      targetWordCount: targetWords,
      output: brief.output,
    };
  };

  const runSeed = async () => {
    setBusy(true); setError(''); setStatus(nonfiction ? 'Expanding seed into a non-fiction proposal…' : 'Expanding seed into a prize-ambition proposal…');
    try {
      const res = await fetchWithTimeout('/api/caspa/write/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed, mode }) }, AI_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Seed failed');
      setProposal(json.data);
      const held = plotHoldFromProposal(json.data || {}, brief.title);
      setPlotHold(held);
      if (json.data?.premise) setSeed(json.data.premise);
      setStep('spine');
      setStatus(`Plot held. ${plotHoldSummary(held)}`);
    } catch (err) { setError(friendlyFetchError(err, 'Seed failed')); }
    finally { setBusy(false); }
  };

  const runPrizeDraft = async () => {
    setBusy(true); setError(''); setStatus(nonfiction ? 'Drafting opening section…' : 'Drafting opening chapter…');
    try {
      const hold = plotHold || loadPlotHold();
      const focus = nextPendingBeat(hold);
      const res = await fetchWithTimeout('/api/caspa/write/prize-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sharedWriteBody(hold, focus), output: nonfiction ? 'Full opening section for the current focus beat' : 'Full opening chapter for the current focus beat', sourceText: draftPage }),
      }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Draft failed');
      const text = json.data.text || '';
      onDraftChange(text);
      if (hold && focus) setPlotHold(markBeatDrafted(focus.id));
      setCritic(json.data.criticReport || '');
      setQualityScore(json.data.quality?.overallScore ?? null);
      setStep('draft');
      setStatus(`Drafted ${Number(json.data.wordCount || countWords(text)).toLocaleString()} words.`);
    } catch (err) { setError(friendlyFetchError(err, 'Draft failed')); }
    finally { setBusy(false); }
  };

  const runContinue = async () => {
    setBusy(true); setError(''); setStatus('Continuing next beat…');
    try {
      const hold = plotHold || loadPlotHold();
      const focus = nextPendingBeat(hold);
      const res = await fetchWithTimeout('/api/caspa/write/continue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sharedWriteBody(hold, focus), sourceText: draftPage, wholeBook: false }),
      }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Continue failed');
      const next = json.data.text || '';
      const heading = sectionHeading(json.data.beatTitle || focus?.title || '', (hold?.beats || []).findIndex((b) => b.title === focus?.title), mode);
      onDraftChange(`${draftPage.trim()}${heading}${next}`.trim());
      if (hold && focus) setPlotHold(markBeatDrafted(focus.id));
      setStatus(`Added ${Number(json.data.wordCount || countWords(next)).toLocaleString()} words.`);
    } catch (err) { setError(friendlyFetchError(err, 'Continue failed')); }
    finally { setBusy(false); }
  };

  const runWholeBook = async () => {
    setError('');
    const hold = plotHold || loadPlotHold();
    if (!hold?.beats?.length) { setError(nonfiction ? 'Expand a seed into a spine first.' : 'Expand a seed into a plot hold first.'); return; }
    setBusy(true);
    setStep('draft');
    setStatus('Starting background whole-book job…');
    try {
      const res = await fetch('/api/caspa/write/whole-book/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sharedWriteBody(hold, null), sourceText: draftPage, wholeBook: true }),
      });
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success || !json.jobId) throw new Error(json.message || 'Could not start whole-book job');
      try { localStorage.setItem(WHOLE_BOOK_JOB_KEY, json.jobId); } catch {}
      setWholeBookJobId(json.jobId);
      const pending = hold.beats.filter((b) => b.status !== 'drafted');
      setBookProgress({ done: 0, total: pending.length || hold.beats.length, title: 'Queued' });
      setStatus('Whole-book job started. You can leave this page; Caspa will reconnect when you return.');
    } catch (err) {
      setBusy(false);
      setError(friendlyFetchError(err, 'Whole-book job could not start'));
    }
  };

  const forgetStaleJob = () => {
    try { localStorage.removeItem(WHOLE_BOOK_JOB_KEY); } catch {}
    setWholeBookJobId('');
    setBusy(false);
    setBookProgress(null);
    setStatus('Background-job link cleared. Existing draft kept.');
  };

  const runCut = async () => {
    if (!draftPage.trim()) { setError('Nothing to cut yet. Draft first.'); return; }
    setBusy(true); setError('');
    const plan = planQualityCut(draftPage, { mode, targetWordCount: targetWords });
    setCutPlan(plan);
    setStatus(plan.needsCut ? `Cutting by need — ${plan.reasons[0] || 'strengthen the product'}…` : 'Surgical polish only — no forced percentage…');
    try {
      const res = await fetchWithTimeout('/api/caspa/write/cut', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draftPage, mode, targetWordCount: targetWords }) }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Cut failed');
      onDraftChange(json.data.text || '');
      setStep('pack');
      setStatus(`Cut ${json.data.beforeWords} → ${json.data.afterWords} words.`);
    } catch (err) { setError(friendlyFetchError(err, 'Cut failed')); }
    finally { setBusy(false); }
  };

  const runPrizePass = async () => {
    if (!draftPage.trim()) return;
    setBusy(true); setError(''); setStatus(nonfiction ? 'Quality pass assessing readiness…' : 'Prize pass assessing readiness…');
    try {
      const res = await fetchWithTimeout('/api/caspa/write/prize-pass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draftPage, prizeLensId, title: brief.title, mode, targetWordCount: targetWords }) }, AI_LONG_FETCH_TIMEOUT_MS);
      const json = await readApiJson<any>(res);
      if (!res.ok || !json.success) throw new Error(json.message || 'Prize pass failed');
      setQualityScore(Number(json.data.assessment?.overallReadiness || json.data.quality?.overallScore || 0));
      setCritic([json.data.assessment?.judgeComment, ...(json.data.assessment?.fixes || []).map((f: string, i: number) => `${i + 1}. ${f}`)].filter(Boolean).join('\n'));
      setStatus(json.data.readyEnough ? 'Ready enough to export.' : 'Not ready yet — fix the notes, then re-pass.');
    } catch (err) { setError(friendlyFetchError(err, 'Prize pass failed')); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gap: 20, color: '#f4f1e9' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 28, letterSpacing: -0.6, color: '#182033' }}>Just write</h2>
        <p style={{ margin: '8px 0 0', color: '#64708a', maxWidth: 720 }}>
          Seed → spine → whole-book draft → cut → pack. Long whole-book work now runs in the background, so the browser is no longer the life-support machine. · {currentWords.toLocaleString()} / {targetWords.toLocaleString()} words
        </p>
      </div>

      {(mode === 'musical' || showPackLive) && (
        <div style={{ ...darkCard, padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={darkMuted}>{showPackLive ? 'Show in a Box pack is live — drafts honour song list, running order, and cast.' : 'Pack the show first, then draft scenes that turn into numbers.'}</span>
          {onGoShowBox && <button type="button" onClick={onGoShowBox} style={button('#8ea7ff', '#0d111b')}>Open Show in a Box</button>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STEPS.map((s) => {
          const active = s.id === step;
          const idx = STEPS.findIndex((x) => x.id === s.id);
          const currentIdx = STEPS.findIndex((x) => x.id === step);
          const done = idx < currentIdx;
          return (
            <button key={s.id} type="button" onClick={() => setStep(s.id)} title={s.detail} style={{ border: active ? '2px solid #8ea7ff' : '1px solid #c7cfdf', background: active ? '#e8ecff' : done ? '#eef1f7' : '#fff', color: '#182033', borderRadius: 999, padding: '8px 14px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', fontWeight: active ? 700 : 500 }}>
              {done ? <Check size={14} /> : null}{s.label}
            </button>
          );
        })}
      </div>

      {plotHold && <div style={{ fontSize: 13, color: '#64708a' }}>Plot hold: {plotHoldSummary(plotHold)}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <label style={{ display: 'grid', gap: 6, maxWidth: 420, flex: '1 1 240px' }}>
          <span style={labelStyle}>{nonfiction ? 'Quality lens' : 'Prize lens'}</span>
          <select value={prizeLensId} onChange={(e) => setPrizeLensId(e.target.value)} style={lightInput}>
            {lenses.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6, maxWidth: 220, flex: '0 1 180px' }}>
          <span style={labelStyle}>Aspire-to words</span>
          <input type="number" min={100} step={500} value={targetWords} onChange={(e) => onTargetWordCountChange?.(Math.max(100, Number(e.target.value) || 100))} disabled={!onTargetWordCountChange} style={{ ...lightInput, fontWeight: 600 }} />
        </label>
      </div>

      {step === 'seed' && (
        <section style={darkCard}>
          <h3 style={darkH3}>1. Seed</h3>
          <p style={darkMuted}>{nonfiction ? 'One paragraph: thesis, question, concrete pressure. Thin input is fine.' : 'One paragraph: wound, desire, place. Thin input is fine.'}</p>
          <textarea value={seed} onChange={(e) => setSeed(e.target.value)} rows={6} style={darkTextarea} />
          <button type="button" disabled={busy || !seed.trim()} onClick={runSeed} style={button('#8ea7ff', '#0d111b')}>{busy ? <Loader size={16} className="spin" /> : <Sparkles size={16} />} Expand into proposal</button>
        </section>
      )}

      {step === 'spine' && (
        <section style={darkCard}>
          <h3 style={darkH3}>2. Spine</h3>
          {proposal ? <div style={{ display: 'grid', gap: 12 }}>
            <strong>{proposal.title || brief.title}</strong>
            <p style={{ margin: 0 }}>{proposal.premise}</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{(proposal.chapters || proposal.scenePlan || []).slice(0, 12).map((ch: any, i: number) => <li key={i} style={{ marginBottom: 6 }}>{typeof ch === 'string' ? ch : `${ch.title || `Beat ${i + 1}`}: ${ch.turn || ch.endingImage || ''}`}</li>)}</ul>
            <button type="button" onClick={() => setStep('draft')} style={button('#8ea7ff', '#0d111b')}><PenLine size={16} /> Accept spine → draft</button>
          </div> : <div><p style={darkMuted}>No spine yet. Expand a seed first, or jump straight to draft.</p><button type="button" onClick={() => setStep('draft')} style={button('#20283a', '#f4f1e9')}>Skip to draft</button></div>}
        </section>
      )}

      {step === 'draft' && (
        <section style={darkCard}>
          <h3 style={darkH3}>3. Whole-book draft</h3>
          <p style={darkMuted}>Starts once, returns immediately, then works beat-by-beat on the server. Close the tab if you like; reopening Caspa reconnects to the job and restores completed material.</p>
          {bookProgress && <div style={{ marginBottom: 14, color: '#cbd3e7', fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{bookProgress.done}/{bookProgress.total} — <strong>{bookProgress.title}</strong></span><span>{Math.round((bookProgress.done / Math.max(1, bookProgress.total)) * 100)}%</span></div>
            <div style={{ marginTop: 8, height: 9, borderRadius: 999, background: '#293249', overflow: 'hidden' }}><div style={{ width: `${Math.round((bookProgress.done / Math.max(1, bookProgress.total)) * 100)}%`, height: '100%', background: '#8ea7ff', transition: 'width .35s ease' }} /></div>
          </div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={wholeBookRunning} onClick={runWholeBook} style={button('#8ea7ff', '#0d111b')}>{wholeBookRunning ? <Loader size={16} className="spin" /> : <Wand2 size={16} />}{wholeBookRunning ? ' Writing in background…' : ' Write whole book'}</button>
            <button type="button" disabled={busy} onClick={runPrizeDraft} style={button('#20283a', '#f4f1e9')}><PenLine size={16} /> Opening {nonfiction ? 'section' : 'chapter'} only</button>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runContinue} style={button('#151b29', '#b9c7ff')}><PenLine size={16} /> Continue next beat</button>
            {wholeBookRunning && <button type="button" onClick={forgetStaleJob} title="Only use this if the server job no longer exists" style={button('#151b29', '#aeb7ca')}><RotateCcw size={16} /> Disconnect view</button>}
          </div>
          {draftPage.trim() && <textarea value={draftPage} onChange={(e) => onDraftChange(e.target.value)} rows={16} disabled={wholeBookRunning} style={{ ...darkTextarea, marginTop: 14, opacity: wholeBookRunning ? .82 : 1 }} />}
        </section>
      )}

      {step === 'cut' && (
        <section style={darkCard}>
          <h3 style={darkH3}>4. Cut</h3>
          <p style={darkMuted}>Cut sludge by need — not a fixed percentage. Keep voice and turns.</p>
          {cutPlan && <div style={{ ...darkMuted, marginBottom: 14 }}>{cutPlan.needsCut ? `Quality ${cutPlan.qualityScore}/100 · lean toward ~${cutPlan.suggestedAfterWords.toLocaleString()} words if that improves the work.` : `Quality ${cutPlan.qualityScore}/100 · surgical polish only.`}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runCut} style={button('#8ea7ff', '#0d111b')}>{busy ? <Loader size={16} className="spin" /> : <Scissors size={16} />} Cut & tighten</button>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runPrizePass} style={button('#20283a', '#f4f1e9')}>{nonfiction ? 'Quality pass' : 'Prize pass'}</button>
          </div>
          <textarea value={draftPage} onChange={(e) => onDraftChange(e.target.value)} rows={14} style={{ ...darkTextarea, marginTop: 14 }} />
        </section>
      )}

      {step === 'pack' && (
        <section style={darkCard}>
          <h3 style={darkH3}>5. Pack</h3>
          <p style={darkMuted}>Export when the draft earns it. Or keep polishing in Workshop / Gold.</p>
          {qualityScore != null && <p style={{ margin: '0 0 12px', fontWeight: 700 }}>Readiness score: {qualityScore}/100</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={onGoPublish} style={button('#8ea7ff', '#0d111b')}><Download size={16} /> Publish pack</button>
            <button type="button" onClick={onGoWorkshop} style={button('#20283a', '#f4f1e9')}>Open Workshop</button>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runPrizePass} style={button('#151b29', '#b9c7ff')}>Re-run {nonfiction ? 'quality' : 'prize'} pass</button>
          </div>
        </section>
      )}

      {(status || error) && <div style={{ padding: 13, borderRadius: 14, border: `1px solid ${error ? '#d9827b' : '#9aabe8'}`, background: error ? '#fff0ef' : '#edf0ff', color: error ? '#922d25' : '#27366d', lineHeight: 1.45 }}>{error || status}</div>}
      {critic && <section style={darkCard}><h3 style={darkH3}>{nonfiction ? 'Assessor notes' : 'Critic / prize notes'}</h3><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, color: '#cbd3e7' }}>{critic}</pre></section>}
    </div>
  );
}

const darkCard: React.CSSProperties = {
  background: '#151b29', color: '#f4f1e9', border: '1px solid rgba(142,167,255,.20)', borderRadius: 20, padding: 20,
  boxShadow: '0 18px 42px rgba(13,17,27,.18)',
};
const darkH3: React.CSSProperties = { margin: '0 0 8px', fontSize: 18, color: '#f4f1e9' };
const darkMuted: React.CSSProperties = { margin: '0 0 14px', color: '#aeb7ca', lineHeight: 1.5 };
const darkTextarea: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 14, border: '1px solid #33405c', padding: 14, fontSize: 15, lineHeight: 1.55, background: '#0d111b', color: '#f4f1e9', resize: 'vertical' };
const lightInput: React.CSSProperties = { padding: 12, borderRadius: 12, border: '1px solid #c7cfdf', background: '#fff', color: '#182033' };
const labelStyle: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#64708a' };
function button(bg: string, color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(142,167,255,.24)', background: bg, color, borderRadius: 14, padding: '12px 16px', cursor: 'pointer', fontWeight: 650 };
}
