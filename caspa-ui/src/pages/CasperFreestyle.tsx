import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Copy,
  FileText,
  Loader2,
  Music,
  PenLine,
  Play,
  Sparkles,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import { createProject } from '../api/projects';
import { createChapter } from '../api/chapters';
import { runNovelWritePro } from '../api/casper';
import {
  buildNovelWriteProOpenWebUIPrompt,
} from '../lib/novelWritePro';
import { isSupportedManuscriptFile, readManuscriptFile } from '../lib/manuscriptUpload';
import { useAppStore } from '../store';
import { useToast } from '../components/Toast';

type CasperMode = 'novel' | 'script' | 'musical' | 'adaptation' | 'polish' | 'chaos';

type ModeCard = {
  id: CasperMode;
  title: string;
  shortTitle: string;
  genre: string;
  targetWordCount: number;
  icon: typeof BookOpen;
  helper: string;
};

type CreateOverride = Partial<{
  mode: CasperMode;
  premise: string;
  output: string;
}>;

const modeCards: ModeCard[] = [
  { id: 'novel', title: 'Novel', shortTitle: 'Blank Novel', genre: 'Novel', targetWordCount: 80000, icon: BookOpen, helper: 'A clean long-form fiction room.' },
  { id: 'script', title: 'Script', shortTitle: 'Script', genre: 'Stage / Screen Script', targetWordCount: 25000, icon: Clapperboard, helper: 'Scenes, dialogue, act structure and staging.' },
  { id: 'musical', title: 'Musical / Show', shortTitle: 'Musical / Show', genre: 'Musical Theatre / Show', targetWordCount: 30000, icon: Music, helper: 'Book, songs, lyrics, chords and demo sketches.' },
  { id: 'adaptation', title: 'Adaptation', shortTitle: 'Adaptation', genre: 'Adaptation', targetWordCount: 50000, icon: FileText, helper: 'Turn notes, transcripts or raw material into story.' },
  { id: 'polish', title: 'Polish Existing Work', shortTitle: 'Polish', genre: 'Manuscript Polish', targetWordCount: 80000, icon: Wand2, helper: 'Upload or paste a manuscript and improve it.' },
  { id: 'chaos', title: 'Chaos Mode', shortTitle: 'Chaos', genre: 'Experimental', targetWordCount: 20000, icon: Sparkles, helper: 'For unhinged ideas with promise.' },
];

const outputOptions = [
  'Project bible',
  'One-page concept',
  'Scene-by-scene outline',
  'First scene',
  'Full chapter',
  'Act One',
  'Song list and lyrics',
  'Playable music sketch',
  'Production pack',
  'Open WebUI prompt',
];

function getMode(mode: CasperMode) {
  return modeCards.find((card) => card.id === mode) ?? modeCards[0];
}

function titleFromPremise(premise: string, mode: CasperMode) {
  const clean = premise.trim().replace(/\s+/g, ' ');
  if (!clean) return `New ${getMode(mode).title}`;
  return clean.length > 74 ? `${clean.slice(0, 71)}...` : clean;
}

function firstDraftTitle(mode: CasperMode, output: string) {
  if (mode === 'script') return output === 'Act One' ? 'Act One — Novel Write Pro Draft' : 'Opening Scene — Novel Write Pro Draft';
  if (mode === 'musical') return 'Opening Number / Show Draft';
  if (mode === 'adaptation') return 'Adaptation Opening — Novel Write Pro Draft';
  if (mode === 'polish') return 'Award Pass Rewrite';
  if (mode === 'chaos') return 'High-Voltage Opening — Novel Write Pro Draft';
  return 'Chapter One — Novel Write Pro Draft';
}

