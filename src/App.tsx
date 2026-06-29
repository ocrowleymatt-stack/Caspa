/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Caspa Creative Engine - intent-first studio UI
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CircleAlert,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Globe,
  Home,
  Library,
  Loader,
  Lock,
  LogOut,
  Mail,
  Menu,
  Music2,
  PenLine,
  Search,
  Settings,
  Sparkles,
  UploadCloud,
  Wand2,
  Hammer,
  X,
} from 'lucide-react';

import CommissionStudio from './components/CommissionStudio';
import ResearchLibrary from './components/ResearchLibrary';

declare const process: any;

type User = {
  uid: string;
  email: string;
  displayName?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

type CreativeMode = 'novel' | 'script' | 'musical' | 'adaptation' | 'gold' | 'chaos';

type ViewType =
  | 'launchpad'
  | 'project'
  | 'write'
  | 'bible'
  | 'redpen'
  | 'workshop'
  | 'gold'
  | 'openwebui'
  | 'library'
  | 'research'
  | 'publish'
  | 'settings';

type ProjectBrief = {
  title: string;
  mode: CreativeMode;
  idea: string;
  tone: string;
  output: string;
  audience: string;
  createdAt: string;
};

type NavItem = {
  id: ViewType;
  label: string;
  detail: string;
  group: 'make' | 'work' | 'improve' | 'produce';
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
};

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

const defaultBrief: ProjectBrief = {
  title: 'Untitled glorious nonsense',
  mode: 'novel',
  idea: 'A strange, ambitious story that needs a proper engine behind it.',
  tone: 'Literate, vivid, funny when it should be, ruthless when it must be.',
  output: 'Project bible, outline, first draft, polish plan.',
  audience: 'General readers / theatre audience / producers, depending on format.',
  createdAt: new Date().toISOString(),
};

const modeLabels: Record<CreativeMode, string> = {
  novel: 'Novel',
  script: 'Script',
  musical: 'Musical / Show',
  adaptation: 'Adaptation',
  gold: 'Gold Refinery',
  chaos: 'Surprise Me',
};

const navItems: NavItem[] = [
  { id: 'launchpad', label: 'New Work', detail: 'Choose what to make', group: 'make', icon: Sparkles },
  { id: 'project', label: 'Current Project', detail: 'Brief, plan, next moves', group: 'work', icon: Home },
  { id: 'write', label: 'White Page', detail: 'Draft in a calm canvas', group: 'work', icon: PenLine },
  { id: 'bible', label: 'Story Bible', detail: 'Characters, rules, canon', group: 'work', icon: BookOpen },
  { id: 'workshop', label: 'Workshop', detail: 'Paste, diagnose, write it', group: 'improve', icon: Hammer },
  { id: 'redpen', label: 'Red Pen', detail: 'Quick issue scan', group: 'improve', icon: CircleAlert },
  { id: 'gold', label: 'Gold Refinery', detail: 'Polish existing text', group: 'improve', icon: Wand2 },
  { id: 'openwebui', label: 'Open WebUI Driver', detail: 'Clean white control page', group: 'improve', icon: UploadCloud },
  { id: 'library', label: 'Library', detail: 'Projects and shelves', group: 'produce', icon: Library },
  { id: 'research', label: 'Research Desk', detail: 'Sources and notes', group: 'produce', icon: Search },
  { id: 'publish', label: 'Publish Pack', detail: 'Export, pitch, rehearse', group: 'produce', icon: Download },
  { id: 'settings', label: 'Settings', detail: 'Account and privacy', group: 'produce', icon: Settings },
];

const modeCards: Array<{
  mode: CreativeMode;
  title: string;
  subtitle: string;
  examples: string[];
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}> = [
  {
    mode: 'novel',
    title: 'Write a Novel',
    subtitle: 'Chapters, plot, voice, character arcs, continuity.',
    examples: ['Gothic literary thriller', 'Comic revenge novel', 'Queer horror with teeth'],
    icon: BookOpen,
  },
  {
    mode: 'script',
    title: 'Make a Script',
    subtitle: 'Stage, screen, radio, sitcom, monologue or sketch.',
    examples: ['Dick Turpin in Milton Keynes', 'Courtroom farce', 'BBC pilot treatment'],
    icon: Clapperboard,
  },
  {
    mode: 'musical',
    title: 'Build a Musical / Show',
    subtitle: 'Book, songs, running order, score brief and production pack.',
    examples: ['Panto with bite', 'Cult musical', 'Community theatre banger'],
    icon: Music2,
  },
  {
    mode: 'adaptation',
    title: 'Adapt Something',
    subtitle: 'Turn notes, evidence, transcripts or chaos into story.',
    examples: ['Transcript to drama', 'Memoir to play', 'Evidence to thriller'],
    icon: FileText,
  },
  {
    mode: 'gold',
    title: 'Polish Existing Work',
    subtitle: 'Structure, subtext, line edit and ruthless final cut.',
    examples: ['Tighten chapter', 'Fix pacing', 'Make it prize-ready'],
    icon: Wand2,
  },
  {
    mode: 'chaos',
    title: 'Surprise Me',
    subtitle: 'For when the idea is unhinged but probably brilliant.',
    examples: ['Travelodge ghost opera', 'Concrete cow heist', 'Victorian demon sitcom'],
    icon: Sparkles,
  },
];

const groupLabels: Record<NavItem['group'], string> = {
  make: 'Make',
  work: 'Work',
  improve: 'Improve',
  produce: 'Produce',
};

const formatDate = (iso: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

const surface: React.CSSProperties = {
  background: '#ffffff',
  color: '#182033',
  border: '1px solid #e8e1d4',
  boxShadow: '0 20px 70px rgba(20, 16, 10, 0.08)',
};

function saveBrief(brief: ProjectBrief) {
  localStorage.setItem('caspa.currentBrief', JSON.stringify(brief));
}

function loadBrief(): ProjectBrief {
  try {
    const raw = localStorage.getItem('caspa.currentBrief');
    return raw ? { ...defaultBrief, ...JSON.parse(raw) } : defaultBrief;
  } catch {
    return defaultBrief;
  }
}

function makeTitle(idea: string, mode: CreativeMode) {
  const cleaned = idea.trim().replace(/\s+/g, ' ');
  if (!cleaned) return `New ${modeLabels[mode]}`;
  return cleaned.length > 58 ? `${cleaned.slice(0, 55)}...` : cleaned;
}

function buildOpenWebUIPrompt(brief: ProjectBrief, canvas: string) {
  return `You are Caspa, a private creative production room for Matthew O'Crowley.

PROJECT
Title: ${brief.title}
Mode: ${modeLabels[brief.mode]}
Idea: ${brief.idea}
Tone: ${brief.tone}
Audience: ${brief.audience}
Required output: ${brief.output}

OPERATING METHOD
- Treat the project as a living creative file.
- Keep answers practical, direct and production-minded.
- Start from the user's latest page/canvas rather than generic advice.
- When drafting, provide usable material immediately.
- When planning, produce clear beats, scenes, chapters, songs, or production tasks.
- Preserve voice, weirdness and ambition. Do not sand the magic off.
- Challenge weak structure, but do not flatten the premise.

CURRENT WHITE PAGE / CANVAS
${canvas || '[Blank page — start by proposing the strongest opening move.]'}

TASK
Drive the project forward. Give the next best creative output now.

When the author says "commission this" or "write it", produce a clean manuscript-ready block they can send to Kesper Workshop.`;
}

function CaspaLogin({ onLoginSuccess }: { onLoginSuccess?: (user: User) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    initializeFirebase();
  }, []);

  const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyBdMzl_c0rFT9C_3LKq1hbDDKfRvPAhP0I',
    authDomain: 'novelwrite-27763.firebaseapp.com',
    projectId: 'novelwrite-27763',
    storageBucket: 'novelwrite-27763.appspot.com',
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '506738699621',
    appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:506738699621:web:9e8f9f8b8c8d8e8f8g8h',
  };

  const initializeFirebase = async () => {
    try {
      const { initializeApp } = await import('firebase/app');
      const { getAuth, onAuthStateChanged } = await import('firebase/auth');

      try {
        initializeApp(firebaseConfig);
      } catch {
        // Already initialised.
      }

      const auth = getAuth();
      onAuthStateChanged(auth, (user) => {
        if (user) {
          onLoginSuccess?.({ uid: user.uid, email: user.email || '', displayName: user.displayName || '' });
        }
      });
      setFirebaseReady(true);
    } catch (err) {
      console.error('Firebase init error:', err);
      setFirebaseReady(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      const result = await signInWithPopup(getAuth(), provider);
      onLoginSuccess?.({ uid: result.user.uid, email: result.user.email || '', displayName: result.user.displayName || '' });
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.code === 'auth/popup-blocked' ? 'Pop-up blocked. Allow pop-ups for this site.' : 'Google sign-in failed. Try email/password instead.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError('');
      if (!email || !password) {
        setError('Email and password required.');
        return;
      }
      const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      const auth = getAuth();
      const result = isSignUp
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess?.({ uid: result.user.uid, email: result.user.email || '', displayName: result.user.displayName || '' });
    } catch (err: any) {
      console.error('Email auth error:', err);
      setError(isSignUp ? 'Could not create account.' : 'Could not sign in. Check the details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'linear-gradient(135deg, #120f0a 0%, #312411 55%, #f4efe5 55%, #fffaf2 100%)' }}>
      <div style={{ width: '100%', maxWidth: 480, borderRadius: 28, padding: 32, ...surface }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, display: 'grid', placeItems: 'center', margin: '0 auto 16px', background: '#d6a846', color: '#1d1408' }}>
            <Sparkles size={34} />
          </div>
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -1 }}>Caspa</h1>
          <p style={{ margin: '8px 0 0', color: '#6d6255' }}>Private creative engine. No dashboard mausoleum.</p>
        </div>

        <button onClick={handleGoogleSignIn} disabled={loading || !firebaseReady} style={primaryButton('#1f2937', '#fff')}>
          {loading ? <Loader size={18} className="spin" /> : <Globe size={18} />}
          Sign in with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0', color: '#9b9184', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          <span style={{ height: 1, flex: 1, background: '#eadfce' }} /> or <span style={{ height: 1, flex: 1, background: '#eadfce' }} />
        </div>

        <form onSubmit={handleEmailSignIn}>
          <LabelledInput icon={Mail} label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          <LabelledInput icon={Lock} label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
          {error && <div style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 14, background: '#fff0ef', color: '#a02b20', marginBottom: 14 }}><AlertCircle size={18} />{error}</div>}
          <button type="submit" disabled={loading} style={primaryButton('#d6a846', '#1d1408')}>
            {loading ? <Loader size={18} className="spin" /> : <Check size={18} />}
            {isSignUp ? 'Create account' : 'Login'}
          </button>
        </form>

        <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{ width: '100%', border: '1px solid #eadfce', background: '#fffaf2', color: '#4a3b28', borderRadius: 14, padding: 12, marginTop: 14, cursor: 'pointer' }}>
          {isSignUp ? 'Already have an account? Sign in' : 'Create new account'}
        </button>
      </div>
    </div>
  );
}

