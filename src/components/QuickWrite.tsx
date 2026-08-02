/**
 * Quick Write — five-step prize path: Seed → Spine → Draft → Cut → Pack.
 * Current UI style; newer functions (aspire-to words, quality cut, mode-aware copy) underneath.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader, Sparkles, Wand2, Scissors, Download, PenLine } from 'lucide-react';
import { BUILTIN_AWARD_LENSES, type AwardLens } from '../services/literary/awardsShelf';
import {
  loadPlotHold,
  plotHoldFromProposal,
  nextPendingBeat,
  markBeatDrafted,
  plotHoldSummary,
  type PlotHold,
} from '../services/plotHoldService';
import {
  countWords,
  defaultTargetWordCount,
  planQualityCut,
  type CutPlan,
} from '../services/wordCountService';
import { formatShowPackForWriting, hasShowBoxContent } from '../services/showBoxService';

type StepId = 'seed' | 'spine' | 'draft' | 'cut' | 'pack';

function writeModeForBrief(mode: string): string {
  if (mode === 'gold') return 'polish';
  if (mode === 'picture') return 'novel';
  if (
    mode === 'nonfiction' ||
    mode === 'essay' ||
    mode === 'poetry' ||
    mode === 'script' ||
    mode === 'musical' ||
    mode === 'adaptation' ||
    mode === 'chaos' ||
    mode === 'novel'
  ) {
    return mode;
  }
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
  if (isNonfictionMode(mode)) {
    return [
      { id: 'seed', label: 'Seed', detail: 'Capture the thesis and question' },
      { id: 'spine', label: 'Spine', detail: 'Section turns, no prose' },
      { id: 'draft', label: 'Draft', detail: 'Write the whole held manuscript' },
      { id: 'cut', label: 'Cut', detail: 'Cut only what weakens the argument' },
      { id: 'pack', label: 'Pack', detail: 'Export when ready' },
    ];
  }
  return [
    { id: 'seed', label: 'Seed', detail: 'Capture the wound and desire' },
    { id: 'spine', label: 'Spine', detail: 'Chapter turns, no prose' },
    { id: 'draft', label: 'Draft', detail: 'Write the whole held manuscript' },
    { id: 'cut', label: 'Cut', detail: 'Cut only what weakens the product' },
    { id: 'pack', label: 'Pack', detail: 'Export when ready' },
  ];
}

function sectionHeading(title: string, index: number, mode: string) {
  const kind = isNonfictionMode(mode) ? 'Section' : mode === 'script' || mode === 'musical' ? 'Scene' : 'Chapter';
  const clean = title.trim() || `${kind} ${index + 1}`;
  return `\n\n# ${clean}\n\n`;
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
  const [prizeLensId, setPrizeLensId] = useState(
    mode === 'essay' ? 'essay-orwell' : nonfiction ? 'pulitzer-nonfiction' : 'booker-literary'
  );
  const [proposal, setProposal] = useState<any>(null);
  const [critic, setCritic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [bookProgress, setBookProgress] = useState<{ done: number; total: number; title: string } | null>(null);
  const [plotHold, setPlotHold] = useState<PlotHold | null>(() => loadPlotHold());
  const [cutPlan, setCutPlan] = useState<CutPlan | null>(null);

  const targetWords =
    typeof brief.targetWordCount === 'number' && brief.targetWordCount > 0
      ? brief.targetWordCount
      : defaultTargetWordCount(brief.mode);
  const currentWords = useMemo(() => countWords(draftPage), [draftPage]);

  useEffect(() => {
    fetch('/api/caspa/write/awards')
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.lenses?.length) {
          setLenses(j.data.lenses);
          const ids = j.data.lenses.map((l: AwardLens) => l.id) as string[];
          if (mode === 'essay' && ids.includes('essay-orwell')) {
            setPrizeLensId((prev) => (prev === 'booker-literary' ? 'essay-orwell' : prev));
          } else if (nonfiction && ids.includes('pulitzer-nonfiction')) {
            setPrizeLensId((prev) => (prev === 'booker-literary' ? 'pulitzer-nonfiction' : prev));
          }
        }
      })
      .catch(() => {});
  }, [mode, nonfiction]);

  useEffect(() => {
    if (!draftPage.trim()) {
      setCutPlan(null);
      return;
    }
    setCutPlan(planQualityCut(draftPage, { mode, targetWordCount: targetWords }));
  }, [draftPage, mode, targetWords]);

  const sharedWriteBody = (hold: PlotHold | null, focus?: { title: string; turn: string } | null) => {
    const basePremise = proposal?.premise || hold?.premise || seed || brief.idea;
    const showPack =
      mode === 'musical' || mode === 'script' ? formatShowPackForWriting() : '';
    return {
      mode,
      genre:
        proposal?.genre ||
        hold?.genre ||
        (nonfiction
          ? 'Creative Non-Fiction'
          : mode === 'musical'
            ? 'Musical / Show'
            : mode === 'script'
              ? 'Stage Play'
              : 'Literary fiction'),
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
    setBusy(true);
    setError('');
    setStatus(nonfiction ? 'Expanding seed into a non-fiction proposal…' : 'Expanding seed into a prize-ambition proposal…');
    try {
      const res = await fetch('/api/caspa/write/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed, mode }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Seed failed');
      setProposal(json.data);
      const held = plotHoldFromProposal(json.data || {}, brief.title);
      setPlotHold(held);
      if (json.data?.premise) setSeed(json.data.premise);
      setStep('spine');
      setStatus(`Plot held. ${plotHoldSummary(held)}`);
    } catch (err: any) {
      setError(err.message || 'Seed failed');
    } finally {
      setBusy(false);
    }
  };

  const runPrizeDraft = async () => {
    setBusy(true);
    setError('');
    setStatus(nonfiction ? 'Drafting opening section…' : 'Drafting opening chapter…');
    try {
      const hold = plotHold || loadPlotHold();
      const focus = nextPendingBeat(hold);
      const res = await fetch('/api/caspa/write/prize-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sharedWriteBody(hold, focus),
          output: nonfiction
            ? 'Full opening section for the current focus beat — hit the aspire-to section word target'
            : 'Full opening chapter for the current focus beat — hit the aspire-to section word target',
          sourceText: draftPage,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Draft failed');
      const text = json.data.text || '';
      onDraftChange(text);
      if (hold && focus) setPlotHold(markBeatDrafted(focus.id));
      setCritic(json.data.criticReport || '');
      setQualityScore(json.data.quality?.overallScore ?? null);
      setStep('draft');
      const got = json.data.wordCount?.toLocaleString?.() || countWords(text).toLocaleString();
      const aim = json.data.sectionTarget ? ` (target ${Number(json.data.sectionTarget).toLocaleString()})` : '';
      setStatus(`Drafted ${got} words${aim}.`);
    } catch (err: any) {
      setError(err.message || 'Draft failed');
    } finally {
      setBusy(false);
    }
  };

  const runContinue = async () => {
    setBusy(true);
    setError('');
    setStatus('Continuing next beat…');
    try {
      const hold = plotHold || loadPlotHold();
      const focus = nextPendingBeat(hold);
      const res = await fetch('/api/caspa/write/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sharedWriteBody(hold, focus),
          sourceText: draftPage,
          wholeBook: false,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Continue failed');
      const next = json.data.text || '';
      const heading = sectionHeading(
        json.data.beatTitle || focus?.title || '',
        (hold?.beats || []).findIndex((b) => b.title === focus?.title),
        mode
      );
      onDraftChange(`${draftPage.trim()}${heading}${next}`.trim());
      if (hold && focus) setPlotHold(markBeatDrafted(focus.id));
      const got = json.data.wordCount?.toLocaleString?.() || countWords(next).toLocaleString();
      const aim = json.data.sectionTarget ? ` (target ${Number(json.data.sectionTarget).toLocaleString()})` : '';
      setStatus(`Added ${got} words${aim}.`);
    } catch (err: any) {
      setError(err.message || 'Continue failed');
    } finally {
      setBusy(false);
    }
  };

  const runWholeBook = async () => {
    setBusy(true);
    setError('');
    setStatus(nonfiction ? 'Writing whole held manuscript…' : 'Writing whole held book…');
    try {
      let hold = plotHold || loadPlotHold();
      if (!hold?.beats?.length) {
        throw new Error(nonfiction ? 'Expand a seed into a spine first.' : 'Expand a seed into a plot hold first.');
      }
      let manuscript = draftPage;
      const pending = hold.beats.filter((b) => (b.status || 'pending') !== 'drafted');
      const total = pending.length || hold.beats.length;
      let done = 0;
      let lastScore: number | null = null;

      for (const beat of hold.beats) {
        if ((beat.status || 'pending') === 'drafted' && manuscript.trim()) continue;
        setBookProgress({ done, total, title: beat.title });
        setStatus(`Writing ${beat.title} (${done + 1}/${total})…`);

        const endpoint = !manuscript.trim() ? '/api/caspa/write/prize-draft' : '/api/caspa/write/continue';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...sharedWriteBody(hold, beat),
            sourceText: manuscript,
            wholeBook: true,
            output: nonfiction
              ? 'Full section for this beat only — hit the aspire-to section word target. Do not restart or repeat prior sections.'
              : 'Full chapter for this beat only — hit the aspire-to section word target. Do not restart or repeat prior chapters.',
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || `Failed on ${beat.title}`);
        const chunk = json.data.text || '';
        if (!manuscript.trim()) {
          manuscript = chunk;
        } else {
          manuscript = `${manuscript.trim()}${sectionHeading(beat.title, done, mode)}${chunk}`.trim();
        }
        onDraftChange(manuscript);
        hold = markBeatDrafted(beat.id) || hold;
        setPlotHold(hold);
        if (json.data.quality?.overallScore != null) lastScore = json.data.quality.overallScore;
        done += 1;
        setBookProgress({ done, total, title: beat.title });
        const sectionAim = json.data.sectionTarget
          ? ` · section ${countWords(chunk).toLocaleString()}/${Number(json.data.sectionTarget).toLocaleString()}`
          : '';
        setStatus(
          `Writing ${beat.title} (${done}/${total}) · book ${countWords(manuscript).toLocaleString()}/${targetWords.toLocaleString()}${sectionAim}`
        );
      }

      if (lastScore != null) setQualityScore(lastScore);
      setStep('cut');
      setStatus(
        `Whole book drafted: ${done}/${total} ${nonfiction ? 'sections' : 'chapters'} · ${countWords(manuscript).toLocaleString()}/${targetWords.toLocaleString()} words. Cut by need, then pack.`
      );
      setBookProgress(null);
    } catch (err: any) {
      setStep('draft');
      setError(
        `${err.message || 'Whole-book draft failed'} — partial manuscript kept. Click Write whole book again to continue remaining ${nonfiction ? 'sections' : 'chapters'}.`
      );
    } finally {
      setBusy(false);
      setBookProgress(null);
    }
  };

  const runCut = async () => {
    if (!draftPage.trim()) {
      setError('Nothing to cut yet. Draft first.');
      return;
    }
    setBusy(true);
    setError('');
    const plan = planQualityCut(draftPage, { mode, targetWordCount: targetWords });
    setCutPlan(plan);
    setStatus(
      plan.needsCut
        ? `Cutting by need — ${plan.reasons[0] || 'strengthen the product'}…`
        : 'Surgical polish only — no forced percentage…'
    );
    try {
      const res = await fetch('/api/caspa/write/cut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draftPage,
          mode,
          targetWordCount: targetWords,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Cut failed');
      onDraftChange(json.data.text || '');
      setStep('pack');
      setStatus(`Cut ${json.data.beforeWords} → ${json.data.afterWords} words.`);
    } catch (err: any) {
      setError(err.message || 'Cut failed');
    } finally {
      setBusy(false);
    }
  };

  const runPrizePass = async () => {
    if (!draftPage.trim()) return;
    setBusy(true);
    setError('');
    setStatus(nonfiction ? 'Quality pass assessing readiness…' : 'Prize pass assessing readiness…');
    try {
      const res = await fetch('/api/caspa/write/prize-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draftPage,
          prizeLensId,
          title: brief.title,
          mode,
          targetWordCount: targetWords,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Prize pass failed');
      setQualityScore(Number(json.data.assessment?.overallReadiness || json.data.quality?.overallScore || 0));
      setCritic(
        [
          json.data.assessment?.judgeComment,
          ...(json.data.assessment?.fixes || []).map((f: string, i: number) => `${i + 1}. ${f}`),
        ]
          .filter(Boolean)
          .join('\n')
      );
      setStatus(json.data.readyEnough ? 'Ready enough to export.' : 'Not prize-ready yet — fix the notes, then re-pass.');
    } catch (err: any) {
      setError(err.message || 'Prize pass failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 28, letterSpacing: -0.6 }}>Just write</h2>
        <p style={{ margin: '8px 0 0', color: '#6d6255', maxWidth: 640 }}>
          Five steps. Seed → spine → whole-book draft → cut → pack. Caspa writes every held{' '}
          {nonfiction ? 'section' : mode === 'script' || mode === 'musical' ? 'scene' : 'chapter'} in order.
          {' '}
          · {currentWords.toLocaleString()} / {targetWords.toLocaleString()} words
        </p>
      </div>

      {(mode === 'musical' || showPackLive) && (
        <div
          style={{
            borderRadius: 16,
            padding: '14px 16px',
            border: '1px solid #eadfce',
            background: '#fff8ea',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 14, color: '#5b4724', lineHeight: 1.45 }}>
            {showPackLive
              ? 'Show in a Box pack is live — drafts honour song list, running order, and cast.'
              : 'Pack the show first (songs + running order), then draft scenes that turn into numbers.'}
          </span>
          {onGoShowBox && (
            <button
              type="button"
              onClick={onGoShowBox}
              style={{
                border: '1px solid #d6a846',
                background: '#d6a846',
                color: '#1d1408',
                borderRadius: 12,
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Open Show in a Box
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STEPS.map((s) => {
          const active = s.id === step;
          const idx = STEPS.findIndex((x) => x.id === s.id);
          const currentIdx = STEPS.findIndex((x) => x.id === step);
          const done = idx < currentIdx;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              title={s.detail}
              style={{
                border: active ? '2px solid #d6a846' : '1px solid #eadfce',
                background: done ? '#f3ecdf' : '#fff',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                fontWeight: active ? 700 : 500,
              }}
            >
              {done ? <Check size={14} /> : null}
              {s.label}
            </button>
          );
        })}
      </div>

      {plotHold && (
        <div style={{ fontSize: 13, color: '#6d6255' }}>Plot hold: {plotHoldSummary(plotHold)}</div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <label style={{ display: 'grid', gap: 6, maxWidth: 420, flex: '1 1 240px' }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#8a7d6c' }}>
            {nonfiction ? 'Quality lens' : 'Prize lens'}
          </span>
          <select
            value={prizeLensId}
            onChange={(e) => setPrizeLensId(e.target.value)}
            style={{ padding: 12, borderRadius: 12, border: '1px solid #eadfce', background: '#fffaf2' }}
          >
            {lenses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6, maxWidth: 220, flex: '0 1 180px' }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#8a7d6c' }}>
            Aspire-to words
          </span>
          <input
            type="number"
            min={100}
            step={500}
            value={targetWords}
            onChange={(e) => onTargetWordCountChange?.(Math.max(100, Number(e.target.value) || 100))}
            disabled={!onTargetWordCountChange}
            style={{ padding: 12, borderRadius: 12, border: '1px solid #eadfce', background: '#fffaf2', fontWeight: 600 }}
          />
        </label>
      </div>

      {step === 'seed' && (
        <section style={card}>
          <h3 style={h3}>1. Seed</h3>
          <p style={muted}>
            {nonfiction
              ? 'One paragraph: thesis, question, concrete pressure. Thin input is fine.'
              : 'One paragraph: wound, desire, place. Thin input is fine.'}
          </p>
          <textarea
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            rows={6}
            placeholder={
              nonfiction
                ? 'A how-to for burned-out carers that refuses empty inspiration…'
                : 'A Dick Turpin stage comedy set in Milton Keynes…'
            }
            style={textarea}
          />
          <button type="button" disabled={busy || !seed.trim()} onClick={runSeed} style={btn('#d6a846', '#1d1408')}>
            {busy ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
            Expand into proposal
          </button>
        </section>
      )}

      {step === 'spine' && (
        <section style={card}>
          <h3 style={h3}>2. Spine</h3>
          {proposal ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <strong>{proposal.title || brief.title}</strong>
              <p style={{ margin: 0 }}>{proposal.premise}</p>
              {proposal.centralWound && (
                <p style={{ margin: 0, color: '#5a4a38' }}>
                  <em>{nonfiction ? 'Central problem:' : 'Wound:'}</em> {proposal.centralWound}
                </p>
              )}
              {proposal.immediateDesire && nonfiction && (
                <p style={{ margin: 0, color: '#5a4a38' }}>
                  <em>Reader payoff:</em> {proposal.immediateDesire}
                </p>
              )}
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(proposal.chapters || proposal.scenePlan || []).slice(0, 12).map((ch: any, i: number) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {typeof ch === 'string' ? ch : `${ch.title || `Beat ${i + 1}`}: ${ch.turn || ch.endingImage || ''}`}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setStep('draft')} style={btn('#1f2937', '#fff')}>
                <PenLine size={16} /> Accept spine → write whole book
              </button>
            </div>
          ) : (
            <div>
              <p style={muted}>No spine yet. Expand a seed first, or jump straight to draft.</p>
              <button type="button" onClick={() => setStep('draft')} style={btn('#1f2937', '#fff')}>
                Skip to draft
              </button>
            </div>
          )}
        </section>
      )}

      {step === 'draft' && (
        <section style={card}>
          <h3 style={h3}>3. Whole-book draft</h3>
          <p style={muted}>
            {nonfiction
              ? 'Writes every pending section on the held spine, in order. Opening section gets the quality pipeline; later sections continue from the manuscript so far.'
              : 'Writes every pending chapter on the held spine, in order. Opening chapter gets the prize pipeline; later chapters continue from the manuscript so far.'}
          </p>
          {bookProgress && (
            <div style={{ marginBottom: 12, fontSize: 14, color: '#5a4a38' }}>
              Progress: {bookProgress.done}/{bookProgress.total} — writing <strong>{bookProgress.title}</strong>
              <div
                style={{
                  marginTop: 8,
                  height: 8,
                  borderRadius: 999,
                  background: '#eadfce',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round((bookProgress.done / Math.max(1, bookProgress.total)) * 100)}%`,
                    height: '100%',
                    background: '#d6a846',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} onClick={runWholeBook} style={btn('#d6a846', '#1d1408')}>
              {busy ? <Loader size={16} className="spin" /> : <Wand2 size={16} />}
              Write whole book
            </button>
            <button type="button" disabled={busy} onClick={runPrizeDraft} style={btn('#1f2937', '#fff')}>
              {busy ? <Loader size={16} className="spin" /> : <PenLine size={16} />}
              Opening {nonfiction ? 'section' : 'chapter'} only
            </button>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runContinue} style={btn('#fffaf2', '#4a3b28')}>
              {busy ? <Loader size={16} className="spin" /> : <PenLine size={16} />}
              Continue next beat
            </button>
          </div>
          {draftPage.trim() && (
            <textarea value={draftPage} onChange={(e) => onDraftChange(e.target.value)} rows={16} style={{ ...textarea, marginTop: 14 }} />
          )}
        </section>
      )}

      {step === 'cut' && (
        <section style={card}>
          <h3 style={h3}>4. Cut</h3>
          <p style={muted}>Cut sludge by need — not a fixed percentage. Keep voice and turns.</p>
          {cutPlan && (
            <div style={{ ...muted, marginBottom: 14 }}>
              {cutPlan.needsCut
                ? `Quality ${cutPlan.qualityScore}/100 · lean toward ~${cutPlan.suggestedAfterWords.toLocaleString()} words if that improves the work.`
                : `Quality ${cutPlan.qualityScore}/100 · surgical polish only.`}
              {cutPlan.reasons.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  {cutPlan.reasons.slice(0, 3).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runCut} style={btn('#1f2937', '#fff')}>
              {busy ? <Loader size={16} className="spin" /> : <Scissors size={16} />}
              Cut & tighten
            </button>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runPrizePass} style={btn('#fffaf2', '#4a3b28')}>
              {nonfiction ? 'Quality pass' : 'Prize pass'}
            </button>
          </div>
          <textarea value={draftPage} onChange={(e) => onDraftChange(e.target.value)} rows={14} style={{ ...textarea, marginTop: 14 }} />
        </section>
      )}

      {step === 'pack' && (
        <section style={card}>
          <h3 style={h3}>5. Pack</h3>
          <p style={muted}>Export when the draft earns it. Or keep polishing in Workshop / Gold.</p>
          {qualityScore != null && (
            <p style={{ margin: '0 0 12px', fontWeight: 700 }}>Readiness score: {qualityScore}/100</p>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={onGoPublish} style={btn('#d6a846', '#1d1408')}>
              <Download size={16} /> Publish pack
            </button>
            <button type="button" onClick={onGoWorkshop} style={btn('#fffaf2', '#4a3b28')}>
              Open Workshop
            </button>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runPrizePass} style={btn('#1f2937', '#fff')}>
              Re-run {nonfiction ? 'quality' : 'prize'} pass
            </button>
          </div>
        </section>
      )}

      {(status || error) && (
        <div style={{ padding: 12, borderRadius: 14, background: error ? '#fff0ef' : '#f3ecdf', color: error ? '#a02b20' : '#3d3428' }}>
          {error || status}
        </div>
      )}

      {critic && (
        <section style={{ ...card, background: '#faf7f1' }}>
          <h3 style={h3}>{nonfiction ? 'Assessor notes' : 'Critic / prize notes'}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5 }}>{critic}</pre>
        </section>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e8e1d4',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 12px 40px rgba(20, 16, 10, 0.05)',
};

const h3: React.CSSProperties = { margin: '0 0 8px', fontSize: 18 };
const muted: React.CSSProperties = { margin: '0 0 14px', color: '#6d6255' };
const textarea: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 14,
  border: '1px solid #eadfce',
  padding: 14,
  fontSize: 15,
  lineHeight: 1.55,
  background: '#fffaf2',
  resize: 'vertical',
};

function btn(bg: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #eadfce',
    background: bg,
    color,
    borderRadius: 14,
    padding: '12px 16px',
    cursor: 'pointer',
    fontWeight: 600,
  };
}
