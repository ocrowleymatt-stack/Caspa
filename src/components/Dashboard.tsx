/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Music2,
  PenLine,
  Plus,
  Search,
  Sparkles,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import { Project, ViewType, ProjectType, Chapter, Character, PlotNode } from '../types';

interface Props {
  project: Project;
  projects: Project[];
  chapters: Chapter[];
  characters: Character[];
  plotNodes: PlotNode[];
  isMobile: boolean;
  selectProject: (project: Project) => void;
  createNewProject: (title?: string) => void;
  updateProject: (updates: Partial<Project>) => void;
  setView: (view: ViewType) => void;
  deleteProject: () => void;
  saveToCloud: () => void;
  isSaving: boolean;
}

type CreativeMode = 'novel' | 'script' | 'musical' | 'adaptation' | 'gold' | 'chaos';

type ModeCard = {
  mode: CreativeMode;
  title: string;
  subtitle: string;
  route: ViewType;
  type: ProjectType;
  icon: typeof BookOpen;
  examples: string[];
};

const modeCards: ModeCard[] = [
  {
    mode: 'novel',
    title: 'Write a Novel',
    subtitle: 'Chapters, voice, plot, character arcs, continuity, reader pull.',
    route: 'write',
    type: 'novel',
    icon: BookOpen,
    examples: ['Gothic literary thriller', 'Queer horror with teeth', 'Comic revenge novel'],
  },
  {
    mode: 'script',
    title: 'Make a Script',
    subtitle: 'Stage, screen, radio, sitcom, monologue, sketch or panto.',
    route: 'design',
    type: 'stageplay',
    icon: Clapperboard,
    examples: ['Dick Turpin in Milton Keynes', 'Courtroom farce', 'BBC pilot treatment'],
  },
  {
    mode: 'musical',
    title: 'Build a Musical / Show',
    subtitle: 'Book, scenes, songs, running order, score brief and a playable demo sketch.',
    route: 'creative',
    type: 'stageplay',
    icon: Music2,
    examples: ['Panto with bite', 'Cult musical', 'Community theatre banger'],
  },
  {
    mode: 'adaptation',
    title: 'Adapt Something',
    subtitle: 'Turn notes, evidence, transcripts or chaos into story architecture.',
    route: 'upload',
    type: 'experimental',
    icon: FileText,
    examples: ['Transcript to drama', 'Memoir to play', 'Evidence to thriller'],
  },
  {
    mode: 'gold',
    title: 'Polish Existing Work',
    subtitle: 'Structure pass, subtext pass, line edit and ruthless final cut.',
    route: 'architect',
    type: 'novel',
    icon: Wand2,
    examples: ['Tighten chapter', 'Fix pacing', 'Make it prize-ready'],
  },
  {
    mode: 'chaos',
    title: 'Surprise Me',
    subtitle: 'For when the idea is unhinged but probably brilliant.',
    route: 'brainstorm',
    type: 'experimental',
    icon: Sparkles,
    examples: ['Travelodge ghost opera', 'Concrete cow heist', 'Victorian demon sitcom'],
  },
];

const starterIdeas = [
  'A Dick Turpin stage comedy set in Milton Keynes, full of roundabouts, false heroism and local civic panic.',
  'A gothic legal thriller about a charming liar, a missing archive and a house that remembers everything.',
  'A camp horror musical about a haunted Travelodge where every room key opens the wrong trauma.',
  'Turn a bundle of transcripts into a courtroom drama with a viciously funny narrator and a proper spine.',
];

const outputs = [
  'One-page concept',
  'Project bible',
  'Scene-by-scene outline',
  'Act One draft',
  'Full chapter draft',
  'Playable music sketch',
  'Song list and lyrics',
  'Pitch pack',
  'Production pack',
];

function inferModeFromProject(project: Project): CreativeMode {
  if (project.type === 'screenplay' || project.type === 'stageplay' || project.type === 'radioplay') return 'script';
  if (project.type === 'novel') return 'novel';
  if (project.type === 'experimental') return 'chaos';
  return 'novel';
}

function modeLabel(mode: CreativeMode) {
  return modeCards.find(card => card.mode === mode)?.title.replace('Write a ', '').replace('Make a ', '').replace('Build a ', '') || 'Project';
}