function CaspaUI() {
  const authContext = React.useContext(AuthContext);
  const [currentView, setCurrentView] = useState<ViewType>('launchpad');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [brief, setBrief] = useState<ProjectBrief>(() => loadBrief());
  const [draftPage, setDraftPage] = useState(() => localStorage.getItem('caspa.whitePage') || '');
  const [manuscriptSource, setManuscriptSource] = useState(() => localStorage.getItem('caspa.manuscriptSource') || '');

  useEffect(() => {
    localStorage.setItem('caspa.whitePage', draftPage);
  }, [draftPage]);

  useEffect(() => {
    localStorage.setItem('caspa.manuscriptSource', manuscriptSource);
  }, [manuscriptSource]);

  const startProject = (mode: CreativeMode, idea: string, tone: string, output: string, audience: string) => {
    const nextBrief: ProjectBrief = {
      title: makeTitle(idea, mode),
      mode,
      idea: idea || modeCards.find((card) => card.mode === mode)?.examples[0] || 'New creative project',
      tone,
      output,
      audience,
      createdAt: new Date().toISOString(),
    };
    setBrief(nextBrief);
    saveBrief(nextBrief);
    setCurrentView(mode === 'gold' ? 'gold' : 'project');
  };

  const renderView = () => {
    switch (currentView) {
      case 'launchpad':
        return <LaunchpadView onStart={startProject} />;
      case 'project':
        return <ProjectView brief={brief} setCurrentView={setCurrentView} />;
      case 'write':
        return <WhitePageView brief={brief} draftPage={draftPage} setDraftPage={setDraftPage} setCurrentView={setCurrentView} />;
      case 'bible':
        return <StoryBibleView brief={brief} />;
      case 'workshop':
        return (
          <CommissionStudio
            brief={brief}
            draftPage={draftPage}
            onArtefactReady={(text) => {
              setDraftPage(text);
              setManuscriptSource(text);
              setCurrentView('write');
            }}
            onManuscriptChange={setManuscriptSource}
          />
        );
      case 'redpen':
        return <RedPenView brief={brief} draftPage={draftPage} setCurrentView={setCurrentView} />;
      case 'gold':
        return <GoldRefineryView brief={brief} draftPage={draftPage} setDraftPage={setDraftPage} />;
      case 'openwebui':
        return (
          <OpenWebUIDriverView
            brief={brief}
            draftPage={draftPage}
            setDraftPage={setDraftPage}
            onSendToWorkshop={(text) => {
              setManuscriptSource(text);
              setCurrentView('workshop');
            }}
          />
        );
      case 'research':
        return <ResearchLibrary brief={brief} manuscriptText={manuscriptSource || draftPage} />;
      case 'library':
        return <SimpleWorkspace title="Library" text="Your projects, shelves, exports and recoverable scraps of genius." />;
      case 'publish':
        return <SimpleWorkspace title="Publish Pack" text="Generate pitch packs, rehearsal packs, exports, treatments and reader-facing summaries." />;
      case 'settings':
        return <SettingsView user={authContext.user} />;
      default:
        return <LaunchpadView onStart={startProject} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5efe5', color: '#172033' }}>
      <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="mobile-menu" style={{ position: 'fixed', top: 16, left: 16, zIndex: 60, border: '1px solid #e0d3bf', background: '#fffaf2', borderRadius: 12, padding: 10 }}>
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside style={{ width: 300, minWidth: 300, height: '100vh', position: 'sticky', top: 0, background: '#17120c', color: '#f8efe0', borderRight: '1px solid #2b2116', padding: '24px 18px', overflowY: 'auto', transform: mobileMenuOpen ? 'translateX(0)' : undefined }} className="caspa-sidebar">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 46, height: 46, borderRadius: 16, background: '#d6a846', color: '#1a1208', display: 'grid', placeItems: 'center' }}><Sparkles size={24} /></div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>Caspa</div>
            <div style={{ color: '#c9b898', fontSize: 13 }}>Make the thing first. Tools second.</div>
          </div>
        </div>

        {(['make', 'work', 'improve', 'produce'] as NavItem['group'][]).map((group) => (
          <div key={group} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, color: '#8f8068', margin: '0 8px 8px' }}>{groupLabels[group]}</div>
            {navItems.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon;
              const active = item.id === currentView;
              return (
                <button key={item.id} onClick={() => { setCurrentView(item.id); setMobileMenuOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: 'none', borderRadius: 16, padding: '12px 12px', marginBottom: 6, cursor: 'pointer', textAlign: 'left', background: active ? '#2f2415' : 'transparent', color: active ? '#ffe2a5' : '#f8efe0' }}>
                  <Icon size={18} />
                  <span>
                    <strong style={{ display: 'block', fontSize: 14 }}>{item.label}</strong>
                    <small style={{ color: active ? '#d6a846' : '#9b8c73' }}>{item.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
        ))}

        <div style={{ borderTop: '1px solid #332719', paddingTop: 16, fontSize: 12, color: '#a89572' }}>
          <div style={{ marginBottom: 12 }}>{authContext.user?.email || 'Private workspace'}</div>
          <button onClick={authContext.signOut} style={{ ...ghostButton, width: '100%', justifyContent: 'center', color: '#ffccc6', borderColor: '#5b2a22' }}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>{renderView()}</main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .mobile-menu { display: none; }
        textarea:focus, input:focus, select:focus { outline: 2px solid #d6a846; outline-offset: 2px; }
        button { font-family: inherit; }
        @media (max-width: 860px) {
          .mobile-menu { display: block; }
          .caspa-sidebar { position: fixed !important; z-index: 55; transform: translateX(-105%); transition: transform .2s ease; }
        }
      `}</style>
    </div>
  );
}

function LaunchpadView({ onStart }: { onStart: (mode: CreativeMode, idea: string, tone: string, output: string, audience: string) => void }) {
  const [mode, setMode] = useState<CreativeMode>('script');
  const [idea, setIdea] = useState('A Dick Turpin stage comedy set in Milton Keynes');
  const [tone, setTone] = useState('Sharp, theatrical, funny, a bit camp, but structurally solid.');
  const [output, setOutput] = useState('Concept, character list, scene-by-scene outline, then Act One draft.');
  const [audience, setAudience] = useState('Theatre audience / producers / writers room.');

  const selected = modeCards.find((card) => card.mode === mode)!;
  const SelectedIcon = selected.icon;

  return (
    <section style={{ minHeight: '100vh', padding: '54px clamp(24px, 5vw, 72px)', background: 'radial-gradient(circle at top left, #fff7e6 0, #f5efe5 36%, #e9dfcf 100%)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, .9fr)', gap: 28, alignItems: 'stretch' }} className="responsive-grid">
          <div style={{ borderRadius: 34, padding: '42px clamp(24px, 4vw, 48px)', background: '#17120c', color: '#fffaf2', boxShadow: '0 30px 90px rgba(23,18,12,.24)' }}>
            <div style={{ color: '#d6a846', fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', fontSize: 12, marginBottom: 16 }}>Caspa Launchpad</div>
            <h1 style={{ fontSize: 'clamp(42px, 7vw, 82px)', lineHeight: .88, margin: 0, letterSpacing: -3 }}>What are we making today?</h1>
            <p style={{ maxWidth: 720, color: '#d7c8aa', fontSize: 19, lineHeight: 1.55, marginTop: 24 }}>Start with the creative intention, not the plumbing. Novel, script, musical, adaptation, polish, or glorious nonsense — then Caspa routes the machinery.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 32 }}>
              {modeCards.map((card) => {
                const Icon = card.icon;
                const active = card.mode === mode;
                return (
                  <button key={card.mode} onClick={() => setMode(card.mode)} style={{ border: `1px solid ${active ? '#d6a846' : '#3a2d1d'}`, background: active ? '#2b2115' : '#21180f', color: '#fffaf2', borderRadius: 20, padding: 18, textAlign: 'left', cursor: 'pointer' }}>
                    <Icon size={24} style={{ color: '#d6a846', marginBottom: 12 }} />
                    <strong style={{ display: 'block', marginBottom: 6 }}>{card.title}</strong>
                    <small style={{ color: '#c4b18b', lineHeight: 1.4 }}>{card.subtitle}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderRadius: 34, padding: 28, ...surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: '#fff3d5', color: '#7a5514', display: 'grid', placeItems: 'center' }}><SelectedIcon size={24} /></div>
              <div>
                <div style={{ color: '#8a6a28', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{selected.title}</div>
                <h2 style={{ margin: 0, fontSize: 26 }}>Project brief</h2>
              </div>
            </div>

            <Field label="Idea / premise">
              <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} style={textareaStyle} placeholder="Example: Dick Turpin in Milton Keynes, but make it stageable..." />
            </Field>
            <Field label="Tone">
              <input value={tone} onChange={(e) => setTone(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Output wanted">
              <input value={output} onChange={(e) => setOutput(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Audience">
              <input value={audience} onChange={(e) => setAudience(e.target.value)} style={inputStyle} />
            </Field>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {selected.examples.map((example) => <button key={example} onClick={() => setIdea(example)} style={chipButton}>{example}</button>)}
            </div>

            <button onClick={() => onStart(mode, idea, tone, output, audience)} style={{ ...primaryButton('#d6a846', '#1d1408'), padding: '16px 18px', fontSize: 16 }}>
              <Sparkles size={19} /> Build this project
            </button>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 1050px) { .responsive-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

function ProjectView({ brief, setCurrentView }: { brief: ProjectBrief; setCurrentView: (view: ViewType) => void }) {
  const nextMoves = useMemo(() => {
    if (brief.mode === 'script') return ['Lock format and stage rules', 'Build character engine', 'Create scene-by-scene act structure', 'Draft opening scene'];
    if (brief.mode === 'musical') return ['Define book spine', 'List song moments', 'Build character vocal palette', 'Create Act One running order'];
    if (brief.mode === 'gold') return ['Paste manuscript', 'Run structure pass', 'Run line edit', 'Export ruthless final cut'];
    if (brief.mode === 'adaptation') return ['Identify source material', 'Extract dramatic spine', 'Choose format', 'Draft treatment'];
    if (brief.mode === 'chaos') return ['Interrogate the madness', 'Find the serious engine', 'Choose format', 'Draft the wildest opening'];
    return ['Define central promise', 'Build chapter map', 'Create characters', 'Draft opening chapter'];
  }, [brief.mode]);

  return (
    <PageShell kicker="Current Project" title={brief.title} subtitle={`${modeLabels[brief.mode]} • created ${formatDate(brief.createdAt)}`}>
      <div style={cardGrid}>
        <article style={{ ...cardStyle, gridColumn: 'span 2' }}>
          <h2 style={sectionTitle}>Creative spine</h2>
          <p style={bigText}>{brief.idea}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 24 }}>
            <MiniPanel label="Tone" value={brief.tone} />
            <MiniPanel label="Output" value={brief.output} />
            <MiniPanel label="Audience" value={brief.audience} />
          </div>
        </article>
        <article style={cardStyle}>
          <h2 style={sectionTitle}>Next best moves</h2>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>{nextMoves.map((move) => <li key={move}>{move}</li>)}</ol>
        </article>
        <article style={cardStyle}>
          <h2 style={sectionTitle}>Drive it</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <button onClick={() => setCurrentView('write')} style={actionButton}><PenLine size={18} /> Open white page</button>
            <button onClick={() => setCurrentView('openwebui')} style={actionButton}><UploadCloud size={18} /> Open WebUI driver</button>
            <button onClick={() => setCurrentView('workshop')} style={actionButton}><Hammer size={18} /> Workshop — paste & write it</button>
            <button onClick={() => setCurrentView('gold')} style={actionButton}><Wand2 size={18} /> Gold polish route</button>
          </div>
        </article>
      </div>
    </PageShell>
  );
}

function WhitePageView({ brief, draftPage, setDraftPage, setCurrentView }: { brief: ProjectBrief; draftPage: string; setDraftPage: (value: string) => void; setCurrentView: (view: ViewType) => void }) {
  return (
    <div style={{ minHeight: '100vh', background: '#ede4d6', padding: '42px clamp(18px, 4vw, 64px)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <div style={kickerStyle}>White Page</div>
            <h1 style={{ margin: 0, fontSize: 38 }}>Drive the project on a clean page</h1>
            <p style={{ margin: '8px 0 0', color: '#73695d' }}>{brief.title}</p>
          </div>
          <button onClick={() => setCurrentView('openwebui')} style={primaryButton('#1f2937', '#fff')}><UploadCloud size={18} /> Send mindset to Open WebUI</button>
        </div>
        <textarea value={draftPage} onChange={(e) => setDraftPage(e.target.value)} placeholder="Start writing here. Scene, chapter, song brief, treatment, argument, joke list, anything. This is deliberately white and boring so the work gets loud." style={{ width: '100%', minHeight: '72vh', border: '1px solid #dfd3c0', borderRadius: 10, padding: '42px clamp(22px, 5vw, 72px)', fontSize: 20, lineHeight: 1.75, color: '#111827', background: '#ffffff', boxShadow: '0 24px 90px rgba(40, 29, 12, .10)', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'Georgia, Cambria, serif' }} />
      </div>
    </div>
  );
}

function OpenWebUIDriverView({
  brief,
  draftPage,
  setDraftPage,
  onSendToWorkshop,
}: {
  brief: ProjectBrief;
  draftPage: string;
  setDraftPage: (value: string) => void;
  onSendToWorkshop: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const prompt = buildOpenWebUIPrompt(brief, draftPage);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f0', padding: '36px clamp(18px, 4vw, 56px)' }}>
      <div style={{ maxWidth: 1260, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 390px', gap: 22 }} className="responsive-grid">
        <section style={{ background: '#ffffff', border: '1px solid #dedede', minHeight: '82vh', padding: '46px clamp(22px, 5vw, 72px)', boxShadow: '0 18px 70px rgba(0,0,0,.08)' }}>
          <div style={kickerStyle}>Open WebUI clear page</div>
          <input value={brief.title} readOnly style={{ border: 'none', borderBottom: '1px solid #e5e5e5', width: '100%', fontSize: 34, fontWeight: 800, padding: '0 0 16px', marginBottom: 24, color: '#111827', background: 'transparent' }} />
          <textarea value={draftPage} onChange={(e) => setDraftPage(e.target.value)} placeholder="Use this as your clean project-driving page. Paste the generated driver prompt into Open WebUI, then keep the working text here." style={{ width: '100%', minHeight: '58vh', border: 'none', resize: 'vertical', fontSize: 19, lineHeight: 1.75, color: '#111827', fontFamily: 'Georgia, Cambria, serif', background: '#fff' }} />
        </section>

        <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <article style={cardStyle}>
            <h2 style={sectionTitle}>Driver prompt</h2>
            <p style={{ color: '#62584c', lineHeight: 1.6 }}>Copy this into Open WebUI to make any model behave like the project room, not a random chatbot with opinions and no shoes.</p>
            <button onClick={copyPrompt} style={primaryButton(copied ? '#15803d' : '#1f2937', '#fff')}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Copied' : 'Copy Open WebUI prompt'}</button>
            <button
              type="button"
              onClick={() => onSendToWorkshop(draftPage)}
              disabled={!draftPage.trim()}
              style={{ ...primaryButton('#d6a846', '#1d1408'), marginTop: 10 }}
            >
              <Hammer size={18} /> Commission this in Workshop
            </button>
          </article>
          <article style={cardStyle}>
            <h2 style={sectionTitle}>Project packet</h2>
            <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 420, background: '#f7f3eb', border: '1px solid #eadfce', borderRadius: 16, padding: 16, fontSize: 12, lineHeight: 1.55 }}>{prompt}</pre>
          </article>
        </aside>
      </div>
      <style>{`@media (max-width: 1050px) { .responsive-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function GoldRefineryView({ brief, draftPage, setDraftPage }: { brief: ProjectBrief; draftPage: string; setDraftPage: (value: string) => void }) {
  const passes = [
    ['Structure Pass', 'Does the spine hold, or is it wearing a hat and pretending?'],
    ['Depth Pass', 'Characters, stakes, world, relationships, pressure.'],
    ['Subtext Pass', 'Meaning underneath the words. Less furniture, more voltage.'],
    ['Line Edit', 'Pace, clarity, rhythm, voice, cuts.'],
    ['Ruthless Final Cut', 'Remove what is decorative, dead, duplicated or showing off.'],
  ];
  return (
    <PageShell kicker="Gold Refinery" title="Polish existing work" subtitle="Gold is no longer the front door. It is the finishing room.">
      <div style={cardGrid}>
        <article style={{ ...cardStyle, gridColumn: 'span 2' }}>
          <h2 style={sectionTitle}>Paste or refine text</h2>
          <textarea value={draftPage} onChange={(e) => setDraftPage(e.target.value)} placeholder="Paste chapter, scene, treatment or script extract here." style={{ ...textareaStyle, minHeight: 360, fontFamily: 'Georgia, Cambria, serif', fontSize: 18 }} />
        </article>
        <article style={cardStyle}>
          <h2 style={sectionTitle}>Refinement route</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {passes.map(([name, detail], index) => <div key={name} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 14, background: '#fff8ea', border: '1px solid #eadfce' }}><strong>{index + 1}</strong><span><b>{name}</b><small style={{ display: 'block', color: '#73695d' }}>{detail}</small></span></div>)}
          </div>
        </article>
        <article style={cardStyle}>
          <h2 style={sectionTitle}>Current project</h2>
          <p style={bigText}>{brief.title}</p>
          <p style={{ color: '#6f6252' }}>{brief.idea}</p>
        </article>
      </div>
    </PageShell>
  );
}

function StoryBibleView({ brief }: { brief: ProjectBrief }) {
  return (
    <PageShell kicker="Story Bible" title="Canon, characters and rules" subtitle={brief.title}>
      <div style={cardGrid}>
        <article style={cardStyle}><h2 style={sectionTitle}>Characters</h2><p>Protagonist, antagonist, allies, comic engines, secrets and reversals.</p></article>
        <article style={cardStyle}><h2 style={sectionTitle}>World rules</h2><p>Setting, period, tone laws, what is allowed, what breaks the spell.</p></article>
        <article style={cardStyle}><h2 style={sectionTitle}>Continuity</h2><p>Facts that must stay true unless deliberately subverted.</p></article>
      </div>
    </PageShell>
  );
}

function RedPenView({ brief, draftPage, setCurrentView }: { brief: ProjectBrief; draftPage: string; setCurrentView: (view: ViewType) => void }) {
  const wordCount = draftPage.trim().split(/\s+/).filter(Boolean).length;
  return (
    <PageShell kicker="Red Pen" title="Quick scan" subtitle="For full diagnose-and-write, use Workshop.">
      <div style={cardGrid}>
        <article style={cardStyle}><h2 style={sectionTitle}>Project</h2><p style={bigText}>{brief.title}</p><p>{brief.idea}</p></article>
        <article style={cardStyle}><h2 style={sectionTitle}>Draft status</h2><p style={bigText}>{wordCount} words</p><p>{wordCount ? 'Ready for Workshop.' : 'Paste a draft in Workshop or White Page first.'}</p></article>
        <article style={cardStyle}>
          <h2 style={sectionTitle}>Full pipeline</h2>
          <p style={{ color: '#73695d', lineHeight: 1.6 }}>Workshop gives structured recommendations and one-click Write it — no fishing through logs.</p>
          <button type="button" onClick={() => setCurrentView('workshop')} style={{ ...primaryButton('#d6a846', '#1d1408'), width: 'auto', marginTop: 14 }}>
            <Hammer size={18} /> Open Workshop
          </button>
        </article>
      </div>
    </PageShell>
  );
}

function SimpleWorkspace({ title, text }: { title: string; text: string }) {
  return <PageShell kicker="Workspace" title={title} subtitle={text}><article style={cardStyle}><p style={bigText}>This room is now placed correctly in the product. Next pass can wire its live functions.</p></article></PageShell>;
}

function SettingsView({ user }: { user: User | null }) {
  return <PageShell kicker="Settings" title="Account and privacy" subtitle={user?.email || 'Private workspace'}><article style={cardStyle}><p>Authentication is still preserved. The redesign changes the working experience, not the access model.</p></article></PageShell>;
}

function PageShell({ kicker, title, subtitle, children }: { kicker: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={kickerStyle}>{kicker}</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1, letterSpacing: -2 }}>{title}</h1>
          <p style={{ margin: 0, maxWidth: 760, color: '#73695d', fontSize: 18, lineHeight: 1.5 }}>{subtitle}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function LabelledInput({ icon: Icon, label, value, onChange, type, placeholder }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; value: string; onChange: (value: string) => void; type: string; placeholder: string }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', color: '#695d4f', fontSize: 13, fontWeight: 700, marginBottom: 7 }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <Icon size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#8b806f' }} />
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, paddingLeft: 42 }} />
      </div>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block', marginBottom: 16 }}><span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#5c5146', marginBottom: 7 }}>{label}</span>{children}</label>;
}

