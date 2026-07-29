/**
 * Show in a Box — book, songs, running order, music sketch, production pack
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clapperboard,
  Copy,
  Download,
  Hammer,
  Loader,
  Music2,
  PenLine,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { getProjectKey } from '../services/researchLibraryService';
import {
  assembleShowPack,
  createMusicSketch,
  loadShowBox,
  saveShowBox,
  showBoxPieceCount,
  syncShowPackToResearch,
  type ShowBoxBriefLike,
  type ShowBoxState,
} from '../services/showBoxService';
import { recordProjectSnapshot } from '../services/projectShelfService';

export type ShowBriefLike = ShowBoxBriefLike;

type PackPiece = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
};

interface Props {
  brief: ShowBriefLike;
  draftPage: string;
  onDraftChange: (text: string) => void;
  onBriefChange?: (patch: Partial<ShowBriefLike>) => void;
  onOpenWorkshop: () => void;
  onOpenWrite: () => void;
  onOpenPublish: () => void;
  onOpenCanvas: () => void;
}

async function aiText(prompt: string, maxTokens = 1800): Promise<string> {
  const res = await fetch('/api/ai/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  const json = await res.json();
  if (!res.ok || !json.result) throw new Error(json.message || 'Generation failed');
  return String(json.result).trim();
}

export default function ShowBoxStudio({
  brief,
  draftPage,
  onDraftChange,
  onBriefChange,
  onOpenWorkshop,
  onOpenWrite,
  onOpenPublish,
  onOpenCanvas,
}: Props) {
  const [state, setState] = useState<ShowBoxState>(loadShowBox);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const projectKey = getProjectKey(brief);

  useEffect(() => {
    saveShowBox(state);
    syncShowPackToResearch(projectKey, brief);
    try {
      recordProjectSnapshot(brief);
    } catch {
      /* shelf optional while launching */
    }
  }, [state, projectKey, brief]);

  const bookWords = draftPage.trim().split(/\s+/).filter(Boolean).length;
  const packMeta = showBoxPieceCount(state);

  const pieces: PackPiece[] = useMemo(
    () => [
      {
        id: 'book',
        label: 'Book / scenes',
        detail: bookWords > 0 ? `${bookWords.toLocaleString()} words on the page` : 'Draft scenes in Just write or White Page',
        done: bookWords >= 80,
      },
      ...packMeta.pieces.map((p) => ({
        id: p.id,
        label: p.label,
        detail: p.done ? `${p.label} locked` : `Build ${p.label.toLowerCase()}`,
        done: p.done,
      })),
    ],
    [bookWords, packMeta.pieces]
  );

  const doneCount = pieces.filter((p) => p.done).length;
  const fullPack = useMemo(() => assembleShowPack(brief, draftPage, state), [brief, draftPage, state]);

  const patch = (partial: Partial<ShowBoxState>) => setState((prev) => ({ ...prev, ...partial }));

  const generateSongList = async () => {
    setBusy('songs');
    setStatus('Building song list…');
    try {
      const text = await aiText(`You are Caspa packing a show in a box.

SHOW: ${brief.title}
PREMISE: ${brief.idea}
TONE: ${brief.tone}
AUDIENCE: ${brief.audience}

Return a concrete SONG LIST only (markdown):
- Number each song
- Title
- Who sings (character / ensemble)
- What the number turns (power, desire, revelation, comic disaster)
- Rough style/tempo note
8–14 songs. No preamble.`);
      patch({ songList: text });
      setStatus('Song list ready.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Song list failed');
    } finally {
      setBusy(null);
    }
  };

  const generateRunningOrder = async () => {
    setBusy('order');
    setStatus('Sequencing the show…');
    try {
      const text = await aiText(`You are Caspa packing a show in a box.

SHOW: ${brief.title}
PREMISE: ${brief.idea}
TONE: ${brief.tone}
EXISTING SONG LIST:
${state.songList || '(none yet — invent a sensible list inline)'}

Return a RUNNING ORDER only (markdown):
Act One / interval / Act Two (or suitable structure).
Interleave book scenes and songs. Every unit must say what turns.
No preamble.`);
      patch({ runningOrder: text });
      setStatus('Running order ready.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Running order failed');
    } finally {
      setBusy(null);
    }
  };

  const generateCast = async () => {
    setBusy('cast');
    setStatus('Casting the company…');
    try {
      const text = await aiText(`You are Caspa packing a show in a box.

SHOW: ${brief.title}
PREMISE: ${brief.idea}
RUNNING ORDER:
${state.runningOrder || '(not yet — infer from premise)'}
SONG LIST:
${state.songList || '(infer)'}

Return CAST & DOUBLES only (markdown):
Principal roles with one-line want/wound, suggested doubles for a lean company, chorus/ensemble notes, casting red flags.
No preamble.`);
      patch({ castNotes: text });
      setStatus('Cast notes ready.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Cast notes failed');
    } finally {
      setBusy(null);
    }
  };

  const generateProductionPack = async () => {
    setBusy('pack');
    setStatus('Writing production pack…');
    try {
      const text = await aiText(`You are Caspa packing a show in a box for producers and directors.

SHOW: ${brief.title}
PREMISE: ${brief.idea}
TONE: ${brief.tone}
AUDIENCE: ${brief.audience}
REQUIRED OUTPUT: ${brief.output}
RUNNING ORDER:
${state.runningOrder || '(infer)'}
SONG LIST:
${state.songList || '(infer)'}
CAST:
${state.castNotes || '(infer)'}

Return a PRODUCTION PACK only (markdown):
1. One-page pitch
2. Staging concept (set that can tour / fit a box)
3. Band / MD notes
4. Rehearsal schedule sketch (2-week intensive)
5. Props / costume essentials
6. Rights / risk notes (fictional, practical)
7. What still needs writing
Concrete. No fluff. No preamble.`);
      patch({ productionPack: text });
      setStatus('Production pack ready.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Production pack failed');
    } finally {
      setBusy(null);
    }
  };

  const writeMusicSketch = () => {
    const sketch = createMusicSketch(brief.idea, brief.tone, brief.title);
    patch({ musicSketch: sketch });
    setStatus('Music sketch written. Play the demo or send it to White Page.');
  };

  const playMusicDemo = async () => {
    setMusicPlaying(true);
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      setStatus('This browser cannot play the built-in demo synth. Use the export prompt instead.');
      setMusicPlaying(false);
      return;
    }

    const ctx = new AudioContextClass();
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    const now = ctx.currentTime;
    const bpm = 126;
    const beat = 60 / bpm;
    const progression = [293.66, 233.08, 261.63, 220.0, 349.23, 261.63, 293.66, 440.0];

    progression.forEach((freq, index) => {
      const start = now + index * beat * 2;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index % 2 ? 'triangle' : 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + beat * 1.8);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + beat * 2);

      const top = ctx.createOscillator();
      const topGain = ctx.createGain();
      top.type = 'square';
      top.frequency.value = freq * (index % 3 === 0 ? 2 : 1.5);
      topGain.gain.setValueAtTime(0.0001, start + beat * 0.5);
      topGain.gain.exponentialRampToValueAtTime(0.08, start + beat * 0.55);
      topGain.gain.exponentialRampToValueAtTime(0.0001, start + beat * 1.4);
      top.connect(topGain).connect(master);
      top.start(start + beat * 0.5);
      top.stop(start + beat * 1.5);
    });

    setTimeout(() => {
      ctx.close();
      setMusicPlaying(false);
    }, progression.length * beat * 2000 + 400);
  };

  const appendToDraft = (block: string, label: string) => {
    if (!block.trim()) return;
    const next = draftPage.trim() ? `${draftPage.trim()}\n\n---\n\n${block.trim()}` : block.trim();
    onDraftChange(next);
    setStatus(`${label} sent to White Page.`);
  };

  const copyFullPack = async () => {
    await navigator.clipboard.writeText(fullPack);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    setStatus('Full show-in-a-box pack copied.');
  };

  const assembleIntoDraft = () => {
    onDraftChange(fullPack);
    onBriefChange?.({
      output: 'Show in a box: book, song list, running order, music sketch, cast, production pack.',
    });
    setStatus('Full pack assembled into White Page.');
  };

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <div style={kicker}>Show in a Box</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
            Pack the whole show
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: '#73695d', fontSize: 17, lineHeight: 1.5 }}>
            Book, songs, running order, music sketch, cast doubles, production pack — one box a company can open and rehearse.
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: '#8a7a66' }}>
            {brief.title} · {doneCount} of {pieces.length} pieces packed
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 22 }}>
          {pieces.map((p) => (
            <div
              key={p.id}
              style={{
                borderRadius: 16,
                padding: 14,
                border: `1px solid ${p.done ? '#c6e7d4' : '#eadfce'}`,
                background: p.done ? '#f0fdf4' : '#fffdf8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14, color: '#21180f' }}>
                {p.done ? <Check size={16} color="#15803d" /> : <span style={{ width: 16, height: 16, borderRadius: 999, border: '1px solid #d8c9b4' }} />}
                {p.label}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#73695d', lineHeight: 1.4 }}>{p.detail}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
          <button type="button" onClick={generateSongList} disabled={!!busy} style={primaryBtn}>
            {busy === 'songs' ? <Loader size={16} className="spin" /> : <Music2 size={16} />} Song list
          </button>
          <button type="button" onClick={generateRunningOrder} disabled={!!busy} style={ghostBtn}>
            {busy === 'order' ? <Loader size={16} className="spin" /> : <Clapperboard size={16} />} Running order
          </button>
          <button type="button" onClick={writeMusicSketch} disabled={!!busy} style={ghostBtn}>
            <Sparkles size={16} /> Music sketch
          </button>
          <button type="button" onClick={playMusicDemo} disabled={musicPlaying} style={ghostBtn}>
            <Volume2 size={16} /> {musicPlaying ? 'Playing…' : 'Play demo'}
          </button>
          <button type="button" onClick={generateCast} disabled={!!busy} style={ghostBtn}>
            {busy === 'cast' ? <Loader size={16} className="spin" /> : <UsersIcon />} Cast & doubles
          </button>
          <button type="button" onClick={generateProductionPack} disabled={!!busy} style={ghostBtn}>
            {busy === 'pack' ? <Loader size={16} className="spin" /> : <Download size={16} />} Production pack
          </button>
        </div>

        {status && (
          <p style={{ margin: '0 0 18px', color: '#5b4724', fontWeight: 600, fontSize: 14 }}>{status}</p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)', gap: 18 }} className="showbox-grid">
          <div style={{ display: 'grid', gap: 16 }}>
            <EditorCard
              title="Song list"
              value={state.songList}
              onChange={(v) => patch({ songList: v })}
              placeholder="1. Opening number — Company — establishes world…"
              onSend={() => appendToDraft(state.songList, 'Song list')}
            />
            <EditorCard
              title="Running order"
              value={state.runningOrder}
              onChange={(v) => patch({ runningOrder: v })}
              placeholder="Act One — Scene 1 — …"
              onSend={() => appendToDraft(state.runningOrder, 'Running order')}
            />
            <EditorCard
              title="Music sketch"
              value={state.musicSketch}
              onChange={(v) => patch({ musicSketch: v })}
              placeholder="Structure, chords, lyric hook, export prompt…"
              onSend={() => appendToDraft(state.musicSketch, 'Music sketch')}
              tall
            />
            <EditorCard
              title="Cast & doubles"
              value={state.castNotes}
              onChange={(v) => patch({ castNotes: v })}
              placeholder="Leads, doubles, company size…"
              onSend={() => appendToDraft(state.castNotes, 'Cast notes')}
            />
            <EditorCard
              title="Production pack"
              value={state.productionPack}
              onChange={(v) => patch({ productionPack: v })}
              placeholder="Pitch, staging, band, rehearsal, props…"
              onSend={() => appendToDraft(state.productionPack, 'Production pack')}
              tall
            />
          </div>

          <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <article style={card}>
              <h2 style={sectionTitle}>Book / scenes</h2>
              <p style={{ margin: '0 0 12px', color: '#73695d', fontSize: 14, lineHeight: 1.5 }}>
                {bookWords > 0
                  ? `${bookWords.toLocaleString()} words in White Page. Draft scenes, then commission polish in Workshop.`
                  : 'No book yet. Open Just write or White Page and get Act One on its feet.'}
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                <button type="button" onClick={onOpenWrite} style={primaryBtn}>
                  <PenLine size={16} /> Open White Page
                </button>
                <button type="button" onClick={onOpenCanvas} style={ghostBtn}>
                  <Clapperboard size={16} /> Jam Canvas storyboard
                </button>
                <button type="button" onClick={onOpenWorkshop} style={ghostBtn}>
                  <Hammer size={16} /> Commission in Workshop
                </button>
              </div>
            </article>

            <article style={card}>
              <h2 style={sectionTitle}>Seal the box</h2>
              <p style={{ margin: '0 0 12px', color: '#73695d', fontSize: 14, lineHeight: 1.5 }}>
                Assemble everything into one artefact, copy it, or export via Publish Pack.
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                <button type="button" onClick={assembleIntoDraft} style={primaryBtn}>
                  <Sparkles size={16} /> Assemble into White Page
                </button>
                <button type="button" onClick={copyFullPack} style={ghostBtn}>
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy full pack'}
                </button>
                <button type="button" onClick={onOpenPublish} style={ghostBtn}>
                  <Download size={16} /> Publish Pack
                </button>
              </div>
            </article>

            <article style={card}>
              <h2 style={sectionTitle}>What “in a box” means</h2>
              <ol style={{ margin: 0, paddingLeft: 18, color: '#4a3b28', lineHeight: 1.8, fontSize: 14 }}>
                <li>A book a cast can rehearse</li>
                <li>Songs that turn something</li>
                <li>A running order that breathes</li>
                <li>A lean cast plan</li>
                <li>A production pack a producer can cost</li>
              </ol>
            </article>
          </aside>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @media (max-width: 900px) { .showbox-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function EditorCard({
  title,
  value,
  onChange,
  placeholder,
  onSend,
  tall,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSend: () => void;
  tall?: boolean;
}) {
  return (
    <article style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ ...sectionTitle, margin: 0 }}>{title}</h2>
        <button type="button" onClick={onSend} disabled={!value.trim()} style={{ ...ghostBtn, padding: '8px 10px', fontSize: 12 }}>
          Send to page
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          minHeight: tall ? 260 : 140,
          boxSizing: 'border-box',
          border: '1px solid #e2d6c3',
          borderRadius: 14,
          padding: 14,
          fontSize: 14,
          lineHeight: 1.55,
          background: '#fffaf2',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
    </article>
  );
}

const kicker: React.CSSProperties = {
  color: '#9b6d16',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
};

const card: React.CSSProperties = {
  borderRadius: 22,
  padding: 20,
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid #eadfce',
  boxShadow: '0 14px 40px rgba(40, 29, 12, 0.05)',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 18,
  letterSpacing: -0.3,
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: 'none',
  borderRadius: 14,
  padding: '12px 16px',
  background: '#d6a846',
  color: '#1d1408',
  fontWeight: 800,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: '1px solid #eadfce',
  borderRadius: 14,
  padding: '12px 16px',
  background: '#fffaf2',
  color: '#4a3b28',
  fontWeight: 700,
  cursor: 'pointer',
};
