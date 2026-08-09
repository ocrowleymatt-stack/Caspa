/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Caspa Creative Engine - intent-first studio UI
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  BookImage,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clapperboard,
  Download,
  FileText,
  GitBranch,
  Globe,
  Home,
  Library,
  Loader,
  Lock,
  LogOut,
  Mail,
  Menu,
  Music2,
  Navigation2,
  Newspaper,
  PenLine,
  Quote,
  Scissors,
  Search,
  Settings,
  Sparkles,
  Users,
  Wand2,
  Hammer,
  Brain,
  Bug,
  Pencil,
  UploadCloud,
  Zap,
  X,
} from 'lucide-react';

import CommissionStudio, { type StudioTab } from './components/CommissionStudio';
import ResearchLibrary from './components/ResearchLibrary';
import PublishPack from './components/PublishPack';
import PsychologyStudio from './components/PsychologyStudio';
import StoryCanvas from './components/StoryCanvas';
import ProjectShelf from './components/ProjectShelf';
import GoldRefinery from './components/GoldRefinery';
import RedPenStudio from './components/RedPenStudio';
import SettingsStudio from './components/SettingsStudio';
import StoryBibleStudio from './components/StoryBibleStudio';
import GuidedNextStep, { WorkflowChecklist } from './components/GuidedNextStep';
import WorkflowStageBar from './components/WorkflowStageBar';
import BookDesignStudio from './components/BookDesignStudio';
import QuickWrite from './components/QuickWrite';
import StudioToolBridge, { type StudioToolId } from './components/StudioToolBridge';
import ShowBoxStudio from './components/ShowBoxStudio';
import ShowCommandCenter from './components/ShowCommandCenter';
import LegalCasesDashboard from './components/LegalCasesDashboard';
import BettingGamePanel from './components/BettingGamePanel';
import {
  completeProject,
  loadProjectSnapshot,
  pruneStaleProjects,
  recordProjectSnapshot,
  saveCurrentProjectState,
  switchToProject,
} from './services/projectShelfService';
import {
  activateUserDatabase,
  deactivateUserDatabase,
  persistActiveUserDatabase,
} from './services/userDatabaseService';
import {
  getNextStep,
  getProgressSummary,
  getWorkflowSteps,
  stepToNavTarget,
  type WorkflowNavTarget,
} from './services/projectWorkflowService';
import { countWords, defaultTargetWordCount } from './services/wordCountService';
import { getProjectKey } from './services/researchLibraryService';
import { clearPlotHold } from './services/plotHoldService';
import { clearShowBox, hasShowBoxContent } from './services/showBoxService';
import { ingestKnowledgeFile, ingestKnowledgeText } from './services/knowledgeClient';
import { clearCloudCredentialsForScope } from './services/cloudCredentialScope';
import firebaseAppletConfig from '../firebase-applet-config.json';

declare const process: any;

const LOCAL_GUEST_KEY = 'caspa.localGuest';

function createLocalGuest(): User {
  return {
    uid: 'local-guest',
    email: 'local@caspa.workspace',
    displayName: 'Local workspace',
  };
}

function isLocalGuest(user: User | null): boolean {
  return Boolean(user?.uid === 'local-guest');
}

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

type CreativeMode =
  | 'novel'
  | 'nonfiction'
  | 'essay'
  | 'poetry'
  | 'picture'
  | 'script'
  | 'musical'
  | 'adaptation'
  | 'gold'
  | 'chaos';

type ViewType =
  | 'launchpad'
  | 'project'
  | 'write'
  | 'quickwrite'
  | 'design'
  | 'bible'
  | 'redpen'
  | 'workshop'
  | 'gold'
  | 'library'
  | 'research'
  | 'publish'
  | 'psychology'
  | 'canvas'
  | 'settings'
  | 'showbox'
  | 'legal-cases'
  | 'betting-game'
  | StudioToolId;

type ProjectBrief = {
  title: string;
  mode: CreativeMode;
  idea: string;
  tone: string;
  output: string;
  audience: string;
  targetWordCount: number;
  createdAt: string;
};

type NavItem = {
  id: ViewType;
  label: string;
  detail: string;
  group: 'primary' | 'advanced' | 'studio';
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
};

const STUDIO_TOOL_IDS: StudioToolId[] = [
  'brainstorm',
  'characters',
  'plot',
  'writing',
  'intelligence',
  'architect',
  'swarm',
  'scalpel',
  'autodraft',
  'pilot',
  'prizes',
];

function isStudioTool(view: ViewType): view is StudioToolId {
  return (STUDIO_TOOL_IDS as string[]).includes(view);
}

function mapLegacyView(legacy: string): ViewType | null {
  const map: Record<string, ViewType> = {
    brainstorm: 'brainstorm',
    characters: 'characters',
    plot: 'plot',
    writing: 'writing',
    write: 'write',
    intelligence: 'intelligence',
    swarm: 'swarm',
    architect: 'architect',
    scalpel: 'scalpel',
    autodraft: 'autodraft',
    prizes: 'prizes',
    design: 'design',
    publish: 'publish',
    export: 'publish',
    library: 'library',
    research: 'research',
    settings: 'settings',
    dashboard: 'project',
    workshop: 'workshop',
    gold: 'gold',
    pilot: 'pilot',
    showbox: 'showbox',
    show: 'showbox',
    musical: 'showbox',
  };
  return map[legacy] || null;
}

function primaryNavFor(brief: ProjectBrief): NavItem[] {
  const showMode = brief.mode === 'musical' || hasShowBoxContent();
  const pictureMode = brief.mode === 'picture';
  return primaryNav.filter((item) => {
    if (item.id === 'showbox') return showMode;
    if (item.id === 'design') return pictureMode || (!showMode && brief.mode !== 'script');
    if (item.id === 'quickwrite') {
      return true;
    }
    return true;
  }).map((item) => {
    if (item.id === 'quickwrite' && (brief.mode === 'musical' || brief.mode === 'script')) {
      return { ...item, detail: 'Whole show / script by scene' };
    }
    if (item.id === 'write' && brief.mode === 'musical') {
      return { ...item, detail: 'Book scenes & lyrics' };
    }
    return item;
  });
}

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
  output: 'Full manuscript: draft every held chapter in order.',
  audience: 'General readers / theatre audience / producers, depending on format.',
  targetWordCount: 80000,
  createdAt: new Date().toISOString(),
};

const modeLabels: Record<CreativeMode, string> = {
  novel: 'Fiction',
  nonfiction: 'Non-fiction',
  essay: 'Essay / article',
  poetry: 'Poetry',
  picture: 'Picture book',
  script: 'Script',
  musical: 'Show in a Box',
  adaptation: 'Adaptation',
  gold: 'Gold Refinery',
  chaos: 'Surprise Me',
};

const primaryNav: NavItem[] = [
  { id: 'project', label: 'Next step', detail: 'What to do now', group: 'primary', icon: Home },
  { id: 'quickwrite', label: 'Just write', detail: 'Whole book by chapter', group: 'primary', icon: Zap },
  { id: 'write', label: 'White Page', detail: 'Draft and edit', group: 'primary', icon: PenLine },
  { id: 'showbox', label: 'Show in a Box', detail: 'Book, songs, pack', group: 'primary', icon: Music2 },
  { id: 'design', label: 'Design', detail: 'Cover & picture pages', group: 'primary', icon: BookImage },
  { id: 'publish', label: 'Publish', detail: 'Export when ready', group: 'primary', icon: Download },
  { id: 'library', label: 'Library', detail: 'Open work & finished', group: 'primary', icon: Library },
];

