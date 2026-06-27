import { Link } from 'react-router-dom';
import { BookOpen, Compass, FileText, Gem, Ghost, HelpCircle, Package, Sparkles } from 'lucide-react';

const SECTIONS = [
  {
    title: 'What is CASPA?',
    icon: Sparkles,
    body: 'A private creative production studio — not just a prompt box. Upload chaos, choose a finished product, and CASPA guides structure, memory, critique, and export without overwriting your originals.',
    when: 'Use this when you want the big picture before diving in.',
    next: 'Open Today (/home) or create a project.',
  },
  {
    title: 'Start a new project',
    icon: BookOpen,
    body: 'Projects hold manuscripts, source assets, bible, book map, and saved outputs in one room.',
    when: 'Use this when you have an idea, a mess, or an existing draft.',
    next: 'Projects → New Project, or Trash to Treasure for rough rescue.',
  },
  {
    title: 'Upload documents and creative assets',
    icon: FileText,
    body: 'The Source Library accepts text, markdown, notes, receipts, fragments, and more. Each asset is stored separately — nothing is overwritten.',
    when: 'Use this when you have mixed files, research, or odd artifacts.',
    next: 'Project → Source Library tab, or /projects/:id/sources.',
  },
  {
    title: 'Choosing a product type',
    icon: Compass,
    body: 'The Production Wizard asks what finished product you want: novel, memoir, screenplay, submission package, and more.',
    when: 'Use this before heavy generation so CASPA knows what “done” means.',
    next: 'Guide Me → Start Production Wizard, or /start.',
  },
  {
    title: 'Production Brief',
    icon: FileText,
    body: 'Audience, tone, length, success criteria, source assets, and privacy mode — saved per project.',
    when: 'Use this after assets are uploaded and before bible/book map generation.',
    next: 'Complete the wizard or PATCH production-brief from project settings.',
  },
  {
    title: 'Project Bible & Book Map',
    icon: BookOpen,
    body: 'The bible holds premise, characters, themes, and style rules. The book map tracks chapters, gaps, arcs, and finish roadmap.',
    when: 'Use this when structure and memory matter across many sessions.',
    next: 'Project → Bible, then Book Map.',
  },
  {
    title: 'Novel Write Pro',
    icon: Ghost,
    body: 'Structured drafting with critic room, rewrite, and saved output — aligned to your production brief.',
    when: 'Use this for award-draft generation or improving existing material.',
    next: 'Write → Casper · Novel Write Pro (/casper).',
  },
  {
    title: 'Trash to Treasure',
    icon: Gem,
    body: 'Rescue rough material without shame. Diagnosis, strongest premise, cut/keep plan, sample rewrite — all saved, nothing overwritten.',
    when: 'Use this when the draft feels broken but has bones.',
    next: '/casper/trash-to-treasure',
  },
  {
    title: 'Gold Pass & Agent Swarm',
    icon: Sparkles,
    body: 'Multi-critic review and gold synthesis — structural, line, commercial, continuity, and intimacy notes where relevant.',
    when: 'Use this after a draft exists and you want honest improvement.',
    next: 'Project → Improve (Gold) or Agent Swarm.',
  },
  {
    title: 'Saved Writing & Safe Apply',
    icon: Package,
    body: 'Every AI run lands in Saved Writing. Apply modes create snapshots before destructive changes.',
    when: 'Use this to find outputs and merge them safely into chapters.',
    next: 'Saved Writing → open output → Apply safely.',
  },
  {
    title: 'Exports',
    icon: FileText,
    body: 'Markdown, DOCX, project archive, bible, book map, and submission packages from the Export tab.',
    when: 'Use this when you need professional files, not browser text.',
    next: 'Project → Export.',
  },
  {
    title: 'Romance & Intimacy settings',
    icon: HelpCircle,
    body: 'Heat levels 0–5, boundaries, and ask-before-increasing controls — set in the Production Wizard or project intimacy settings.',
    when: 'Use this for adult fiction, romance, or when you need fade-to-black by default.',
    next: 'Production Wizard step 3, or project intimacy PATCH.',
  },
  {
    title: 'AI engines & failures',
    icon: Sparkles,
    body: 'Providers show green only when they can actually generate. Ollama is local-first fallback and may take several minutes.',
    when: 'Use this when generation fails or feels stuck.',
    next: 'Top bar provider status, or Studio Command → Test all AI engines.',
  },
];

export default function HelpCentre() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="rounded-[2rem] border border-[#eadfca] bg-white p-8 shadow-room">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dfc991] bg-[#fffaf0] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#98711d]">
          <HelpCircle className="h-4 w-4" /> Help Centre
        </div>
        <h1 className="mt-4 font-serif text-4xl font-semibold text-[#171a22]">Practical help — not a manual nobody reads</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Short sections: what it does, when to use it, what to click next.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/home" className="btn-primary">Open Today</Link>
          <Link to="/start" className="btn-secondary">Production Wizard</Link>
          <Link to="/projects" className="btn-secondary">Projects</Link>
        </div>
      </header>

      <div className="grid gap-4">
        {SECTIONS.map((section) => (
          <article key={section.title} className="rounded-[1.5rem] border border-[#eadfca] bg-[#fffdf8] p-6 shadow-paper">
            <div className="flex items-start gap-3">
              <section.icon className="mt-1 h-5 w-5 shrink-0 text-[#98711d]" />
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#171a22]">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#2a2520]">{section.body}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[#98711d]">Use this when…</p>
                <p className="text-sm text-muted">{section.when}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[#98711d]">What to click next</p>
                <p className="text-sm text-muted">{section.next}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
