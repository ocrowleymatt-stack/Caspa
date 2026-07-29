/**
 * Quick Write — five-step prize path: Seed → Spine → Draft → Cut → Pack.
 * Simple surface; plot hold + prize engine underneath.
 */

import React, { useEffect, useState } from 'react';
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

type Props = {
  brief: {
    title: string;
    mode: string;
    idea: string;
    tone: string;
    output: string;
  };
  draftPage: string;
  onDraftChange: (text: string) => void;
  onGoPublish: () => void;
  onGoWorkshop: () => void;
};

const STEPS: Array<{ id: StepId; label: string; detail: string }> = [
  { id: 'seed', label: 'Seed', detail: 'Capture the wound and desire' },
  { id: 'spine', label: 'Spine', detail: 'Chapter turns, no prose' },
  { id: 'draft', label: 'Draft', detail: 'Write the whole held manuscript' },
  { id: 'cut', label: 'Cut', detail: 'Kill the sludge' },
  { id: 'pack', label: 'Pack', detail: 'Export when ready' },
];

function chapterHeading(title: string, index: number) {
  const clean = title.trim() || `Chapter ${index + 1}`;
  return `\n\n# ${clean}\n\n`;
}

export default function QuickWrite({ brief, draftPage, onDraftChange, onGoPublish, onGoWorkshop }: Props) {
  const [step, setStep] = useState<StepId>('seed');
  const [seed, setSeed] = useState(brief.idea || '');
  const [lenses, setLenses] = useState<AwardLens[]>(BUILTIN_AWARD_LENSES);
  const [prizeLensId, setPrizeLensId] = useState('booker-literary');
  const [proposal, setProposal] = useState<any>(null);
  const [critic, setCritic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [bookProgress, setBookProgress] = useState<{ done: number; total: number; title: string } | null>(null);
  const [plotHold, setPlotHold] = useState<PlotHold | null>(() => loadPlotHold());

  useEffect(() => {
    fetch('/api/caspa/write/awards')
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.lenses?.length) setLenses(j.data.lenses);
      })
      .catch(() => {});
  }, []);

  const sharedWriteBody = (hold: PlotHold | null, focus?: { title: string; turn: string } | null) => ({
    mode: writeModeForBrief(brief.mode),
    genre: proposal?.genre || hold?.genre || 'Literary fiction',
    premise: proposal?.premise || hold?.premise || seed || brief.idea,
    tone: proposal?.tone || hold?.tone || brief.tone,
    prizeLensId,
    plotHold: hold || undefined,
    focusBeat: focus ? `${focus.title}: ${focus.turn}` : undefined,
  });

  const runSeed = async () => {
    setBusy(true);
    setError('');
    setStatus('Expanding seed into a prize-ambition proposal…');
    try {
      const res = await fetch('/api/caspa/write/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed, mode: writeModeForBrief(brief.mode) }),
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
    setStatus('Plan → draft → critic → award rewrite. Plot hold enforced…');
    try {
      const hold = plotHold || loadPlotHold();
      const focus = nextPendingBeat(hold);
      const res = await fetch('/api/caspa/write/prize-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sharedWriteBody(hold, focus),
          output: brief.output || 'Opening chapter (1800–2800 words)',
          sourceText: draftPage,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Draft failed');
      onDraftChange(json.data.text || '');
      setCritic(json.data.criticReport || '');
      setQualityScore(json.data.quality?.overallScore ?? null);
      if (!proposal && json.data.plan) {
        const held = plotHoldFromProposal(json.data.plan, brief.title);
        setPlotHold(held);
        setProposal({ ...json.data.plan, title: brief.title });
      }
      if (focus) {
        const updated = markBeatDrafted(focus.id);
        if (updated) setPlotHold(updated);
      }
      setStep('cut');
      setStatus('Opening chapter written. Use Write whole book to finish the rest, or cut this chapter.');
    } catch (err: any) {
      setError(err.message || 'Prize draft failed');
    } finally {
      setBusy(false);
    }
  };

  const runContinue = async () => {
    setBusy(true);
    setError('');
    setStatus('Writing the next held beat…');
    try {
      const hold = plotHold || loadPlotHold();
      const focus = nextPendingBeat(hold);
      const res = await fetch('/api/caspa/write/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sharedWriteBody(hold, focus),
          sourceText: draftPage,
          wholeBook: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Continue failed');
      const addition = String(json.data.text || '').trim();
      const heading = focus ? chapterHeading(focus.title, (hold?.beats.findIndex((b) => b.id === focus.id) ?? 0)) : '\n\n';
      onDraftChange(draftPage.trim() ? `${draftPage.trim()}${heading}${addition}` : addition);
      if (focus) {
        const updated = markBeatDrafted(focus.id);
        if (updated) setPlotHold(updated);
      }
      setStep('draft');
      setStatus(focus ? `Wrote: ${focus.title}` : 'Next section appended.');
    } catch (err: any) {
      setError(err.message || 'Continue failed');
    } finally {
      setBusy(false);
    }
  };

  const runWholeBook = async () => {
    setBusy(true);
    setError('');
    setBookProgress(null);

    try {
      let hold = plotHold || loadPlotHold();
      if (!hold?.beats?.length) {
        throw new Error('Accept a spine first (Seed → Expand) so Caspa knows every chapter to write.');
      }

      const total = hold.beats.length;
      let done = hold.beats.filter((b) => b.status === 'drafted').length;
      let manuscript = draftPage.trim();
      let lastCritic = '';
      let lastScore: number | null = null;

      while (true) {
        const focus = nextPendingBeat(hold);
        if (!focus) break;

        const index = hold.beats.findIndex((b) => b.id === focus.id);
        setBookProgress({ done, total, title: focus.title });
        setStatus(`Writing ${focus.title} (${done + 1}/${total})…`);

        if (!manuscript) {
          // Opening chapter: full prize pipeline once.
          const res = await fetch('/api/caspa/write/prize-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...sharedWriteBody(hold, focus),
              output: `Full opening chapter: ${focus.title} (1800–2800 words). Then stop — later chapters will follow.`,
              sourceText: '',
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.message || `Failed on ${focus.title}`);
          manuscript = String(json.data.text || '').trim();
          lastCritic = json.data.criticReport || '';
          lastScore = json.data.quality?.overallScore ?? null;
          if (!proposal && json.data.plan) {
            setProposal({ ...json.data.plan, title: brief.title });
          }
        } else {
          const res = await fetch('/api/caspa/write/continue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...sharedWriteBody(hold, focus),
              sourceText: manuscript,
              wholeBook: true,
              output: `Full chapter: ${focus.title} (1500–2500 words). Do not restart the book or repeat prior chapters.`,
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) throw new Error(json.message || `Failed on ${focus.title}`);
          const addition = String(json.data.text || '').trim();
          manuscript = `${manuscript.trim()}${chapterHeading(focus.title, index)}${addition}`;
        }

        onDraftChange(manuscript);
        const updated = markBeatDrafted(focus.id);
        if (updated) {
          hold = updated;
          setPlotHold(updated);
        } else {
          // Defensive: avoid infinite loop if storage write fails.
          hold = {
            ...hold,
            beats: hold.beats.map((b) => (b.id === focus.id ? { ...b, status: 'drafted' as const } : b)),
          };
          setPlotHold(hold);
        }
        done += 1;
        setBookProgress({ done, total, title: focus.title });
      }

      if (lastCritic) setCritic(lastCritic);
      if (lastScore != null) setQualityScore(lastScore);
      setStep('cut');
      setStatus(`Whole book drafted: ${done}/${total} chapters. Cut sludge, then pack.`);
      setBookProgress(null);
    } catch (err: any) {
      setError(err.message || 'Whole-book draft failed');
    } finally {
      setBusy(false);
    }
  };

  const runCut = async () => {
    if (!draftPage.trim()) {
      setError('Nothing to cut yet. Draft first.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('Cutting 30% while keeping turns and voice…');
    try {
      const res = await fetch('/api/caspa/write/cut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draftPage, reduction: 0.3 }),
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
    setStatus('Prize pass assessing readiness…');
    try {
      const res = await fetch('/api/caspa/write/prize-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draftPage, prizeLensId, title: brief.title }),
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
          Five steps. Seed → spine → whole-book draft → cut → pack. Caspa writes every held chapter in order.
        </p>
      </div>

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

      <label style={{ display: 'grid', gap: 6, maxWidth: 420 }}>
        <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#8a7d6c' }}>Prize lens</span>
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

      {step === 'seed' && (
        <section style={card}>
          <h3 style={h3}>1. Seed</h3>
          <p style={muted}>One paragraph: wound, desire, place. Thin input is fine.</p>
          <textarea
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            rows={6}
            placeholder="A Dick Turpin stage comedy set in Milton Keynes…"
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
                  <em>Wound:</em> {proposal.centralWound}
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
            Writes every pending chapter on the held spine, in order. Opening chapter gets the prize pipeline;
            later chapters continue from the manuscript so far.
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
              Opening chapter only
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
          <p style={muted}>Remove 30% sludge. Keep voice and turns.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runCut} style={btn('#1f2937', '#fff')}>
              {busy ? <Loader size={16} className="spin" /> : <Scissors size={16} />}
              Cut & tighten
            </button>
            <button type="button" disabled={busy || !draftPage.trim()} onClick={runPrizePass} style={btn('#fffaf2', '#4a3b28')}>
              Prize pass
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
              Re-run prize pass
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
          <h3 style={h3}>Critic / prize notes</h3>
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