function buildMusicSketch(premise: string, tone: string) {
  return `# Playable Music Sketch

Working title: ${premise || 'Untitled show number'}
Style: theatrical demo / story-led composition
Tempo: 126 BPM
Key: D minor, lifting to F major for the chorus
Tone: ${tone || 'Comic, theatrical, sharp and melodic'}

## Structure
Intro: 4 bars — small motif, simple hook, clear entry point
Verse 1: 16 bars — story setup and character voice
Pre-chorus: 8 bars — rising pressure or emotional turn
Chorus: 16 bars — clear title hook and repeatable refrain
Middle 8: 8 bars — reversal, confession, joke, or reveal
Final chorus: 24 bars — bigger arrangement, button ending

## Chords
Intro: Dm | Bb | C | A7
Verse: Dm | Dm/C | Bb | A7
Pre: Gm | Bb | F | A7
Chorus: F | C/E | Dm | Bb | Gm | C | F | A7
Middle 8: Bb | C | Am | Dm | Gm | C | F | F

## First lyric hook
[Write the title hook here]
[Answer it with a second line that lands the joke, wound, or wish]
[Repeatable phrase]
[Button line]

## Arrangement
Tack piano or clean piano, light percussion, bass, strings or synth pad, brass or guitar stabs after jokes, ensemble or backing vocals for the final chorus.

## Secondary export prompt
Theatrical story song, 126 BPM, D minor to F major, strong title hook, character-led vocal, clean demo arrangement, dramatic lift, playable stage/show sketch.`;
}