const advancedNav: NavItem[] = [
  { id: 'launchpad', label: 'New Work', detail: 'Start another project', group: 'advanced', icon: Sparkles },
  { id: 'workshop', label: 'Workshop', detail: 'Diagnose → commission → artefact', group: 'advanced', icon: Hammer },
  { id: 'bible', label: 'Story Bible', detail: 'Canon and characters', group: 'advanced', icon: BookOpen },
  { id: 'psychology', label: 'Psychology', detail: 'Emotional journeys', group: 'advanced', icon: Brain },
  { id: 'redpen', label: 'Red Pen', detail: 'Quick issue scan', group: 'advanced', icon: CircleAlert },
  { id: 'gold', label: 'Gold Refinery', detail: 'Polish existing text', group: 'advanced', icon: Wand2 },
  { id: 'canvas', label: 'Jam Canvas', detail: 'Storyboards', group: 'advanced', icon: Pencil },
  { id: 'research', label: 'Research Desk', detail: 'Sources and notes', group: 'advanced', icon: Search },
  { id: 'settings', label: 'Settings', detail: 'Backup and account', group: 'advanced', icon: Settings },
];

const studioNav: NavItem[] = [
  { id: 'brainstorm', label: 'Brainstorm', detail: 'Premise under pressure', group: 'studio', icon: Sparkles },
  { id: 'characters', label: 'Character Forge', detail: 'Wants, masks, wounds', group: 'studio', icon: Users },
  { id: 'plot', label: 'Plot Architect', detail: 'Spine and turns', group: 'studio', icon: GitBranch },
  { id: 'writing', label: 'Writing Studio', detail: 'Chapter craft room', group: 'studio', icon: PenLine },
  { id: 'intelligence', label: 'Intelligence Lab', detail: 'Deep research engine', group: 'studio', icon: Search },
  { id: 'architect', label: 'Rip & Fix', detail: 'Restructure / rebuild', group: 'studio', icon: Hammer },
  { id: 'swarm', label: 'Critic Swarm', detail: 'Multi-lens critique', group: 'studio', icon: Bug },
  { id: 'scalpel', label: 'Scalpel', detail: 'Cut sludge hard', group: 'studio', icon: Scissors },
  { id: 'autodraft', label: 'Auto Drafter', detail: 'Deep-draft chapters', group: 'studio', icon: Zap },
  { id: 'pilot', label: 'Pilot Seat', detail: 'Directive steering', group: 'studio', icon: Navigation2 },
  { id: 'prizes', label: 'Prize Calibration', detail: 'Lens pressure test', group: 'studio', icon: Award },
];

const omniToolNav: NavItem[] = [
  { id: 'legal-cases', label: 'Legal Cases', detail: 'Browse investigations and evidence', group: 'advanced', icon: FileText },
  { id: 'betting-game', label: 'Betting Game', detail: 'ML predictions and leaderboard', group: 'advanced', icon: Zap },
];

const modeCards: Array<{
  mode: CreativeMode;
  title: string;
  subtitle: string;
  examples: string[];
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  hero?: boolean;
}> = [
  {
    mode: 'novel',
    title: 'Fiction',
    subtitle: 'Novel, short story, series bible. Plot held under the hood.',
    examples: ['Gothic literary thriller', 'Comic revenge novel', 'Queer horror with teeth'],
    icon: Zap,
    hero: true,
  },
  {
    mode: 'nonfiction',
    title: 'Non-fiction',
    subtitle: 'Memoir, reportage, how-to, history, true crime, biography.',
    examples: ['Family history with teeth', 'How-to for burned-out carers', 'Town that vanished overnight'],
    icon: Newspaper,
    hero: true,
  },
  {
    mode: 'picture',
    title: 'Picture book',
    subtitle: 'Age bands, spreads, wraparound covers, character lock.',
    examples: ['Fox who lost the moon', 'Toddler and the night bus', 'Quiet dragon learns to share'],
    icon: BookImage,
    hero: true,
  },
  {
    mode: 'musical',
    title: 'Show in a Box',
    subtitle: 'Book, songs, running order, music sketch, cast & production pack.',
    examples: ['Panto with bite', 'Cult musical', 'Dick Turpin in Milton Keynes'],
    icon: Music2,
    hero: true,
  },
  {
    mode: 'gold',
    title: 'Polish',
    subtitle: 'Paste existing work. Gold pipeline. Same piece, sharper.',
    examples: ['Tighten chapter', 'Fix pacing', 'Make it prize-ready'],
    icon: Wand2,
    hero: true,
  },
  {
    mode: 'script',
    title: 'Script',
    subtitle: 'Stage, screen, radio, sitcom, monologue or sketch.',
    examples: ['Courtroom farce', 'BBC pilot treatment', 'Radio two-hander'],
    icon: Clapperboard,
  },
  {
    mode: 'essay',
    title: 'Essay / article',
    subtitle: 'Column, thinkpiece, feature, review, speech draft.',
    examples: ['Personal essay on shame', 'Longread investigation', 'Op-ed with receipts'],
    icon: FileText,
  },
  {
    mode: 'poetry',
    title: 'Poetry',
    subtitle: 'Poem, sequence, pamphlet, performance piece.',
    examples: ['Sonnet crown about work', 'Spoken-word set', 'Elegy that refuses comfort'],
    icon: Quote,
  },
  {
    mode: 'adaptation',
    title: 'Adapt Something',
    subtitle: 'Turn notes, evidence, transcripts or chaos into a finished form.',
    examples: ['Transcript to drama', 'Memoir to play', 'Evidence to thriller'],
    icon: PenLine,
  },
  {
    mode: 'chaos',
    title: 'Surprise Me',
    subtitle: 'For when the idea is unhinged but probably brilliant.',
    examples: ['Travelodge ghost opera', 'Concrete cow heist', 'Victorian demon sitcom'],
    icon: Sparkles,
  },
];

