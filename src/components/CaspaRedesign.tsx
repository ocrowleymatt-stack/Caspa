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

const fallbackChapters = [] as Chapter[];

const fallbackCharacters = [] as Character[];

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
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResult, setAssistantResult] = useState<string | null>(null);

  const chapters = props.chapters && props.chapters.length > 0
    ? [...props.chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];
  const characters = props.characters && props.characters.length > 0
    ? props.characters
    : [];
  const selectedChapter = chapters.length > 0
    ? (chapters.find((c) => c.title?.toLowerCase().includes('levee')) || chapters[chapters.length - 1])
    : null;
  const computedWords = props.totalWords || (chapters.length > 0 ? chapters.reduce((acc, chapter) => acc + countWords(chapter.content), 0) : 0);
  const progress = Math.min(99, Math.max(1, Math.round((computedWords / 120000) * 100)));
  const projectTitle = props.project?.title && props.project.title !== 'Untitled Narrative' ? props.project.title : 'Untitled Manuscript';
  const genre = props.project?.genre || 'Literary Fiction';

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
      } else {
        setAssistantResult(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setAssistantResult(`Failed to reach assistant: ${err.message}`);
    } finally {
      setAssistantLoading(false);
    }
  };

  const content = useMemo(() => {
    switch (props.currentView) {
      case 'write':
      case 'writing':
        return chapters.length === 0 ? (
          <SimpleScreen
            title="Writing Room"
            text="Create your first chapter to begin writing."
            action="New Chapter"
            icon={PenLine}
            onClick={() => { /* create chapter logic */ }}
          />
        ) : (
          <WritingRoom title={projectTitle} genre={genre} chapter={selectedChapter!} chapters={chapters} characters={characters} progress={progress} computedWords={computedWords} onAssist={callAssistant} isLoading={assistantLoading} result={assistantResult} />
        );
      case 'memory':
      case 'intelligence':
        return <RedPen title={projectTitle} chapters={chapters} characters={characters} computedWords={computedWords} onAnalyze={() => callAssistant('analyze-manuscript')} isLoading={assistantLoading} result={assistantResult} />;
      case 'library':
        return <LibraryScreen createNewProject={props.createNewProject} />;
      case 'upload':
        return <ResearchScreen />;
      case 'publish':
        return <PublishScreen title={projectTitle} computedWords={computedWords} />;
      case 'settings':
        return <SettingsScreen user={props.user} />;
      default:
        return <ProjectDesk title={projectTitle} genre={genre} chapters={chapters} characters={characters} progress={progress} computedWords={computedWords} setCurrentView={props.setCurrentView} onAssist={() => callAssistant('outline-next-chapter')} />;
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
          {chapters.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#999' }}>
              <p style={{ marginBottom: '1rem' }}>No chapters yet. Start writing to build your story.</p>
              <button className="cs-button cs-button--gold" onClick={() => setCurrentView('write')} style={{ fontSize: '0.875rem' }}>New Chapter</button>
            </div>
          ) : (
            <div className="cs-list">
              {chapters.slice(-5).reverse().map((chapter, index) => <ChapterRow key={chapter.id || index} chapter={chapter} />)}
            </div>
          )}
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
          <div className="cs-toolbar"><select><option>Body Text</option></select><button>B</button><button><i>I</i></button><button><u>U</u></button><button>menu</button><button>quotes</button><button>—</button></div>
          <div className="cs-editor__page">
            <span className="cs-kicker">Chapter {chapter.order || 17}</span>
            <h2>{chapter?.title || 'Untitled Chapter'}</h2>
            {chapter?.content ? (
              chapter.content.split('\n').filter(Boolean).map((para, index) => <p key={index}>{para}</p>)
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No content yet. Start writing below or use AI assistance.</p>
            )}
          </div>
          <div className="cs-editor__footer"><Metric value={formatNumber(countWords(chapter.content || fallbackChapters[4]?.content || ''))} label="Words" /><Metric value="52m" label="Read time" /><Metric value="4" label="POV" /></div>
        </article>
        <aside className="cs-assistant">
          {result ? (
            <div className="cs-card cs-card--result">
              <div className="cs-card__title">Assistant Response</div>
              <p>{result}</p>
            </div>
          ) : (
            <div className="cs-card"><div className="cs-card__title">Caspa Assistant</div><AssistantAction title="Draft next scene" detail="Continue the story from here." onClick={() => onAssist('draft-scene')} loading={isLoading} /><AssistantAction title="Tighten this chapter" detail="Improve pacing and clarity." onClick={() => onAssist('tighten-prose')} loading={isLoading} /><AssistantAction title="Find continuity risks" detail="Spot contradictions before they spread." onClick={() => onAssist('find-continuity')} loading={isLoading} /></div>
          )}
          <div className="cs-card"><div className="cs-card__title">Continuity notes <span>3</span></div><ul className="cs-bullet-list"><li>The levee is failing slowly - foreshadowing.</li><li>The ring appears in ch. 5 and ch. 17; keep chain of custody clear.</li><li>Weather shift between chapters needs a bridge sentence.</li></ul></div>
          <div className="cs-card"><div className="cs-card__title">Character reminders <button>Manage</button></div>{characters.slice(0, 4).map((character) => <div key={character.id} className="cs-character-reminder"><strong>{character.name}</strong><small>{character.role || 'Character'}</small></div>)}</div>
        </aside>
      </div>
    </section>
  );
}