async function playBrowserMusicDemo() {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser cannot start the WebAudio demo synth.');

  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  master.gain.value = 0.13;
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
    gain.gain.exponentialRampToValueAtTime(0.0001, start + beat * 0.86);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + beat * 0.95);
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
  const [premise, setPremise] = useState('');
  const [tone, setTone] = useState('Clear, vivid, witty, production-minded.');
  const [output, setOutput] = useState('Act One');
  const [whitePage, setWhitePage] = useState('');
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedMode = getMode(mode);
  const SelectedIcon = selectedMode.icon;

  const openWebUIPrompt = useMemo(
    () => buildNovelWriteProOpenWebUIPrompt({
      mode,
      modeTitle: selectedMode.title,
      genre: selectedMode.genre,
      premise,
      tone,
      output,
      sourceText: whitePage,
      uploadedName,
    }),
    [mode, selectedMode.title, selectedMode.genre, premise, tone, output, whitePage, uploadedName],
  );

  const createMutation = useMutation({
    mutationFn: async (override?: CreateOverride) => {
      const finalMode = override?.mode ?? mode;
      const finalPremise = override?.premise ?? premise;
      const finalOutput = override?.output ?? output;
      const finalModeCard = getMode(finalMode);
      const title = titleFromPremise(uploadedName || finalPremise, finalMode);
      const trimmedPremise = finalPremise.trim();
      const description = trimmedPremise
        ? `${trimmedPremise}\n\nCaspa auto-write target: Novel Write Pro / award-level ${finalOutput}`
        : uploadedName
          ? `Uploaded manuscript: ${uploadedName}\n\nCaspa auto-write target: Novel Write Pro / award-level ${finalOutput}`
          : `A fresh blank room.\n\nCaspa auto-write target: Novel Write Pro / award-level ${finalOutput}`;

      const project = await createProject({
        title,
        genre: finalModeCard.genre,
        description,
        targetWordCount: finalModeCard.targetWordCount,
        status: 'draft',
      });

      if (whitePage.trim()) {
        await createChapter(project.id, {
          title: uploadedName ? `Source manuscript: ${uploadedName}` : 'Source White Page',
          order: 1,
          content: whitePage,
          status: finalMode === 'polish' ? 'draft' : 'outline',
        });
      }

      const draft = await runNovelWritePro({
        projectId: project.id,
        mode: finalMode,
        modeTitle: finalModeCard.title,
        genre: finalModeCard.genre,
        spark: finalPremise,
        source: whitePage,
        tone,
        output: finalOutput,
        uploadedName,
      });

      const generated = draft.text.trim();
      if (!generated) {
        throw new Error('Novel Write Pro returned no writing. Check Ollama on the server or try again.');
      }

      const chapter = await createChapter(project.id, {
        title: draft.title || firstDraftTitle(finalMode, finalOutput),
        order: whitePage.trim() ? 2 : 1,
        content: generated,
        status: 'draft',
      });

      return { project, chapter, draft };
    },
    onSuccess: async ({ project, chapter, draft }) => {
      setActiveProjectId(project.id);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['chapters', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['outputs'] });
      toast.success(`Novel Write Pro drafted with ${draft.provider}/${draft.model} · saved output ${draft.outputId.slice(0, 8)}`);
      navigate(`/projects/${project.id}/chapters/${chapter.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleWhitePageChange(value: string) {
    setWhitePage(value);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isSupportedManuscriptFile(file)) {
      toast.error('Quick upload currently supports .txt, .md, .rtf and .html. Convert PDF/DOCX to text or paste it into the source page.');
      event.target.value = '';
      return;
    }

    const { title, text } = await readManuscriptFile(file);
    setUploadedName(file.name);
    setPremise(`Uploaded manuscript: ${title}`);
    setMode('polish');
    setOutput('Project bible');
    handleWhitePageChange(text);
    toast.success('Manuscript loaded. Press Auto-write to run Novel Write Pro.');
    event.target.value = '';
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(openWebUIPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function handleMusicSketch() {
    const sketch = buildMusicSketch(premise, tone);
    setMode('musical');
    setOutput('Playable music sketch');
    handleWhitePageChange(whitePage.trim() ? `${whitePage.trim()}\n\n---\n\n${sketch}` : sketch);
    toast.success('Music sketch written to source page');
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

  function startProject(override?: CreateOverride) {
    createMutation.mutate(override);
  }

  function startMode(nextMode: CasperMode, nextOutput = output) {
    setMode(nextMode);
    setOutput(nextOutput);
    startProject({ mode: nextMode, output: nextOutput });
  }

  function handleIdeaSubmit(event: FormEvent) {
    event.preventDefault();
    startProject();
  }

  const pendingLabel = 'Novel Write Pro is drafting...';

  return (
    <div className="-mx-4 -my-4 min-h-[calc(100vh-5rem)] rounded-[2rem] bg-[#f7f1e6] px-4 py-6 pb-24 text-[#1f2430] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] md:-mx-6 md:-my-6 md:px-8 md:py-8 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#98711d] shadow-sm">
              <Sparkles className="h-4 w-4" /> Casper · Novel Write Pro
            </div>
            <div className="space-y-4">
              <h1 className="max-w-4xl font-serif text-5xl font-semibold leading-[0.95] tracking-[-0.045em] text-[#171a22] md:text-7xl lg:text-8xl">
                What are we writing?
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[#68604f]">
                Give Casper a spark, upload a manuscript, or leave it blank. Novel Write Pro creates the room and writes the first award-target draft automatically.
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#eadfca] bg-white/75 p-5 shadow-[0_24px_70px_rgba(75,55,21,0.10)] backdrop-blur">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Current writing room</div>
            <div className="mt-3 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff1c9] text-[#8a6717]">
                <SelectedIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-semibold text-[#171a22]">{selectedMode.title}</h2>
                <p className="mt-1 text-sm leading-6 text-[#726957]">{selectedMode.helper}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-[2.2rem] border border-[#eadfca] bg-white p-4 shadow-[0_30px_100px_rgba(75,55,21,0.13)] md:p-6">
          <form onSubmit={handleIdeaSubmit} className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">The spark</label>
              <textarea
                value={premise}
                onChange={(event) => setPremise(event.target.value)}
                className="min-h-[148px] w-full resize-y rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-6 text-2xl leading-snug text-[#171a22] shadow-inner outline-none transition placeholder:text-[#b8aa91] focus:border-[#caa044] focus:ring-4 focus:ring-[#d4af37]/20 md:text-3xl"
                placeholder="Describe the book, script, show, song or idea — or leave blank and let Novel Write Pro invent the opening."
              />
              <p className="text-sm leading-6 text-[#766b58]">
                Primary action: create the project, run the critic room silently, generate the first draft, and open the writing page.
              </p>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-[1.35rem] bg-[#f5d37a] px-6 py-4 text-base font-bold text-[#171a22] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#ffe39a] disabled:opacity-60"
              >
                {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                {createMutation.isPending ? pendingLabel : 'Auto-write award draft'}
              </button>
            </div>

            <div className="grid gap-3 self-stretch">
              <button type="button" onClick={() => startMode('novel', 'Full chapter')} disabled={createMutation.isPending} className="rounded-[1.35rem] bg-[#171a22] px-5 py-4 text-left text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#262b38] disabled:opacity-60">
                <BookOpen className="mb-3 h-5 w-5 text-[#f5d37a]" />
                <strong className="block">Novel</strong>
                <span className="text-sm text-white/65">Auto-write Chapter One</span>
              </button>
              <button type="button" onClick={() => startMode('script', 'Act One')} disabled={createMutation.isPending} className="rounded-[1.35rem] border border-[#e7d8b9] bg-[#fff8e8] px-5 py-4 text-left text-[#171a22] transition hover:-translate-y-0.5 hover:border-[#d4af37] disabled:opacity-60">
                <Clapperboard className="mb-3 h-5 w-5 text-[#98711d]" />
                <strong className="block">Script</strong>
                <span className="text-sm text-[#766b58]">Auto-write Act One</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => startMode('musical', 'Song list and lyrics')} disabled={createMutation.isPending} className="rounded-2xl border border-[#e7d8b9] bg-[#fffdf8] px-3 py-3 text-left text-sm text-[#171a22] transition hover:border-[#d4af37] disabled:opacity-60">
                  <Music className="mb-2 h-4 w-4 text-[#98711d]" />
                  <strong className="block">Musical</strong>
                </button>
                <button type="button" onClick={() => startMode('adaptation', 'Project bible')} disabled={createMutation.isPending} className="rounded-2xl border border-[#e7d8b9] bg-[#fffdf8] px-3 py-3 text-left text-sm text-[#171a22] transition hover:border-[#d4af37] disabled:opacity-60">
                  <FileText className="mb-2 h-4 w-4 text-[#98711d]" />
                  <strong className="block">Adaptation</strong>
                </button>
                <button type="button" onClick={() => startMode('polish', 'Project bible')} disabled={createMutation.isPending} className="rounded-2xl border border-[#e7d8b9] bg-[#fffdf8] px-3 py-3 text-left text-sm text-[#171a22] transition hover:border-[#d4af37] disabled:opacity-60">
                  <Wand2 className="mb-2 h-4 w-4 text-[#98711d]" />
                  <strong className="block">Polish</strong>
                </button>
                <button type="button" onClick={() => startMode('chaos', 'One-page concept')} disabled={createMutation.isPending} className="rounded-2xl border border-[#e7d8b9] bg-[#fffdf8] px-3 py-3 text-left text-sm text-[#171a22] transition hover:border-[#d4af37] disabled:opacity-60">
                  <Sparkles className="mb-2 h-4 w-4 text-[#98711d]" />
                  <strong className="block">Chaos</strong>
                </button>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-[1.35rem] border border-[#e7d8b9] bg-[#fffdf8] px-5 py-4 text-left text-[#171a22] transition hover:-translate-y-0.5 hover:border-[#d4af37]">
                <UploadCloud className="mb-3 h-5 w-5 text-[#98711d]" />
                <strong className="block">Upload Manuscript</strong>
                <span className="text-sm text-[#766b58]">Then auto-write an award pass</span>
              </button>
              <input ref={fileInputRef} type="file" accept=".txt,.md,.markdown,.rtf,.html,.htm,text/plain,text/markdown,text/html" className="hidden" onChange={handleUpload} />
            </div>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_330px]">
          <article className="rounded-[2.2rem] border border-[#eadfca] bg-white p-5 shadow-[0_25px_80px_rgba(75,55,21,0.10)] md:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">Source / Scratch Page</div>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-[#171a22]">Give Novel Write Pro raw material.</h2>
              </div>
              {uploadedName && <span className="rounded-full bg-[#fff1c9] px-3 py-1 text-xs font-semibold text-[#7c5b12]">Loaded: {uploadedName}</span>}
            </div>
            <textarea
              value={whitePage}
              onChange={(event) => handleWhitePageChange(event.target.value)}
              className="min-h-[560px] w-full resize-y rounded-[1.7rem] border border-[#eee3d0] bg-[#fffdf8] p-7 font-serif text-xl leading-9 text-[#20202a] shadow-inner outline-none transition placeholder:text-[#b8aa91] focus:border-[#caa044] focus:ring-4 focus:ring-[#d4af37]/20"
              placeholder="Paste rough notes, a chapter, lyrics, scene fragments, or leave blank. Novel Write Pro will create a first draft from whatever is here."
            />
          </article>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-[#e7d8b9] bg-[#171a22] p-5 text-white shadow-[0_25px_70px_rgba(23,26,34,0.20)]">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#f5d37a]">
                <PenLine className="h-4 w-4" /> Novel Write Pro
              </div>
              <div className="space-y-3">
                <button type="button" onClick={() => startProject()} disabled={createMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f5d37a] px-4 py-3 text-sm font-bold text-[#171a22] transition hover:bg-[#ffe39a] disabled:opacity-60">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {createMutation.isPending ? pendingLabel : 'Auto-write now'}
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  <UploadCloud className="h-4 w-4 text-[#f5d37a]" /> Upload manuscript
                </button>
                <button type="button" onClick={handleMusicSketch} className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  <Music className="h-4 w-4 text-[#f5d37a]" /> Draft music scaffold
                </button>
                <button type="button" onClick={handlePlayMusic} disabled={playing} className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60">
                  {playing ? <Loader2 className="h-4 w-4 animate-spin text-[#f5d37a]" /> : <Play className="h-4 w-4 text-[#f5d37a]" />}
                  {playing ? 'Playing demo...' : 'Play demo music'}
                </button>
                <button type="button" onClick={() => { setMode('polish'); setOutput('Project bible'); }} className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  <Wand2 className="h-4 w-4 text-[#f5d37a]" /> Switch to polish mode
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#e7d8b9] bg-white/85 p-5 shadow-sm">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Kind of thing</div>
              <div className="grid grid-cols-2 gap-2">
                {modeCards.map((card) => {
                  const Icon = card.icon;
                  const active = card.id === mode;
                  return (
                    <button key={card.id} type="button" onClick={() => setMode(card.id)} className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${active ? 'border-[#caa044] bg-[#fff1c9] text-[#171a22]' : 'border-[#eee3d0] bg-[#fffdf8] text-[#665d4d] hover:border-[#d4af37]'}`}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Icon className="h-4 w-4 text-[#98711d]" />
                        {active && <Check className="h-3.5 w-3.5 text-[#98711d]" />}
                      </div>
                      <span className="font-semibold">{card.shortTitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#e7d8b9] bg-white/85 p-5 shadow-sm">
              <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Advanced</div>
                  <div className="mt-1 text-sm text-[#766b58]">Output, tone and Open WebUI handoff</div>
                </div>
                {showAdvanced ? <ChevronUp className="h-5 w-5 text-[#98711d]" /> : <ChevronDown className="h-5 w-5 text-[#98711d]" />}
              </button>
              {showAdvanced && (
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Output</label>
                    <select value={output} onChange={(event) => setOutput(event.target.value)} className="w-full rounded-2xl border border-[#eee3d0] bg-[#fffdf8] px-4 py-3 text-sm text-[#171a22] outline-none focus:border-[#caa044]">
                      {outputOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Tone</label>
                    <input value={tone} onChange={(event) => setTone(event.target.value)} className="w-full rounded-2xl border border-[#eee3d0] bg-[#fffdf8] px-4 py-3 text-sm text-[#171a22] outline-none focus:border-[#caa044]" />
                  </div>
                  <div className="rounded-2xl border border-[#eee3d0] bg-[#fffdf8] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Open WebUI</span>
                      <button type="button" onClick={copyPrompt} className="inline-flex items-center gap-1 rounded-full bg-[#171a22] px-3 py-1.5 text-xs font-semibold text-white">
                        <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-[11px] leading-5 text-[#5f5648]">{openWebUIPrompt}</pre>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#eadfca] bg-[#fffdf8]/95 p-4 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => startProject()}
            disabled={createMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f5d37a] px-4 py-3 text-sm font-bold text-[#171a22] disabled:opacity-60"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {createMutation.isPending ? pendingLabel : 'Auto-write award draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
