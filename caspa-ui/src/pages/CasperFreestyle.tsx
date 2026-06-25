import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Check,
  Clapperboard,
  Copy,
  FileText,
  Loader2,
  Music,
  PenLine,
  Play,
  Plus,
  Sparkles,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import { createProject } from '../api/projects';
import { createChapter } from '../api/chapters';
import { useAppStore } from '../store';
import { useToast } from '../components/Toast';

type CasperMode = 'novel' | 'script' | 'musical' | 'adaptation' | 'polish' | 'chaos';

type ModeCard = {
  id: CasperMode;
  title: string;
  genre: string;
  targetWordCount: number;
  icon: typeof BookOpen;
  helper: string;
};

const modeCards: ModeCard[] = [
  { id: 'novel', title: 'Novel', genre: 'Novel', targetWordCount: 80000, icon: BookOpen, helper: 'Chapters, plot, character arcs, continuity and voice.' },
  { id: 'script', title: 'Script', genre: 'Stage / Screen Script', targetWordCount: 25000, icon: Clapperboard, helper: 'Scenes, dialogue, act structure and production shape.' },
  { id: 'musical', title: 'Musical / Show', genre: 'Musical Theatre / Show', targetWordCount: 30000, icon: Music, helper: 'Book, song list, lyrics, chords, cue ideas and playable demo sketches.' },
  { id: 'adaptation', title: 'Adaptation', genre: 'Adaptation', targetWordCount: 50000, icon: FileText, helper: 'Turn notes, transcripts, evidence, memoir or chaos into a story file.' },
  { id: 'polish', title: 'Polish Existing Work', genre: 'Manuscript Polish', targetWordCount: 80000, icon: Wand2, helper: 'Upload or paste a manuscript and run a structure/line-edit pass.' },
  { id: 'chaos', title: 'Chaos Mode', genre: 'Experimental', targetWordCount: 20000, icon: Sparkles, helper: 'For ideas that are unhinged but probably brilliant.' },
];

const outputOptions = [
  'One-page concept',
  'Project bible',
  'Scene-by-scene outline',
  'First scene',
  'Full chapter',
  'Act One',
  'Song list and lyrics',
  'Playable music sketch',
  'Open WebUI prompt',
  'Production pack',
];

function titleFromPremise(premise: string, mode: CasperMode) {
  const clean = premise.trim().replace(/\s+/g, ' ');
  if (!clean) return `New ${modeCards.find((m) => m.id === mode)?.title ?? 'Project'}`;
  return clean.length > 74 ? `${clean.slice(0, 71)}...` : clean;
}

function stripBasicMarkup(text: string) {
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\'[a-z0-9]+ ?/gi, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildMusicSketch(premise: string, tone: string) {
  return `# Playable Music Sketch

Working title: ${premise || 'Untitled show number'}
Style: British theatrical comedy / panto-rock / patter song
Tempo: 126 BPM
Key: D minor, lifting to F major for the chorus
Tone: ${tone || 'Comic, theatrical, sharp and melodic'}

## Structure
Intro: 4 bars — pizzicato strings, tack piano, muted brass sting
Verse 1: 16 bars — patter exposition, tight comic rhymes
Pre-chorus: 8 bars — rising civic panic
Chorus: 16 bars — big hook, ensemble response
Middle 8: 8 bars — hero/villain reversal
Final chorus: 24 bars — key lift, full company, button ending

## Chords
Intro: Dm | Bb | C | A7
Verse: Dm | Dm/C | Bb | A7
Pre: Gm | Bb | F | A7
Chorus: F | C/E | Dm | Bb | Gm | C | F | A7
Middle 8: Bb | C | Am | Dm | Gm | C | F | F

## First lyric hook
Round and round the roundabout, nobody knows why,
Dick Turpin lost his horse outside the retail park by five.
Stand and deliver? Darling, not in lane three —
Milton Keynes has swallowed him and charged him parking fee.

## Arrangement
Tack piano, theatre organ, brass stabs after jokes, bouncy bass, brushed snare into full kit, pizzicato strings for sneaking, ensemble chorus for the button.

## Secondary export prompt
Theatrical British comedy patter song, 126 BPM, D minor to F major, panto-rock, witty camp lyrics, brass stabs, tack piano, ensemble chorus, highwayman lost in modern Milton Keynes, West End demo style.`;
}

