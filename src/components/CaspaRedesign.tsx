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
} from 'lucide-react';
import type { Chapter, Character, Project, ViewType } from '../types';
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
  arc: '',
  traits: [],
  voiceNotes: '',
} as Character));

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Project Desk', detail: 'Overview and next action', icon: Home },
  { id: 'write', label: 'Writing Room', detail: 'Draft and edit scenes', icon: PenLine },
  { id: 'memory', label: 'Story Bible', detail: 'Characters and canon', icon: BookOpen },
  { id: 'intelligence', label: 'Red Pen', detail: 'Issues and repairs', icon: CircleAlert },
  { id: 'library', label: 'Library', detail: 'Projects and shelves', icon: Library },
  { id: 'upload', label: 'Research Desk', detail: 'Sources and notes', icon: Search },
  { id: 'publish', label: 'Publish', detail: 'Export and readers', icon: Download },
  { id: 'settings', label: 'Settings', detail: 'Account and privacy', icon: Settings },
];

const countWords = (text = '') => text.trim().split(/\s+/).filter(Boolean).length;
const formatNumber = (n: number) => new Intl.NumberFormat('en-GB').format(n);

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
  const chapters = props.chapters.length ? [...props.chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : fallbackChapters;
  const characters = props.characters.length ? props.characters : fallbackCharacters;
  const selectedChapter = chapters.find((c) => c.title?.toLowerCase().includes('levee')) || chapters[chapters.length - 1];
  const computedWords = props.totalWords || chapters.reduce((acc, chapter) => acc + countWords(chapter.content), 0) || 86742;
  const progress = Math.min(99, Math.max(1, Math.round((computedWords / 120000) * 100)));
  const projectTitle = props.project?.title && props.project.title !== 'Untitled Narrative' ? props.project.title : 'The House of God';
  const genre = props.project?.genre || 'Epic Literary Fiction';

  const content = useMemo(() => {
    switch (props.currentView) {
      case 'write':
      case 'writing':
        return <WritingRoom title={projectTitle} genre={genre} chapter={selectedChapter} chapters={chapters} characters={characters} progress={progress} computedWords={computedWords} />;
      case 'memory':
      case 'intelligence':
        return <RedPen title={projectTitle} chapters={chapters} characters={characters} computedWords={computedWords} />;
      case 'library':
        return <LibraryScreen createNewProject={props.createNewProject} />;
      case 'upload':
        return <ResearchScreen />;
      case 'publish':
        return <PublishScreen title={projectTitle} computedWords={computedWords} />;
      case 'settings':
        return <SettingsScreen user={props.user} />;
      default:
        return <ProjectDesk title={projectTitle} genre={genre} chapters={chapters} characters={characters} progress={progress} computedWords={computedWords} setCurrentView={props.setCurrentView} />;
    }
  }, [props.currentView, projectTitle, genre, selectedChapter, chapters, characters, progress, computedWords]);

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
            <input placeholder="Search manuscript, characters, notes…" />
          </label>
          <div className="cs-topbar__actions">
            <button className="cs-button cs-button--ghost" onClick={props.saveToCloud}><CheckCircle2 size={16} /> Save</button>
            <button className="cs-button cs-button--gold"><Sparkles size={16} /> Caspa Assist</button>
          </div>
        </header>

        {content}
      </main>
    </div>
  );
}

function ProjectDesk({ title, genre, chapters, characters, progress, computedWords, setCurrentView }: {
  title: string; genre: string; chapters: Chapter[]; characters: Character[]; progress: number; computedWords: number; setCurrentView: (view: ViewType) => void;
}) {
  return (
    <section className="cs-page cs-project-desk">
      <div className="cs-hero">
        <div>
          <div className="cs-kicker">Project Desk</div>
          <h1>{title}</h1>
          <p>{genre} · Draft 6 · Private workspace</p>
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
              <p>You’re maintaining a strong pace. Next meaningful win: complete the current part and run a continuity pass.</p>
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
              <small>Part II · Chapter {chapters.length ? chapters[Math.min(4, chapters.length - 1)].order || 17 : 17}</small>
              <h3>{chapters[Math.min(4, chapters.length - 1)]?.title || 'The Levee'}</h3>
              <p>Last edited recently · {formatNumber(countWords(chapters[Math.min(4, chapters.length - 1)]?.content || ''))} words</p>
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
          <Task title="Character Arc: Eli" detail="Review transformation" date="Jun 2" tone="violet" />
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
          <button><Target />Goal<small>Set a target</small></button>
        </article>
      </div>
    </section>
  );
}

