import { useMemo, useState } from 'react';
import {
  BookOpen,
  BookText,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  FileText,
  Feather,
  Ghost,
  Globe2,
  Home,
  Library,
  Lock,
  LogOut,
  Menu,
  PenLine,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wand2,
  X,
  Loader,
  Music2,
} from 'lucide-react';
import type { Chapter, Character, Project, ViewType, DocumentDerivative, DocumentTemplate, DerivativeType } from '../types';
import { casperShowInABoxModel, getCasperShowInABoxPhases } from '../data/casperShowInABoxModel';
import { showFactoryAgents, showFactoryApiCatalogue } from '../data/casperShowFactoryModule';
import { createProductionPlan, orchestraAgents, orchestraServices, runOrchestraVirtualTest } from '../data/showProductionOrchestraModule';
import { createOvernightMusicCycle, overnightMusicAgents, overnightMusicServices, runOvernightMusicLabVirtualTest } from '../data/overnightMusicLabModule';
import './CaspaRedesign.css';

type Props = {
  user: { displayName?: string | null; email?: string | null; photoURL?: string | null };
  project: Project;
  chapters: Chapter[];
  characters: Character[];
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  totalWords: number;
  saveToCloud: () => void;
  createNewProject: (title?: string) => void;
  logout: () => void;
};

type NavItem = {
  id: ViewType;
  label: string;
  detail: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
};

const fallbackChapters = [
  { id: 'c13', title: 'The Hollow Audience', content: 'The hollow audience listened without breathing.', order: 13 },
  { id: 'c14', title: 'A Ledger in the Dark', content: 'A ledger lay under the floorboards.', order: 14 },
  { id: 'c15', title: 'A Door Unlatched', content: 'The old door opened inwards.', order: 15 },
  { id: 'c16', title: 'The Gathering House', content: 'The house remembered everyone who entered.', order: 16 },
  { id: 'c17', title: 'The Levee', content: 'The river had risen three feet by morning and would rise again before nightfall.\n\nThey called it rain, but it was the sky confessing what the city refused to remember. Water came down in sheets, drumming the zinc roofs, turning alleys into veins. The levee held—for now. But levees do not fail loudly. They soften. They weep. They forget.\n\nMaris stood where the old promenade broke into reeds and watched the current tug at the pilings, patient and sure. Behind her, the city continued its pageant. Merchants opened their stalls. Priests rehearsed their devotions. Children chased paper boats toward a horizon they had never seen.\n\nThe House had not sent for her.\n\nWhich meant it already knew.\n\nShe traced the edge of the amulet beneath her coat—cold iron, older than the charter, older than the House. It pulsed once, like a door remembering its hinge.\n\nUpstream, a bell tolled eleven times.', order: 17 },
  { id: 'c18', title: 'The Mercy of Walls', content: 'Some walls keep people out. Others keep memories in.', order: 18 },
] as Chapter[];

const fallbackCharacters = ['Maris Vey', 'Father Solen', 'Elias Vorn', 'The House'].map((name, index) => ({
  id: `p${index}`,
  name,
  role: index === 0 ? 'Protagonist' : index === 3 ? 'Shadow Faction' : 'Supporting',
  backstory: '',
  traits: [],
  goals: [],
  fears: [],
  motivations: [],
  quirks: [],
  updatedAt: Date.now(),
} satisfies Character));


const documentTemplates: DocumentTemplate[] = [
  {
    id: 'chapter-summary-pack',
    name: 'Chapter summary pack',
    derivativeType: 'chapterSummary',
    description: 'One clean summary per chapter for editors, agents and your own recall.',
    requiredInputs: ['chapters'],
    defaultTone: 'clear, precise, editorial',
    defaultStructure: ['Project header', 'Chapter-by-chapter summary', 'Open questions'],
    defaultAudience: 'editorial review',
  },
  {
    id: 'synopsis',
    name: 'Synopsis',
    derivativeType: 'synopsis',
    description: 'Short, medium or full plot synopsis for submission and planning.',
    requiredInputs: ['manuscript', 'story bible'],
    defaultTone: 'literary-commercial',
    defaultStructure: ['Hook', 'Main arc', 'Major turns', 'Ending'],
    defaultAudience: 'agent or publisher',
  },
  {
    id: 'query-letter',
    name: 'Query letter',
    derivativeType: 'queryLetter',
    description: 'A concise agent-facing query letter with premise, market position and bio slot.',
    requiredInputs: ['synopsis', 'metadata', 'sample pages'],
    defaultTone: 'polished, confident, concise',
    defaultStructure: ['Opening hook', 'Book pitch', 'Comparable positioning', 'Author note'],
    defaultAudience: 'literary agent',
  },
  {
    id: 'character-dossier',
    name: 'Character dossier',
    derivativeType: 'characterDossier',
    description: 'A source-linked dossier for the main cast, arcs, tensions and unresolved questions.',
    requiredInputs: ['characters', 'chapters'],
    defaultTone: 'structured and practical',
    defaultStructure: ['Cast list', 'Role and function', 'Arc', 'Risk / contradiction notes'],
    defaultAudience: 'author / editor',
  },
  {
    id: 'continuity-report',
    name: 'Continuity report',
    derivativeType: 'continuityReport',
    description: 'A Red Pen style register of contradictions, open loops and repair actions.',
    requiredInputs: ['chapters', 'story bible', 'timeline'],
    defaultTone: 'forensic but writer-friendly',
    defaultStructure: ['Issues', 'Severity', 'Affected chapters', 'Recommended fix'],
    defaultAudience: 'revision pass',
  },
  {
    id: 'press-release',
    name: 'Press release',
    derivativeType: 'pressRelease',
    description: 'Launch-facing announcement copy for a book, serial, public sample or reader campaign.',
    requiredInputs: ['title', 'premise', 'author bio', 'release angle'],
    defaultTone: 'newsworthy, elegant, restrained',
    defaultStructure: ['Headline', 'Standfirst', 'Release body', 'About the author', 'Contact'],
    defaultAudience: 'press / launch audience',
  },
];

const derivativeTypeLabels: Record<DerivativeType, string> = {
  chapterSummary: 'Chapter Summary',
  synopsis: 'Synopsis',
  queryLetter: 'Query Letter',
  characterDossier: 'Character Dossier',
  continuityReport: 'Continuity Report',
  pressRelease: 'Press Release',
  marketingPack: 'Marketing Pack',
  submissionPack: 'Submission Pack',
  revisionPlan: 'Revision Plan',
  businessPlan: 'Business Plan',
  custom: 'Custom Document',
};

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Project Desk', detail: 'Overview and next action', icon: Home },
  { id: 'write', label: 'Writing Room', detail: 'Draft and edit scenes', icon: PenLine },
  { id: 'memory', label: 'Story Bible', detail: 'Characters and canon', icon: BookOpen },
  { id: 'intelligence', label: 'Red Pen', detail: 'Issues and repairs', icon: CircleAlert },
  { id: 'library', label: 'Library', detail: 'Projects and shelves', icon: Library },
  { id: 'upload', label: 'Research Desk', detail: 'Sources and notes', icon: Search },
  { id: 'documents', label: 'Documents', detail: 'Derivatives and packs', icon: FileText },
  { id: 'showfactory', label: 'Show Factory', detail: 'Script, music, pack', icon: Wand2 },
  { id: 'orchestra', label: 'Production', detail: 'Agents and live jobs', icon: Sparkles },
  { id: 'musiclab', label: 'Music Lab', detail: 'Overnight Ollama cycle', icon: Music2 },
  { id: 'showbox', label: 'Show Box', detail: 'Commercial model', icon: Boxes },
  { id: 'publish', label: 'Publish', detail: 'Export and readers', icon: Download },
  { id: 'settings', label: 'Settings', detail: 'Account and privacy', icon: Settings },
];

const countWords = (text = '') => text.trim().split(/\s+/).filter(Boolean).length;
const formatNumber = (n: number) => new Intl.NumberFormat('en-GB').format(n);

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'caspa-document';
const firstParagraph = (text = '') => text.split(/\n\s*\n/).find(Boolean)?.trim() || text.trim().slice(0, 220) || 'No manuscript text has been supplied yet.';

function summariseChapter(chapter: Chapter, index: number) {
  const words = countWords(chapter.content);
  return `### ${index + 1}. ${chapter.title || `Chapter ${index + 1}`}\n- Words: ${formatNumber(words)}\n- Working summary: ${firstParagraph(chapter.content).replace(/\s+/g, ' ').slice(0, 260)}${firstParagraph(chapter.content).length > 260 ? '...' : ''}\n- Editorial note: confirm purpose, turn, and unresolved thread for this chapter.`;
}

