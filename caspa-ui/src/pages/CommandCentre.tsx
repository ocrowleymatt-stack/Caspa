import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Clapperboard,
  FileText,
  Gem,
  Ghost,
  Map,
  Music,
  Package,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { listProjects } from '../api/projects';
import { getCasperStatus } from '../api/casper';
import { listOutputs } from '../api/outputs';
import { useAppStore } from '../store';
import { GuideMeButton } from '../components/GuideMeDrawer';
import { ProviderStatus } from '../components/ProviderStatus';
import { normalizeOutputKind, OUTPUT_KIND_LABELS, outputExcerpt, extractOutputText } from '../lib/outputSemantics';

const quickLinks = [
  { to: '/casper', label: 'Novel Write Pro', icon: Ghost, desc: 'Auto-write, upload a manuscript, or improve an existing chapter.' },
  { to: '/projects', label: 'Projects', icon: BookOpen, desc: 'Create a room, import structure, and pick up where you left off.' },
  { to: '/command', label: 'Studio Command', icon: Sparkles, desc: 'Ask what to do next — routes to Pier, Gold, Research, Swarm or Outputs.' },
  { to: '/outputs', label: 'Saved Writing', icon: Package, desc: 'Every AI draft and report — apply only when you are ready.' },
  { to: '/music-prompt', label: 'Music', icon: Music, desc: 'Lyrics, show numbers, prompts and musical sketches.' },
  { to: '/documents', label: 'Documents', icon: FileText, desc: 'Render, preview and prepare manuscripts.' },
];