function buildOpenWebUIPrompt(project: Project, mode: CreativeMode, whitePage: string, desiredOutput: string) {
  const musicalInstruction = mode === 'musical'
    ? '\nMUSIC REQUIREMENT\n- Do not merely output a prompt. Produce concrete music material: song structure, tempo, key, chord progression, lyrics, melody contour, arrangement notes, and a DAW/Suno/Udio export block only as a secondary handoff.'
    : '';

  return `You are Caspa, Matthew O'Crowley's private creative production room.

PROJECT
Title: ${project.title || 'Untitled'}
Mode: ${modeLabel(mode)}
Format: ${project.type}
Genre: ${project.genre || 'Not fixed yet'}
Tone: ${project.tone || 'Literate, vivid, witty, sharp, production-minded'}
Premise: ${project.premise || '[No formal premise yet]'}
Required output: ${desiredOutput}

CURRENT WHITE PAGE
${whitePage.trim() || '[Blank page. Start by proposing the strongest opening move.]'}

OPERATING METHOD
- Start from the current page/canvas, not generic writing advice.
- Preserve the weirdness and ambition; do not sand the magic off.
- Make it usable immediately: scenes, beats, chapters, song list, production tasks, revised text, or music material.
- Challenge weak structure directly, but keep the user's voice alive.
- When useful, give the next concrete draft section rather than a lecture.${musicalInstruction}

TASK
Drive this project forward now.`;
}

function createMusicSketch(idea: string, tone: string) {
  return `# Music Sketch

Working title: ${idea || 'Untitled show number'}
Style: theatrical pop / panto-rock / comic patter song
Tempo: 126 BPM
Key: D minor moving to F major for the release
Tone: ${tone || 'Comic, theatrical, sharp, with a big chorus'}

## Structure
Intro: 4 bars - cheeky pizzicato strings and muted brass stab
Verse 1: 16 bars - patter delivery, comic exposition
Pre-chorus: 8 bars - rising panic / civic outrage
Chorus: 16 bars - big hook, ensemble response
Middle 8: 8 bars - villain/hero reversal
Final chorus: 24 bars - key lift, full company, button ending

## Chords
Intro: Dm | Bb | C | A7
Verse: Dm | Dm/C | Bb | A7
Pre: Gm | Bb | F | A7
Chorus: F | C/E | Dm | Bb | Gm | C | F | A7
Middle 8: Bb | C | Am | Dm | Gm | C | F | F

## Melody contour
Verse: fast repeated notes around A-C, with comic leaps on punchlines.
Pre-chorus: climb C-D-E-F-G to build theatrical panic.
Chorus hook: land strongly on F, then leap to A on the title phrase.

## First lyric hook
Round and round the roundabout, nobody knows why,
Dick Turpin lost his horse outside the retail park by five.
Stand and deliver? Darling, not in lane three —
Milton Keynes has swallowed him and charged him parking fee.

## Arrangement
Drums: brushed snare into full kit by chorus.
Bass: bouncy quavers, comic swagger.
Keys: tack piano doubled with theatre organ.
Brass: short stabs after jokes.
Strings: pizzicato for sneaking, full tremolo for mock peril.

## Export prompt for Suno/Udio/DAW assistant
Theatrical British comedy patter song, 126 BPM, D minor to F major, panto-rock energy, witty camp lyrics, brass stabs, tack piano, ensemble chorus, comic highwayman lost in modern Milton Keynes, catchy chorus, West End demo style.`;
}