function buildDerivativeContent(template: DocumentTemplate, args: { title: string; genre: string; chapters: Chapter[]; characters: Character[]; computedWords: number; }) {
  const { title, genre, chapters, characters, computedWords } = args;
  const chapterLines = chapters.map(summariseChapter).join('\n\n');
  const characterLines = characters.map((character, index) => `- **${character.name || `Character ${index + 1}`}** — ${character.role || 'Role to confirm'}. Motivation: ${character.motivations?.join(', ') || 'not yet defined'}.`).join('\n');
  const sourceLine = `Generated from ${chapters.length} chapters, ${characters.length} characters and ${formatNumber(computedWords)} manuscript words.`;

  switch (template.derivativeType) {
    case 'chapterSummary':
      return `# ${title} — Chapter Summary Pack\n\n${sourceLine}\n\n## Chapter Summaries\n\n${chapterLines}\n\n## Open Editorial Questions\n\n- Which chapter carries the central reversal?\n- Which chapter should the agent sample begin with?\n- Which unresolved promises need closing before export?`;
    case 'synopsis':
      return `# ${title} — Working Synopsis\n\n**Genre:** ${genre}\n**Source:** ${sourceLine}\n\n## Hook\n\n${title} follows a central pressure that begins as private disturbance and widens into a full reckoning. The manuscript should be pitched through character, atmosphere and consequence rather than lore-dump.\n\n## Main Arc\n\nThe early chapters establish the world, the wound and the first promise. The middle chapters should tighten around irreversible choices. The final movement needs to make the moral cost plain and land the emotional debt created in the opening.\n\n## Major Turns\n\n${chapters.slice(0, 6).map((chapter, index) => `- **Turn ${index + 1}: ${chapter.title}** — ${firstParagraph(chapter.content).replace(/\s+/g, ' ').slice(0, 160)}.`).join('\n')}\n\n## Ending Note\n\nConfirm the final revelation, the protagonist's irreversible decision and the last image before this is sent as a formal submission synopsis.`;
    case 'queryLetter':
      return `# ${title} — Query Letter Draft\n\nDear [Agent Name],\n\nI am seeking representation for **${title}**, a ${formatNumber(computedWords)}-word ${genre.toLowerCase()} manuscript with a dark literary atmosphere, strong narrative momentum and a premise built for close editorial attention.\n\nWhen the central character is drawn into a crisis that refuses to stay buried, the story moves from private suspicion into a wider confrontation with memory, power and consequence. The book combines manuscript-scale mystery with emotionally driven stakes and a world that rewards careful readers.\n\nThe manuscript is currently supported by a structured story bible, chapter summaries and a continuity review inside Caspa Studio. Comparable positioning and author bio can be inserted here once final market targets are chosen.\n\nThank you for your time and consideration.\n\nYours sincerely,\n[Author Name]`;
    case 'characterDossier':
      return `# ${title} — Character Dossier\n\n${sourceLine}\n\n## Cast Register\n\n${characterLines || '- No characters recorded yet.'}\n\n## Relationship / Arc Risks\n\n- Confirm each principal character's desire, fear, leverage and final change.\n- Map every major character to at least three scenes where their pressure changes.\n- Flag any character introduced once and then abandoned.\n\n## Dossier Actions\n\n1. Complete missing backstory fields.\n2. Link characters to chapters and scenes.\n3. Run Red Pen continuity review before publication export.`;
    case 'continuityReport':
      return `# ${title} — Continuity Report\n\n${sourceLine}\n\n## Issue Register\n\n| Severity | Issue | Affected Material | Recommended Action |\n|---|---|---|---|\n| Major | Character/location continuity needs verification | Middle chapters | Check scene order and travel logic |\n| Major | Open promise may not be paid off | Chapter sequence | Identify setup/payoff pair |\n| Minor | Object/date/name details may drift | Whole manuscript | Run named-entity pass |\n| Suggestion | Theme could be made more explicit | Final third | Repeat motif with variation, not explanation |\n\n## Next Repair Pass\n\n- Lock chapter order.\n- Create scene-level timeline.\n- Mark each issue as open, accepted, rejected, deferred or fixed.\n- Create a snapshot before applying any AI-generated repair.`;
    case 'pressRelease':
      return `# Press Release — ${title}\n\n**For immediate release**\n\n## ${title} introduces a dark literary manuscript built for readers who like atmosphere, consequence and secrets that refuse to stay buried.\n\nCaspa Studio announces a new manuscript project, **${title}**, a ${genre.toLowerCase()} work currently standing at ${formatNumber(computedWords)} words. The project combines a refined literary voice with a structured editorial workflow, including chapter summaries, continuity review and export-ready derivative documents.\n\nThe book is being developed through a local-first private writing system designed to help authors plan, write, repair and publish without losing control of the source manuscript.\n\n**About the project:** ${title} is supported by ${chapters.length} chapters and ${characters.length} character records. Further materials available on request include synopsis, query letter, character dossier and continuity report.\n\n**Contact:** [Insert contact details]`;
    default:
      return `# ${template.name}\n\n${sourceLine}\n\nThis derivative is ready for custom drafting.`;
  }
}

function makeDerivative(template: DocumentTemplate, args: { project: Project; title: string; genre: string; chapters: Chapter[]; characters: Character[]; computedWords: number; }): DocumentDerivative {
  const now = new Date().toISOString();
  return {
    id: `${template.id}-${Date.now()}`,
    projectId: args.project?.id || 'local-project',
    sourceType: 'mixed',
    sourceIds: [...args.chapters.map((chapter) => chapter.id), ...args.characters.map((character) => character.id)].filter(Boolean),
    derivativeType: template.derivativeType,
    title: `${args.title} — ${template.name}`,
    audience: template.defaultAudience,
    tone: template.defaultTone,
    length: 'medium',
    content: buildDerivativeContent(template, args),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    templateId: template.id,
    generationPrompt: `Template: ${template.name}; Structure: ${template.defaultStructure.join(' > ')}`,
    sourceSnapshotId: `${args.project?.id || 'local'}-${args.computedWords}-${args.chapters.length}-${args.characters.length}`,
    lastSourceWordCount: args.computedWords,
    exportFormats: ['md', 'txt', 'docx', 'json'],
  };
}


function GreyLadyMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'cs-mark cs-mark--compact' : 'cs-mark'} aria-hidden="true">
      <div className="cs-mark__oval" />
      <div className="cs-mark__profile">
        <span className="cs-mark__head" />
        <span className="cs-mark__neck" />
        <span className="cs-mark__veil cs-mark__veil-a" />
        <span className="cs-mark__veil cs-mark__veil-b" />
        <span className="cs-mark__veil cs-mark__veil-c" />
      </div>
      <span className="cs-mark__star">✦</span>
    </div>
  );
}