function WritingRoom({ title, genre, chapter, chapters, characters, progress, computedWords }: {
  title: string; genre: string; chapter: Chapter; chapters: Chapter[]; characters: Character[]; progress: number; computedWords: number;
}) {
  return (
    <section className="cs-writing-room">
      <div className="cs-writing-header">
        <div><div className="cs-kicker">Writing Room</div><h1>{title}</h1><p>{genre} · Autosaved a few seconds ago</p></div>
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
          <div className="cs-toolbar"><select><option>Body Text</option></select><button>B</button><button><i>I</i></button><button><u>U</u></button><button>☰</button><button>“”</button><button>↶</button><button>↷</button></div>
          <div className="cs-editor__page">
            <span className="cs-kicker">Chapter {chapter.order || 17}</span>
            <h2>{chapter.title || 'The Levee'}</h2>
            {(chapter.content || fallbackChapters[4].content).split('\n').filter(Boolean).map((para, index) => <p key={index}>{para}</p>)}
          </div>
          <div className="cs-editor__footer"><Metric value={formatNumber(countWords(chapter.content || fallbackChapters[4].content))} label="Words" /><Metric value="52m" label="Read time" /><Metric value="1 of 5" label="Scene" /><Metric value="47m" label="Focus" /></div>
        </article>
        <aside className="cs-assistant">
          <div className="cs-card"><div className="cs-card__title">Caspa Assistant</div><AssistantAction title="Draft next scene" detail="Continue the story from here." /><AssistantAction title="Improve this scene" detail="Enhance clarity, tension and flow." /><AssistantAction title="Repair this chapter" detail="Strengthen structure and pacing." /><AssistantAction title="Summarise this chapter" detail="Get a concise chapter summary." /></div>
          <div className="cs-card"><div className="cs-card__title">Continuity notes <span>3</span></div><ul className="cs-bullet-list"><li>The levee is failing slowly — foreshadowing.</li><li>The old amulet is iron and pre-House.</li><li>The House appears to know the flood is coming.</li></ul></div>
          <div className="cs-card"><div className="cs-card__title">Character reminders <button>Manage</button></div>{characters.slice(0, 4).map((character) => <div key={character.id} className="cs-person-row"><span>{character.name.slice(0, 1)}</span><strong>{character.name}</strong><small>{character.role || 'Character'}</small></div>)}</div>
        </aside>
      </div>
    </section>
  );
}

function RedPen({ title, chapters, characters, computedWords }: { title: string; chapters: Chapter[]; characters: Character[]; computedWords: number }) {
  const issues = [
    ['Major', 'Elena’s location does not match timeline.', 'Character location jumps without travel time.'],
    ['Major', 'Daniel’s injury changes between chapters.', 'Physical continuity needs resolving.'],
    ['Minor', 'Document date conflict in Chapter 17.', 'Prop date contradicts timeline.'],
    ['Suggestion', 'Foreshadowing opportunity.', 'Seed the flood image earlier.'],
  ];
  return (
    <section className="cs-page cs-redpen">
      <div className="cs-hero cs-hero--compact"><div><div className="cs-kicker">Story Bible / Red Pen</div><h1>{title}</h1><p>Plan. Refine. Repair. Elevate your story.</p></div><button className="cs-button cs-button--gold"><Wand2 size={16} /> Run full analysis</button></div>
      <div className="cs-grid cs-grid--redpen">
        <article className="cs-card cs-character-board"><div className="cs-card__title">Character board <span>{characters.length}</span></div>{characters.slice(0, 7).map((c, i) => <div key={c.id} className="cs-character-card"><div className="cs-character-card__portrait">{c.name.slice(0, 1)}</div><strong>{c.name}</strong><small>{c.role || (i === 0 ? 'Protagonist' : 'Supporting')}</small><span className="cs-mini-bar"><i style={{ width: `${55 + i * 6}%` }} /></span></div>)}</article>
        <article className="cs-card cs-timeline"><div className="cs-card__title">Plot timeline <button>View timeline</button></div><div className="cs-timeline__line">{['The Call','The First Lie','The Deepening','The Betrayal','The Revelation','The Reckoning'].map((label, i) => <span key={label} style={{ left: `${6 + i * 17}%` }}><b>Ch. {i * 5 + 1}</b><small>{label}</small></span>)}</div></article>
        <article className="cs-card"><div className="cs-card__title">Themes</div><Theme label="Truth vs Power" strength="Strong" width={88} /><Theme label="Faith & Doubt" strength="Medium" width={62} /><Theme label="Redemption" strength="Medium" width={58} /><Theme label="Sacrifice" strength="Low" width={34} /></article>
        <article className="cs-card"><div className="cs-card__title">Continuity alerts <span>12</span></div>{issues.map(([level, title, detail], i) => <div key={i} className="cs-issue-row"><span className={`cs-dot cs-dot--${level.toLowerCase()}`} /><div><strong>{title}</strong><small>{detail}</small></div><em>{level}</em></div>)}</article>
        <article className="cs-card cs-scene-map"><div className="cs-card__title">Scene relationships</div><div className="cs-map-node cs-map-node--center">Ch. 14<br />The Betrayal</div><div className="cs-map-node n1">Ch. 12<br />Warning</div><div className="cs-map-node n2">Ch. 13<br />Confession</div><div className="cs-map-node n3">Ch. 15<br />Escape</div><div className="cs-map-node n4">Ch. 17<br />Letter</div></article>
        <aside className="cs-aside-panel cs-redpen-inspector"><SuggestionCard type="Issue detail" text="Elena appears in two locations without travel time. Add a transition scene or adjust the chapter opening." action="Apply suggestion" /><SuggestionCard type="AI recommendation" text="Best fix: add a short travel beat and use it to reveal character tension." action="Add travel scene" /><SuggestionCard type="Manuscript profile" text={`${formatNumber(computedWords)} words · ${chapters.length} chapters · repair pass recommended.`} action="Generate report" /></aside>
      </div>
    </section>
  );
}