function MiniPanel({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 16, borderRadius: 18, background: '#fff8ea', border: '1px solid #eadfce' }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8a6a28', fontWeight: 800 }}>{label}</div><p style={{ margin: '8px 0 0', color: '#2f281f' }}>{value}</p></div>;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #e2d6c3',
  borderRadius: 14,
  padding: '13px 14px',
  background: '#fffdf8',
  color: '#172033',
  fontSize: 15,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  lineHeight: 1.6,
};

const primaryButton = (background: string, color: string): React.CSSProperties => ({
  width: '100%',
  border: 'none',
  borderRadius: 16,
  padding: '13px 16px',
  background,
  color,
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
});

const ghostButton: React.CSSProperties = {
  border: '1px solid #d8c9b4',
  borderRadius: 14,
  padding: '11px 13px',
  background: 'transparent',
  color: '#3b3126',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

const chipButton: React.CSSProperties = {
  border: '1px solid #e3d7c4',
  background: '#fff8ea',
  color: '#5b4724',
  borderRadius: 999,
  padding: '8px 11px',
  cursor: 'pointer',
  fontSize: 12,
};

const kickerStyle: React.CSSProperties = {
  color: '#9b6d16',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
};

const cardGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 18,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 26,
  padding: 24,
  ...surface,
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 20,
  letterSpacing: -0.3,
};

