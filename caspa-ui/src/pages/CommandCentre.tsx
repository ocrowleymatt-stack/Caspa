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

const coreQuickLinks = [
  { to: '/projects', label: 'Projects', icon: BookOpen, desc: 'Add material, choose a product, and pick up where you left off.' },
  { to: '/casper', label: 'Novel Write Pro', icon: Ghost, desc: 'Auto-write, upload a manuscript, or improve an existing chapter.' },
  { to: '/outputs', label: 'Saved Writing', icon: Package, desc: 'Every AI draft and report — apply only when you are ready.' },
  { to: '/help', label: 'Help Centre', icon: FileText, desc: 'Practical guides for material, plan, write, improve, and export.' },
];

const moreQuickLinks = [
  { to: '/command', label: 'Studio Command', icon: Sparkles, desc: 'Ask what to do next — routes to Pier, Gold, Research, Swarm or Outputs.' },
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
    <div className="page-content mx-auto max-w-7xl space-y-6 sm:space-y-8">
      <section className="page-panel shadow-room">
        <div className="grid min-w-0 gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="min-w-0 space-y-5 p-4 sm:space-y-7 sm:p-7 md:p-10 lg:p-12">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#98711d] shadow-sm sm:px-4 sm:text-[11px] sm:tracking-[0.24em]">
                <Sparkles className="h-4 w-4 shrink-0" /> The Studio
              </div>
              <ProviderStatus compact className="max-w-full" />
            </div>
            <div className="min-w-0">
              <h1 className="max-w-full break-words font-serif text-[1.75rem] font-semibold leading-tight tracking-[-0.045em] text-[#171a22] sm:text-4xl md:text-5xl lg:text-7xl">
                What are we making today?
              </h1>
              <p className="mt-4 max-w-full text-base leading-7 text-muted sm:mt-5 sm:text-lg sm:leading-8">
                Start blank, upload a manuscript, rescue rough material, or continue the book you already have.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Link to="/projects" className="btn-primary w-full sm:w-auto">
                <BookOpen className="h-4 w-4 shrink-0" /> Start with material
              </Link>
              {activeProject ? (
                <Link to={`/projects/${activeProject.id}`} className="btn-secondary w-full min-w-0 sm:w-auto">
                  <PenLine className="h-4 w-4 shrink-0" />
                  <span className="truncate">Continue {activeProject.title}</span>
                </Link>
              ) : (
                <Link to="/projects" className="btn-secondary w-full sm:w-auto">
                  <PenLine className="h-4 w-4 shrink-0" /> Continue project
                </Link>
              )}
              <Link to="/casper/trash-to-treasure" className="btn-secondary w-full sm:w-auto">
                <Gem className="h-4 w-4 shrink-0" /> Rescue rough material
              </Link>
              <Link to="/outputs" className="btn-secondary w-full sm:w-auto">
                <Package className="h-4 w-4 shrink-0" /> Open saved writing
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <GuideMeButton />
              <Link to="/start" className="btn-ghost text-sm">
                <Sparkles className="h-4 w-4" /> Production Wizard
              </Link>
              <Link to="/help" className="btn-ghost text-sm">
                <FileText className="h-4 w-4" /> Help Centre
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

          <div className="min-w-0 border-t border-[#eadfca] bg-[#f7f1e6] p-4 sm:p-7 md:p-10 lg:border-l lg:border-t-0 lg:p-12">
            <div className="min-w-0 space-y-4">
              <div className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4 shadow-paper sm:rounded-[2rem] sm:p-6">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">Today’s page</div>
                <div className="mt-4 space-y-4 font-serif text-lg leading-8 text-[#2a2520] sm:mt-5 sm:space-y-5 sm:text-xl sm:leading-9">
                  <p>Start with a premise.</p>
                  <p>Open a room.</p>
                  <p>Write badly if necessary.</p>
                  <p>Casper can tidy it after the spark has arrived.</p>
                </div>
                <div className="mt-8 rounded-2xl border border-[#eadfca] bg-[#fff8e8] p-4 text-sm leading-6 text-[#5f5648]">
                  Material in → plan → draft → improve → export. One calm path; every tool still available when you need it.
                </div>
              </div>
              <ProviderStatus />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 rounded-[1.5rem] border border-[#eadfca] bg-white p-4 shadow-paper sm:rounded-[1.8rem] sm:p-5 lg:col-span-2">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Your project</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {activeProject ? (
              <Link to={`/projects/${activeProject.id}`} className="min-w-0 rounded-2xl border border-[#caa044] bg-[#fff8e8] p-4 transition hover:-translate-y-0.5">
                <PenLine className="h-5 w-5 text-[#98711d]" />
                <div className="mt-2 break-words font-serif text-lg font-semibold text-[#171a22]">Continue {activeProject.title}</div>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {coreQuickLinks.map(({ to, label, icon: Icon, desc }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-[1.7rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper transition-all hover:-translate-y-1 hover:border-accent hover:bg-[#fffaf0]"
          >
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div className="shrink-0 rounded-2xl bg-[#fff1c9] p-3 text-[#98711d] transition group-hover:bg-[#171a22] group-hover:text-[#f5d37a]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="break-words font-serif text-lg font-semibold text-[#171a22] sm:text-xl">{label}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <details className="rounded-[1.8rem] border border-[#eadfca] bg-white/80 p-5 shadow-paper">
        <summary className="cursor-pointer font-serif text-lg font-semibold text-[#171a22]">
          More tools
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moreQuickLinks.map(({ to, label, icon: Icon, desc }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-[1.4rem] border border-[#eadfca] bg-[#fffdf8] p-4 transition hover:border-[#caa044]"
            >
              <Icon className="h-5 w-5 text-[#98711d]" />
              <div className="mt-2 font-serif text-lg font-semibold text-[#171a22]">{label}</div>
              <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
            </Link>
          ))}
        </div>
      </details>

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
