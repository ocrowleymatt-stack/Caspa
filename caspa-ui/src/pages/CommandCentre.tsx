import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Command,
  FileText,
  Ghost,
  Hammer,
  LayoutDashboard,
  Music,
  Package,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { listProjects } from '../api/projects';
import { getCasperStatus } from '../api/casper';
import { useAppStore } from '../store';

const quickLinks = [
  { to: '/command', label: 'Natural Command', icon: Command, desc: 'Tell CASPA what you need in plain English' },
  { to: '/casper', label: 'Casper Freestyle', icon: Ghost, desc: 'Conversational command routing' },
  { to: '/forge', label: 'Forge & Intake', icon: Hammer, desc: 'Analyse sources and plan products' },
  { to: '/music-prompt', label: 'Music Prompt Lab', icon: Music, desc: 'Interpret prompts and jam sessions' },
  { to: '/documents', label: 'Document Studio', icon: FileText, desc: 'Preview and render manuscripts' },
  { to: '/confidence', label: 'Publish Confidence', icon: ShieldCheck, desc: 'Pre-flight publication checks' },
  { to: '/outputs', label: 'Outputs Hub', icon: Package, desc: 'All generated artefacts in one place' },
];

export default function CommandCentre() {
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: listProjects });
  const { data: casperStatus } = useQuery({ queryKey: ['casper-status'], queryFn: getCasperStatus });

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/10 via-surface to-purple-950/40 p-8 shadow-xl shadow-black/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,162,39,0.12),transparent_60%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <LayoutDashboard className="h-8 w-8 text-accent" />
            <h1 className="text-3xl font-bold tracking-tight">Command Centre</h1>
          </div>
          <p className="text-muted max-w-2xl">
            Your creative cockpit — orchestrate quality, music, publishing, and production from one place.
          </p>
          {activeProject ? (
            <p className="mt-4 text-sm">
              Active project:{' '}
              <Link to={`/projects/${activeProject.id}`} className="text-accent font-medium hover:underline">
                {activeProject.title}
              </Link>
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Select a project in the sidebar, or explore with the demo{' '}
              <span className="text-accent">The Grey Lady of Bridgnorth</span>.
            </p>
          )}
          {casperStatus && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
              <Terminal className="h-3 w-3 text-accent" />
              Casper {casperStatus.available ? 'online' : 'offline'} — v{casperStatus.version}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(({ to, label, icon: Icon, desc }) => (
          <Link
            key={to}
            to={to}
            className="group card hover:border-accent/30 hover:bg-accent/5 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-accent/15 p-2.5 group-hover:bg-accent/25 transition-colors">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="font-semibold">{label}</h2>
                <p className="text-sm text-muted mt-1">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="card border-accent/10">
        <h3 className="font-medium flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-accent" /> Getting started
        </h3>
        <ol className="text-sm text-muted space-y-2 list-decimal list-inside">
          <li>Open <Link to="/command" className="text-accent hover:underline">Natural Command</Link> and describe your goal</li>
          <li>Run <Link to="/forge" className="text-accent hover:underline">Forge & Intake</Link> on notes or excerpts</li>
          <li>Check <Link to="/confidence" className="text-accent hover:underline">Publish Confidence</Link> before export</li>
        </ol>
      </div>
    </div>
  );
}