const bigText: React.CSSProperties = {
  fontSize: 22,
  lineHeight: 1.45,
  margin: 0,
  color: '#21180f',
};

const actionButton: React.CSSProperties = {
  ...ghostButton,
  width: '100%',
  justifyContent: 'flex-start',
  background: '#fff8ea',
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { initializeApp } = await import('firebase/app');
        const { getAuth, onAuthStateChanged } = await import('firebase/auth');

        const firebaseConfig = {
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyBdMzl_c0rFT9C_3LKq1hbDDKfRvPAhP0I',
          authDomain: 'novelwrite-27763.firebaseapp.com',
          projectId: 'novelwrite-27763',
          storageBucket: 'novelwrite-27763.appspot.com',
          messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '506738699621',
          appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:506738699621:web:9e8f9f8b8c8d8e8f8g8h',
        };

        try {
          initializeApp(firebaseConfig);
        } catch {
          // Already initialised.
        }

        const unsubscribe = onAuthStateChanged(getAuth(), (firebaseUser) => {
          if (firebaseUser) {
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email || '', displayName: firebaseUser.displayName || '' });
          }
          setAuthLoading(false);
        });
        return unsubscribe;
      } catch (err) {
        console.error('Auth check error:', err);
        setAuthLoading(false);
        return undefined;
      }
    };

    const unsubscribe = checkAuth();
    return () => {
      if (unsubscribe instanceof Promise) unsubscribe.then((unsub) => unsub?.());
    };
  }, []);

  const handleSignOut = async () => {
    try {
      const { getAuth, signOut } = await import('firebase/auth');
      await signOut(getAuth());
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (authLoading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#17120c', color: '#fffaf2' }}><div style={{ textAlign: 'center' }}><Loader size={46} className="spin" /><p>Loading Caspa...</p></div></div>;
  }

  if (!user) return <CaspaLogin onLoginSuccess={setUser} />;

  return (
    <AuthContext.Provider value={{ user, loading: authLoading, signOut: handleSignOut }}>
      <CaspaUI />
    </AuthContext.Provider>
  );
}
