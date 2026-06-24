/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
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
    subtitle: 'Book, scenes, songs, running order, score brief and production pack.',
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
- Make it usable immediately: scenes, beats, chapters, song list, production tasks, or revised text.
- Challenge weak structure directly, but keep the user's voice alive.
- When useful, give the next concrete draft section rather than a lecture.

TASK
Drive this project forward now.`;
}

export default function Dashboard({
  project,
  chapters,
  characters,
  plotNodes,
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

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(openWebUIPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div id="caspa-launchpad" className="h-full overflow-y-auto custom-scrollbar bg-[#f7f3ea] text-[#1c2433]" style={{ minHeight: 0 }}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-10 space-y-8 pb-24">
        <section className="rounded-[2rem] border border-[#e1d5bd] bg-white shadow-[0_24px_80px_rgba(42,31,14,0.10)] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 md:p-10 space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d9c89f] bg-[#fffaf0] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#8b6b18] font-semibold">
                <Sparkles size={14} /> Caspa Launchpad
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl md:text-6xl font-serif font-semibold tracking-tight text-[#151b28] leading-[0.96]">
                  What are we making today?
                </h1>
                <p className="text-base md:text-lg text-[#687184] max-w-2xl leading-relaxed">
                  Start with the thing you want to create, not the machine that creates it. Novel, script, musical, adaptation, polish job or glorious nonsense — pick the beast, then Caspa opens the right room.
                </p>
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
              </div>
            </div>

            <aside className="bg-[#141821] text-white p-6 md:p-10 flex flex-col justify-between gap-8">
              <div className="space-y-5">
                <div className="text-xs uppercase tracking-[0.22em] text-[#d4af37] font-semibold">Active project</div>
                <div>
                  <h2 className="text-3xl font-serif font-semibold leading-tight">{project.title || 'Untitled project'}</h2>
                  <p className="mt-3 text-sm text-slate-300 leading-relaxed">{project.premise || 'No premise fixed yet. Use the launchpad to give the project a real spine.'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Words" value={wordCount.toLocaleString()} />
                <Metric label="Chapters" value={chapters.length.toString()} />
                <Metric label="Characters" value={characters.length.toString()} />
                <Metric label="Threads" value={plotNodes.length.toString()} />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                <strong className="block text-white mb-1">White-page rule</strong>
                Write first. Tools second. No more pipeline cupboard as the emotional front door.
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
              placeholder="Start here. Scene, chapter, song list, production brief, character voice, fragments, mad idea, whatever. This feeds the Open WebUI driver prompt."
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => setView('write')} className="rounded-xl bg-[#1c2433] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2e394d] transition">Open writing room</button>
              <button onClick={() => setView('memory')} className="rounded-xl border border-[#d8c89e] px-4 py-2.5 text-sm font-semibold text-[#7c5e10] hover:bg-[#fff7df] transition">Story bible</button>
              <button onClick={() => setView('intelligence')} className="rounded-xl border border-[#d8c89e] px-4 py-2.5 text-sm font-semibold text-[#7c5e10] hover:bg-[#fff7df] transition">Red Pen</button>
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