export default function CommandCentre() {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects });
  const { data: casperStatus } = useQuery({ queryKey: ['casper-status'], queryFn: getCasperStatus });
  const { data: recentOutputs = [] } = useQuery({
    queryKey: ['outputs-recent'],
    queryFn: () => listOutputs(),
  });

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const latestOutputs = recentOutputs.slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="overflow-hidden rounded-[2.4rem] border border-[#eadfca] bg-white shadow-room">
        <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-7 p-7 md:p-10 lg:p-12">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#98711d] shadow-sm">
                <Sparkles className="h-4 w-4" /> The Studio
              </div>
              <ProviderStatus compact />
            </div>
            <div>
              <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-[0.96] tracking-[-0.045em] text-[#171a22] md:text-7xl">
                What are we making today?
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
                Start blank, upload a manuscript, rescue rough material, or continue the book you already have.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/projects" className="btn-primary">
                <BookOpen className="h-4 w-4" /> Start blank project
              </Link>
              <Link to="/start" className="btn-secondary">
                <Sparkles className="h-4 w-4" /> Production Wizard
              </Link>
              <Link to="/casper/trash-to-treasure" className="btn-secondary">
                <Gem className="h-4 w-4" /> Trash to Treasure
              </Link>
              {activeProject && (
                <Link to={`/projects/${activeProject.id}`} className="btn-secondary">
                  <PenLine className="h-4 w-4" /> Continue {activeProject.title}
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <GuideMeButton />
              <Link to="/help" className="btn-ghost text-sm">
                <FileText className="h-4 w-4" /> Help Centre
              </Link>
              <Link to="/casper" className="btn-ghost text-sm">
                <Ghost className="h-4 w-4" /> Casper · Novel Write Pro
              </Link>
              <Link to="/outputs" className="btn-ghost text-sm">
                <Package className="h-4 w-4" /> Saved Writing
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {casperStatus && (
                <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfca] bg-[#fff8e8] px-3 py-1.5 text-xs font-semibold text-[#766b58]">
                  <span className={`h-2 w-2 rounded-full ${casperStatus.available ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  Casper {casperStatus.available ? 'online' : 'offline'} — v{casperStatus.version}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#eadfca] bg-[#f7f1e6] p-7 md:p-10 lg:border-l lg:border-t-0 lg:p-12">
            <div className="space-y-4">
              <div className="rounded-[2rem] border border-[#eadfca] bg-[#fffdf8] p-6 shadow-paper">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">Today’s page</div>
                <div className="mt-5 space-y-5 font-serif text-xl leading-9 text-[#2a2520]">
                  <p>Start with a premise.</p>
                  <p>Open a room.</p>
                  <p>Write badly if necessary.</p>
                  <p>Casper can tidy it after the spark has arrived.</p>
                </div>
                <div className="mt-8 rounded-2xl bg-[#171a22] p-4 text-sm leading-6 text-white/78">
                  The tools are still here. They have simply been told to stop standing in front of the work.
                </div>
              </div>
              <ProviderStatus />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.8rem] border border-[#eadfca] bg-white p-5 shadow-paper lg:col-span-2">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Secret Weapon cockpit</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {activeProject ? (
              <Link to={`/projects/${activeProject.id}`} className="rounded-2xl border border-[#caa044] bg-[#fff8e8] p-4 transition hover:-translate-y-0.5">
                <PenLine className="h-5 w-5 text-[#98711d]" />
                <div className="mt-2 font-serif text-lg font-semibold text-[#171a22]">Continue {activeProject.title}</div>
                <p className="mt-1 text-xs text-muted">Pick up the active project — chapters, Book Map, Saved Writing.</p>
              </Link>
            ) : (
              <Link to="/projects" className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4">
                <BookOpen className="h-5 w-5 text-[#98711d]" />
                <div className="mt-2 font-serif text-lg font-semibold">Start a project</div>
                <p className="mt-1 text-xs text-muted">Blank room or upload a manuscript.</p>
              </Link>
            )}
            <Link to="/casper/trash-to-treasure" className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4 transition hover:border-[#caa044]">
              <Gem className="h-5 w-5 text-[#98711d]" />
              <div className="mt-2 font-serif text-lg font-semibold">Rescue rough material</div>
              <p className="mt-1 text-xs text-muted">Trash to Treasure — diagnosis, plan, sample. Original preserved.</p>
            </Link>
            {activeProject && (
              <>
                <Link to={`/projects/${activeProject.id}/book-map`} className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4">
                  <Map className="h-5 w-5 text-[#98711d]" />
                  <div className="mt-2 font-serif text-lg font-semibold">Finish this book</div>
                  <p className="mt-1 text-xs text-muted">Book Map, missing chapters, finish roadmap.</p>
                </Link>
                <Link to={`/projects/${activeProject.id}/export`} className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4">
                  <FileText className="h-5 w-5 text-[#98711d]" />
                  <div className="mt-2 font-serif text-lg font-semibold">Exports ready</div>
                  <p className="mt-1 text-xs text-muted">Markdown, DOCX, archive, PDF/EPUB.</p>
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.8rem] border border-[#eadfca] bg-white p-5 shadow-paper">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Latest saved writing</div>
              <Link to="/outputs" className="text-xs font-semibold text-[#98711d] hover:underline">All</Link>
            </div>
            {latestOutputs.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No outputs yet — run Novel Write Pro or Trash to Treasure.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {latestOutputs.map((output) => {
                  const kind = normalizeOutputKind(output.type, output.metadata);
                  const text = extractOutputText(output.metadata);
                  return (
                    <li key={output.id}>
                      <Link to={`/outputs/${output.id}`} className="block rounded-xl border border-[#eadfca] bg-[#fffdf8] px-3 py-2 hover:border-[#caa044]">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#98711d]">{OUTPUT_KIND_LABELS[kind]}</div>
                        <div className="truncate text-sm font-semibold text-[#171a22]">{output.title}</div>
                        {text && <p className="mt-1 line-clamp-1 text-xs text-muted">{outputExcerpt(text, 80)}</p>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <ProviderStatus compact />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(({ to, label, icon: Icon, desc }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-[1.7rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper transition-all hover:-translate-y-1 hover:border-accent hover:bg-[#fffaf0]"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-[#fff1c9] p-3 text-[#98711d] transition group-hover:bg-[#171a22] group-hover:text-[#f5d37a]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#171a22]">{label}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-[1.8rem] border border-[#eadfca] bg-white/80 p-6 shadow-paper">
        <h3 className="mb-3 flex items-center gap-2 font-serif text-2xl font-semibold text-[#171a22]">
          <Clapperboard className="h-5 w-5 text-[#98711d]" /> Fast start
        </h3>
        <ol className="grid gap-3 text-sm leading-6 text-muted md:grid-cols-3">
          <li className="rounded-2xl bg-[#fffdf8] p-4"><strong className="text-[#171a22]">1.</strong> Open Casper and describe the thing.</li>
          <li className="rounded-2xl bg-[#fffdf8] p-4"><strong className="text-[#171a22]">2.</strong> Create the room: novel, script, show or polish.</li>
          <li className="rounded-2xl bg-[#fffdf8] p-4"><strong className="text-[#171a22]">3.</strong> Use the specialist tools only when the work asks for them.</li>
        </ol>
      </div>
    </div>
  );
}