const formatDate = (iso: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

function hasActiveProject(): boolean {
  try {
    return Boolean(localStorage.getItem('caspa.currentBrief'));
  } catch {
    return false;
  }
}

function loadProjectStatus(brief: ProjectBrief): 'active' | 'complete' {
  const key = getProjectKey(brief);
  const snap = loadProjectSnapshot(key);
  return snap?.status === 'complete' ? 'complete' : 'active';
}

const surface: React.CSSProperties = {
  background: '#ffffff',
  color: '#182033',
  border: '1px solid #e8e1d4',
  boxShadow: '0 20px 70px rgba(20, 16, 10, 0.08)',
};

function saveBrief(brief: ProjectBrief) {
  localStorage.setItem('caspa.currentBrief', JSON.stringify(brief));
  recordProjectSnapshot(brief);
}

function loadBrief(): ProjectBrief {
  try {
    const raw = localStorage.getItem('caspa.currentBrief');
    if (!raw) return defaultBrief;
    const parsed = JSON.parse(raw);
    const merged = { ...defaultBrief, ...parsed } as ProjectBrief;
    if (!merged.targetWordCount || merged.targetWordCount < 100) {
      merged.targetWordCount = defaultTargetWordCount(merged.mode);
    }
    return merged;
  } catch {
    return defaultBrief;
  }
}

function makeTitle(idea: string, mode: CreativeMode) {
  const cleaned = idea.trim().replace(/\s+/g, ' ');
  if (!cleaned) return `New ${modeLabels[mode]}`;
  return cleaned.length > 58 ? `${cleaned.slice(0, 55)}...` : cleaned;
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
    apiKey: firebaseAppletConfig.apiKey,
    authDomain: firebaseAppletConfig.authDomain,
    projectId: firebaseAppletConfig.projectId,
    storageBucket: firebaseAppletConfig.storageBucket,
    messagingSenderId: firebaseAppletConfig.messagingSenderId,
    appId: firebaseAppletConfig.appId,
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
          try {
            localStorage.removeItem(LOCAL_GUEST_KEY);
          } catch {
            /* ignore */
          }
          onLoginSuccess?.({ uid: user.uid, email: user.email || '', displayName: user.displayName || '' });
        }
      });
      setFirebaseReady(true);
    } catch (err) {
      console.error('Firebase init error:', err);
      setFirebaseReady(false);
    }
  };

  const handleLocalContinue = () => {
    try {
      localStorage.setItem(LOCAL_GUEST_KEY, '1');
    } catch {
      /* ignore */
    }
    onLoginSuccess?.(createLocalGuest());
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
      try {
        localStorage.removeItem(LOCAL_GUEST_KEY);
      } catch {
        /* ignore */
      }
      onLoginSuccess?.({ uid: result.user.uid, email: result.user.email || '', displayName: result.user.displayName || '' });
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.code === 'auth/popup-blocked' ? 'Pop-up blocked. Allow pop-ups for this site.' : 'Google sign-in failed. Try email/password or Continue locally.');
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
      try {
        localStorage.removeItem(LOCAL_GUEST_KEY);
      } catch {
        /* ignore */
      }
      onLoginSuccess?.({ uid: result.user.uid, email: result.user.email || '', displayName: result.user.displayName || '' });
    } catch (err: any) {
      console.error('Email auth error:', err);
      setError(isSignUp ? 'Could not create account.' : 'Could not sign in. Check the details, or Continue locally.');
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
          <p style={{ margin: '8px 0 0', color: '#6d6255' }}>Private creative engine. Start in one click — account optional.</p>
        </div>

        <button onClick={handleLocalContinue} disabled={loading} style={primaryButton('#d6a846', '#1d1408')}>
          <Zap size={18} />
          Continue locally
        </button>
        <p style={{ margin: '10px 0 0', color: '#8a7d6b', fontSize: 13, lineHeight: 1.45, textAlign: 'center' }}>
          Works offline in this browser. Back up from Settings when you want a server copy.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0', color: '#9b9184', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          <span style={{ height: 1, flex: 1, background: '#eadfce' }} /> or sign in <span style={{ height: 1, flex: 1, background: '#eadfce' }} />
        </div>

        <button onClick={handleGoogleSignIn} disabled={loading || !firebaseReady} style={primaryButton('#1f2937', '#fff')}>
          {loading ? <Loader size={18} className="spin" /> : <Globe size={18} />}
          Sign in with Google
        </button>

        <form onSubmit={handleEmailSignIn} style={{ marginTop: 14 }}>
          <LabelledInput icon={Mail} label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          <LabelledInput icon={Lock} label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
          {error && <div style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 14, background: '#fff0ef', color: '#a02b20', marginBottom: 14 }}><AlertCircle size={18} />{error}</div>}
          <button type="submit" disabled={loading} style={primaryButton('#17120c', '#fffaf2')}>
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
  const [currentView, setCurrentView] = useState<ViewType>(() => (hasActiveProject() ? 'project' : 'launchpad'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [workshopTab, setWorkshopTab] = useState<StudioTab | undefined>(undefined);
  const [workshopFocusChapter, setWorkshopFocusChapter] = useState<number | null>(null);
  const [brief, setBrief] = useState<ProjectBrief>(() => loadBrief());
  const [draftPage, setDraftPage] = useState(() => localStorage.getItem('caspa.whitePage') || '');
  const [manuscriptSource, setManuscriptSource] = useState(() => localStorage.getItem('caspa.manuscriptSource') || '');
  const [projectStatus, setProjectStatus] = useState<'active' | 'complete'>(() => loadProjectStatus(loadBrief()));
  const [sidebarFastUploading, setSidebarFastUploading] = useState(false);
  const sidebarFastUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = 'atlas.runtime.gitSha';
    const checkBuild = async () => {
      try {
        const response = await fetch('/api/doctor', { cache: 'no-store' });
        const data = await response.json();
        const sha = data?.data?.gitSha || data?.data?.deployment?.gitSha || '';
        if (!sha || cancelled) return;
        const previous = sessionStorage.getItem(key);
        if (previous && previous !== sha) {
          sessionStorage.setItem(key, sha);
          window.location.reload();
          return;
        }
        sessionStorage.setItem(key, sha);
      } catch {
        /* update checking is fail-soft */
      }
    };
    void checkBuild();
    const timer = window.setInterval(checkBuild, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const reloadFromStorage = () => {
    const nextBrief = loadBrief();
    setBrief(nextBrief);
    setDraftPage(localStorage.getItem('caspa.whitePage') || '');
    setManuscriptSource(localStorage.getItem('caspa.manuscriptSource') || '');
    setProjectStatus(loadProjectStatus(nextBrief));
  };

  const goTo = (view: ViewType) => {
    if (view === 'workshop') {
      // Sidebar click — no forced tab; Studio remembers last tab.
      setWorkshopTab(undefined);
      setWorkshopFocusChapter(null);
    }
    if (isStudioTool(view)) setStudioOpen(true);
    if (advancedNav.some((n) => n.id === view)) setAdvancedOpen(true);
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  const goWorkflow = (target: WorkflowNavTarget) => {
    if (target.view === 'workshop') {
      setWorkshopTab(target.workshopTab);
      setWorkshopFocusChapter(target.focusChapter ?? null);
      setAdvancedOpen(true);
    } else {
      setWorkshopTab(undefined);
      setWorkshopFocusChapter(null);
    }
    setCurrentView(target.view as ViewType);
    setMobileMenuOpen(false);
  };

  const handleCompleteProject = () => {
    const key = getProjectKey(brief);
    saveCurrentProjectState();
    completeProject(key);
    setProjectStatus('complete');
    goTo('library');
  };

  const handleSwitchProject = () => {
    reloadFromStorage();
    goTo('project');
  };

  const handleProjectCompleted = () => {
    reloadFromStorage();
    if (!hasActiveProject()) {
      goTo('launchpad');
    }
  };

  useEffect(() => {
    pruneStaleProjects();
    // Only snapshot a real active brief — never the fallback default.
    if (hasActiveProject()) {
      recordProjectSnapshot(brief);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('caspa.whitePage', draftPage);
  }, [draftPage]);

  useEffect(() => {
    localStorage.setItem('caspa.manuscriptSource', manuscriptSource);
  }, [manuscriptSource]);

  const startProject = (mode: CreativeMode, idea: string, tone: string, output: string, audience: string, targetWordCount?: number) => {
    saveCurrentProjectState();
    const nextBrief: ProjectBrief = {
      title: makeTitle(idea, mode),
      mode,
      idea: idea || modeCards.find((card) => card.mode === mode)?.examples[0] || 'New creative project',
      tone,
      output,
      audience,
      targetWordCount: targetWordCount && targetWordCount > 0 ? targetWordCount : defaultTargetWordCount(mode),
      createdAt: new Date().toISOString(),
    };
    setBrief(nextBrief);
    saveBrief(nextBrief);
    setProjectStatus('active');
    setDraftPage('');
    setManuscriptSource('');
    localStorage.setItem('caspa.whitePage', '');
    localStorage.setItem('caspa.manuscriptSource', '');
    localStorage.removeItem('caspa.commission');
    localStorage.removeItem('caspa.commission.tab');
    clearShowBox();
    clearPlotHold();
    // Match CTA: picture → Design, show → Show Box, polish → Gold, else → Next step.
    if (mode === 'picture') goTo('design');
    else if (mode === 'musical') goTo('showbox');
    else if (mode === 'gold') goTo('gold');
    else goTo('project');
  };

  const handleFastDataUpload = async (files: File[]) => {
    if (!files.length) return;
    saveCurrentProjectState();

    const selected = files.slice(0, 20);
    const parsed: Array<{ name: string; text: string }> = [];
    for (const [index, file] of selected.entries()) {
      const data = await ingestKnowledgeFile(file, `data-ingest:${Date.now()}:${index}:${file.name}`);
      const extracted = String(data?.extractedText || '').trim();
      const warning = String(data?.extractionWarning || '').trim();
      parsed.push({
        name: file.name,
        text: extracted || `[File accepted: ${file.name} · ${file.type || 'unknown type'} · ${file.size.toLocaleString()} bytes${warning ? ` · extraction warning: ${warning}` : ''}]`,
      });
    }

    const useful = parsed.filter((item) => item.text.trim());
    if (!useful.length) throw new Error('The selected files could not be registered for ingestion.');

    const combined = useful.length === 1
      ? useful[0].text
      : useful.map((item) => `===== ${item.name} =====\n\n${item.text}`).join('\n\n');
    const title = useful.length === 1
      ? useful[0].name.replace(/\.[^.]+$/, '') || 'Uploaded material'
      : `Data pack — ${new Date().toLocaleDateString('en-GB')}`;

    const nextBrief: ProjectBrief = {
      title,
      mode: 'adaptation',
      idea: useful.length === 1 ? `Data ingest: ${useful[0].name}` : `Data ingest: ${useful.length} source files`,
      tone: 'Preserve the source voice and evidential boundaries. Structure before embellishment.',
      output: 'Analyse, organise and turn the uploaded material into the strongest appropriate finished form.',
      audience: 'Determine from the source material and project intent.',
      targetWordCount: defaultTargetWordCount('adaptation'),
      createdAt: new Date().toISOString(),
    };

    setBrief(nextBrief);
    saveBrief(nextBrief);
    setProjectStatus('active');
    setDraftPage('');
    setManuscriptSource(combined);
    localStorage.setItem('caspa.whitePage', '');
    localStorage.setItem('caspa.manuscriptSource', combined);
    localStorage.removeItem('caspa.commission');
    localStorage.removeItem('caspa.commission.tab');
    clearShowBox();
    clearPlotHold();
    recordProjectSnapshot(nextBrief);
    persistActiveUserDatabase();
    goTo('workshop');
  };

  const runSidebarFastUpload = async (list: FileList | null) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    setSidebarFastUploading(true);
    try {
      await handleFastDataUpload(files);
    } finally {
      setSidebarFastUploading(false);
      if (sidebarFastUploadRef.current) sidebarFastUploadRef.current.value = '';
    }
  };

  const patchBrief = (patch: Partial<ProjectBrief>) => {
    const next = { ...brief, ...patch };
    setBrief(next);
    saveBrief(next);
  };

  const guidedNextStep = useMemo(
    () => getNextStep(brief, draftPage, manuscriptSource, projectStatus),
    [brief, draftPage, manuscriptSource, projectStatus]
  );

  const roomLabel = useMemo(() => {
    const all = [...primaryNav, ...advancedNav, ...studioNav];
    return all.find((n) => n.id === currentView)?.label;
  }, [currentView]);

  const showStageBar =
    hasActiveProject() &&
    currentView !== 'launchpad' &&
    currentView !== 'project' &&
    currentView !== 'library';

  const handleStageContinue = () => {
    if (guidedNextStep.id === 'complete_to_library') {
      handleCompleteProject();
      return;
    }
    goWorkflow(stepToNavTarget(guidedNextStep));
  };

  const renderView = () => {
    switch (currentView) {
      case 'launchpad':
        return <LaunchpadView onStart={startProject} onFastUpload={handleFastDataUpload} />;
      case 'project':
        return (
          <ProjectView
            brief={brief}
            draftPage={draftPage}
            manuscriptSource={manuscriptSource}
            projectStatus={projectStatus}
            onGo={goWorkflow}
            onBriefChange={patchBrief}
            onCompleteProject={handleCompleteProject}
          />
        );
      case 'write':
        return <WhitePageView brief={brief} draftPage={draftPage} setDraftPage={setDraftPage} setCurrentView={goTo} />;
      case 'quickwrite':
        return (
          <PageShell kicker="Auto write" title="Just write" subtitle="Seed a spine, then draft the whole book by chapter.">
            <QuickWrite
              brief={brief}
              draftPage={draftPage}
              onDraftChange={setDraftPage}
              onTargetWordCountChange={(n) => {
                const next = { ...brief, targetWordCount: n };
                setBrief(next);
                saveBrief(next);
              }}
              onGoPublish={() => goTo('publish')}
              onGoWorkshop={() => goTo('workshop')}
              onGoShowBox={() => goTo('showbox')}
            />
          </PageShell>
        );
      case 'showbox':
        return (
          <ShowBoxStudio
            brief={brief}
            draftPage={draftPage}
            onDraftChange={setDraftPage}
            onBriefChange={patchBrief}
            onOpenWorkshop={() => goTo('workshop')}
            onOpenWrite={() => goTo('write')}
            onOpenQuickWrite={() => goTo('quickwrite')}
            onOpenPublish={() => goTo('publish')}
            onOpenCanvas={() => goTo('canvas')}
          />
        );
      case 'design':
        return (
          <BookDesignStudio
            brief={brief}
            draftPage={draftPage}
            authorName={authContext.user?.displayName || ''}
            onDraftChange={setDraftPage}
          />
        );
      case 'bible':
        return (
          <StoryBibleStudio
            brief={brief}
            onOpenWorkshop={() => goTo('workshop')}
            onOpenPsychology={() => goTo('psychology')}
            onOpenResearch={() => goTo('research')}
            onOpenShowBox={() => goTo('showbox')}
          />
        );
      case 'workshop':
        return (
          <CommissionStudio
            brief={brief}
            draftPage={draftPage}
            initialTab={workshopTab}
            focusChapter={workshopFocusChapter}
            onDeepLinkConsumed={() => {
              setWorkshopTab(undefined);
              setWorkshopFocusChapter(null);
            }}
            onArtefactReady={(text, leave) => {
              setDraftPage(text);
              setManuscriptSource(text);
              if (leave === 'write') goTo('write');
              if (leave === 'quickwrite') goTo('quickwrite');
            }}
            onManuscriptChange={setManuscriptSource}
            onBriefChange={patchBrief}
          />
        );
      case 'redpen':
        return (
          <RedPenStudio
            brief={brief}
            draftPage={draftPage}
            onOpenWorkshop={() => goTo('workshop')}
          />
        );
      case 'gold':
        return <GoldRefinery brief={brief} draftPage={draftPage} setDraftPage={setDraftPage} />;
      case 'research':
        return <ResearchLibrary brief={brief} manuscriptText={manuscriptSource || draftPage} />;
      case 'library':
        return (
          <ProjectShelf
            brief={brief}
            onOpenWorkshop={() => goTo('workshop')}
            onOpenPublish={() => goTo('publish')}
            onExportProject={(key) => {
              const snap = switchToProject(key);
              if (snap) {
                reloadFromStorage();
                goTo('publish');
              }
            }}
            onSwitchProject={handleSwitchProject}
            onProjectCompleted={handleProjectCompleted}
            onNewProject={() => goTo('launchpad')}
          />
        );
      case 'psychology':
        return <PsychologyStudio brief={brief} manuscriptText={manuscriptSource || draftPage} />;
      case 'canvas':
        return (
          <StoryCanvas
            brief={brief}
            onCommission={(text) => {
              setManuscriptSource(text);
              goTo('workshop');
            }}
          />
        );
      case 'publish':
        return (
          <PublishPack
            brief={brief}
            authorEmail={authContext.user?.email}
            onGoWorkshop={() => goTo('workshop')}
            onGoDesign={() => goTo('design')}
            onGoShowBox={() => goTo('showbox')}
            onMoveToLibrary={handleCompleteProject}
          />
        );
      case 'settings':
        return <SettingsStudio userEmail={authContext.user?.email} userId={authContext.user?.uid} onFastUpload={handleFastDataUpload} />;
      case 'legal-cases':
        return <LegalCasesDashboard />;
      case 'betting-game':
        return <BettingGamePanel />;
      default:
        if (isStudioTool(currentView)) {
          return (
            <StudioToolBridge
              tool={currentView}
              brief={brief}
              draftPage={draftPage}
              onBriefChange={patchBrief}
              onDraftChange={(text) => {
                setDraftPage(text);
                setManuscriptSource(text);
              }}
              onNavigate={(legacy) => {
                const mapped = mapLegacyView(String(legacy));
                if (mapped) goTo(mapped);
              }}
            />
          );
        }
        return <LaunchpadView onStart={startProject} onFastUpload={handleFastDataUpload} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#f5efe5', color: '#172033' }}>
      <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="mobile-menu" style={{ position: 'fixed', top: 16, left: 16, zIndex: 60, border: '1px solid #e0d3bf', background: '#fffaf2', borderRadius: 12, padding: 10 }}>
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside style={{ width: 300, minWidth: 300, height: '100%', background: '#17120c', color: '#f8efe0', borderRight: '1px solid #2b2116', padding: '24px 18px', overflowY: 'auto', transform: mobileMenuOpen ? 'translateX(0)' : undefined }} className="caspa-sidebar">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 46, height: 46, borderRadius: 16, background: '#d6a846', color: '#1a1208', display: 'grid', placeItems: 'center' }}><Sparkles size={24} /></div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>Caspa</div>
            <div style={{ color: '#c9b898', fontSize: 13 }}>Make the thing first. Tools second.</div>
          </div>
        </div>

        <div style={{ marginBottom: 20, padding: '0 8px', fontSize: 12, color: '#a89572', lineHeight: 1.5 }}>
          One step at a time. Advanced rooms stay tucked away until you need them.
        </div>

        <div style={{ marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => sidebarFastUploadRef.current?.click()}
            disabled={sidebarFastUploading}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, border: '1px solid #d6a846', borderRadius: 14, padding: '12px 14px', background: '#d6a846', color: '#1d1408', fontWeight: 900, cursor: 'pointer' }}
          >
            {sidebarFastUploading ? <Loader size={17} className="spin" /> : <UploadCloud size={17} />}
            {sidebarFastUploading ? 'Ingesting…' : 'Data Ingest'}
          </button>
          <input
            ref={sidebarFastUploadRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(event) => runSidebarFastUpload(event.target.files)}
          />
          <div style={{ color: '#8f8068', fontSize: 10, lineHeight: 1.35, marginTop: 6, padding: '0 4px', textAlign: 'center' }}>
            Any file type → extract/transcribe/index where possible
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, color: '#8f8068', margin: '0 8px 8px' }}>Your work</div>
          {primaryNavFor(brief).map((item) => {
            const Icon = item.icon;
            const active = item.id === currentView;
            return (
              <button key={item.id} onClick={() => goTo(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: 'none', borderRadius: 16, padding: '12px 12px', marginBottom: 6, cursor: 'pointer', textAlign: 'left', background: active ? '#2f2415' : 'transparent', color: active ? '#ffe2a5' : '#f8efe0' }}>
                <Icon size={18} />
                <span>
                  <strong style={{ display: 'block', fontSize: 14 }}>{item.label}</strong>
                  <small style={{ color: active ? '#d6a846' : '#9b8c73' }}>{item.detail}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: 'transparent', color: '#9b8c73', padding: '8px 12px', cursor: 'pointer', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4 }}
          >
            Rooms
            {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {advancedOpen && advancedNav.map((item) => {
            const Icon = item.icon;
            const active = item.id === currentView;
            return (
              <button key={item.id} onClick={() => goTo(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: 'none', borderRadius: 16, padding: '10px 12px', marginBottom: 4, cursor: 'pointer', textAlign: 'left', background: active ? '#2f2415' : 'transparent', color: active ? '#ffe2a5' : '#c9b898' }}>
                <Icon size={16} />
                <span>
                  <strong style={{ display: 'block', fontSize: 13 }}>{item.label}</strong>
                  <small style={{ color: active ? '#d6a846' : '#7a6d58', fontSize: 11 }}>{item.detail}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => setStudioOpen(!studioOpen)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: 'transparent', color: '#9b8c73', padding: '8px 12px', cursor: 'pointer', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4 }}
          >
            Literary engine
            {studioOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {studioOpen && studioNav.map((item) => {
            const Icon = item.icon;
            const active = item.id === currentView;
            return (
              <button key={item.id} onClick={() => goTo(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: 'none', borderRadius: 16, padding: '10px 12px', marginBottom: 4, cursor: 'pointer', textAlign: 'left', background: active ? '#2f2415' : 'transparent', color: active ? '#ffe2a5' : '#c9b898' }}>
                <Icon size={16} />
                <span>
                  <strong style={{ display: 'block', fontSize: 13 }}>{item.label}</strong>
                  <small style={{ color: active ? '#d6a846' : '#7a6d58', fontSize: 11 }}>{item.detail}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, color: '#8f8068', margin: '0 8px 8px' }}>Omni Tools</div>
          {omniToolNav.map((item) => {
            const Icon = item.icon;
            const active = item.id === currentView;
            return (
              <button key={item.id} onClick={() => goTo(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: 'none', borderRadius: 16, padding: '10px 12px', marginBottom: 4, cursor: 'pointer', textAlign: 'left', background: active ? '#2f2415' : 'transparent', color: active ? '#ffe2a5' : '#c9b898' }}>
                <Icon size={16} />
                <span>
                  <strong style={{ display: 'block', fontSize: 13 }}>{item.label}</strong>
                  <small style={{ color: active ? '#d6a846' : '#7a6d58', fontSize: 11 }}>{item.detail}</small>
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ borderTop: '1px solid #332719', paddingTop: 16, fontSize: 12, color: '#a89572' }}>
          <div style={{ marginBottom: 12 }}>{isLocalGuest(authContext.user) ? 'Local workspace' : authContext.user?.email || 'Private workspace'}</div>
          <button onClick={authContext.signOut} style={{ ...ghostButton, width: '100%', justifyContent: 'center', color: '#ffccc6', borderColor: '#5b2a22' }}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="custom-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {renderView()}
        </div>
        {showStageBar ? (
          <WorkflowStageBar
            nextStep={guidedNextStep}
            roomLabel={roomLabel}
            onBack={() => goTo('project')}
            onContinue={handleStageContinue}
          />
        ) : null}
      </main>

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

function LaunchpadView({ onStart, onFastUpload }: {
  onStart: (mode: CreativeMode, idea: string, tone: string, output: string, audience: string, targetWordCount?: number) => void;
  onFastUpload: (files: File[]) => Promise<void>;
}) {
  const [mode, setMode] = useState<CreativeMode>('novel');
  const [idea, setIdea] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [showBriefDetails, setShowBriefDetails] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState(defaultTargetWordCount('novel'));
  const [tone, setTone] = useState('Sharp, vivid, structurally solid.');
  const [output, setOutput] = useState('Full manuscript: draft every held chapter in order to the aspire-to word count.');
  const [audience, setAudience] = useState('Literary / general readers.');
  const [fastUploading, setFastUploading] = useState(false);
  const [fastUploadError, setFastUploadError] = useState('');
  const fastUploadRef = useRef<HTMLInputElement | null>(null);

  const runFastUpload = async (list: FileList | null) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    setFastUploading(true);
    setFastUploadError('');
    try {
      await onFastUpload(files);
    } catch (error) {
      setFastUploadError(error instanceof Error ? error.message : 'Fast upload failed.');
    } finally {
      setFastUploading(false);
      if (fastUploadRef.current) fastUploadRef.current.value = '';
    }
  };

  const selected = modeCards.find((card) => card.mode === mode)!;
  const SelectedIcon = selected.icon;
  const heroCards = modeCards.filter((c) => c.hero);
  const moreCards = modeCards.filter((c) => !c.hero);

  const defaultsFor = (m: CreativeMode) => {
    if (m === 'picture') {
      return {
        tone: 'Warm, concrete, image-led, read-aloud friendly.',
        output: '32-page picture book with wraparound cover.',
        audience: 'Children 3–5 and the adults who read with them.',
      };
    }
    if (m === 'gold') {
      return {
        tone: 'Preserve the author voice. Sharpen only.',
        output: 'Polished manuscript ready for export.',
        audience: 'Same readers as the source draft.',
      };
    }
    if (m === 'nonfiction') {
      return {
        tone: 'Clear, concrete, earned authority. No fake profundity.',
        output: 'Full manuscript: draft every held chapter/section in order to the aspire-to word count.',
        audience: 'General informed readers (or name the niche).',
      };
    }
    if (m === 'essay') {
      return {
        tone: 'Sharp, personal where useful, argument-led.',
        output: 'Finished essay / article / column draft to the aspire-to word count.',
        audience: 'Magazine, Substack, or newspaper readers.',
      };
    }
    if (m === 'poetry') {
      return {
        tone: 'Compressed, musical, image before explanation.',
        output: 'Poem, sequence, or short pamphlet.',
        audience: 'Readers of contemporary poetry / live audience.',
      };
    }
    if (m === 'musical') {
      return {
        tone: 'Theatrical, melodic, witty, with a proper hook.',
        output: 'Show in a box: book, song list, running order, music sketch, cast doubles, production pack.',
        audience: 'Actors, MD, director, producer — a company that can open the box and rehearse.',
      };
    }
    if (m === 'script') {
      return {
        tone: 'Spoken, actable, scene-turn hungry.',
        output: 'Full script draft: every held scene in order.',
        audience: 'Actors, directors, producers.',
      };
    }
    return {
      tone: 'Sharp, vivid, structurally solid.',
      output: 'Full manuscript: draft every held chapter in order to the aspire-to word count.',
      audience: 'Literary / general readers.',
    };
  };

  const applyModeDefaults = (m: CreativeMode) => {
    const d = defaultsFor(m);
    setTone(d.tone);
    setOutput(d.output);
    setAudience(d.audience);
    setTargetWordCount(defaultTargetWordCount(m));
  };

  const launch = () => {
    onStart(mode, idea, tone, output, audience, targetWordCount);
  };

  const ctaLabel =
    mode === 'picture'
      ? 'Open Design'
      : mode === 'musical'
        ? 'Open Show in a Box'
        : mode === 'gold'
          ? 'Open Gold'
          : mode === 'script'
            ? 'Start script'
            : mode === 'nonfiction' || mode === 'essay'
              ? 'Start non-fiction'
              : mode === 'poetry'
                ? 'Start poem'
                : 'Start writing';

  return (
    <section style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at top left, #fff7e6 0, #f5efe5 36%, #e9dfcf 100%)' }}>
      <div className="custom-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '54px clamp(24px, 5vw, 72px) 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ borderRadius: 34, padding: '42px clamp(24px, 4vw, 48px)', background: '#17120c', color: '#fffaf2', boxShadow: '0 30px 90px rgba(23,18,12,.24)', marginBottom: 24 }}>
          <div style={{ color: '#d6a846', fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', fontSize: 12, marginBottom: 16 }}>Caspa</div>
          <h1 style={{ fontSize: 'clamp(40px, 7vw, 72px)', lineHeight: .9, margin: 0, letterSpacing: -2.5 }}>What are we making?</h1>
          <p style={{ maxWidth: 640, color: '#d7c8aa', fontSize: 18, lineHeight: 1.5, marginTop: 18 }}>
            Fiction is one door. Non-fiction, picture books, a show in a box — pick the form first.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              onClick={() => fastUploadRef.current?.click()}
              disabled={fastUploading}
              style={{ ...primaryButton('#d6a846', '#1d1408'), width: 'auto', padding: '12px 16px' }}
            >
              {fastUploading ? <Loader size={17} className="spin" /> : <UploadCloud size={17} />}
              {fastUploading ? 'Reading data…' : 'Fast Data Upload'}
            </button>
            <span style={{ alignSelf: 'center', color: '#a89572', fontSize: 12 }}>PDF · TXT · MD · RTF · HTML · JSON · YAML · CSV · up to 20 files</span>
            <input
              ref={fastUploadRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(event) => runFastUpload(event.target.files)}
            />
          </div>
          {fastUploadError ? <p style={{ margin: '10px 0 0', color: '#ffb4aa', fontSize: 13 }}>{fastUploadError}</p> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 28 }}>
            {heroCards.map((card) => {
              const Icon = card.icon;
              const active = card.mode === mode;
              return (
                <button
                  key={card.mode}
                  onClick={() => {
                    setMode(card.mode);
                    applyModeDefaults(card.mode);
                  }}
                  style={{ border: `2px solid ${active ? '#d6a846' : '#3a2d1d'}`, background: active ? '#2b2115' : '#21180f', color: '#fffaf2', borderRadius: 20, padding: 20, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Icon size={26} style={{ color: '#d6a846', marginBottom: 12 }} />
                  <strong style={{ display: 'block', marginBottom: 6, fontSize: 18 }}>{card.title}</strong>
                  <small style={{ color: '#c4b18b', lineHeight: 1.4 }}>{card.subtitle}</small>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setShowMore(!showMore)} style={{ marginTop: 18, background: 'transparent', border: 'none', color: '#a89572', cursor: 'pointer', fontSize: 13 }}>
            {showMore ? 'Hide other formats' : 'More formats (script, essay, poetry, adaptation…)'}
          </button>
          {showMore && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 12 }}>
              {moreCards.map((card) => {
                const Icon = card.icon;
                const active = card.mode === mode;
                return (
                  <button
                    key={card.mode}
                    onClick={() => {
                      setMode(card.mode);
                      applyModeDefaults(card.mode);
                    }}
                    style={{ border: `1px solid ${active ? '#d6a846' : '#3a2d1d'}`, background: active ? '#2b2115' : '#1a140e', color: '#fffaf2', borderRadius: 16, padding: 14, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <Icon size={18} style={{ color: '#d6a846', marginBottom: 8 }} />
                    <strong style={{ display: 'block', fontSize: 14 }}>{card.title}</strong>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ borderRadius: 28, padding: 28, ...surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: '#fff3d5', color: '#7a5514', display: 'grid', placeItems: 'center' }}><SelectedIcon size={24} /></div>
            <div>
              <div style={{ color: '#8a6a28', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{selected.title}</div>
              <h2 style={{ margin: 0, fontSize: 24 }}>One idea is enough</h2>
            </div>
          </div>

          <Field label="Idea / premise">
            <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} style={textareaStyle} placeholder={selected.examples[0] || 'Start with a wound, a place, a desire…'} />
          </Field>

          <Field label="Aspire-to word count">
            <input
              type="number"
              min={100}
              step={500}
              value={targetWordCount}
              onChange={(e) => setTargetWordCount(Math.max(100, Number(e.target.value) || 100))}
              style={{ ...textareaStyle, minHeight: 0, padding: '12px 14px' }}
            />
          </Field>

          <button
            type="button"
            onClick={() => setShowBriefDetails(!showBriefDetails)}
            style={{ background: 'transparent', border: 'none', color: '#8a6a28', cursor: 'pointer', fontSize: 13, fontWeight: 700, marginBottom: 10, padding: 0 }}
          >
            {showBriefDetails ? 'Hide tone / audience / output' : 'Tune tone, audience & output (optional)'}
          </button>
          {showBriefDetails && (
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <Field label="Tone">
                <textarea value={tone} onChange={(e) => setTone(e.target.value)} rows={2} style={textareaStyle} />
              </Field>
              <Field label="Audience">
                <textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={2} style={textareaStyle} />
              </Field>
              <Field label="Required output">
                <textarea value={output} onChange={(e) => setOutput(e.target.value)} rows={2} style={textareaStyle} />
              </Field>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {selected.examples.map((example) => <button key={example} onClick={() => setIdea(example)} style={chipButton}>{example}</button>)}
          </div>

          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#73695d', lineHeight: 1.45 }}>
            {mode === 'picture'
              ? 'Creates the project and opens Design for spreads & covers.'
              : mode === 'musical'
                ? 'Creates the project and opens Show in a Box — songs, running order, music sketch, production pack.'
                : mode === 'gold'
                  ? 'Creates the project and opens Gold Refinery to polish pasted text.'
                  : mode === 'script'
                    ? 'Creates the project and opens guided next steps for an actable script.'
                    : 'Creates the project and opens your guided next step (Just write → Workshop diagnose → commission).'}
          </p>

        </div>
      </div>
      </div>

      {/* Always-visible footer so the primary step is reachable without hunting/scrolling. */}
      <div
        style={{
          flexShrink: 0,
          borderTop: '1px solid #e3d8c4',
          background: 'rgba(23,18,12,0.97)',
          color: '#fffaf2',
          boxShadow: '0 -10px 40px rgba(23,18,12,0.28)',
          padding: '14px clamp(24px, 5vw, 72px)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: '#d7c8aa' }}>
            {idea.trim() ? (
              <>
                <strong style={{ color: '#fffaf2' }}>{selected.title}</strong> · ready when you are
              </>
            ) : (
              'Pick a form and add an idea to begin'
            )}
          </span>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fastUploadRef.current?.click()}
              disabled={fastUploading}
              style={{ ...ghostButton, color: '#ffe2a5', borderColor: '#6b5430', background: '#21180f' }}
            >
              <UploadCloud size={17} /> Fast Data Upload
            </button>
            <button
              onClick={launch}
              style={{ ...primaryButton('#d6a846', '#1d1408'), width: 'auto', padding: '14px 24px', fontSize: 16 }}
            >
              <Sparkles size={19} /> {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectView({
  brief,
  draftPage,
  manuscriptSource,
  projectStatus,
  onGo,
  onBriefChange,
  onCompleteProject,
}: {
  brief: ProjectBrief;
  draftPage: string;
  manuscriptSource: string;
  projectStatus: 'active' | 'complete';
  onGo: (target: WorkflowNavTarget) => void;
  onBriefChange: (patch: Partial<ProjectBrief>) => void;
  onCompleteProject: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftBrief, setDraftBrief] = useState(brief);

  useEffect(() => {
    setDraftBrief(brief);
  }, [brief]);

  const steps = useMemo(
    () => getWorkflowSteps(brief, draftPage, manuscriptSource, projectStatus),
    [brief, draftPage, manuscriptSource, projectStatus]
  );
  const nextStep = useMemo(
    () => getNextStep(brief, draftPage, manuscriptSource, projectStatus),
    [brief, draftPage, manuscriptSource, projectStatus]
  );
  const progress = useMemo(
    () => getProgressSummary(brief, draftPage, manuscriptSource, projectStatus),
    [brief, draftPage, manuscriptSource, projectStatus]
  );

  const saveEdits = () => {
    onBriefChange({
      title: draftBrief.title.trim() || brief.title,
      idea: draftBrief.idea,
      tone: draftBrief.tone,
      output: draftBrief.output,
      audience: draftBrief.audience,
      targetWordCount: Math.max(100, Number(draftBrief.targetWordCount) || defaultTargetWordCount(brief.mode)),
    });
    setEditing(false);
  };

  return (
    <PageShell
      kicker="Guided workflow"
      title={brief.title}
      subtitle={`${modeLabels[brief.mode] || brief.mode} · ${projectStatus === 'complete' ? 'In library' : 'Active project'} · ${formatDate(brief.createdAt)}`}
    >
      <GuidedNextStep
        step={nextStep}
        progress={progress}
        onGo={onGo}
        onComplete={onCompleteProject}
        briefTitle={brief.idea}
      />

      {(brief.mode === 'musical' || hasShowBoxContent()) && (
        <ShowCommandCenter bookWords={countWords(draftPage || manuscriptSource)} onGo={onGo} />
      )}

      <div style={cardGrid}>
        <article style={{ ...cardStyle, gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ ...sectionTitle, margin: 0 }}>Brief</h2>
            {!editing ? (
              <button type="button" onClick={() => setEditing(true)} style={ghostButton}>
                <Pencil size={16} /> Edit brief
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setDraftBrief(brief); setEditing(false); }} style={ghostButton}>
                  Cancel
                </button>
                <button type="button" onClick={saveEdits} style={{ ...primaryButton('#d6a846', '#1d1408'), width: 'auto', padding: '11px 14px' }}>
                  <Check size={16} /> Save brief
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              <Field label="Title">
                <input
                  value={draftBrief.title}
                  onChange={(e) => setDraftBrief({ ...draftBrief, title: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Idea / premise">
                <textarea
                  value={draftBrief.idea}
                  onChange={(e) => setDraftBrief({ ...draftBrief, idea: e.target.value })}
                  rows={4}
                  style={textareaStyle}
                />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <Field label="Tone">
                  <textarea value={draftBrief.tone} onChange={(e) => setDraftBrief({ ...draftBrief, tone: e.target.value })} rows={3} style={textareaStyle} />
                </Field>
                <Field label="Output">
                  <textarea value={draftBrief.output} onChange={(e) => setDraftBrief({ ...draftBrief, output: e.target.value })} rows={3} style={textareaStyle} />
                </Field>
                <Field label="Audience">
                  <textarea value={draftBrief.audience} onChange={(e) => setDraftBrief({ ...draftBrief, audience: e.target.value })} rows={3} style={textareaStyle} />
                </Field>
                <Field label="Aspire-to words">
                  <input
                    type="number"
                    min={100}
                    step={500}
                    value={draftBrief.targetWordCount}
                    onChange={(e) => setDraftBrief({ ...draftBrief, targetWordCount: Math.max(100, Number(e.target.value) || 100) })}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
          ) : (
            <>
              <p style={bigText}>{brief.idea}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 24 }}>
                <MiniPanel label="Tone" value={brief.tone} />
                <MiniPanel label="Output" value={brief.output} />
                <MiniPanel label="Audience" value={brief.audience} />
                <MiniPanel
                  label="Words"
                  value={`${countWords(draftPage).toLocaleString()} now · ${(brief.targetWordCount || defaultTargetWordCount(brief.mode)).toLocaleString()} aspire-to`}
                />
              </div>
            </>
          )}
        </article>
        <WorkflowChecklist steps={steps} onGo={onGo} />
      </div>
    </PageShell>
  );
}

function WhitePageView({ brief, draftPage, setDraftPage, setCurrentView }: { brief: ProjectBrief; draftPage: string; setDraftPage: (value: string) => void; setCurrentView: (view: ViewType) => void }) {
  const current = countWords(draftPage);
  const target = brief.targetWordCount || defaultTargetWordCount(brief.mode);
  const showLive = brief.mode === 'musical' || hasShowBoxContent();
  return (
    <div style={{ minHeight: '100vh', background: '#ede4d6', padding: '42px clamp(18px, 4vw, 64px)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <div style={kickerStyle}>White Page</div>
            <h1 style={{ margin: 0, fontSize: 38 }}>Write here</h1>
            <p style={{ margin: '8px 0 0', color: '#73695d' }}>
              {brief.title} — {current.toLocaleString()} / {target.toLocaleString()} words · when you have enough text, Workshop diagnoses it.
            </p>
          </div>
          <button onClick={() => setCurrentView('project')} style={primaryButton('#1f2937', '#fff')}><Home size={18} /> Back to next step</button>
        </div>
        {showLive && (
          <div style={{ marginBottom: 14, borderRadius: 16, padding: '12px 14px', border: '1px solid #eadfce', background: '#fff8ea', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: '#5b4724' }}>
              Show in a Box is live — keep book scenes turning into the locked song list and running order.
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setCurrentView('showbox')} style={{ ...ghostButton, background: '#fffaf2' }}>
                <Music2 size={16} /> Show Box
              </button>
              <button type="button" onClick={() => setCurrentView('quickwrite')} style={{ ...ghostButton, background: '#fffaf2' }}>
                <Zap size={16} /> Just write
              </button>
              <button type="button" onClick={() => setCurrentView('workshop')} style={{ ...ghostButton, background: '#fffaf2' }}>
                <Hammer size={16} /> Workshop
              </button>
            </div>
          </div>
        )}
        <textarea value={draftPage} onChange={(e) => setDraftPage(e.target.value)} placeholder="Start writing here. Scene, chapter, song brief, treatment, argument, joke list, anything. This is deliberately white and boring so the work gets loud." style={{ width: '100%', minHeight: '72vh', border: '1px solid #dfd3c0', borderRadius: 10, padding: '42px clamp(22px, 5vw, 72px)', fontSize: 20, lineHeight: 1.75, color: '#111827', background: '#ffffff', boxShadow: '0 24px 90px rgba(40, 29, 12, .10)', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'Georgia, Cambria, serif' }} />
      </div>
    </div>
  );
}

function SimpleWorkspace({ title, text }: { title: string; text: string }) {
  return <PageShell kicker="Workspace" title={title} subtitle={text}><article style={cardStyle}><p style={bigText}>This room is now placed correctly in the product. Next pass can wire its live functions.</p></article></PageShell>;
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

  const acceptUser = (nextUser: User) => {
    activateUserDatabase(nextUser.uid);
    if (nextUser.email) localStorage.setItem('currentUserEmail', nextUser.email);
    setUser(nextUser);
  };

  useEffect(() => {
    try {
      if (localStorage.getItem(LOCAL_GUEST_KEY) === '1') {
        acceptUser(createLocalGuest());
        setAuthLoading(false);
        return;
      }
    } catch {
      /* ignore */
    }

    const checkAuth = async () => {
      try {
        const { initializeApp } = await import('firebase/app');
        const { getAuth, onAuthStateChanged } = await import('firebase/auth');

        const firebaseConfig = {
          apiKey: firebaseAppletConfig.apiKey,
          authDomain: firebaseAppletConfig.authDomain,
          projectId: firebaseAppletConfig.projectId,
          storageBucket: firebaseAppletConfig.storageBucket,
          messagingSenderId: firebaseAppletConfig.messagingSenderId,
          appId: firebaseAppletConfig.appId,
        };

        try {
          initializeApp(firebaseConfig);
        } catch {
          // Already initialised.
        }

        const unsubscribe = onAuthStateChanged(getAuth(), (firebaseUser) => {
          if (firebaseUser) {
            acceptUser({ uid: firebaseUser.uid, email: firebaseUser.email || '', displayName: firebaseUser.displayName || '' });
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
      clearCloudCredentialsForScope();
      persistActiveUserDatabase();
      deactivateUserDatabase(user?.uid);
    } catch (error) {
      console.warn('Could not fully unmount user database during sign-out:', error);
    }
    try {
      localStorage.removeItem(LOCAL_GUEST_KEY);
    } catch {
      /* ignore */
    }
    if (isLocalGuest(user)) {
      setUser(null);
      return;
    }
    try {
      const { getAuth, signOut } = await import('firebase/auth');
      await signOut(getAuth());
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
      setUser(null);
    }
  };

  if (authLoading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#17120c', color: '#fffaf2' }}><div style={{ textAlign: 'center' }}><Loader size={46} className="spin" /><p>Loading Caspa...</p></div></div>;
  }

  if (!user) return <CaspaLogin onLoginSuccess={acceptUser} />;

  return (
    <AuthContext.Provider value={{ user, loading: authLoading, signOut: handleSignOut }}>
      <CaspaUI />
    </AuthContext.Provider>
  );
}