function LibraryScreen({ createNewProject }: { createNewProject: (title?: string) => void }) { return <SimpleScreen title="Library" text="Your manuscripts, shelves, public read links and local drafts live here." action="New manuscript" onClick={() => createNewProject('Untitled Manuscript')} icon={Library} />; }
function ResearchScreen() { return <SimpleScreen title="Research Desk" text="A cleaner home for uploaded sources, notes, worldbuilding material and evidence-like references." action="Add source" icon={Search} />; }
function PublishScreen({ title, computedWords }: { title: string; computedWords: number }) { return <SimpleScreen title="Publish" text={`${title} is at ${formatNumber(computedWords)} words. Export routes belong here: DOCX, PDF, EPUB, reader link and manuscript report.`} action="Prepare export" icon={Download} />; }
function SettingsScreen({ user }: { user: Props['user'] }) { return <SimpleScreen title="Settings" text={`Signed in as ${user.email || user.displayName || 'local author'}. Account, privacy, storage and provider settings stay here.`} action="Review settings" icon={Settings} />; }

function SimpleScreen({ title, text, action, icon: Icon, onClick }: { title: string; text: string; action: string; icon: React.ComponentType<{ size?: number }>; onClick?: () => void }) { return <section className="cs-page"><div className="cs-simple-screen"><GreyLadyMark /><div className="cs-kicker">Caspa Studio</div><h1>{title}</h1><p>{text}</p><button onClick={onClick} className="cs-button cs-button--gold"><Icon size={16} /> {action}</button></div></section>; }

function Metric({ value, label }: { value: string | number; label: string }) { return <span className="cs-metric"><strong>{value}</strong><small>{label}</small></span>; }
function SuggestionCard({ type, text, action }: { type: string; text: string; action: string }) { return <article className="cs-suggestion"><div className="cs-card__title"><Sparkles size={14} /> {type}</div><p>{text}</p><button>{action}</button></article>; }
function ChapterRow({ chapter }: { chapter: Chapter }) { return <div className="cs-row"><FileText size={17} /><div><strong>{chapter.title}</strong><small>{formatNumber(countWords(chapter.content))} words · recently edited</small></div><ChevronRight size={16} /></div>; }
function Task({ title, detail, date, tone }: { title: string; detail: string; date: string; tone: 'gold' | 'violet' }) { return <div className="cs-task"><span className={`cs-task__dot cs-task__dot--${tone}`} /><div><strong>{title}</strong><small>{detail}</small></div><time>{date}</time></div>; }
function AssistantAction({ title, detail }: { title: string; detail: string }) { return <button className="cs-assistant-action"><Feather size={17} /><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={15} /></button>; }
function Theme({ label, strength, width }: { label: string; strength: string; width: number }) { return <div className="cs-theme"><span>{label}<small>{strength}</small></span><b><i style={{ width: `${width}%` }} /></b></div>; }