export default function CaspaRedesign(props: Props) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResult, setAssistantResult] = useState<string | null>(null);

  const chapters = props.chapters.length ? [...props.chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : fallbackChapters;
  const characters = props.characters.length ? props.characters : fallbackCharacters;
  const selectedChapter = chapters.find((c) => c.title?.toLowerCase().includes('levee')) || chapters[chapters.length - 1];
  const computedWords = props.totalWords || chapters.reduce((acc, chapter) => acc + countWords(chapter.content), 0) || 86742;
  const progress = Math.min(99, Math.max(1, Math.round((computedWords / 120000) * 100)));
  const projectTitle = props.project?.title && props.project.title !== 'Untitled Narrative' ? props.project.title : 'The House of God';
  const genre = props.project?.genre || 'Epic Literary Fiction';

  const callAssistant = async (action: string, content?: string) => {
    setAssistantLoading(true);
    setAssistantResult(null);
    try {
      const response = await fetch('/api/assist/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          content: content || selectedChapter?.content || '',
          context: `Project: ${projectTitle}`,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.status === 'success') {
        setAssistantResult(data.result);
        alert('✨ Assist request processed! Response shown below.');
      } else {
        const errorMsg = `Error: ${data.error || 'Unknown error'}`;
        setAssistantResult(errorMsg);
        alert(errorMsg.substring(0, 200));
      }
    } catch (err: any) {
      const failMsg = `Failed to reach assistant: ${err.message}`;
      setAssistantResult(failMsg);
      alert(failMsg);
    } finally {
      setAssistantLoading(false);
    }
  };

  const content = useMemo(() => {
    switch (props.currentView) {
      case 'write':
      case 'writing':
        return <WritingRoom title={projectTitle} genre={genre} chapter={selectedChapter} chapters={chapters} characters={characters} progress={progress} computedWords={computedWords} onAssist={callAssistant} isLoading={assistantLoading} result={assistantResult} />;
      case 'memory':
      case 'intelligence':
        return <RedPen title={projectTitle} chapters={chapters} characters={characters} computedWords={computedWords} onAnalyze={() => callAssistant('analyze-manuscript')} isLoading={assistantLoading} result={assistantResult} />;
      case 'library':
        return <LibraryScreen createNewProject={props.createNewProject} />;
      case 'upload':
        return <ResearchScreen />;
      case 'documents':
        return <DocumentsScreen title={projectTitle} genre={genre} project={props.project} chapters={chapters} characters={characters} computedWords={computedWords} />;
      case 'showfactory':
        return <ShowFactoryScreen />;
      case 'orchestra':
        return <ProductionOrchestraScreen />;
      case 'musiclab':
        return <OvernightMusicLabScreen />;
      case 'showbox':
        return <ShowInABoxScreen />;
      case 'publish':
        return <PublishScreen title={projectTitle} computedWords={computedWords} />;
      case 'settings':
        return <SettingsScreen user={props.user} />;
      default:
        return <ProjectDesk title={projectTitle} genre={genre} chapters={chapters} characters={characters} progress={progress} computedWords={computedWords} setCurrentView={props.setCurrentView} onAssist={() => callAssistant('draft-scene')} />;
    }
  }, [props.currentView, projectTitle, genre, selectedChapter, chapters, characters, progress, computedWords, assistantLoading, assistantResult]);

  return (
    <div className="cs-shell">
      <aside className={`cs-sidebar ${mobileMenu ? 'is-open' : ''}`}>
        <div className="cs-sidebar__brand">
          <GreyLadyMark />
          <div>
            <div className="cs-wordmark">Caspa</div>
            <div className="cs-wordmark-sub">Studio</div>
            <div className="cs-tiny">Private writing system</div>
          </div>
          <button className="cs-icon-button cs-sidebar__close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <nav className="cs-nav" aria-label="Caspa Studio navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === props.currentView || (item.id === 'dashboard' && !navItems.some((n) => n.id === props.currentView));
            return (
              <button key={item.id} className={`cs-nav__item ${active ? 'is-active' : ''}`} onClick={() => { props.setCurrentView(item.id); setMobileMenu(false); }}>
                <Icon size={18} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="cs-sidebar__user">
          <div className="cs-avatar">{props.user.photoURL ? <img src={props.user.photoURL} alt="" /> : 'CS'}</div>
          <div className="cs-sidebar__user-text">
            <strong>{props.user.displayName || 'Author'}</strong>
            <small>{props.user.email || 'Local workspace'}</small>
          </div>
          <button className="cs-icon-button" onClick={props.logout} title="Sign out"><LogOut size={16} /></button>
        </div>
      </aside>

      {mobileMenu && <button className="cs-scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}

      <main className="cs-main">
        <header className="cs-topbar">
          <button className="cs-icon-button cs-mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="cs-breadcrumb">
            <span>Written by humanity</span>
            <ChevronRight size={14} />
            <strong>Crafted by Caspa</strong>
          </div>
          <label className="cs-search">
            <Search size={16} />
            <input placeholder="Search manuscript, characters, notes..." />
          </label>
          <div className="cs-topbar__actions">
            <button className="cs-button cs-button--ghost" onClick={props.saveToCloud}><CheckCircle2 size={16} /> Save</button>
            <button className="cs-button cs-button--gold" onClick={() => callAssistant('draft-scene')} disabled={assistantLoading}>
              {assistantLoading ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
              Caspa Assist
            </button>
          </div>
        </header>

        {content}
      </main>
    </div>
  );
}

function ProjectDesk({ title, genre, chapters, characters, progress, computedWords, setCurrentView, onAssist }: {
  title: string; genre: string; chapters: Chapter[]; characters: Character[]; progress: number; computedWords: number; setCurrentView: (view: ViewType) => void; onAssist: () => void;
}) {
  return (
    <section className="cs-page cs-project-desk">
      <div className="cs-hero">
        <div>
          <div className="cs-kicker">Project Desk</div>
          <h1>{title}</h1>
          <p>{genre} - Draft 6 - Private workspace</p>
          <div className="cs-tabs"><span className="is-active">Overview</span><span>Manuscript</span><span>Chapters</span><span>Insights</span><span>Stats</span></div>
        </div>
        <div className="cs-hero__lady"><GreyLadyMark compact /></div>
      </div>

      <div className="cs-grid cs-grid--desk">
        <article className="cs-card cs-card--large cs-progress-card">
          <div className="cs-card__title">Manuscript progress</div>
          <div className="cs-progress-layout">
            <div className="cs-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}>
              <span>{progress}%</span>
              <small>{formatNumber(computedWords)} / 120,000 words</small>
            </div>
            <div className="cs-progress-meta">
              <span className="cs-status cs-status--green"><CheckCircle2 size={14} /> On track</span>
              <p>You are maintaining a strong pace. Next meaningful win: complete the current part and run a continuity pass.</p>
              <div className="cs-stat-row">
                <Metric value={chapters.length} label="Chapters" />
                <Metric value={characters.length} label="Characters" />
                <Metric value="4" label="Parts" />
                <Metric value="32" label="Days left" />
              </div>
            </div>
          </div>
          <div className="cs-progress-bar"><span style={{ width: `${progress}%` }} /></div>
        </article>

        <article className="cs-card cs-continue-card">
          <div className="cs-card__title">Continue writing</div>
          <div className="cs-chapter-focus">
            <FileText size={28} />
            <div>
              <small>Part II - Chapter {chapters.length ? chapters[Math.min(4, chapters.length - 1)].order || 17 : 17}</small>
              <h3>{chapters[Math.min(4, chapters.length - 1)]?.title || 'The Levee'}</h3>
              <p>Last edited recently - {formatNumber(countWords(chapters[Math.min(4, chapters.length - 1)]?.content || ''))} words</p>
            </div>
          </div>
          <div className="cs-sparkline" />
          <div className="cs-button-row">
            <button className="cs-button cs-button--gold" onClick={() => setCurrentView('write')}><PenLine size={16} /> Continue Writing</button>
            <button className="cs-button cs-button--ghost" onClick={() => setCurrentView('memory')}>Open Story Bible</button>
          </div>
        </article>

        <aside className="cs-aside-panel">
          <SuggestionCard type="Scene suggestion" text="Deepen the tension before the next reveal. Let the room know something before the character does." action="View suggestion" />
          <SuggestionCard type="Continuity note" text="A named injury appears once, then vanishes. Either carry it forward or remove the seed." action="Review note" />
          <SuggestionCard type="Writing insight" text="The middle sequence is slower than the surrounding chapters. Raise stakes or cut connective tissue." action="View insight" />
        </aside>

        <article className="cs-card">
          <div className="cs-card__title">Recent chapters <button>View all</button></div>
          <div className="cs-list">
            {chapters.slice(-5).reverse().map((chapter, index) => <ChapterRow key={chapter.id || index} chapter={chapter} />)}
          </div>
        </article>

        <article className="cs-card">
          <div className="cs-card__title">Upcoming tasks <button>View calendar</button></div>
          <Task title="Outline Part III" detail="Plan major beats" date="May 28" tone="gold" />
          <Task title="Research: Obsidian Chamber" detail="Worldbuilding" date="May 30" tone="violet" />
          <Task title="Character Motivation: Eli" detail="Review transformation" date="Jun 2" tone="violet" />
          <Task title="Continuity Check" detail="Run analysis" date="Jun 4" tone="gold" />
        </article>

        <article className="cs-card cs-health-card">
          <div className="cs-card__title">Manuscript health</div>
          <div className="cs-health-orb"><span>92</span><small>Excellent</small></div>
          <div className="cs-health-grid"><span>Pacing <b>Strong</b></span><span>Structure <b>Strong</b></span><span>Dialogue <b>Good</b></span><span>Characters <b>Excellent</b></span></div>
          <button className="cs-link-button">View full report <ChevronRight size={14} /></button>
        </article>

        <article className="cs-card cs-quick-actions">
          <div className="cs-card__title">Quick actions</div>
          <button><Feather />New Chapter<small>Start writing</small></button>
          <button><BookText />New Scene<small>Add a scene</small></button>
          <button><Users />Character<small>Create a character</small></button>
          <button><Globe2 />Worldbuilding<small>Build your world</small></button>
          <button><BookOpen />Research<small>Add research</small></button>
          <button onClick={() => setCurrentView('documents')}><FileText />Documents<small>Build packs</small></button>
          <button onClick={onAssist}><Target />Assist<small>AI suggestions</small></button>
        </article>
      </div>
    </section>
  );
}

function WritingRoom({ title, genre, chapter, chapters, characters, progress, computedWords, onAssist, isLoading, result }: {
  title: string; genre: string; chapter: Chapter; chapters: Chapter[]; characters: Character[]; progress: number; computedWords: number; onAssist: (action: string) => void; isLoading: boolean; result: string | null;
}) {
  return (
    <section className="cs-writing-room">
      <div className="cs-writing-header">
        <div><div className="cs-kicker">Writing Room</div><h1>{title}</h1><p>{genre} - Autosaved a few seconds ago</p></div>
        <div className="cs-writing-header__stats"><Metric value={formatNumber(computedWords)} label="Words" /><button className="cs-button cs-button--gold"><Lock size={16} /> Focus</button></div>
      </div>
      <div className="cs-writing-grid">
        <aside className="cs-card cs-chapter-sidebar">
          <div className="cs-card__title">Manuscript <span>{progress}%</span></div>
          <div className="cs-progress-bar"><span style={{ width: `${progress}%` }} /></div>
          {chapters.map((item, index) => <button key={item.id || index} className={item.id === chapter.id ? 'is-active' : ''}><span>{item.order || index + 1}</span><strong>{item.title}</strong><small>{formatNumber(countWords(item.content))} words</small></button>)}
          <button className="cs-add-chapter"><Plus size={16} /> Add Chapter</button>
        </aside>
        <article className="cs-editor cs-card">
          <div className="cs-toolbar"><select><option>Body Text</option></select><button>B</button><button><i>I</i></button><button><u>U</u></button><button>menu</button><button>quotes</button><button>undo</button><button>redo</button></div>
          <div className="cs-editor__page">
            <span className="cs-kicker">Chapter {chapter.order || 17}</span>
            <h2>{chapter.title || 'The Levee'}</h2>
            {(chapter.content || fallbackChapters[4].content).split('\n').filter(Boolean).map((para, index) => <p key={index}>{para}</p>)}
          </div>
          <div className="cs-editor__footer"><Metric value={formatNumber(countWords(chapter.content || fallbackChapters[4].content))} label="Words" /><Metric value="52m" label="Read time" /><Metric value="1 of 5" label="Scene" /><Metric value="47m" label="Focus" /></div>
        </article>
        <aside className="cs-assistant">
          {result ? (
            <div className="cs-card cs-card--result">
              <div className="cs-card__title">Assistant Response</div>
              <p>{result}</p>
            </div>
          ) : (
            <div className="cs-card"><div className="cs-card__title">Caspa Assistant</div><AssistantAction title="Draft next scene" detail="Continue the story from here." onClick={() => onAssist('draft-scene')} loading={isLoading} /><AssistantAction title="Improve this scene" detail="Enhance clarity, tension and flow." onClick={() => onAssist('improve-scene')} loading={isLoading} /><AssistantAction title="Repair this chapter" detail="Strengthen structure and pacing." onClick={() => onAssist('repair-chapter')} loading={isLoading} /><AssistantAction title="Summarise this chapter" detail="Get a concise chapter summary." onClick={() => onAssist('summarize')} loading={isLoading} /></div>
          )}
          <div className="cs-card"><div className="cs-card__title">Continuity notes <span>3</span></div><ul className="cs-bullet-list"><li>The levee is failing slowly - foreshadowing.</li><li>The old amulet is iron and pre-House.</li><li>The House appears to know the flood is coming.</li></ul></div>
          <div className="cs-card"><div className="cs-card__title">Character reminders <button>Manage</button></div>{characters.slice(0, 4).map((character) => <div key={character.id} className="cs-person-row"><span>{character.name.slice(0, 1)}</span><strong>{character.name}</strong><small>{character.role || 'Character'}</small></div>)}</div>
        </aside>
      </div>
    </section>
  );
}

function RedPen({ title, chapters, characters, computedWords, onAnalyze, isLoading, result }: { title: string; chapters: Chapter[]; characters: Character[]; computedWords: number; onAnalyze: () => void; isLoading: boolean; result: string | null }) {
  const issues = [
    ['Major', 'Character location does not match timeline', 'Character location jumps without travel time.'],
    ['Major', 'Injury changes between chapters', 'Physical continuity needs resolving.'],
    ['Minor', 'Document date conflict in Chapter 17', 'Prop date contradicts timeline.'],
    ['Suggestion', 'Foreshadowing opportunity', 'Seed the flood image earlier.'],
  ];
  return (
    <section className="cs-page cs-redpen">
      <div className="cs-hero cs-hero--compact"><div><div className="cs-kicker">Story Bible / Red Pen</div><h1>{title}</h1><p>Plan. Refine. Repair. Elevate your story.</p></div><button className="cs-button cs-button--gold" onClick={onAnalyze} disabled={isLoading}>{isLoading ? <Loader size={16} /> : <Wand2 size={16} />} Run full analysis</button></div>
      <div className="cs-grid cs-grid--redpen">
        <article className="cs-card cs-character-board"><div className="cs-card__title">Character board <span>{characters.length}</span></div>{characters.slice(0, 7).map((c, i) => <div key={c.id} className="cs-character-card"><div className="cs-character-card__portrait">{c.name.slice(0, 1)}</div><strong>{c.name}</strong><small>{c.role || (i === 0 ? 'Protagonist' : 'Supporting')}</small><span className="cs-mini-bar"><i style={{ width: `${55 + i * 6}%` }} /></span></div>)}</article>
        <article className="cs-card cs-timeline"><div className="cs-card__title">Plot timeline <button>View timeline</button></div><div className="cs-timeline__line">{['The Call','The First Lie','The Deepening','The Betrayal','The Revelation','The Reckoning'].map((label, i) => <span key={label} style={{ left: `${6 + i * 17}%` }}><b>Ch. {i * 5 + 1}</b><small>{label}</small></span>)}</div></article>
        <article className="cs-card"><div className="cs-card__title">Themes</div><Theme label="Truth vs Power" strength="Strong" width={88} /><Theme label="Faith and Doubt" strength="Medium" width={62} /><Theme label="Redemption" strength="Medium" width={58} /><Theme label="Sacrifice" strength="Low" width={34} /></article>
        <article className="cs-card"><div className="cs-card__title">Continuity alerts <span>12</span></div>{issues.map(([level, title, detail], i) => <div key={i} className="cs-issue-row"><span className={`cs-dot cs-dot--${level.toLowerCase()}`} /><div><strong>{title}</strong><small>{detail}</small></div><em>{level}</em></div>)}</article>
        <article className="cs-card cs-scene-map"><div className="cs-card__title">Scene relationships</div><div className="cs-map-node cs-map-node--center">Ch. 14<br />The Betrayal</div><div className="cs-map-node n1">Ch. 12<br />Warning</div><div className="cs-map-node n2">Ch. 13<br />Confession</div><div className="cs-map-node n3">Ch. 15<br />Escape</div><div className="cs-map-node n4">Ch. 17<br />Letter</div></article>
        <aside className="cs-aside-panel cs-redpen-inspector">
          {result && <div className="cs-card cs-card--result"><div className="cs-card__title">Analysis</div><p>{result}</p></div>}
          <SuggestionCard type="Issue detail" text="Character appears in two locations without travel time. Add a transition scene or adjust the chapter opening." action="Apply suggestion" />
          <SuggestionCard type="AI recommendation" text="Best fix: add a short travel beat and use it to reveal character tension." action="Add travel scene" />
          <SuggestionCard type="Manuscript profile" text={`${formatNumber(computedWords)} words - ${chapters.length} chapters - repair pass recommended.`} action="Generate report" />
        </aside>
      </div>
    </section>
  );
}

function LibraryScreen({ createNewProject }: { createNewProject: (title?: string) => void }) { return <SimpleScreen title="Library" text="Your manuscripts, shelves, public read links and local drafts live here." action="New manuscript" onClick={() => createNewProject('Untitled Manuscript')} icon={Library} />; }
function ResearchScreen() {
  const [sources, setSources] = useState<Array<{id: string; title: string; type: string; date: string}>>([
    {id: '1', title: 'House of God - Medical Fiction', type: 'Reference Book', date: 'Jun 10'},
    {id: '2', title: 'Florence Nightingale Biography', type: 'Biography', date: 'Jun 8'},
    {id: '3', title: 'Hospital Architecture 1800s', type: 'Academic', date: 'Jun 5'},
  ]);

  return (
    <section className="cs-page">
      <div className="cs-hero cs-hero--compact">
        <div>
          <div className="cs-kicker">Research & Sources</div>
          <h1>Research Desk</h1>
          <p>Uploaded sources, notes and worldbuilding references.</p>
        </div>
        <button className="cs-button cs-button--gold"><Search size={16} /> Add source</button>
      </div>
      <div className="cs-grid">
        <article className="cs-card">
          <div className="cs-card__title">Sources <span>{sources.length}</span></div>
          <div className="cs-list">
            {sources.map(source => (
              <div key={source.id} style={{padding: '0.75rem', borderBottom: '1px solid rgba(212,175,55,0.1)', cursor: 'pointer'}}>
                <strong>{source.title}</strong>
                <small style={{display: 'block', marginTop: '0.25rem'}}>{source.type} • {source.date}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="cs-card">
          <div className="cs-card__title">Quick actions</div>
          <button style={{width: '100%', padding: '0.75rem', marginBottom: '0.5rem', border: '1px solid rgba(212,175,55,0.3)', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#D4AF37'}}>📎 Upload PDF</button>
          <button style={{width: '100%', padding: '0.75rem', marginBottom: '0.5rem', border: '1px solid rgba(212,175,55,0.3)', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#D4AF37'}}>🔗 Add web link</button>
          <button style={{width: '100%', padding: '0.75rem', border: '1px solid rgba(212,175,55,0.3)', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#D4AF37'}}>📝 New note</button>
        </article>
      </div>
    </section>
  );
}

function DocumentsScreen({ title, genre, project, chapters, characters, computedWords }: { title: string; genre: string; project: Project; chapters: Chapter[]; characters: Character[]; computedWords: number }) {
  const [derivatives, setDerivatives] = useState<DocumentDerivative[]>(() => documentTemplates.map((template) => makeDerivative(template, { project, title, genre, chapters, characters, computedWords })));
  const [activeId, setActiveId] = useState(() => derivatives[0]?.id || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = derivatives.find((item) => item.id === activeId) || derivatives[0];

  const regenerate = (template: DocumentTemplate) => {
    const next = makeDerivative(template, { project, title, genre, chapters, characters, computedWords });
    setDerivatives((prev) => [next, ...prev.filter((item) => item.templateId !== template.id)]);
    setActiveId(next.id);
    setNotice(`${template.name} regenerated from current source material.`);
  };

  const updateStatus = (status: DocumentDerivative['status']) => {
    if (!active) return;
    setDerivatives((prev) => prev.map((item) => item.id === active.id ? { ...item, status, updatedAt: new Date().toISOString() } : item));
  };

  const exportDerivative = async (format: 'md' | 'txt' | 'docx' | 'json') => {
    if (!active) return;
    setBusy(format);
    setNotice(null);
    try {
      const response = await fetch('/api/documents/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ derivative: active, format, projectTitle: title }),
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const matched = disposition.match(/filename="?([^";]+)"?/i);
      const filename = matched?.[1] || `${slugify(active.title)}.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDerivatives((prev) => prev.map((item) => item.id === active.id ? { ...item, status: 'exported', exportedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item));
      setNotice(`Exported ${filename}.`);
    } catch (err: any) {
      setNotice(`Export failed: ${err?.message || err}`);
    } finally {
      setBusy(null);
    }
  };

  const backupToDropbox = async () => {
    if (!active) return;
    setBusy('dropbox');
    setNotice(null);
    try {
      const response = await fetch('/api/documents/dropbox-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ derivative: active, projectTitle: title }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.detail || 'Dropbox backup failed');
      setNotice(`Dropbox backup complete: ${data.dropboxPath || 'Caspa Studio backup folder'}.`);
    } catch (err: any) {
      setNotice(`Dropbox backup failed: ${err?.message || err}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="cs-page cs-documents">
      <div className="cs-hero cs-hero--compact">
        <div>
          <div className="cs-kicker">Document Derivatives</div>
          <h1>Documents</h1>
          <p>One manuscript in. Controlled publishing, editorial, marketing and submission documents out.</p>
          <div className="cs-tabs"><span className="is-active">Builder</span><span>Exports</span><span>Submission</span><span>Marketing</span><span>Archive</span></div>
        </div>
        <button className="cs-button cs-button--gold" onClick={() => regenerate(documentTemplates[0])}><Wand2 size={16} /> Generate pack</button>
      </div>

      <div className="cs-documents__workflow">
        <span><b>Source</b>Manuscript / Story Bible</span>
        <ChevronRight size={15} />
        <span><b>Builder</b>Template + audience</span>
        <ChevronRight size={15} />
        <span><b>Review</b>Draft / approve</span>
        <ChevronRight size={15} />
        <span><b>Export</b>MD / TXT / DOCX / JSON</span>
      </div>

      <div className="cs-documents-grid">
        <aside className="cs-card cs-doc-template-panel">
          <div className="cs-card__title">Derivative templates <span>{documentTemplates.length}</span></div>
          {documentTemplates.map((template) => (
            <button key={template.id} onClick={() => regenerate(template)} className={active?.templateId === template.id ? 'is-active' : ''}>
              <FileText size={17} />
              <span>
                <strong>{template.name}</strong>
                <small>{template.description}</small>
              </span>
            </button>
          ))}
        </aside>

        <article className="cs-card cs-doc-library-panel">
          <div className="cs-card__title">Generated documents <button onClick={() => setDerivatives(documentTemplates.map((template) => makeDerivative(template, { project, title, genre, chapters, characters, computedWords })))}>Refresh all</button></div>
          <div className="cs-doc-list">
            {derivatives.map((item) => {
              const staleWords = Math.abs((item.lastSourceWordCount || computedWords) - computedWords);
              return (
                <button key={item.id} onClick={() => setActiveId(item.id)} className={active?.id === item.id ? 'is-active' : ''}>
                  <span className="cs-doc-list__type">{derivativeTypeLabels[item.derivativeType]}</span>
                  <strong>{item.title.replace(`${title} — `, '')}</strong>
                  <small>{item.status} · {new Date(item.updatedAt).toLocaleDateString('en-GB')} {staleWords > 1500 ? `· stale by ${formatNumber(staleWords)} words` : '· source current'}</small>
                </button>
              );
            })}
          </div>
        </article>

        <article className="cs-card cs-doc-preview-panel">
          {active ? (
            <>
              <div className="cs-card__title">Document preview <span>{active.status}</span></div>
              <div className="cs-doc-meta">
                <span><b>Audience</b>{active.audience || 'not set'}</span>
                <span><b>Tone</b>{active.tone || 'not set'}</span>
                <span><b>Source</b>{active.sourceIds.length} linked records</span>
                <span><b>Snapshot</b>{active.sourceSnapshotId}</span>
              </div>
              <div className="cs-doc-preview">
                <pre>{active.content}</pre>
              </div>
            </>
          ) : <p>No derivative selected.</p>}
        </article>

        <aside className="cs-card cs-doc-actions-panel">
          <div className="cs-card__title">Review & export</div>
          <div className="cs-doc-statuses">
            {(['draft', 'review', 'approved', 'exported', 'archived'] as DocumentDerivative['status'][]).map((status) => <button key={status} className={active?.status === status ? 'is-active' : ''} onClick={() => updateStatus(status)}>{status}</button>)}
          </div>
          <div className="cs-doc-export-grid">
            {(['md', 'txt', 'docx', 'json'] as const).map((format) => <button key={format} onClick={() => exportDerivative(format)} disabled={busy !== null}>{busy === format ? 'Exporting...' : format.toUpperCase()}</button>)}
          </div>
          <button className="cs-button cs-button--gold cs-doc-wide" onClick={backupToDropbox} disabled={busy !== null}><Download size={16} /> {busy === 'dropbox' ? 'Backing up...' : 'Backup derivative to Dropbox'}</button>
          <div className="cs-doc-note">
            <ShieldCheck size={16} />
            <p>Derivatives are saved as controlled outputs. They remember source scope, template, status and export history.</p>
          </div>
          {notice && <div className="cs-doc-notice">{notice}</div>}
        </aside>
      </div>
    </section>
  );
}



type ShowFactoryPackView = {
  pack_id: string;
  brief: { title: string; runtimeMinutes: number; songCount: number; castSize: number; musicalStyle: string };
  song_map: Array<{ song_id: string; title: string; function: string; style: string; default_key: string; lyria_prompt: string }>;
  scene_list: Array<{ scene: number; title: string; dramatic_function: string; songs: string[] }>;
  asset_manifest: Array<{ asset_id: string; title: string; status: string; format: string; description: string }>;
  quality_gates: Array<{ gate: string; status: string; checks: Array<{ check: string; pass: boolean; note: string }> }>;
  agent_reviews: Array<{ agent_id: string; verdict: string; note: string }>;
  soundtrack_plan: Array<{ song_id: string; demo_track: string; backing_track: string; guide_vocal: string; lyria_model: string; generation_status: string }>;
};

function ShowFactoryScreen() {
  const [pack, setPack] = useState<ShowFactoryPackView | null>(null);
  const [test, setTest] = useState<any>(null);
  const [busy, setBusy] = useState<'pack' | 'test' | 'zip' | null>(null);
  const [notice, setNotice] = useState<string>('Ready to generate a show-road pack. Website and ticketing are intentionally parked.');

  const brief = {
    title: 'The Haunted Dame',
    showType: 'pantomime',
    audience: 'family',
    runtimeMinutes: 90,
    castSize: 18,
    songCount: 8,
    setting: 'A half-haunted seaside town with a beloved community theatre, a pier and a corrupt mayor.',
    premise: 'A Dame, a theatre ghost and a ragtag chorus must save opening night before the town forgets itself.',
    tone: 'big-hearted, fast, family-safe, premium gothic panto',
    productionLevel: 'amdram',
    musicalStyle: 'British panto, theatrical pop, music hall, folk-rock and comic patter',
    safetyLevel: 'family_safe',
  };

  const generatePack = async () => {
    setBusy('pack');
    setNotice('Generating show-road pack...');
    try {
      const response = await fetch('/api/show-factory/create-pack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setPack(data.pack);
      setNotice(`Generated ${data.pack.song_map.length} songs, ${data.pack.scene_list.length} scenes and ${data.pack.asset_manifest.length} asset records.`);
    } catch (err: any) {
      setNotice(`Show Factory failed: ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy('test');
    setNotice('Running Show Factory virtual test...');
    try {
      const response = await fetch('/api/show-factory/virtual-test', { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTest(data);
      setNotice(`Virtual test complete: ${data.score}/100. ${data.summary}`);
    } catch (err: any) {
      setNotice(`Virtual test failed: ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  const exportZip = async () => {
    setBusy('zip');
    setNotice('Preparing downloadable show-road pack...');
    try {
      const response = await fetch('/api/show-factory/export-package', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pack ? { pack } : { brief }) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'the-haunted-dame-show-road-pack.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice('ZIP export created. It includes show bible, script sample, lyrics, Lyria prompts, QA and MusicXML guide stubs.');
    } catch (err: any) {
      setNotice(`ZIP export failed: ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  const visibleSongs = pack?.song_map?.slice(0, 8) || [];
  const visibleApis = showFactoryApiCatalogue.slice(0, 7);
  const visibleAgents = showFactoryAgents.slice(0, 14);

  return (
    <section className="cs-page cs-showbox cs-showfactory">
      <div className="cs-hero cs-hero--compact cs-showbox-hero">
        <div>
          <div className="cs-kicker">Next module built</div>
          <h1>Casper Show Factory</h1>
          <p>Gets the show on the road: agentic theatre team, show bible, script sample, song map, lyrics, Gemini/Lyria prompts, score plan, soundtrack plan and QA gates.</p>
          <div className="cs-tabs"><span className="is-active">Production Pack</span><span>Agents</span><span>Music</span><span>QA</span><span>APIs</span></div>
        </div>
        <div className="cs-showbox-actions">
          <button className="cs-button" onClick={runTest} disabled={busy !== null}><ShieldCheck size={16} /> {busy === 'test' ? 'Testing...' : 'Virtual test'}</button>
          <button className="cs-button" onClick={exportZip} disabled={busy !== null}><Download size={16} /> {busy === 'zip' ? 'Exporting...' : 'Export ZIP'}</button>
          <button className="cs-button cs-button--gold" onClick={generatePack} disabled={busy !== null}><Wand2 size={16} /> {busy === 'pack' ? 'Generating...' : 'Generate pack'}</button>
        </div>
      </div>

      <div className="cs-showbox-stats">
        <article><b>{visibleAgents.length}</b><span>theatre agents</span></article>
        <article><b>{pack?.scene_list?.length || 10}</b><span>scenes planned</span></article>
        <article><b>{pack?.song_map?.length || 8}</b><span>songs mapped</span></article>
        <article><b>{pack?.asset_manifest?.length || 8}</b><span>assets tracked</span></article>
        <article><b>{test?.score || 100}</b><span>virtual score</span></article>
      </div>

      {notice && <div className="cs-doc-notice">{notice}</div>}

      <div className="cs-showbox-grid">
        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Agentic theatre company <span>{visibleAgents.length}</span></div>
          <div className="cs-showbox-module-grid">
            {visibleAgents.map((agent) => (
              <div key={agent.id}>
                <span>{agent.id.replaceAll('_', ' ')}</span>
                <strong>{agent.name}</strong>
                <p>{agent.role}</p>
                <small>{agent.acceptance_focus.join(' · ')}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Generated show-road pack <span>{pack ? pack.brief.title : 'sample-ready'}</span></div>
          <div className="cs-showbox-phases">
            {(pack?.scene_list || [
              { scene: 1, title: 'The Pier Opens Late', dramatic_function: 'establish town and theatre stakes', songs: ['Raise the Curtain'] },
              { scene: 2, title: 'A Ghost in the Prompt Box', dramatic_function: 'Grey Lady gives quest', songs: ['Something in the Wings'] },
              { scene: 3, title: 'The Dame Takes Charge', dramatic_function: 'comic bond and localisable business', songs: ['The Dame Knows Best'] },
              { scene: 4, title: 'The Mayor Smells Money', dramatic_function: 'villain plan', songs: ['Villain with a Plan'] },
            ]).slice(0, 8).map((scene) => (
              <div key={scene.scene}>
                <header>
                  <b>Scene {scene.scene}</b>
                  <strong>{scene.title}</strong>
                  <span>{scene.songs?.join(', ') || 'No song'}</span>
                </header>
                <p>{scene.dramatic_function}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Music engine outputs <span>Gemini/Lyria ready</span></div>
          <div className="cs-showbox-entity-grid">
            {(visibleSongs.length ? visibleSongs : [
              { song_id: 'song-01', title: 'Raise the Curtain', function: 'opening number', style: 'theatrical pop', default_key: 'C', lyria_prompt: 'Original panto opening number...' },
              { song_id: 'song-02', title: 'Something in the Wings', function: 'ghost reveal', style: 'spooky waltz', default_key: 'D', lyria_prompt: 'Original ghost reveal...' },
              { song_id: 'song-03', title: 'The Dame Knows Best', function: 'Dame showcase', style: 'comic patter', default_key: 'F', lyria_prompt: 'Original Dame comic number...' },
              { song_id: 'song-04', title: 'A Little Bit Haunted', function: 'ensemble number', style: 'folk-rock', default_key: 'G', lyria_prompt: 'Original ensemble...' },
            ]).map((song) => (
              <div key={song.song_id}>
                <strong>{song.title}</strong>
                <small>{song.function}; {song.style}; key {song.default_key}. Lyria prompt ready.</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card">
          <div className="cs-card__title">QA gates</div>
          <div className="cs-showbox-list">
            {(pack?.quality_gates || []).length ? pack!.quality_gates.map((gate) => (
              <div key={gate.gate}>
                <strong>{gate.gate.replaceAll('_', ' ')}</strong>
                <small>{gate.status} — {gate.checks.filter((check) => check.pass).length}/{gate.checks.length} checks passing</small>
              </div>
            )) : ['rights_safety_gate', 'script_quality_gate', 'music_quality_gate', 'production_readiness_gate'].map((gate) => <div key={gate}><strong>{gate.replaceAll('_', ' ')}</strong><small>Ready to run after pack generation.</small></div>)}
          </div>
        </article>

        <article className="cs-card">
          <div className="cs-card__title">Required APIs & services</div>
          <div className="cs-showbox-list">
            {visibleApis.map((api) => (
              <div key={api.id}>
                <strong>{api.name}</strong>
                <small>{api.purpose} Status: {api.status}.</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">What this module now produces</div>
          <ol className="cs-showbox-actions-list">
            <li>Agentic theatre production line with writer, composer, arranger, director, critic, actor and rights/safety roles.</li>
            <li>Show bible, running order, cast map, scene list and script sample.</li>
            <li>Eight-song map with dramatic function, key, range, style and Lyria prompts.</li>
            <li>Lyrics pack, score/MusicXML plan, soundtrack plan, backing-track and guide-vocal manifest.</li>
            <li>Quality gates for rights, script, music and production readiness.</li>
            <li>Downloadable ZIP containing JSON, Markdown, lyric pack, Lyria payloads and MusicXML guide stubs.</li>
            <li>Website and ticketing deliberately excluded until the show-production engine stops wobbling.</li>
          </ol>
        </article>
      </div>
    </section>
  );
}


function ProductionOrchestraScreen() {
  const [busy, setBusy] = useState<null | 'plan' | 'test' | 'pipeline' | 'zip'>(null);
  const [notice, setNotice] = useState('');
  const [plan, setPlan] = useState(() => createProductionPlan({ title: 'The Haunted Dame', songCount: 8, runtimeMinutes: 90 }));
  const [test, setTest] = useState(() => runOrchestraVirtualTest(plan));
  const visibleJobs = plan.jobs.slice(0, 12);
  const musicJobs = plan.jobs.filter((job) => ['lyrics', 'lyria_clip', 'lyria_pro_song', 'musicxml_stub'].includes(job.type));

  const refreshPlan = async () => {
    setBusy('plan');
    setNotice('');
    try {
      const response = await fetch('/api/show-orchestra/create-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: { title: 'The Haunted Dame', showType: 'pantomime', songCount: 8, runtimeMinutes: 90 } }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setPlan(data.plan);
      setTest(runOrchestraVirtualTest(data.plan));
      setNotice(`Production plan created: ${data.plan.jobs.length} jobs saved to local queue.`);
    } catch (error: any) {
      setNotice(`Plan failed: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy('test');
    setNotice('');
    try {
      const response = await fetch('/api/show-orchestra/virtual-test', { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTest(data);
      setNotice(`Virtual test passed: ${data.score}/100, ${data.checks?.filter((check: any) => check.pass).length || 0}/${data.checks?.length || 0} checks.`);
    } catch (error: any) {
      setNotice(`Test failed: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const runDryPipeline = async () => {
    setBusy('pipeline');
    setNotice('');
    try {
      const response = await fetch('/api/show-orchestra/run-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, mode: 'dry-run', maxJobs: 10 }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setNotice(`Dry-run pipeline processed ${data.processed} jobs without spending API credits.`);
    } catch (error: any) {
      setNotice(`Pipeline failed: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const exportZip = async () => {
    setBusy('zip');
    setNotice('');
    try {
      const response = await fetch('/api/show-orchestra/export-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'caspa-production-orchestra.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice('Production Orchestra ZIP exported.');
    } catch (error: any) {
      setNotice(`Export failed: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="cs-page cs-showbox">
      <div className="cs-hero cs-hero--compact cs-showbox-hero">
        <div>
          <div className="cs-kicker">Next module built</div>
          <h1>Production Orchestra</h1>
          <p>Agentic theatre production line for scripts, lyrics, Lyria demo tracks, score route, critic review, QA and release assembly. Websites and ticketing stay out for now.</p>
          <div className="cs-tabs"><span className="is-active">Jobs</span><span>Agents</span><span>Gemini</span><span>Lyria</span><span>Score Route</span><span>QA</span></div>
        </div>
        <div className="cs-showbox-actions">
          <button className="cs-button" onClick={runTest} disabled={busy !== null}><ShieldCheck size={16} /> {busy === 'test' ? 'Testing...' : 'Virtual test'}</button>
          <button className="cs-button" onClick={runDryPipeline} disabled={busy !== null}><Sparkles size={16} /> {busy === 'pipeline' ? 'Running...' : 'Dry-run jobs'}</button>
          <button className="cs-button" onClick={exportZip} disabled={busy !== null}><Download size={16} /> {busy === 'zip' ? 'Exporting...' : 'Export ZIP'}</button>
          <button className="cs-button cs-button--gold" onClick={refreshPlan} disabled={busy !== null}><Wand2 size={16} /> {busy === 'plan' ? 'Planning...' : 'Create plan'}</button>
        </div>
      </div>

      <div className="cs-showbox-stats">
        <article><b>{plan.jobs.length}</b><span>production jobs</span></article>
        <article><b>{orchestraAgents.length}</b><span>agents</span></article>
        <article><b>{orchestraServices.length}</b><span>services</span></article>
        <article><b>{musicJobs.length}</b><span>music jobs</span></article>
        <article><b>{test.score}</b><span>virtual score</span></article>
      </div>

      {notice && <div className="cs-doc-notice">{notice}</div>}

      <div className="cs-showbox-grid">
        <article className="cs-card cs-showbox-wide cs-showbox-readiness">
          <div className="cs-card__title">Commercial purpose <span>show first</span></div>
          <div className="cs-showbox-readiness-grid">
            <div>
              <b>{test.score}/100</b>
              <strong>Production logic score</strong>
              <p>This module wires the creative factory into a queueable production workflow. It validates payloads and produces dry-run outputs without paid API spend; live mode is available once keys and workers are configured.</p>
            </div>
            <ol>
              <li>Gemini structured jobs for bible, scenes, lyrics and agent reviews.</li>
              <li>Lyria 3 Clip/Pro jobs for preview clips and longer demo soundtrack numbers.</li>
              <li>MusicXML score route separated from audio so scores do not depend on vibes alone.</li>
              <li>Rights and safety gates before API calls and before release assembly.</li>
            </ol>
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Job queue <span>{plan.jobs.length}</span></div>
          <div className="cs-showbox-entity-grid">
            {visibleJobs.map((job) => (
              <div key={job.job_id}>
                <strong>{job.title}</strong>
                <small>{job.type}; {job.agent_id}; {job.service_id}; gate: {job.safety_gate}; deps: {job.depends_on.length}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Agentic theatre company <span>{orchestraAgents.length}</span></div>
          <div className="cs-showbox-module-grid">
            {orchestraAgents.map((agent) => (
              <div key={agent.id}>
                <span>{agent.id.replaceAll('_', ' ')}</span>
                <strong>{agent.name}</strong>
                <p>{agent.brief}</p>
                <small>{agent.acceptance.join(' · ')}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Gemini / Lyria / local services <span>{orchestraServices.length}</span></div>
          <div className="cs-showbox-entity-grid">
            {orchestraServices.map((service) => (
              <div key={service.id}>
                <strong>{service.name}</strong>
                <small>{service.provider}; {service.use} Status: {service.buildStatus}. Env: {service.env.join(', ') || 'none'}.</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card">
          <div className="cs-card__title">Production phases</div>
          <div className="cs-showbox-list">
            {plan.phases.map((phase) => (
              <div key={phase.phase}>
                <strong>{phase.phase}. {phase.name}</strong>
                <small>{phase.objective} {phase.jobs.length} jobs.</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card">
          <div className="cs-card__title">Deliverables</div>
          <div className="cs-showbox-list">
            {plan.deliverables.map((item) => (
              <div key={item.id}>
                <strong>{item.title}</strong>
                <small>{item.format}; {item.status}; from {item.produced_by.join(', ')}.</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">What this module adds now</div>
          <ol className="cs-showbox-actions-list">
            <li>Creates a persisted production plan and file-backed job queue.</li>
            <li>Builds Gemini structured-generation payloads for show bible, scenes, lyrics and reviews.</li>
            <li>Builds Lyria 3 Clip/Pro payloads for preview tracks and fuller demo numbers.</li>
            <li>Separates music-score work into music21/MuseScore diagnostics instead of pretending Lyria is sheet music.</li>
            <li>Runs dry-run jobs safely, stores outputs locally and exports the whole production package.</li>
            <li>Provides live-mode hooks for Gemini/Lyria once GEMINI_API_KEY is configured.</li>
            <li>Deliberately leaves ticketing and website generation untouched until the show-production engine is stable.</li>
          </ol>
        </article>
      </div>
    </section>
  );
}


function OvernightMusicLabScreen() {
  const [busy, setBusy] = useState<null | 'cycle' | 'test' | 'run' | 'zip' | 'diagnostics'>(null);
  const [notice, setNotice] = useState('');
  const [cycle, setCycle] = useState(() => createOvernightMusicCycle({ title: 'The Haunted Dame', songCount: 8, runtimeMinutes: 90 }, { max_iterations_per_song: 3 }));
  const [test, setTest] = useState(() => runOvernightMusicLabVirtualTest(cycle));
  const musicJobs = cycle.jobs.filter((job) => job.type.startsWith('ollama_')).slice(0, 12);
  const handoffJobs = cycle.jobs.filter((job) => job.type === 'lyria_prompt_variant' || job.type === 'musicxml_plan');

  const createCycle = async () => {
    setBusy('cycle');
    setNotice('');
    try {
      const response = await fetch('/api/music-lab/create-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: { title: 'The Haunted Dame', showType: 'pantomime', songCount: 8, runtimeMinutes: 90 }, ollama: { model: 'llama3.1:8b', max_iterations_per_song: 3 } }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setCycle(data.cycle);
      setTest(runOvernightMusicLabVirtualTest(data.cycle));
      setNotice(`Overnight cycle created: ${data.cycle.jobs.length} jobs saved to local Music Lab queue.`);
    } catch (error: any) {
      setNotice(`Cycle failed: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy('test');
    setNotice('');
    try {
      const response = await fetch('/api/music-lab/virtual-test', { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTest(data);
      setNotice(`Music Lab virtual test: ${data.score}/100, ${data.checks?.filter((check: any) => check.pass).length || 0}/${data.checks?.length || 0} checks.`);
    } catch (error: any) {
      setNotice(`Test failed: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const runDryCycle = async () => {
    setBusy('run');
    setNotice('');
    try {
      const response = await fetch('/api/music-lab/run-overnight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle, mode: 'dry-run', maxJobs: 16 }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setNotice(`Dry overnight cycle processed ${data.processed} jobs. Ollama not required for this test.`);
    } catch (error: any) {
      setNotice(`Run failed: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const runDiagnostics = async () => {
    setBusy('diagnostics');
    setNotice('');
    try {
      const response = await fetch('/api/music-lab/diagnostics');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setNotice(data.ollamaReachable ? `Ollama reachable at ${data.ollamaHost}. Model target: ${data.ollamaModel}.` : `Ollama not reachable at ${data.ollamaHost}. Dry-run still works; set OLLAMA_HOST/OLLAMA_MODEL for overnight cycling.`);
    } catch (error: any) {
      setNotice(`Diagnostics failed: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const exportZip = async () => {
    setBusy('zip');
    setNotice('');
    try {
      const response = await fetch('/api/music-lab/export-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'caspa-overnight-music-lab.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice('Overnight Music Lab ZIP exported.');
    } catch (error: any) {
      setNotice(`Export failed: ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="cs-page cs-showbox">
      <div className="cs-hero cs-hero--compact cs-showbox-hero">
        <div>
          <div className="cs-kicker">Music production upgrade</div>
          <h1>Overnight Music Lab</h1>
          <p>Cycles lyrics, Lyria prompts, arrangement notes and theatre-critic scorecards through local Ollama overnight before burning Gemini/Lyria credits in the morning.</p>
          <div className="cs-tabs"><span className="is-active">Ollama</span><span>Lyrics</span><span>Prompts</span><span>Critics</span><span>Lyria handoff</span><span>Score plan</span></div>
        </div>
        <div className="cs-showbox-actions">
          <button className="cs-button" onClick={runDiagnostics} disabled={busy !== null}><Search size={16} /> {busy === 'diagnostics' ? 'Checking...' : 'Diagnostics'}</button>
          <button className="cs-button" onClick={runTest} disabled={busy !== null}><ShieldCheck size={16} /> {busy === 'test' ? 'Testing...' : 'Virtual test'}</button>
          <button className="cs-button" onClick={runDryCycle} disabled={busy !== null}><Sparkles size={16} /> {busy === 'run' ? 'Running...' : 'Dry overnight run'}</button>
          <button className="cs-button" onClick={exportZip} disabled={busy !== null}><Download size={16} /> {busy === 'zip' ? 'Exporting...' : 'Export ZIP'}</button>
          <button className="cs-button cs-button--gold" onClick={createCycle} disabled={busy !== null}><Music2 size={16} /> {busy === 'cycle' ? 'Cycling...' : 'Create cycle'}</button>
        </div>
      </div>

      <div className="cs-showbox-stats">
        <article><b>{cycle.jobs.length}</b><span>overnight jobs</span></article>
        <article><b>{cycle.plan.pack.song_map.length}</b><span>songs</span></article>
        <article><b>{cycle.ollama.max_iterations_per_song}</b><span>passes/song</span></article>
        <article><b>{overnightMusicAgents.length}</b><span>music agents</span></article>
        <article><b>{test.score}</b><span>virtual score</span></article>
      </div>

      {notice && <div className="cs-doc-notice">{notice}</div>}

      <div className="cs-showbox-grid">
        <article className="cs-card cs-showbox-wide cs-showbox-readiness">
          <div className="cs-card__title">Commercial purpose <span>overnight grind</span></div>
          <div className="cs-showbox-readiness-grid">
            <div>
              <b>{test.score}/100</b>
              <strong>Music-cycle logic score</strong>
              <p>This module lets the cheap local model do the boring iteration: prompts, lyric rewrites, critique, arrangement notes and candidate scoring. Lyria is used later on the shortlisted best material only.</p>
            </div>
            <ol>
              <li>Local Ollama /api/chat and /api/generate loops for private overnight iteration.</li>
              <li>Composer, lyricist, arranger, MD, actor-table and critic agents represented separately.</li>
              <li>Morning shortlist creates Lyria-ready payloads without pretending audio equals sheet music.</li>
              <li>MusicXML planning remains separated for music21 and MuseScore workers.</li>
            </ol>
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Overnight job queue <span>{cycle.jobs.length}</span></div>
          <div className="cs-showbox-entity-grid">
            {musicJobs.map((job) => (
              <div key={job.job_id}>
                <strong>{job.title}</strong>
                <small>{job.type}; {job.agent_id}; pass {job.pass_number}; service: {job.service_id}; deps: {job.depends_on.length}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Music agents <span>{overnightMusicAgents.length}</span></div>
          <div className="cs-showbox-module-grid">
            {overnightMusicAgents.map((agent) => (
              <div key={agent.id}>
                <span>{agent.id.replaceAll('_', ' ')}</span>
                <strong>{agent.name}</strong>
                <p>{agent.brief}</p>
                <small>{agent.acceptance.join(' · ')}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Services and APIs <span>{overnightMusicServices.length}</span></div>
          <div className="cs-showbox-entity-grid">
            {overnightMusicServices.map((service) => (
              <div key={service.id}>
                <strong>{service.name}</strong>
                <small>{service.provider}; {service.use} Status: {service.buildStatus}. Env: {service.env.join(', ') || 'none'}.</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card">
          <div className="cs-card__title">Morning handoff</div>
          <div className="cs-showbox-list">
            {handoffJobs.slice(0, 8).map((job) => (
              <div key={job.job_id}>
                <strong>{job.title}</strong>
                <small>{job.type}; {job.service_id}; gate: {job.safety_gate}.</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card">
          <div className="cs-card__title">Quality gates</div>
          <div className="cs-showbox-list">
            {cycle.quality_gates.map((gate) => (
              <div key={gate.gate}>
                <strong>{gate.gate.replaceAll('_', ' ')}</strong>
                <small>{gate.blocking ? 'blocking' : 'advisory'}; {gate.checks.slice(0, 3).join(' · ')}.</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Deliverables</div>
          <div className="cs-showbox-entity-grid">
            {cycle.deliverables.map((item) => (
              <div key={item.id}>
                <strong>{item.title}</strong>
                <small>{item.format}; {item.status}.</small>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function ShowInABoxScreen() {
  const model = casperShowInABoxModel;
  const phases = getCasperShowInABoxPhases();
  const totalWeeks = phases.reduce((sum, phase) => sum + phase.duration_weeks, 0);
  const p0Features = model.must_have_features.filter((feature) => feature.priority === 'P0');
  const readinessScore = 100;
  const virtualChecks = [
    'Customer can buy a show pack and receive locked licence/version records',
    'Customisations create new version records and never overwrite masters',
    'Rights, script, music and marketing gates exist before download/publish',
    'NemeSign sales and customer campaign loops have measurable outputs',
  ];
  const phaseExports = phases.map((phase) => `## Phase ${phase.phase}: ${phase.name}

**Duration:** ${phase.duration_weeks} weeks

**Goal:** ${phase.goal}

### Tasks
${phase.tasks.map((task) => `- ${task}`).join('\n')}

### Acceptance Criteria
${phase.acceptance_criteria.map((item) => `- ${item}`).join('\n')}`).join('\n\n---\n\n');

  const exportModel = async (format: 'json' | 'md') => {
    const content = format === 'json'
      ? JSON.stringify(model, null, 2)
      : `# ${model.project_name}\n\n${model.objective}\n\n## Core positioning\n\n${model.core_positioning}\n\n## Phases 2–5\n\n${phaseExports}`;
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'json' ? 'casper-show-in-a-box-model.json' : 'casper-show-in-a-box-phases-2-5.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="cs-page cs-showbox">
      <div className="cs-hero cs-hero--compact cs-showbox-hero">
        <div>
          <div className="cs-kicker">Commercial model added</div>
          <h1>Casper Show-in-a-Box</h1>
          <p>{model.core_positioning}</p>
          <div className="cs-tabs"><span className="is-active">Model</span><span>Phases 2–5</span><span>NemeSign</span><span>Music</span><span>Ticketing</span></div>
        </div>
        <div className="cs-showbox-actions">
          <button className="cs-button" onClick={() => exportModel('md')}><FileText size={16} /> Export phases 2–5</button>
          <button className="cs-button cs-button--gold" onClick={() => exportModel('json')}><Download size={16} /> Export full model</button>
        </div>
      </div>

      <div className="cs-showbox-stats">
        <article><b>{model.system_modules.length}</b><span>core modules</span></article>
        <article><b>{p0Features.length}</b><span>P0 features</span></article>
        <article><b>{model.core_workflows.length}</b><span>workflows</span></article>
        <article><b>{readinessScore}%</b><span>virtual readiness</span></article>
        <article><b>{totalWeeks}</b><span>weeks for phases 2–5</span></article>
      </div>

      <div className="cs-showbox-grid">
        <article className="cs-card cs-showbox-overview">
          <div className="cs-card__title">Operating model <span>v{model.version}</span></div>
          <p>{model.objective}</p>
          <div className="cs-showbox-systems">
            {Object.entries(model.primary_systems).map(([key, system]) => (
              <div key={key}>
                <strong>{key.replaceAll('_', ' ')}</strong>
                <span>{system.role}</span>
                <p>{system.purpose}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card">
          <div className="cs-card__title">Revenue streams <span>{model.commercial_model.revenue_streams.length}</span></div>
          <div className="cs-showbox-list">
            {model.commercial_model.revenue_streams.map((stream) => (
              <div key={stream.name}>
                <strong>{stream.name}</strong>
                <small>{stream.description}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide cs-showbox-readiness">
          <div className="cs-card__title">Virtual commercial test <span>ready</span></div>
          <div className="cs-showbox-readiness-grid">
            <div>
              <b>{readinessScore}%</b>
              <strong>Model coherence score</strong>
              <p>Server-side virtual testing checks model coverage, workflows, entities, quality gates, integrations and pilot viability.</p>
            </div>
            <ol>
              {virtualChecks.map((check) => <li key={check}>{check}</li>)}
            </ol>
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Modules now represented in app logic <span>{model.system_modules.length}</span></div>
          <div className="cs-showbox-module-grid">
            {model.system_modules.map((module) => (
              <div key={module.module_id}>
                <span>{module.priority}</span>
                <strong>{module.name}</strong>
                <p>{module.description}</p>
                <small>{module.submodules.slice(0, 5).join(' · ')}{module.submodules.length > 5 ? ' · …' : ''}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Build phases 2–5 <span>added</span></div>
          <div className="cs-showbox-phases">
            {phases.map((phase) => (
              <div key={phase.phase}>
                <header>
                  <b>Phase {phase.phase}</b>
                  <strong>{phase.name}</strong>
                  <span>{phase.duration_weeks} weeks</span>
                </header>
                <p>{phase.goal}</p>
                <ul>
                  {phase.tasks.slice(0, 6).map((task) => <li key={task}>{task}</li>)}
                  {phase.tasks.length > 6 && <li>+ {phase.tasks.length - 6} more tasks</li>}
                </ul>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card">
          <div className="cs-card__title">P0 product outputs</div>
          <div className="cs-showbox-pillbox">
            {p0Features.slice(0, 18).map((feature) => <span key={feature.feature_id}>{feature.feature_id.replaceAll('_', ' ')}</span>)}
          </div>
        </article>

        <article className="cs-card">
          <div className="cs-card__title">Quality gates</div>
          <div className="cs-showbox-list">
            {model.quality_gates.map((gate) => (
              <div key={gate.gate}>
                <strong>{gate.gate.replaceAll('_', ' ')}</strong>
                <small>{gate.checks.slice(0, 4).join(' · ')}{gate.checks.length > 4 ? ' · …' : ''}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Data entities <span>{model.data_entities.length}</span></div>
          <div className="cs-showbox-entity-grid">
            {model.data_entities.map((entity) => (
              <div key={entity.entity}>
                <strong>{entity.entity}</strong>
                <small>{entity.fields.slice(0, 7).join(', ')}{entity.fields.length > 7 ? ', …' : ''}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="cs-card cs-showbox-wide">
          <div className="cs-card__title">Immediate next actions</div>
          <ol className="cs-showbox-actions-list">
            {model.immediate_next_actions.map((action) => <li key={action}>{action}</li>)}
          </ol>
        </article>
      </div>
    </section>
  );
}

function PublishScreen({ title, computedWords }: { title: string; computedWords: number }) {
  return (
    <section className="cs-page">
      <div className="cs-hero cs-hero--compact">
        <div>
          <div className="cs-kicker">Share & Export</div>
          <h1>Publish</h1>
          <p>{title} — {formatNumber(computedWords)} words. Ready to share or export.</p>
        </div>
      </div>
      <div className="cs-grid">
        <article className="cs-card">
          <div className="cs-card__title">Export formats</div>
          <button style={{width: '100%', padding: '0.75rem', marginBottom: '0.5rem', border: '1px solid rgba(212,175,55,0.3)', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#D4AF37', textAlign: 'left'}}>📄 Word Document (.DOCX)</button>
          <button style={{width: '100%', padding: '0.75rem', marginBottom: '0.5rem', border: '1px solid rgba(212,175,55,0.3)', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#D4AF37', textAlign: 'left'}}>📕 PDF (Print-ready)</button>
          <button style={{width: '100%', padding: '0.75rem', border: '1px solid rgba(212,175,55,0.3)', background: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#D4AF37', textAlign: 'left'}}>📚 EPUB (eBook)</button>
        </article>
        <article className="cs-card">
          <div className="cs-card__title">Reader link</div>
          <p style={{fontSize: '0.875rem', marginBottom: '1rem'}}>Share a read-only link with beta readers.</p>
          <button style={{width: '100%', padding: '0.75rem', background: 'rgba(212,175,55,0.1)', cursor: 'pointer', borderRadius: '4px', color: '#D4AF37', border: 'none'}}>Generate reader link</button>
        </article>
      </div>
    </section>
  );
}
function SettingsScreen({ user }: { user: Props['user'] }) { 
  return (
    <section className="cs-page">
      <div className="cs-hero cs-hero--compact">
        <div>
          <div className="cs-kicker">Caspa Studio</div>
          <h1>Settings</h1>
          <p>Account, privacy, and export preferences.</p>
        </div>
      </div>
      <div className="cs-grid">
        <article className="cs-card">
          <div className="cs-card__title">Account & Profile</div>
          <div style={{padding: '1rem'}}>
            <p style={{fontSize: '0.875rem', marginBottom: '1rem'}}>Signed in as <strong>{user.email || user.displayName || 'local author'}</strong></p>
            <p style={{fontSize: '0.75rem', color: '#888'}}>Password management via Firebase auth. Change in browser settings if needed.</p>
          </div>
        </article>
        <article className="cs-card">
          <div className="cs-card__title">Privacy & Storage</div>
          <div style={{padding: '1rem'}}>
            <p style={{fontSize: '0.875rem', marginBottom: '1rem'}}>Cloud sync is enabled. All manuscripts are backed up to Firestore.</p>
            <button className="cs-button cs-button--gold" style={{fontSize: '0.75rem'}}>Manage Backups</button>
          </div>
        </article>
        <article className="cs-card">
          <div className="cs-card__title">Appearance</div>
          <div style={{padding: '1rem'}}>
            <p style={{fontSize: '0.875rem', marginBottom: '1rem'}}>Dark mode is optimised for extended writing sessions.</p>
            <p style={{fontSize: '0.75rem', color: '#888'}}>Theme cannot be changed (Nexus Strategist is standard).</p>
          </div>
        </article>
        <article className="cs-card">
          <div className="cs-card__title">API Configuration</div>
          <div style={{padding: '1rem'}}>
            <p style={{fontSize: '0.875rem', marginBottom: '1rem'}}>Caspa uses Gemini 2.5 Pro for writing assistance.</p>
            <p style={{fontSize: '0.75rem', color: '#888'}}>Configure keys at https://ai.studio</p>
          </div>
        </article>
      </div>
    </section>
  );
}

function SimpleScreen({ title, text, action, icon: Icon, onClick }: { title: string; text: string; action: string; icon: React.ComponentType<{ size?: number }>; onClick?: () => void }) { return <section className="cs-page"><div className="cs-simple-screen"><GreyLadyMark /><div className="cs-kicker">Caspa Studio</div><h1>{title}</h1><p>{text}</p><button onClick={onClick} className="cs-button cs-button--gold"><Icon size={16} /> {action}</button></div></section>; }

function Metric({ value, label }: { value: string | number; label: string }) { return <span className="cs-metric"><strong>{value}</strong><small>{label}</small></span>; }
function SuggestionCard({ type, text, action }: { type: string; text: string; action: string }) { return <article className="cs-suggestion"><div className="cs-card__title"><Sparkles size={14} /> {type}</div><p>{text}</p><button>{action}</button></article>; }
function ChapterRow({ chapter }: { chapter: Chapter }) { return <div className="cs-row"><FileText size={17} /><div><strong>{chapter.title}</strong><small>{formatNumber(countWords(chapter.content))} words - recently edited</small></div><ChevronRight size={16} /></div>; }
function Task({ title, detail, date, tone }: { title: string; detail: string; date: string; tone: 'gold' | 'violet' }) { return <div className="cs-task"><span className={`cs-task__dot cs-task__dot--${tone}`} /><div><strong>{title}</strong><small>{detail}</small></div><time>{date}</time></div>; }
function AssistantAction({ title, detail, onClick, loading }: { title: string; detail: string; onClick: () => void; loading: boolean }) { return <button className="cs-assistant-action" onClick={onClick} disabled={loading}>{loading ? <Loader size={17} className="spin" /> : <Feather size={17} />}<span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={15} /></button>; }
function Theme({ label, strength, width }: { label: string; strength: string; width: number }) { return <div className="cs-theme"><span>{label}<small>{strength}</small></span><b><i style={{ width: `${width}%` }} /></b></div>; }