export default function Dashboard({
  project,
  chapters,
  characters,
  plotNodes,
  createNewProject,
  updateProject,
  setView,
  saveToCloud,
  isSaving,
}: Props) {
  const [idea, setIdea] = useState(project.premise || starterIdeas[0]);
  const [selectedMode, setSelectedMode] = useState<CreativeMode>(() => inferModeFromProject(project));
  const [desiredOutput, setDesiredOutput] = useState(outputs[1]);
  const [tone, setTone] = useState(project.tone || 'Funny, vivid, slightly dangerous, but structurally disciplined.');
  const [whitePage, setWhitePage] = useState('');
  const [copied, setCopied] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const whitePageKey = `caspa.whitePage.${project.id}`;

  useEffect(() => {
    setIdea(project.premise || starterIdeas[0]);
    setSelectedMode(inferModeFromProject(project));
    setTone(project.tone || 'Funny, vivid, slightly dangerous, but structurally disciplined.');
  }, [project.id]);

  useEffect(() => {
    setWhitePage(localStorage.getItem(whitePageKey) || '');
  }, [whitePageKey]);

  useEffect(() => {
    localStorage.setItem(whitePageKey, whitePage);
  }, [whitePage, whitePageKey]);

  const activeCard = modeCards.find(card => card.mode === selectedMode) || modeCards[0];
  const wordCount = project.stats?.totalWords || chapters.reduce((total, chapter) => total + (chapter.wordCount || chapter.content?.split(/\s+/).filter(Boolean).length || 0), 0);

  const openWebUIPrompt = useMemo(
    () => buildOpenWebUIPrompt(project, selectedMode, whitePage, desiredOutput),
    [project, selectedMode, whitePage, desiredOutput],
  );

  const startProject = (route: ViewType = activeCard.route) => {
    const cleanIdea = idea.trim();
    const title = cleanIdea
      ? cleanIdea.length > 64 ? `${cleanIdea.slice(0, 61)}...` : cleanIdea
      : `New ${modeLabel(selectedMode)}`;

    updateProject({
      title,
      premise: cleanIdea,
      type: activeCard.type,
      tone,
      genre: selectedMode === 'script' ? 'Stage comedy / dramatic script' : selectedMode === 'musical' ? 'Musical theatre / show' : project.genre || 'Creative fiction',
      lastModified: Date.now(),
    });
    setView(route);
  };

  const handleNewProject = (mode: CreativeMode = selectedMode) => {
    const card = modeCards.find(item => item.mode === mode) || activeCard;
    const title = `New ${modeLabel(mode)}`;
    createNewProject(title);
    setSelectedMode(mode);
    setIdea('');
    setTone(mode === 'musical' ? 'Theatrical, melodic, witty, with a proper hook.' : 'Clear, vivid and production-minded.');
    setDesiredOutput(mode === 'musical' ? 'Playable music sketch' : 'Project bible');
    setWhitePage('');
    setTimeout(() => {
      updateProject({
        title,
        type: card.type,
        premise: '',
        tone: mode === 'musical' ? 'Theatrical, melodic, witty, with a proper hook.' : 'Clear, vivid and production-minded.',
        genre: mode === 'musical' ? 'Musical theatre / show' : mode === 'script' ? 'Stage comedy / dramatic script' : 'Creative fiction',
        lastModified: Date.now(),
      });
    }, 0);
  };

  const handleUploadManuscript = async (file: File | undefined) => {
    if (!file) return;
    const supported = /\.(txt|md|markdown|rtf|html?)$/i.test(file.name) || file.type.startsWith('text/');
    if (!supported) {
      alert('For this quick uploader, use .txt, .md, .rtf or .html. For PDF/DOCX, paste the text into the white page for now.');
      return;
    }

    const text = await file.text();
    const title = file.name.replace(/\.[^.]+$/, '') || 'Uploaded manuscript';
    createNewProject(title);
    setWhitePage(text);
    setIdea(`Uploaded manuscript: ${title}`);
    setSelectedMode('gold');
    setDesiredOutput('Structure pass, line edit and ruthless final cut.');
    updateProject({
      title,
      premise: `Uploaded manuscript: ${title}`,
      type: 'novel',
      genre: 'Uploaded manuscript',
      tone: tone || 'Preserve authorial voice while improving structure, clarity and force.',
      stats: {
        ...(project.stats || { narrativeStreak: 0, aiContributions: 0, lastActiveDay: new Date().toISOString().slice(0, 10) }),
        totalWords: text.split(/\s+/).filter(Boolean).length,
      },
      lastModified: Date.now(),
    });
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(openWebUIPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const playMusicDemo = async () => {
    setMusicPlaying(true);
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      alert('This browser cannot play the built-in demo synth. Use the generated music sketch/export prompt instead.');
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

  const addMusicSketch = () => {
    const sketch = createMusicSketch(idea, tone);
    setWhitePage(prev => prev.trim() ? `${prev.trim()}\n\n---\n\n${sketch}` : sketch);
    setSelectedMode('musical');
    setDesiredOutput('Playable music sketch');
  };

  return (
    <div id="caspa-launchpad" className="h-full overflow-y-auto custom-scrollbar bg-[#f7f3ea] text-[#1c2433]" style={{ minHeight: 0 }}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-10 space-y-8 pb-24">
        <section className="rounded-[2rem] border border-[#e1d5bd] bg-white shadow-[0_24px_80px_rgba(42,31,14,0.10)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 md:p-10 space-y-7">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c89f] bg-[#fffaf0] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#8b6b18] font-semibold">
                  <Sparkles size={14} /> Caspa Launchpad
                </div>
                <button onClick={() => handleNewProject()} className="inline-flex items-center gap-2 rounded-full border border-[#d9c89f] bg-white px-3 py-1.5 text-xs font-semibold text-[#1c2433] hover:bg-[#fff7df] transition">
                  <Plus size={14} /> New project
                </button>
                <button onClick={() => uploadInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-[#d9c89f] bg-white px-3 py-1.5 text-xs font-semibold text-[#1c2433] hover:bg-[#fff7df] transition">
                  <UploadCloud size={14} /> Upload manuscript
                </button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".txt,.md,.markdown,.rtf,.html,.htm,text/plain,text/markdown,text/html"
                  className="hidden"
                  onChange={(event) => handleUploadManuscript(event.target.files?.[0])}
                />
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl md:text-6xl font-serif font-semibold tracking-tight text-[#151b28] leading-[0.96]">
                  What are we making today?
                </h1>
                <p className="text-base md:text-lg text-[#687184] max-w-2xl leading-relaxed">
                  Start a new project, upload a manuscript, make a script, build a show, or generate actual music material — not just a lonely prompt in a velvet waistcoat.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={() => handleNewProject('novel')} className="rounded-2xl border border-[#e2d6bd] bg-[#fffdf8] p-4 text-left hover:border-[#d4af37] hover:shadow-md transition">
                  <BookOpen size={19} className="text-[#8b6b18] mb-2" />
                  <strong className="block">Blank novel</strong>
                  <span className="text-xs text-[#687184]">Start clean</span>
                </button>
                <button onClick={() => handleNewProject('script')} className="rounded-2xl border border-[#e2d6bd] bg-[#fffdf8] p-4 text-left hover:border-[#d4af37] hover:shadow-md transition">
                  <Clapperboard size={19} className="text-[#8b6b18] mb-2" />
                  <strong className="block">New script</strong>
                  <span className="text-xs text-[#687184]">Stage/screen/radio</span>
                </button>
                <button onClick={() => handleNewProject('musical')} className="rounded-2xl border border-[#e2d6bd] bg-[#fffdf8] p-4 text-left hover:border-[#d4af37] hover:shadow-md transition">
                  <Music2 size={19} className="text-[#8b6b18] mb-2" />
                  <strong className="block">New music/show</strong>
                  <span className="text-xs text-[#687184]">Playable demo sketch</span>
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-[0.22em] font-semibold text-[#7c6841]">Premise / command</label>
                <textarea
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  className="w-full min-h-[128px] rounded-2xl border border-[#dfd5c3] bg-[#fffdf8] p-5 text-base md:text-lg leading-relaxed text-[#1d2533] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#d4af37]/40"
                  placeholder="Example: Make me a Dick Turpin stage comedy set in Milton Keynes..."
                />
                <div className="flex flex-wrap gap-2">
                  {starterIdeas.map((starter) => (
                    <button
                      key={starter}
                      onClick={() => setIdea(starter)}
                      className="rounded-full border border-[#e2d6bd] bg-white px-3 py-1.5 text-[11px] text-[#596274] hover:border-[#d4af37] hover:text-[#8b6b18] transition"
                    >
                      {starter.length > 46 ? `${starter.slice(0, 43)}...` : starter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] font-semibold text-[#7c6841]">Desired output</span>
                  <select
                    value={desiredOutput}
                    onChange={(event) => setDesiredOutput(event.target.value)}
                    className="w-full rounded-xl border border-[#dfd5c3] bg-white px-4 py-3 text-sm text-[#1d2533] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                  >
                    {outputs.map(output => <option key={output}>{output}</option>)}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] font-semibold text-[#7c6841]">Tone</span>
                  <input
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    className="w-full rounded-xl border border-[#dfd5c3] bg-white px-4 py-3 text-sm text-[#1d2533] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
                  />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => startProject()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1c2433] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2f3a4d] transition"
                >
                  Start this project <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => startProject('write')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8c89e] bg-[#fffaf0] px-5 py-3 text-sm font-semibold text-[#7c5e10] hover:bg-[#fff4d7] transition"
                >
                  Open white page <PenLine size={16} />
                </button>
                <button
                  onClick={addMusicSketch}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8c89e] bg-[#fffaf0] px-5 py-3 text-sm font-semibold text-[#7c5e10] hover:bg-[#fff4d7] transition"
                >
                  Create music sketch <Music2 size={16} />
                </button>
              </div>
            </div>

            <aside className="bg-[#141821] text-white p-6 md:p-10 flex flex-col justify-between gap-8">
              <div className="space-y-5">
                <div className="text-xs uppercase tracking-[0.22em] text-[#d4af37] font-semibold">Active project</div>
                <div>
                  <h2 className="text-3xl font-serif font-semibold leading-tight">{project.title || 'Untitled project'}</h2>
                  <p className="mt-3 text-sm text-slate-300 leading-relaxed">{project.premise || 'No premise fixed yet. Use New Project or Upload Manuscript to give the thing a spine.'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Words" value={wordCount.toLocaleString()} />
                <Metric label="Chapters" value={chapters.length.toString()} />
                <Metric label="Characters" value={characters.length.toString()} />
                <Metric label="Threads" value={plotNodes.length.toString()} />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                <strong className="block text-white mb-1">Rule</strong>
                A project must be creatable, ingestible, writable, and exportable. Anything less is a haunted brochure.
              </div>
            </aside>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modeCards.map((card) => {
            const Icon = card.icon;
            const isActive = selectedMode === card.mode;
            return (
              <button
                key={card.mode}
                onClick={() => setSelectedMode(card.mode)}
                className={`text-left rounded-2xl border p-5 transition bg-white hover:-translate-y-0.5 hover:shadow-xl ${isActive ? 'border-[#d4af37] shadow-[0_18px_50px_rgba(212,175,55,0.18)]' : 'border-[#e4dac8] shadow-sm'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-11 h-11 rounded-xl bg-[#f5efe1] text-[#8b6b18] flex items-center justify-center">
                    <Icon size={22} />
                  </div>
                  {isActive && <CheckCircle2 className="text-[#b58b19]" size={20} />}
                </div>
                <h3 className="mt-4 text-xl font-serif font-semibold text-[#1c2433]">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#687184]">{card.subtitle}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {card.examples.map(example => (
                    <span key={example} className="rounded-full bg-[#f7f3ea] px-2.5 py-1 text-[11px] text-[#6f7889]">{example}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </section>

        {selectedMode === 'musical' && (
          <section className="rounded-[1.5rem] bg-[#17120c] border border-[#3a2b16] p-5 md:p-7 text-white shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#d4af37] font-semibold">Music Lab</div>
                <h2 className="text-2xl font-serif font-semibold">Make music, not just a prompt</h2>
                <p className="mt-2 text-sm text-[#cdbf9e] max-w-3xl">This creates a playable browser synth demo and writes a structured song sketch into the white page. Full studio-quality audio still needs a provider such as Suno/Udio/DAW export, but Casper now produces actual music material rather than pretending a prompt is a song.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={playMusicDemo} disabled={musicPlaying} className="rounded-xl bg-[#d4af37] px-4 py-2.5 text-sm font-semibold text-[#17120c] hover:bg-[#e7c65d] transition disabled:opacity-60">
                  {musicPlaying ? 'Playing demo...' : 'Play demo music'}
                </button>
                <button onClick={addMusicSketch} className="rounded-xl border border-[#d4af37]/50 px-4 py-2.5 text-sm font-semibold text-[#ffe5a5] hover:bg-white/5 transition">Write music sketch</button>
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_0.95fr] gap-6">
          <article className="rounded-[1.5rem] bg-white border border-[#e4dac8] p-5 md:p-7 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#8b6b18] font-semibold">White Page</div>
                <h2 className="text-2xl font-serif font-semibold text-[#1c2433]">Drive the project on a clear page</h2>
              </div>
              <PenLine className="text-[#b58b19]" />
            </div>
            <textarea
              value={whitePage}
              onChange={(event) => setWhitePage(event.target.value)}
              className="w-full min-h-[430px] rounded-2xl border border-[#e0d6c4] bg-[#fffdf8] p-6 text-base leading-8 text-[#1c2433] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30"
              placeholder="Start here, paste a manuscript, or upload .txt/.md/.rtf/.html. Music mode writes song structure, chords and lyrics here."
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => setView('write')} className="rounded-xl bg-[#1c2433] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2e394d] transition">Open writing room</button>
              <button onClick={() => setView('memory')} className="rounded-xl border border-[#d8c89e] px-4 py-2.5 text-sm font-semibold text-[#7c5e10] hover:bg-[#fff7df] transition">Story bible</button>
              <button onClick={() => setView('intelligence')} className="rounded-xl border border-[#d8c89e] px-4 py-2.5 text-sm font-semibold text-[#7c5e10] hover:bg-[#fff7df] transition">Red Pen</button>
              <button onClick={() => uploadInputRef.current?.click()} className="rounded-xl border border-[#d8c89e] px-4 py-2.5 text-sm font-semibold text-[#7c5e10] hover:bg-[#fff7df] transition">Upload manuscript</button>
            </div>
          </article>

          <article className="rounded-[1.5rem] bg-white border border-[#e4dac8] p-5 md:p-7 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#8b6b18] font-semibold">Open WebUI Driver</div>
                <h2 className="text-2xl font-serif font-semibold text-[#1c2433]">Copy this into Open WebUI</h2>
              </div>
              <UploadCloud className="text-[#b58b19]" />
            </div>
            <pre className="min-h-[430px] max-h-[430px] overflow-auto whitespace-pre-wrap rounded-2xl border border-[#e0d6c4] bg-[#fbf8f1] p-5 text-xs leading-6 text-[#263044]">
              {openWebUIPrompt}
            </pre>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={copyPrompt} className="inline-flex items-center gap-2 rounded-xl bg-[#1c2433] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2e394d] transition">
                <Copy size={15} /> {copied ? 'Copied' : 'Copy Open WebUI prompt'}
              </button>
              <button onClick={saveToCloud} disabled={isSaving} className="rounded-xl border border-[#d8c89e] px-4 py-2.5 text-sm font-semibold text-[#7c5e10] hover:bg-[#fff7df] transition disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Save project'}
              </button>
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard icon={ClipboardList} title="Plan the beast" text="Turn the premise into beats, chapters, scenes or musical numbers." action="Open design" onClick={() => setView('design')} />
          <ActionCard icon={Search} title="Bring sources in" text="Upload research, transcripts, old notes or raw project material." action="Research desk" onClick={() => setView('upload')} />
          <ActionCard icon={Download} title="Make it presentable" text="Export a pitch, rehearsal, reader or publishing pack." action="Publish pack" onClick={() => setView('publish')} />
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-2xl font-serif font-semibold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, text, action, onClick }: { icon: typeof ClipboardList; title: string; text: string; action: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group text-left rounded-2xl border border-[#e4dac8] bg-white p-5 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition">
      <div className="w-10 h-10 rounded-xl bg-[#f5efe1] text-[#8b6b18] flex items-center justify-center mb-4">
        <Icon size={20} />
      </div>
      <h3 className="text-lg font-serif font-semibold text-[#1c2433]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#687184]">{text}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] font-semibold text-[#8b6b18]">
        {action} <ArrowRight size={13} className="group-hover:translate-x-1 transition" />
      </div>
    </button>
  );
}