function buildOpenWebUIPrompt(mode: CasperMode, premise: string, tone: string, output: string, whitePage: string) {
  return `You are Casper, Matthew O'Crowley's private creative production room.

PROJECT
Mode: ${mode}
Premise: ${premise || '[No premise supplied]'}
Tone: ${tone || 'Clear, vivid, witty, production-minded'}
Required output: ${output}

CURRENT WHITE PAGE / MANUSCRIPT
${whitePage || '[Blank page]'}

RULES
- Start from the page, not generic advice.
- Produce usable material immediately.
- For scripts: give scenes, beats, dialogue and staging.
- For novels: give chapters, prose, structure and continuity.
- For musicals/music: give concrete music material — tempo, key, chords, structure, lyric hook, melody contour and arrangement. A prompt is only a secondary export, not the product.
- Preserve weirdness, ambition and voice. Do not sand the magic off.

TASK
Drive this project forward now.`;
}

async function playBrowserMusicDemo() {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser cannot start the WebAudio demo synth.');

  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  master.gain.value = 0.16;
  master.connect(ctx.destination);

  const now = ctx.currentTime;
  const bpm = 126;
  const beat = 60 / bpm;
  const notes = [293.66, 349.23, 392.0, 440.0, 523.25, 440.0, 392.0, 349.23, 293.66, 233.08, 261.63, 293.66];

  notes.forEach((freq, index) => {
    const start = now + index * beat;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = index % 3 === 0 ? 'square' : 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + beat * 0.85);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + beat * 0.95);
  });

  const bassNotes = [146.83, 116.54, 130.81, 110.0];
  bassNotes.forEach((freq, index) => {
    const start = now + index * beat * 3;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + beat * 2.6);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + beat * 2.8);
  });

  window.setTimeout(() => void ctx.close(), 7200);
}

