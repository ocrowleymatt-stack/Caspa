import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Clapperboard,
  FileText,
  Ghost,
  Hammer,
  Music,
  Package,
  PenLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { listProjects } from '../api/projects';
import { getCasperStatus } from '../api/casper';
import { useAppStore } from '../store';

const quickLinks = [
  { to: '/casper', label: 'Start with Casper', icon: Ghost, desc: 'Open the room: novel, script, manuscript, show or song.' },
  { to: '/projects', label: 'Projects', icon: BookOpen, desc: 'Your books, scripts, shows and working drafts.' },
  { to: '/forge', label: 'Forge', icon: Hammer, desc: 'Turn notes, sources and raw material into shaped work.' },
  { to: '/music-prompt', label: 'Music', icon: Music, desc: 'Lyrics, show numbers, prompts and musical sketches.' },
  { to: '/documents', label: 'Documents', icon: FileText, desc: 'Render, preview and prepare manuscripts.' },
  { to: '/confidence', label: 'Confidence', icon: ShieldCheck, desc: 'Check readiness before export or publication.' },
  { to: '/outputs', label: 'Outputs', icon: Package, desc: 'Collected exports, packs and generated materials.' },
];

export default function CommandCentre() {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects });
  const { data: casperStatus } = useQuery({ queryKey: ['casper-status'], queryFn: getCasperStatus });

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="overflow-hidden rounded-[2.4rem] border border-[#eadfca] bg-white shadow-room">
        <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-7 p-7 md:p-10 lg:p-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#98711d] shadow-sm">
              <Sparkles className="h-4 w-4" /> The Studio
            </div>
            <div>
              <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-[0.96] tracking-[-0.045em] text-[#171a22] md:text-7xl">
                Make the thing. Then make it better.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
                Caspa is your private creative room: novels, scripts, shows, songs, manuscripts, production packs and polish without the cockpit nonsense.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/casper" className="btn-primary">
                <Ghost className="h-4 w-4" /> Open Casper
              </Link>
              <Link to="/projects" className="btn-secondary">
                <BookOpen className="h-4 w-4" /> View Projects
              </Link>
              {activeProject && (
                <Link to={`/projects/${activeProject.id}`} className="btn-secondary">
                  <PenLine className="h-4 w-4" /> Continue {activeProject.title}
                </Link>
              )}
            </div>
            {casperStatus && (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfca] bg-[#fff8e8] px-3 py-1.5 text-xs font-semibold text-[#766b58]">
                <span className={`h-2 w-2 rounded-full ${casperStatus.available ? 'bg-emerald-500' : 'bg-red-400'}`} />
                Casper {casperStatus.available ? 'online' : 'offline'} — v{casperStatus.version}
              </div>
            )}
          </div>

          <div className="border-t border-[#eadfca] bg-[#f7f1e6] p-7 md:p-10 lg:border-l lg:border-t-0 lg:p-12">
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
          </div>
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