function RedPen({ title, chapters, characters, computedWords, onAnalyze, isLoading, result }: { title: string; chapters: Chapter[]; characters: Character[]; computedWords: number; onAnalyze: () => void; isLoading: boolean; result: string | null; }) {
  const issues = [
    ['Major', 'Character location does not match timeline', 'Character location jumps without travel time.'],
    ['Major', 'Injury changes between chapters', 'Physical continuity needs resolving.'],
    ['Minor', 'Document date conflict in Chapter 17', 'Prop date contradicts timeline.'],
    ['Suggestion', 'Foreshadowing opportunity', 'Seed the flood image earlier.'],
  ];
  return (
    <section className="cs-page cs-redpen">
      <div className="cs-hero cs-hero--compact"><div><div className="cs-kicker">Story Bible / Red Pen</div><h1>{title}</h1><p>Plan. Refine. Repair. Elevate your story.</p></div><button className="cs-button cs-button--gold" onClick={onAnalyze} disabled={isLoading}>{isLoading ? <Loader size={16} className="spin" /> : <Wand2 size={16} />} Run full analysis</button></div>
      <div className="cs-grid cs-grid--redpen">
        <article className="cs-card cs-character-board"><div className="cs-card__title">Character board <span>{characters.length}</span></div>{characters.slice(0, 7).map((c, i) => <div key={c.id} className="cs-character-row"><span>{i + 1}</span><div><strong>{c.name}</strong><small>{c.role || 'Character'}</small></div><button>Open</button></div>)}</article>
        <article className="cs-card cs-timeline"><div className="cs-card__title">Plot timeline <button>View timeline</button></div><div className="cs-timeline__line">{['The Call','The First Lie','The Fracture','The Levee','The Chamber'].map((beat, index) => <div key={beat} className={index === 3 ? 'is-active' : ''}><span>{index + 1}</span><small>{beat}</small></div>)}</div></article>
        <article className="cs-card"><div className="cs-card__title">Themes</div><Theme label="Truth vs Power" strength="Strong" width={88} /><Theme label="Faith and Doubt" strength="Medium" width={63} /><Theme label="Family as Weapon" strength="Rising" width={71} /></article>
        <article className="cs-card"><div className="cs-card__title">Continuity alerts <span>12</span></div>{issues.map(([level, issueTitle, detail], i) => <div key={i} className="cs-issue-row"><span className={`cs-pill cs-pill--${String(level).toLowerCase()}`}>{level}</span><div><strong>{issueTitle}</strong><small>{detail}</small></div><button>Fix</button></div>)}</article>
        <article className="cs-card cs-scene-map"><div className="cs-card__title">Scene relationships</div><div className="cs-map-node cs-map-node--center">Ch. 14<br />The Betrayal</div><div className="cs-map-node cs-map-node--a">Ch. 13<br />The Hollow Audience</div><div className="cs-map-node cs-map-node--b">Ch. 17<br />The Levee</div><div className="cs-map-node cs-map-node--c">Character: Maris</div></article>
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

function LibraryScreen({ createNewProject }: { createNewProject: (title?: string) => void }) { return <SimpleScreen title="Library" text="Your manuscripts, shelves, public read links and local drafts." action="New project" icon={Boxes} onClick={() => createNewProject('Untitled Narrative')} />; }
function ResearchScreen() { return <SimpleScreen title="Research Desk" text="A cleaner home for uploaded sources, notes, worldbuilding material and evidence-like references." action="Add source" icon={CalendarDays} />; }
function PublishScreen({ title, computedWords }: { title: string; computedWords: number }) { return <SimpleScreen title="Publish" text={`${title} is at ${formatNumber(computedWords)} words. Export EPUB/PDF, create private links, and prep release metadata.`} action="Generate export" icon={ShieldCheck} />; }
function SettingsScreen({ user }: { user: Props['user'] }) { return <SimpleScreen title="Settings" text={`Signed in as ${user.email || user.displayName || 'local author'}. Account, privacy, storage and model defaults live here.`} action="Manage account" icon={Ghost} />; }

function SimpleScreen({ title, text, action, icon: Icon, onClick }: { title: string; text: string; action: string; icon: React.ComponentType<{ size?: number }>; onClick?: () => void }) { return <section className="cs-page"><article className="cs-card cs-simple"><div className="cs-simple__icon"><Icon size={32} /></div><h1>{title}</h1><p>{text}</p><button className="cs-button cs-button--gold" onClick={onClick}>{action}</button></article></section>; }

function Metric({ value, label }: { value: string | number; label: string }) { return <span className="cs-metric"><strong>{value}</strong><small>{label}</small></span>; }
function SuggestionCard({ type, text, action }: { type: string; text: string; action: string }) { return <article className="cs-suggestion"><div className="cs-card__title"><Sparkles size={14} /> {type}</div><p>{text}</p><button>{action}</button></article>; }
function ChapterRow({ chapter }: { chapter: Chapter }) { return <div className="cs-row"><FileText size={17} /><div><strong>{chapter.title}</strong><small>{formatNumber(countWords(chapter.content))} words</small></div><Clock3 size={15} /></div>; }
function Task({ title, detail, date, tone }: { title: string; detail: string; date: string; tone: 'gold' | 'violet' }) { return <div className="cs-task"><span className={`cs-task__dot cs-task__dot--${tone}`} /><div><strong>{title}</strong><small>{detail}</small></div><time>{date}</time></div>; }
function AssistantAction({ title, detail, onClick, loading }: { title: string; detail: string; onClick: () => void; loading: boolean }) { return <button className="cs-assistant-action" onClick={onClick} disabled={loading}>{loading ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}<span><strong>{title}</strong><small>{detail}</small></span></button>; }
function Theme({ label, strength, width }: { label: string; strength: string; width: number }) { return <div className="cs-theme"><span>{label}<small>{strength}</small></span><b><i style={{ width: `${width}%` }} /></b></div>; }