export default function CasperFreestyle() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<CasperMode>('script');
  const [premise, setPremise] = useState('A Dick Turpin stage comedy set in Milton Keynes');
  const [tone, setTone] = useState('Sharp, theatrical, funny, a bit camp, but structurally solid.');
  const [output, setOutput] = useState('Act One');
  const [whitePage, setWhitePage] = useState(() => localStorage.getItem('casper.whitePage') || '');
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);

  const selectedMode = modeCards.find((card) => card.id === mode) ?? modeCards[0];

  const openWebUIPrompt = useMemo(
    () => buildOpenWebUIPrompt(mode, premise, tone, output, whitePage),
    [mode, premise, tone, output, whitePage],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const title = titleFromPremise(uploadedName || premise, mode);
      const project = await createProject({
        title,
        genre: selectedMode.genre,
        description: premise || uploadedName || selectedMode.helper,
        targetWordCount: selectedMode.targetWordCount,
        status: 'draft',
      });

      if (whitePage.trim()) {
        await createChapter(project.id, {
          title: uploadedName ? `Uploaded manuscript: ${uploadedName}` : 'White Page Draft',
          order: 1,
          content: whitePage,
          status: mode === 'polish' ? 'draft' : 'outline',
        });
      }

      return project;
    },
    onSuccess: async (project) => {
      setActiveProjectId(project.id);
      localStorage.setItem('casper.whitePage', whitePage);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['chapters', project.id] });
      toast.success('Project created');
      navigate(`/projects/${project.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleWhitePageChange(value: string) {
    setWhitePage(value);
    localStorage.setItem('casper.whitePage', value);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const supported = /\.(txt|md|markdown|rtf|html?)$/i.test(file.name) || file.type.startsWith('text/');
    if (!supported) {
      toast.error('Quick upload currently supports .txt, .md, .rtf and .html. Convert PDF/DOCX to text or paste it into the white page.');
      event.target.value = '';
      return;
    }

    const raw = await file.text();
    const text = stripBasicMarkup(raw);
    const title = file.name.replace(/\.[^.]+$/, '');
    setUploadedName(file.name);
    setPremise(`Uploaded manuscript: ${title}`);
    setMode('polish');
    setOutput('Project bible');
    handleWhitePageChange(text);
    toast.success('Manuscript loaded into the white page');
    event.target.value = '';
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(openWebUIPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleMusicSketch() {
    const sketch = buildMusicSketch(premise, tone);
    setMode('musical');
    setOutput('Playable music sketch');
    handleWhitePageChange(whitePage.trim() ? `${whitePage.trim()}\n\n---\n\n${sketch}` : sketch);
    toast.success('Music sketch written to white page');
  }

  async function handlePlayMusic() {
    try {
      setPlaying(true);
      await playBrowserMusicDemo();
      window.setTimeout(() => setPlaying(false), 7600);
    } catch (error) {
      setPlaying(false);
      toast.error(error instanceof Error ? error.message : 'Could not play demo music');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-accent/10 shadow-2xl">
        <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6 p-6 md:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                <Sparkles className="h-4 w-4" /> Casper
              </span>
              <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                New project
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                <UploadCloud className="h-4 w-4" /> Upload manuscript
              </button>
              <input ref={fileInputRef} type="file" accept=".txt,.md,.markdown,.rtf,.html,.htm,text/plain,text/markdown,text/html" className="hidden" onChange={handleUpload} />
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">What are we making?</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted md:text-lg">
                Start with the thing, not the tools. Create a new project, upload a manuscript, write on the white page, or make music material that actually plays.
              </p>
            </div>

            <div className="space-y-2">
              <label className="label">Premise / command</label>
              <textarea
                value={premise}
                onChange={(event) => setPremise(event.target.value)}
                className="input min-h-28 text-base leading-7"
                placeholder="Example: A Dick Turpin stage comedy set in Milton Keynes"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modeCards.map((card) => {
                const Icon = card.icon;
                const active = card.id === mode;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setMode(card.id)}
                    className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${active ? 'border-accent bg-accent/10 shadow-lg shadow-accent/10' : 'border-white/10 bg-surface/70 hover:border-accent/40'}`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <Icon className="h-5 w-5 text-accent" />
                      {active && <Check className="h-4 w-4 text-accent" />}
                    </div>
                    <h3 className="font-semibold">{card.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted">{card.helper}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Output</label>
                <select value={output} onChange={(event) => setOutput(event.target.value)} className="input">
                  {outputOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tone</label>
                <input value={tone} onChange={(event) => setTone(event.target.value)} className="input" />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create and open project
              </button>
              <button type="button" onClick={handleMusicSketch} className="btn-secondary">
                <Music className="h-4 w-4" /> Write music sketch
              </button>
              <button type="button" onClick={handlePlayMusic} disabled={playing} className="btn-secondary">
                {playing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {playing ? 'Playing demo...' : 'Play demo music'}
              </button>
            </div>
          </div>

          <aside className="border-t border-white/10 bg-black/20 p-6 md:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
                <PenLine className="h-4 w-4" /> White Page
              </div>
              <p className="text-sm leading-6 text-muted">
                Paste, draft, or upload here. This becomes the first chapter/draft when you create the project.
              </p>
              <textarea
                value={whitePage}
                onChange={(event) => handleWhitePageChange(event.target.value)}
                className="input min-h-[430px] resize-y bg-background/70 text-sm leading-7"
                placeholder="Start writing, paste notes, or upload a manuscript. Casper will build from this page."
              />
              {uploadedName && <p className="text-xs text-muted">Loaded: {uploadedName}</p>}
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-accent" />
            <h2 className="font-semibold">Music Lab, but honest</h2>
          </div>
          <p className="text-sm leading-6 text-muted">
            The old music flow made prompts and called them tracks. This page now gives you music material and a browser-playable demo sketch. Full studio audio still needs a generation provider or MIDI/WAV export backend.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleMusicSketch} className="btn-primary">
              <Music className="h-4 w-4" /> Generate song structure/chords/lyric hook
            </button>
            <button type="button" onClick={handlePlayMusic} disabled={playing} className="btn-secondary">
              {playing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Play browser demo
            </button>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Open WebUI handoff</h2>
              <p className="text-xs text-muted">Secondary export, not the product.</p>
            </div>
            <button type="button" onClick={copyPrompt} className="btn-secondary text-xs">
              <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-background/70 p-4 text-xs leading-5 text-muted">
            {openWebUIPrompt}
          </pre>
        </div>
      </section>
    </div>
  );
}
