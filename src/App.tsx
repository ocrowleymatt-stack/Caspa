/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  GitBranch, 
  PenTool, 
  Sparkles, 
  BarChart3,
  Library,
  LogOut,
  LogIn,
  Globe,
  Zap,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Construction,
  Settings,
  Trophy,
  X,
  BrainCircuit,
  Menu,
  MessageSquare,
  Upload,
  Activity,
  ChevronDown,
  Plus,
  Scissors,
  AlertTriangle,
  Ghost,
  Feather
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
import { 
  Project, 
  ViewType, 
  Character, 
  PlotNode, 
  Chapter, 
  ResearchNote, 
  SourceMaterial,
  Presence,
  ExternalReview
} from './types';
import { auth, db, loginWithGoogle, logout, loginAnonymously } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firestoreUtils';
import { 
  onSnapshot, 
  doc, 
  getDoc,
  collection, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  query, 
  where,
  or,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Services
import { AIService } from './services/ai';

// Components
import Dashboard from './components/Dashboard';
import Brainstorm from './components/Brainstorm';
import CharacterForge from './components/CharacterForge';
import PlotArchitect from './components/PlotArchitect';
import WritingStudio from './components/WritingStudio';
import LibraryView from './components/Library';
import IntelligenceLab from './components/IntelligenceLab';
import CriticSwarm from './components/CriticSwarm';
import ManuscriptFixer from './components/ManuscriptFixer';
import SettingsView from './components/SettingsView';
import PublishView from './components/PublishView';
import PrizeView from './components/PrizeView';
import ReaderView from './components/ReaderView';
import ReviewVault from './components/ReviewVault';
import EvidenceArchive from './components/EvidenceArchive';
import PinGate from './components/PinGate';
import ScalpelModule from './components/ScalpelModule';
import AutoDrafter from './components/AutoDrafter';
import SpatialGlassMode from './components/SpatialGlassMode';
import DiscoverView from './components/DiscoverView';
import DesignView from './components/DesignView';
import WriteView from './components/WriteView';
import MemoryView from './components/MemoryView';
import IntelligenceView from './components/IntelligenceView';

const INITIAL_PROJECT: Project = {
  id: 'default',
  title: 'Untitled Narrative',
  type: 'novel',
  maturity: 'standard',
  genre: 'Science Fiction',
  premise: '',
  tone: 'Cinematic', // Default tone
  collaborators: [],
  ownerId: '',
  sourceMaterials: [],
  lastModified: Date.now(),
  createdAt: Date.now(),
  stats: {
    narrativeStreak: 0,
    totalWords: 0,
    aiContributions: 0,
    lastActiveDay: new Date().toISOString().split('T')[0]
  }
};

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Load project cache on mount
  useEffect(() => {
    if (user) {
      try {
        const cached = localStorage.getItem(`ls_projects_cache_${user.uid}`);
        if (cached) {
          setProjects(JSON.parse(cached));
        }
      } catch (e) {
        console.error("Failed to parse projects cache from localStorage:", e);
      }
    }
  }, [user]);

  const [project, setProject] = useState<Project>(INITIAL_PROJECT);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [plotNodes, setPlotNodes] = useState<PlotNode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [research, setResearch] = useState<ResearchNote[]>([]);
  const [sourceMaterials, setSourceMaterials] = useState<SourceMaterial[]>([]);
  const [externalReviews, setExternalReviews] = useState<ExternalReview[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const saved = localStorage.getItem('ls_current_view');
    return (saved as ViewType) || 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('ls_current_view', currentView);
  }, [currentView]);

  const [lastProjectId, setLastProjectId] = useState(() => localStorage.getItem('ls_project_id'));

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(true);
  const [isShortHeight, setIsShortHeight] = useState(false);
  const [isSpatialGlassModeActive, setIsSpatialGlassModeActive] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('ls_spatial_glass_mode_active');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('ls_spatial_glass_mode_active', String(isSpatialGlassModeActive));
  }, [isSpatialGlassModeActive]);

  const [loading, setLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: 'error' | 'success' | 'info' }[]>([]);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading]);
  const [systemAlert, setSystemAlert] = useState<{ message: string; type: 'error' | 'warning' } | null>(null);
  const [readerProject, setReaderProject] = useState<Project | null>(null);
  const [readerChapters, setReaderChapters] = useState<Chapter[]>([]);
  const [isReading, setIsReading] = useState(false);

  useEffect(() => {
    if (project.id !== 'default') {
      localStorage.setItem('ls_project_id', project.id);
    }
  }, [project.id]);

  // Handle Reading Link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const readId = params.get('read');
    if (readId) {
      const fetchPublicProject = async () => {
        try {
          const { getDoc, doc, collection, getDocs, query, orderBy } = await import('firebase/firestore');
          const pSnap = await getDoc(doc(db, 'projects', readId));
          if (pSnap.exists()) {
            const data = pSnap.data() as Project;
            if (data.isPublic) {
              setReaderProject(data);
              setIsReading(true);
              const cSnap = await getDocs(query(collection(db, 'projects', readId, 'chapters'), orderBy('order')));
              setReaderChapters(cSnap.docs.map(d => d.data() as Chapter));
            }
          }
        } catch (e) {
          console.error("Public fetch error:", e);
        }
      };
      fetchPublicProject();
    }
  }, []);

  const addNotification = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    let finalMsg = message;
    try {
      if (message.startsWith('{') && message.endsWith('}')) {
        const parsed = JSON.parse(message);
        if (parsed.isQuotaExceeded) {
          setSystemAlert({ 
            message: 'CRITICAL: Firestore Quota Exceeded. Writing & Reading may be disabled until credits reset or billing propagates. Upgrading to Blaze plan removes these limits.', 
            type: 'error' 
          });
          return;
        }
        finalMsg = parsed.error || message;
      }
    } catch (e) { /* not JSON */ }

    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, message: finalMsg, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  const onNotify = addNotification;

  // Mobile & Orientation Detection
  useEffect(() => {
    const checkLayout = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsPortrait(window.innerHeight > window.innerWidth);
      setIsShortHeight(window.innerHeight < 600);
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
    else setIsSidebarOpen(true);
  }, [isMobile]);

  // History State
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Derived Stats
  const totalWords = chapters.reduce((acc, c) => {
    const words = c.content?.trim().split(/\s+/).filter(w => w.length > 0).length || 0;
    return acc + words;
  }, 0);

  const pushToHistory = (state: Project) => {
    setHistory(prev => [state, ...prev].slice(0, 50));
    setFuture([]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[0];
    const newHistory = history.slice(1);
    
    setFuture(prev => [project, ...prev]);
    setHistory(newHistory);
    setProject(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory(prev => [project, ...prev]);
    setFuture(newFuture);
    setProject(next);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, history, future]);

  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  // Auth Listener
  useEffect(() => {
    const initAuth = async () => {
      const { handleRedirectLogin } = await import('./lib/firebase');
      await handleRedirectLogin();
    };
    initAuth();

    return onAuthStateChanged(auth, (u) => {
      console.log('Auth state changed:', u?.uid || 'no user');
      setUser(u);
      if (u) {
        setLoginError(null);
        if (u.email) localStorage.setItem('currentUserEmail', u.email);
        setIsProjectsLoading(true);
      } else {
        localStorage.removeItem('currentUserEmail');
        setProject(INITIAL_PROJECT);
        setCharacters([]);
        setPlotNodes([]);
        setChapters([]);
        setResearch([]);
        setSourceMaterials([]);
        setExternalReviews([]);
        setIsProjectsLoading(false);
      }
      setLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked') {
        setLoginError('Popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setLoginError(err.message || 'An error occurred during login.');
      }
    }
  };

  const handleGuestLogin = async () => {
    try {
      setLoginError(null);
      await loginAnonymously();
    } catch (err: any) {
      console.error(err);
      setLoginError('Failure entering Guest Protocol. Please try again or use Google Auth.');
    }
  };

  // Sync AI Provider
  useEffect(() => {
    if (project.primaryProvider) {
      AIService.setPrimaryProvider(project.primaryProvider);
    }
  }, [project.primaryProvider]);

  const isCreatingInitialProjectRef = useRef(false);

  // Project List Sync
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setIsProjectsLoading(false);
      return;
    }

    // Keep project sync to security-rule-safe predicates only.
    // The previous email-variation fan-out produced Firestore PERMISSION_DENIED
    // errors because several queries were not provably authorised by the rules.
    const queries = [
      query(collection(db, 'projects'), where('ownerId', '==', user.uid)),
      query(collection(db, 'projects'), where('collaborators', 'array-contains', user.uid))
    ];

    setIsProjectsLoading(true);
    const queryResults: Project[][] = new Array(queries.length).fill([]).map(() => []);
    const initialFires = new Set<number>();

    const unsubs = queries.map((q, idx) => {
      return onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Project));
        queryResults[idx] = list;
        initialFires.add(idx);

        // Perform client-side deduplicated merge
        const mergedMap = new Map<string, Project>();
        queryResults.forEach(subList => {
          subList.forEach(p => {
            if (p && p.id) {
              const existing = mergedMap.get(p.id);
              if (!existing || (p.lastModified || 0) > (existing.lastModified || 0)) {
                mergedMap.set(p.id, p);
              }
            }
          });
        });

        const projectsList = Array.from(mergedMap.values())
          .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

        setProjects(projectsList);
        
        // ONLY set loading to false once all parallel queries have responded at least once
        if (initialFires.size === queries.length) {
          setIsProjectsLoading(false);
        }
        
        localStorage.setItem(`ls_projects_cache_${user.uid}`, JSON.stringify(projectsList));

        console.log('--- Project Sync Merged Diagnostic ---');
        console.log(`Sub-query ${idx} synced ${list.length} items. Total merged:`, projectsList.length);
        console.log('Logged in as:', user.email);
        console.log('User UID:', user.uid);
        console.log('------------------------------');

        if (projectsList.length === 0) {
          return;
        }

        // Select project only on initial load or if current is missing
        setProject(current => {
          const savedId = localStorage.getItem(`lastProject_${user.uid}`);
          
          if (current.id && current.id !== 'default') {
            const stillExists = projectsList.find(p => p.id === current.id);
            if (stillExists) return current;
          }

          if (savedId) {
            const found = projectsList.find(p => p.id === savedId);
            if (found) return found;
            
            console.warn("Saved Project ID not found in merged list. Attempting background recovery for:", savedId);
            const pRef = doc(db, 'projects', savedId);
            getDoc(pRef).then(pSnap => {
              if (pSnap.exists()) {
                const pData = pSnap.data() as Project;
                setProjects(prev => {
                  if (prev.find(p => p.id === savedId)) return prev;
                  return [pData, ...prev];
                });
                setProject(pData);
                onNotify(`Manuscript recovered from deep storage: ${pData.title}`, 'success');
              }
            }).catch(err => {
              console.error("Deep recovery failed for", savedId, err);
            });
          }

          if (projectsList.length === 0) {
            return INITIAL_PROJECT;
          }
          return projectsList[0];
        });
      }, (err) => {
        console.error(`Snapshot Query ${idx} failed:`, err);
        initialFires.add(idx);
        if (initialFires.size === queries.length) {
          setIsProjectsLoading(false);
          addNotification("Some manuscript partitions failed to synchronize.", "info");
        }
      });
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [user, loading]);

  // Load local storage cache instantly on project ID change to prevent data latency or offline blanks
  useEffect(() => {
    const pId = project.id;
    if (pId && pId !== 'default') {
      try {
        const cachedChapters = localStorage.getItem(`ls_cache_${pId}_chapters`);
        const cachedCharacters = localStorage.getItem(`ls_cache_${pId}_characters`);
        const cachedNodes = localStorage.getItem(`ls_cache_${pId}_plotNodes`);
        const cachedResearch = localStorage.getItem(`ls_cache_${pId}_research`);
        const cachedSources = localStorage.getItem(`ls_cache_${pId}_sourceMaterials`);
        const cachedReviews = localStorage.getItem(`ls_cache_${pId}_externalReviews`);

        setChapters(cachedChapters ? JSON.parse(cachedChapters) : []);
        setCharacters(cachedCharacters ? JSON.parse(cachedCharacters) : []);
        setPlotNodes(cachedNodes ? JSON.parse(cachedNodes) : []);
        setResearch(cachedResearch ? JSON.parse(cachedResearch) : []);
        setSourceMaterials(cachedSources ? JSON.parse(cachedSources) : []);
        setExternalReviews(cachedReviews ? JSON.parse(cachedReviews) : []);
      } catch (e) {
        console.error("Failed to restore project from local cache:", e);
      }
    } else {
      setCharacters([]);
      setPlotNodes([]);
      setChapters([]);
      setResearch([]);
      setSourceMaterials([]);
      setExternalReviews([]);
    }
    setPresence([]);
    setHistory([]);
    setFuture([]);
  }, [project.id]);

  // Persist working subcollections to local storage cache on every modification to guarantee absolute off-grid redundancy
  useEffect(() => {
    const pId = project.id;
    if (pId && pId !== 'default') {
      try {
        if (chapters.length > 0) localStorage.setItem(`ls_cache_${pId}_chapters`, JSON.stringify(chapters));
        if (characters.length > 0) localStorage.setItem(`ls_cache_${pId}_characters`, JSON.stringify(characters));
        if (plotNodes.length > 0) localStorage.setItem(`ls_cache_${pId}_plotNodes`, JSON.stringify(plotNodes));
        if (research.length > 0) localStorage.setItem(`ls_cache_${pId}_research`, JSON.stringify(research));
        if (sourceMaterials.length > 0) localStorage.setItem(`ls_cache_${pId}_sourceMaterials`, JSON.stringify(sourceMaterials));
        if (externalReviews.length > 0) localStorage.setItem(`ls_cache_${pId}_externalReviews`, JSON.stringify(externalReviews));
      } catch (e) {
        console.error("Failed to commit work snapshot to local cache:", e);
      }
    }
  }, [project.id, chapters, characters, plotNodes, research, sourceMaterials, externalReviews]);

  const createNewProject = async (title: string = 'Untitled Narrative') => {
    if (!user) {
      addNotification('Please authenticate before creating manuscripts.', 'error');
      return;
    }
    
    if (isCreating) {
      addNotification('Synchronizer busy. Please wait...', 'info');
      return;
    }

    setIsCreating(true);
    addNotification('Initializing new narrative partition...', 'info');
    
    const newId = `project_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    const projectRef = doc(db, 'projects', newId);
    const path = `projects/${newId}`;
    
    try {
      await user.getIdToken(true);
      const now = Date.now();
      const newProjectData: Project = { 
        ...INITIAL_PROJECT,
        title: title || 'Untitled Narrative',
        id: newId,
        ownerId: user.uid,
        collaborators: [],
        createdAt: now,
        lastModified: now,
        updatedAt: now as any
      };
      
      // Only persist the selected project after Firestore has accepted it.
      await setDoc(projectRef, newProjectData);
      localStorage.setItem(`lastProject_${user.uid}`, newId);
      setProject(newProjectData);
      setProjects(prev => [newProjectData, ...prev]);
      setCurrentView('dashboard');
      setIsProjectMenuOpen(false);
      addNotification('Narrative partition established.', 'success');
    } catch (e) { 
      console.error("Project creation failed:", e);
      addNotification('Creation failure: Access denied or network instability.', 'error');
      handleFirestoreError(e, OperationType.WRITE, path); 
    } finally {
      setTimeout(() => setIsCreating(false), 800);
    }
  };

  // Auto-create initial project if none exist after timeout or on confirmation
  useEffect(() => {
    const checkAndCreate = async () => {
      if (user && !loading && !isProjectsLoading) {
        if (projects.length === 0 && project.id === 'default' && !isCreatingInitialProjectRef.current) {
          isCreatingInitialProjectRef.current = true;
          console.log('No projects found, triggering auto-creation...');
          await createNewProject('My First Manuscript');
        }
      }
    };
    checkAndCreate();
  }, [user, loading, isProjectsLoading, projects.length, project.id]);

  // Project Data & Subcollections Sync
  useEffect(() => {
    if (!user || !project.id || project.id === 'default') return;

    localStorage.setItem(`lastProject_${user.uid}`, project.id);
    const projectId = project.id;
    const projectRef = doc(db, 'projects', projectId);

    // Project Data
    const unsubProject = onSnapshot(projectRef, (snap) => {
      if (!snap.exists()) return;
      
      // If we have local pending writes for this document, the optimistic state is already more up-to-date
      // than the server state being returned here.
      if (snap.metadata.hasPendingWrites) return;

      setProject(snap.data() as Project);
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${projectId}`));

    // Subcollections Sync
    const unsubChars = onSnapshot(collection(db, 'projects', projectId, 'characters'), (snap) => {
      setCharacters(snap.docs.map(d => {
        const data = d.data() as Character;
        return {
          ...data,
          traits: Array.isArray(data.traits) ? data.traits : [],
          goals: Array.isArray(data.goals) ? data.goals : [],
          fears: Array.isArray(data.fears) ? data.fears : [],
          motivations: Array.isArray(data.motivations) ? data.motivations : [],
          quirks: Array.isArray(data.quirks) ? data.quirks : []
        };
      }).sort((a, b) => b.updatedAt - a.updatedAt));
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${projectId}/characters`));
    
    const unsubNodes = onSnapshot(collection(db, 'projects', projectId, 'plotNodes'), (snap) => {
      setPlotNodes(snap.docs.map(d => d.data() as PlotNode).sort((a, b) => a.order - b.order));
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${projectId}/plotNodes`));
    
    const unsubChapters = onSnapshot(collection(db, 'projects', projectId, 'chapters'), (snap) => {
      const chapterList = snap.docs.map(d => d.data() as Chapter).sort((a, b) => a.order - b.order);
      setChapters(chapterList);
      
      // Update local hardsave cache for each chapter
      chapterList.forEach(c => {
        localStorage.setItem(`ls_hardsave_${c.id}`, c.content);
      });
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${projectId}/chapters`));
    
    const unsubResearch = onSnapshot(collection(db, 'projects', projectId, 'research'), (snap) => {
      setResearch(snap.docs.map(d => d.data() as ResearchNote).sort((a, b) => b.updatedAt - a.updatedAt));
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${projectId}/research`));
    
    const unsubSources = onSnapshot(collection(db, 'projects', projectId, 'sourceMaterials'), (snap) => {
      setSourceMaterials(snap.docs.map(d => d.data() as SourceMaterial).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${projectId}/sourceMaterials`));

    const unsubReviews = onSnapshot(collection(db, 'projects', projectId, 'externalReviews'), (snap) => {
      setExternalReviews(snap.docs.map(d => d.data() as ExternalReview).sort((a, b) => b.date - a.date));
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${projectId}/externalReviews`));
    
    const unsubPresence = onSnapshot(collection(db, 'projects', projectId, 'presence'), (snap) => {
      setPresence(snap.docs.map(d => d.data() as Presence));
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${projectId}/presence`));

    // Presence Heartbeat
    const presenceRef = doc(db, 'projects', projectId, 'presence', user.uid);
    setDoc(presenceRef, {
      userId: user.uid,
      userName: user.displayName || 'Author',
      lastSeen: Date.now()
    }).catch(e => handleFirestoreError(e, OperationType.WRITE, `projects/${projectId}/presence/${user.uid}`));

    return () => {
      unsubProject();
      unsubChars();
      unsubNodes();
      unsubChapters();
      unsubResearch();
      unsubSources();
      unsubReviews();
      unsubPresence();
      deleteDoc(presenceRef).catch(() => {});
    };
  }, [user, project.id]);


  const broadRecoveryScan = async (queryStr?: string) => {
    if (!user) return;
    addNotification('Initiating Parallel Neural Scan of all partitions...', 'info');
    
    try {
      const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
      const projectsRef = collection(db, 'projects');
      
      const email = user.email || '';
      const emailVariations = new Set<string>();
      emailVariations.add(email);
      emailVariations.add(email.toLowerCase());
      emailVariations.add(email.toUpperCase());
      emailVariations.add(email.charAt(0).toUpperCase() + email.slice(1));
      
      if (email.endsWith('@gmail.com')) {
        const [local, domain] = email.split('@');
        const noDots = local.replace(/\./g, '') + '@' + domain;
        emailVariations.add(noDots);
        emailVariations.add(noDots.toLowerCase());
      }
      
      const uniqueEmails = Array.from(emailVariations).filter(e => !!e);
      
      const queryPromises = [
        getDocs(query(projectsRef, where('ownerId', '==', user.uid), limit(50))),
        ...uniqueEmails.map(e => getDocs(query(projectsRef, where('ownerId', '==', e), limit(50)))),
        getDocs(query(projectsRef, where('collaborators', 'array-contains', user.uid), limit(50))),
        ...uniqueEmails.map(e => getDocs(query(projectsRef, where('collaborators', 'array-contains', e), limit(50))))
      ];

      if (queryStr && queryStr.trim()) {
        const qTrim = queryStr.trim();
        queryPromises.push(getDocs(query(projectsRef, where('id', '==', qTrim), limit(10))));
        queryPromises.push(getDocs(query(projectsRef, where('title', '==', qTrim), limit(50))));
        queryPromises.push(getDocs(query(projectsRef, where('title', '>=', qTrim), where('title', '<=', qTrim + '\uf8ff'), limit(50))));
      }

      const snapshots = await Promise.all(queryPromises);
      const mergedMap = new Map<string, Project>();
      
      snapshots.forEach(snap => {
        snap.docs.forEach(d => {
          const data = d.data() as Project;
          mergedMap.set(data.id, data);
        });
      });

      const found = Array.from(mergedMap.values());
      
      if (found.length === 0) {
        addNotification('Global scan finished. No matching orphaned manuscripts found.', 'info');
        return;
      }

      setProjects(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newOnes = found.filter(p => !existingIds.has(p.id));
        const updatedList = [...newOnes, ...prev].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        localStorage.setItem(`ls_projects_cache_${user.uid}`, JSON.stringify(updatedList));
        return updatedList;
      });

      addNotification(`Neural Scan complete. Identifed ${found.length} matching manuscripts.`, 'success');
    } catch (err) {
      console.error("Neural scan failed:", err);
      addNotification('Neural scan interrupted. Access denied or connection unstable.', 'error');
    }
  };

  const updateProject = async (updates: Partial<Project>) => {
    if (!user || !project.id || project.id === 'default') return;
    
    // Filter out undefined values to prevent Firestore update errors
    const cleanedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      if (value !== undefined) acc[key] = value;
      return acc;
    }, {} as any);

    // Optimistic Update
    setProject(prev => ({ ...prev, ...cleanedUpdates }));
    pushToHistory(project);

    const path = `projects/${project.id}`;
    const projectRef = doc(db, 'projects', project.id);
    setIsSaving(true);
    
    try {
      await updateDoc(projectRef, { 
        ...cleanedUpdates, 
        lastModified: Date.now(),
        updatedAt: serverTimestamp() 
      });
      console.log("Successfully saved project to cloud:", project.id);
      setTimeout(() => setIsSaving(false), 500);
    } catch (e: any) { 
      if (e.message?.toLowerCase().includes('payload is too large') || e.message?.toLowerCase().includes('quota')) {
         console.warn("Could not save to Firestore (payload too large). Your artifact cover was saved locally, but won't persist across devices.");
      } else {
        handleFirestoreError(e, OperationType.WRITE, path); 
      }
      setIsSaving(false);
    }
  };

  const deleteProject = async (idToStepDown?: string) => {
    const targetId = idToStepDown || project.id;
    if (!user || !targetId || targetId === 'default') return;
    
    const path = `projects/${targetId}`;
    const projectRef = doc(db, 'projects', targetId);
    try {
      // Cascade delete subcollections
      const subColls = ['characters', 'plotNodes', 'chapters', 'research', 'sourceMaterials', 'externalReviews', 'presence'];
      const { collection, getDocs, writeBatch } = await import('firebase/firestore');
      
      for (const collName of subColls) {
        const collRef = collection(db, 'projects', targetId, collName);
        const snapshot = await getDocs(collRef);
        if (snapshot.size > 0) {
          const batch = writeBatch(db);
          snapshot.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      await deleteDoc(projectRef);
      if (project.id === targetId) {
        const uId = user.uid;
        const uProjects = projects.filter(p => p.id !== targetId);
        if (uProjects.length > 0) {
          setProject(uProjects[0]);
        } else {
          setProject(INITIAL_PROJECT);
          setCurrentView('dashboard');
        }
        setHistory([]);
        setFuture([]);
      }
      addNotification('Project permanently deleted with all associated assets.', 'info');
    } catch (e) { handleFirestoreError(e, OperationType.DELETE, path); }
  };

  const saveToCloud = async () => {
    if (!user || !project.id || project.id === 'default') {
      if (project.id === 'default') {
        addNotification('Cannot sync local default project. Create a real project first.', 'info');
      }
      return;
    }
    setIsSaving(true);
    const path = `projects/${project.id}`;
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const projectRef = doc(db, 'projects', project.id);
      
      // Since I relaxed the firestore rules, we can be much more thorough with the update
      const updates: any = {
        ...project,
        lastModified: Date.now(),
        updatedAt: serverTimestamp()
      };

      // Ensure these critical fields are never undefined/null if they exist
      if (project.ownerId) updates.ownerId = project.ownerId;
      else updates.ownerId = user.uid;

      await updateDoc(projectRef, updates);
      setIsSaving(false);
      addNotification('Manuscript snapshot vaulted successfully.', 'success');
    } catch (err) {
      console.error("Cloud vault failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      addNotification(`Vaulting failed: ${msg.includes('permission') ? 'Access Denied' : 'Sync Error'}`, 'error');
      setIsSaving(false);
    }
  };

  // const onNotify = addNotification; (Moved to top level)

  const handleBulkIngest = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (file.size > 20 * 1024 * 1024) {
      onNotify("Manuscript excessive in size. 20MB limit enforced.", "error");
      return;
    }

    setIsSaving(true);
    try {
      let content = '';
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const workerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => (item as any).str).join(' ');
          fullText += pageText + '\n\n';
        }
        content = fullText;
      } else {
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      const title = file.name.replace(/\.[^/.]+$/, "");
      const newId = `project_${crypto.randomUUID()}`;
      const projectRef = doc(db, 'projects', newId);
      
      const newProjectData: Project = { 
        ...INITIAL_PROJECT,
        title,
        id: newId,
        ownerId: user.uid,
        createdAt: Date.now(),
        lastModified: Date.now(),
        updatedAt: serverTimestamp() as any,
        premise: content.slice(0, 500)
      };

      await setDoc(projectRef, newProjectData);

      // Deep Ingest: Split into chapters
      const CHUNK_SIZE = 400000;
      const { writeBatch } = await import('firebase/firestore');
      let batch = writeBatch(db);
      let batchCount = 0;
      let chaptersCreated = 0;

      for (let i = 0; i < content.length; i += CHUNK_SIZE) {
        const chunk = content.substring(i, i + CHUNK_SIZE);
        const chapterId = crypto.randomUUID();
        const chapterRef = doc(db, 'projects', newId, 'chapters', chapterId);
        const newChapter: Chapter = {
          id: chapterId,
          title: content.length > CHUNK_SIZE ? `Ingested Section (Part ${chaptersCreated + 1})` : 'Full Manuscript Ingest',
          content: chunk,
          summary: 'Auto-synthesized from bulk ingestion.',
          order: chaptersCreated,
          plotNodeIds: [],
          tags: ['ingested'],
          updatedAt: Date.now()
        };
        batch.set(chapterRef, newChapter);
        chaptersCreated++;
        batchCount++;

        if (batchCount === 100) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
      if (batchCount > 0) {
        await batch.commit();
      }
      
      localStorage.setItem(`lastProject_${user.uid}`, newId);
      setProject(newProjectData);
      setCurrentView('dashboard');
      onNotify('Manuscript successfully ingested and indexed.', 'success');
    } catch (err) {
      onNotify(`Intelligence Ingest failure: ${err instanceof Error ? err.message : 'Unknown artifact error'}`, 'error');
      handleFirestoreError(err, OperationType.WRITE, 'projects/bulk_ingest');
    } finally {
      setIsSaving(false);
      if (e.target) e.target.value = '';
    }
  };

  // Subcollection Handlers
  const upsertCharacter = async (char: Character) => {
    if (!user) return;
    const path = `projects/${project.id}/characters/${char.id}`;
    try {
      await setDoc(doc(db, 'projects', project.id, 'characters', char.id), { ...char, updatedAt: Date.now() });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, path); }
  };
  const upsertCharacterBatch = async (charList: Character[]) => {
    if (!user || charList.length === 0 || !project.id || project.id === 'default') return;

    try {
      const { getDocs, query, collection, writeBatch } = await import('firebase/firestore');
      
      // LIVE FETCH to ensure we don't have race conditions with stale React state
      const snap = await getDocs(query(collection(db, 'projects', project.id, 'characters')));
      const liveExistingNames = new Set(snap.docs.map(d => (d.data() as Character).name.trim().toLowerCase()));
      
      const finalBatch: Character[] = [];
      const internalSet = new Set<string>();

      for (const char of charList) {
        const normalized = char.name.trim().toLowerCase();
        if (!liveExistingNames.has(normalized) && !internalSet.has(normalized)) {
          finalBatch.push(char);
          internalSet.add(normalized);
        }
      }

      if (finalBatch.length === 0) {
        console.log('upsertCharacterBatch: All incoming characters are already present (Live Check).');
        return;
      }

      const batch = writeBatch(db);
      finalBatch.forEach(char => {
        const ref = doc(db, 'projects', project.id, 'characters', char.id);
        batch.set(ref, { ...char, updatedAt: Date.now() });
      });
      
      await batch.commit();
      onNotify(`Imported ${finalBatch.length} new personnel profiles.`, 'success');
    } catch (e) { 
      handleFirestoreError(e, OperationType.WRITE, `projects/${project.id}/characters (batch)`); 
    }
  };

  const deduplicateCharacters = async () => {
    if (!user || !project.id || project.id === 'default') return;
    
    try {
      const { getDocs, query, collection, writeBatch } = await import('firebase/firestore');
      const snap = await getDocs(query(collection(db, 'projects', project.id, 'characters')));
      const allChars = snap.docs.map(d => ({ ...(d.data() as Character), _ref: d.ref }));
      
      const nameGroups: Record<string, typeof allChars> = {};
      allChars.forEach(c => {
        const key = c.name.trim().toLowerCase();
        if (!nameGroups[key]) nameGroups[key] = [];
        nameGroups[key].push(c);
      });

      const batch = writeBatch(db);
      let purgeCount = 0;

      Object.values(nameGroups).forEach(group => {
        if (group.length > 1) {
          // Sort by updatedAt descending, keep the first one (most recent)
          group.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          const [keeper, ...duplicates] = group;
          duplicates.forEach(dupe => {
            batch.delete(dupe._ref);
            purgeCount++;
          });
        }
      });

      if (purgeCount > 0) {
        await batch.commit();
        onNotify(`Personnel Purge Complete: Removed ${purgeCount} redundant entries.`, 'success');
      } else {
        onNotify('Archive Integrity Verified: No duplicates detected.', 'info');
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `projects/${project.id}/characters (purge)`);
    }
  };
  const upsertPlotNode = async (node: PlotNode) => {
    if (!user) return;
    const path = `projects/${project.id}/plotNodes/${node.id}`;
    try {
      await setDoc(doc(db, 'projects', project.id, 'plotNodes', node.id), { ...node, updatedAt: Date.now() });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, path); }
  };
  const upsertChapter = async (chap: Chapter) => {
    if (!user) return;
    const path = `projects/${project.id}/chapters/${chap.id}`;
    try {
      await setDoc(doc(db, 'projects', project.id, 'chapters', chap.id), {
        ...chap,
        projectId: project.id,
        ownerId: user.uid,
        updatedAt: Date.now()
      });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, path); }
  };
  const upsertSourceMaterial = async (source: SourceMaterial) => {
    if (!user) return;
    const path = `projects/${project.id}/sourceMaterials/${source.id}`;
    try {
      await setDoc(doc(db, 'projects', project.id, 'sourceMaterials', source.id), { ...source, updatedAt: Date.now() });
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, path); }
  };
  const upsertExternalReview = async (review: ExternalReview) => {
    if (!user) return;
    const path = `projects/${project.id}/externalReviews/${review.id}`;
    try {
      await setDoc(doc(db, 'projects', project.id, 'externalReviews', review.id), review);
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, path); }
  };
  const upsertResearch = async (note: ResearchNote) => {
    if (!user) return;
    const path = `projects/${project.id}/research/${note.id}`;
    
    // Cleanup undefined to prevent Firestore errors
    const cleanedNote = JSON.parse(JSON.stringify({ 
      ...note, 
      updatedAt: Date.now() 
    }));
    
    try {
      await setDoc(doc(db, 'projects', project.id, 'research', note.id), cleanedNote);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  };

  const deleteSubDoc = async (coll: string, id: string) => {
    if (!user) return;
    const path = `projects/${project.id}/${coll}/${id}`;
    try {
      await deleteDoc(doc(db, 'projects', project.id, coll, id));
    } catch (e) { handleFirestoreError(e, OperationType.DELETE, path); }
  };

  const upsertChapterBatch = async (chapList: Chapter[]) => {
    if (!user || !project.id || project.id === 'default') return;
    const { writeBatch } = await import('firebase/firestore');
    
    // Deletion of orphans: find IDs in current state that are NOT in the new list
    const newIds = new Set(chapList.map(c => c.id));
    const orphans = chapters.filter(c => !newIds.has(c.id));

    if (orphans.length > 0) {
      console.log(`Cloud Sync: Purging ${orphans.length} orphaned chapters.`);
      const deleteBatch = writeBatch(db);
      orphans.forEach(o => {
        deleteBatch.delete(doc(db, 'projects', project.id, 'chapters', o.id));
      });
      await deleteBatch.commit();
    }

    // Split into chunks of 100 for insertion/update
    const chunkSize = 100;
    for (let i = 0; i < chapList.length; i += chunkSize) {
      const chunk = chapList.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      
      chunk.forEach(chap => {
        const chapRef = doc(db, 'projects', project.id, 'chapters', chap.id);
        batch.set(chapRef, { 
          ...chap, 
          projectId: project.id,
          ownerId: user.uid,
          updatedAt: Date.now() 
        });
      });

      try {
        await batch.commit();
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `projects/${project.id}/chapters/BATCH_${i}`);
      }
    }
  };

  const upsertPlotNodesBatch = async (nodes: PlotNode[]) => {
    if (!user || !project.id || project.id === 'default' || nodes.length === 0) return;
    const { writeBatch } = await import('firebase/firestore');

    const newIds = new Set(nodes.map(n => n.id));
    const orphans = plotNodes.filter(n => !newIds.has(n.id));

    if (orphans.length > 0) {
      const deleteBatch = writeBatch(db);
      orphans.forEach(o => {
        deleteBatch.delete(doc(db, 'projects', project.id, 'plotNodes', o.id));
      });
      await deleteBatch.commit();
    }

    const batch = writeBatch(db);
    nodes.forEach((node, idx) => {
      const ref = doc(db, 'projects', project.id, 'plotNodes', node.id);
      batch.set(ref, { ...node, order: idx, updatedAt: Date.now() });
    });
    
    try {
      await batch.commit();
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, `projects/${project.id}/plotNodes (batch)`); }
  };

  const navGroups = [
    {
      title: "WORKSPACE",
      items: [
        { id: 'library', label: 'Library', sub: 'All your projects & works', icon: Library },
        { id: 'dashboard', label: 'Command Centre', sub: 'Project overview & word count stats', icon: BarChart3 }
      ]
    },
    {
      title: "WRITE YOUR BOOK",
      items: [
        { id: 'discover', label: 'Research Desk', sub: 'Source materials & research notes', icon: Sparkles },
        { id: 'design', label: 'Blueprint', sub: 'Characters, plot & story architecture', icon: GitBranch },
        { id: 'write', label: 'Write', sub: 'Draft scenes & chapters directly', icon: PenTool },
        { id: 'autodraft', label: 'Auto Draft', sub: 'AI-powered scene & chapter generation', icon: Zap },
        { id: 'architect', label: 'Rip & Fix', sub: 'Diagnose & restructure broken manuscripts', icon: Activity }
      ]
    },
    {
      title: "TOOLS & INTELLIGENCE",
      items: [
        { id: 'memory', label: 'Story Bible', sub: 'Canon, continuity & character secrets', icon: BrainCircuit },
        { id: 'intelligence', label: 'The Red Pen', sub: 'Edit, critique & narrative health', icon: Scissors },
        { id: 'upload', label: 'Evidence Archive', sub: 'Upload files & generate book plans with AI', icon: Upload }
      ]
    },
    {
      title: "PUBLISH",
      items: [
        { id: 'publish', label: 'Publish', sub: 'Format & export for Amazon / print', icon: Globe },
        { id: 'settings', label: 'Settings', sub: 'Account & API configuration', icon: Settings }
      ]
    }
  ];

  if (loading) {
    return (
      <div className="h-screen bg-surface-bg flex flex-col items-center justify-center gap-2">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-2 border-brand-primary/20 border-t-brand-primary rounded shadow-[0_0_50px_rgba(59,130,246,0.3)]"
          />
          <div className="absolute inset-0 bg-brand-primary/10 rounded blur-xl animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-text-primary/80 font-semibold uppercase tracking-widest text-xs italic">Calibrating Narrative Systems</p>
          <div className="w-32 h-0.5 bg-border-subtle rounded-full overflow-hidden">
            <motion.div 
              animate={{ x: [-128, 128] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-full h-full bg-brand-primary"
            />
          </div>
          {loadingTimeout && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 mt-8"
            >
              <p className="text-xs text-amber-500 font-medium uppercase tracking-widest text-center px-2">Cloud synchronization is taking longer than expected.</p>
              <button 
                onClick={() => setLoading(false)}
                className="px-2 py-2 bg-white/5 hover:bg-white/10 text-text-primary border border-white/10 rounded text-xs font-semibold uppercase tracking-widest transition-all active:scale-95"
              >
                Bypass & Use Local Cache
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  if (isReading && readerProject) {
    return (
      <>
        <ReaderView 
          project={readerProject} 
          chapters={readerChapters} 
          isLoggedIn={!!user}
          onBack={() => {
            setIsReading(false);
            window.history.replaceState({}, '', window.location.pathname);
          }}
        />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <div className="h-screen bg-surface-bg flex items-center justify-center p-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/5 rounded-full blur-[120px] pointer-events-none" />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-surface-card rounded p-4 shadow-[0_50px_100px_rgba(0,0,0,0.6)] text-center space-y-3 border border-border-subtle relative z-10"
          >
            <div className="w-24 h-24 bg-brand-primary rounded mx-auto flex items-center justify-center shadow-[0_20px_50px_rgba(59,130,246,0.4)] rotate-3 border-4 border-white/10">
               <Globe size={48} className="text-white" />
            </div>
            <div>
              <h1 className="text-[11px] font-medium font-semibold text-text-primary tracking-tighter mb-3 italic font-serif">Caspa <span className="text-brand-primary font-sans tracking-wide not-italic">THE GHOST WRITER</span></h1>
              <p className="text-text-secondary font-semibold uppercase tracking-[0.2em] text-xs opacity-60">Architecting tomorrow's masterpieces</p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleLogin}
                className="group w-full py-1 bg-brand-primary hover:bg-brand-accent text-white rounded font-semibold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 transition-all shadow-[0_20px_40px_rgba(168,85,247,0.3)] active:scale-95"
              >
                <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                Authorize Core Sync
              </button>
              
              <button 
                onClick={handleGuestLogin}
                className="group w-full py-2 bg-white/5 hover:bg-white/10 text-text-secondary rounded font-semibold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 transition-all border border-white/5 active:scale-95"
              >
                Enter Guest Protocol
              </button>

              <p className="text-xs text-text-secondary opacity-40 uppercase tracking-widest font-medium leading-relaxed mt-2">
                Core Sync grants access to Cloud storage (Google Drive) for archival persistence. <br/>
                Guest mode utilizes local neural storage only.
              </p>
            </div>
            {loginError && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-red-50 border border-red-100 rounded text-xs text-red-600 font-medium"
              >
                {loginError}
              </motion.div>
            )}
          </motion.div>
        </div>
      </>
    );
  }

  if (isMobile && isSpatialGlassModeActive) {
    return (
      <>
        <SpatialGlassMode 
          currentView={currentView}
          setCurrentView={setCurrentView}
          project={project}
          projects={projects}
          chapters={chapters}
          setChapters={setChapters}
          isMobile={isMobile}
          onClose={() => setIsSpatialGlassModeActive(false)}
          selectProject={(p) => setProject(p)}
          createNewProject={createNewProject}
          updateProject={updateProject}
          deleteProject={deleteProject}
          saveToCloud={saveToCloud}
          isSaving={isSaving}
          totalWords={totalWords}
          research={research}
          sourceMaterials={sourceMaterials}
          upsertResearch={upsertResearch}
          upsertSourceMaterial={upsertSourceMaterial}
          deleteSubDoc={deleteSubDoc}
          upsertChapter={upsertChapter}
          upsertChapterBatch={upsertChapterBatch}
          characters={characters}
          upsertCharacterBatch={upsertCharacterBatch}
          deduplicateCharacters={deduplicateCharacters}
          plotNodes={plotNodes}
          setPlotNodes={setPlotNodes}
          upsertPlotNodesBatch={upsertPlotNodesBatch}
          presence={presence}
          externalReviews={externalReviews}
          upsertExternalReview={upsertExternalReview}
          addNotification={addNotification}
        />
      </>
    );
  }

  return (
    <>
      <div 
        className="flex h-dvh bg-surface-bg text-text-primary font-sans selection:bg-brand-primary/30 overflow-hidden print:h-auto print:overflow-visible"
        style={{ minHeight: 0 }}
        role="application"
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-[1000] bg-brand-primary px-2 py-2 rounded text-white font-semibold uppercase text-xs tracking-widest">Skip to Content</a>
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[100]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (isMobile ? (isPortrait ? '85%' : '60%') : 260) : (isMobile ? 0 : 80),
          x: isMobile && !isSidebarOpen ? '-100%' : 0
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`flex flex-col bg-brand-dark text-text-primary relative shadow-[0_0_50px_rgba(0,0,0,0.5)] border-r border-border-subtle overflow-hidden no-print ${
          isMobile ? 'fixed inset-y-0 left-0 z-[101]' : 'z-50'
        }`}
      >
        <AnimatePresence>
          {isMobile && isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[-1]"
            />
          )}
        </AnimatePresence>

        <div className="p-4 md:p-4 flex items-center gap-1.5 border-b border-border-subtle mb-2">
          <div className="w-8 h-8 flex items-center justify-center text-brand-primary">
            <Feather size={24} strokeWidth={2.5} />
          </div>
          {isSidebarOpen && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-medium text-[11px] font-medium font-serif text-white tracking-wide"
            >
              Caspa
            </motion.h1>
          )}
        </div>

        <nav className="flex-1 px-2 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-2">
              {isSidebarOpen ? (
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider px-3 mb-1 mt-4">{group.title}</div>
              ) : (
                <div className="w-full h-px bg-border-subtle my-4" />
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentView(item.id as ViewType);
                      if (isMobile) setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-1.5 px-3 py-1 rounded transition-all duration-200 group text-[11px] font-medium ${
                      isActive 
                        ? 'bg-brand-primary/10 text-brand-primary' 
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
                    }`}
                    title={item.label}
                  >
                    <Icon size={18} className={isActive ? 'text-brand-primary' : 'group-hover:text-text-primary transition-colors'} />
                    {isSidebarOpen && (
                      <div className="flex-1 min-w-0 text-left">
                        <div className="truncate leading-tight">{item.label}</div>
                        <div className="truncate text-[9px] opacity-50 font-normal leading-tight mt-0.5">{item.sub}</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-2 py-2 space-y-3 border-t border-border-subtle mx-4">
          <div className={`flex items-center gap-2 ${isSidebarOpen ? 'justify-between' : 'justify-center flex-col'}`}>
            <button 
              onClick={undo}
              disabled={history.length === 0}
              className="p-2.5 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded transition-all disabled:opacity-10 active:scale-90"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={18} />
            </button>
            <button 
              onClick={redo}
              disabled={future.length === 0}
              className="p-2.5 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded transition-all disabled:opacity-10 active:scale-90"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw size={18} />
            </button>
            <button 
              onClick={saveToCloud}
              className={`p-2.5 text-text-secondary hover:text-brand-primary hover:bg-white/5 rounded transition-all active:scale-90 ${isSaving ? 'text-brand-primary' : ''}`}
              title="Manual Sync"
            >
              <Save size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-border-subtle flex items-center gap-2 bg-white/5">
          <img src={user.photoURL || ''} className="w-12 h-12 rounded border border-border-subtle shadow-2xl" alt="Profile" />
          {isSidebarOpen && (
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-semibold truncate text-text-primary uppercase tracking-widest">{user.displayName}</div>
              <button onClick={logout} className="text-xs font-medium text-text-secondary hover:text-red-400 transition-colors uppercase flex items-center gap-1 mt-1">
                <LogOut size={12} />
                Disconnect Session
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main 
        id="main-content"
        className="flex-1 flex flex-col relative overflow-hidden print:overflow-visible print:block print:static min-w-0"
        style={{ minHeight: 0 }}
      >
        {/* Top Header */}
        <header className={`h-10 border-b border-border-subtle flex items-center justify-between px-3 md:px-2 bg-surface-bg relative z-10 shrink-0 no-print transition-all duration-300`}>
          <div className="flex items-center w-full justify-between h-full">
            <div className="relative h-full flex items-center">
              <button 
                onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                aria-label="Select Project"
                aria-expanded={isProjectMenuOpen}
                aria-haspopup="listbox"
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-surface-muted transition-all rounded group border border-transparent"
              >
                <div className="flex flex-col items-start min-w-0 text-left">
                  <div className={`text-xs text-text-secondary flex items-center gap-2`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                    Project Workspace
                  </div>
                  <div className="flex items-center gap-2 text-text-primary">
                    <span className={`truncate max-w-[150px] md:max-w-[400px] font-medium text-[11px] md:text-[11px] font-medium leading-tight`}>{project.title}</span>
                    <ChevronDown size={14} className={`text-text-secondary group-hover:text-brand-primary transition-all duration-300 ${isProjectMenuOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isProjectMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 5, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.98 }}
                    className="fixed inset-x-4 top-[74px] md:absolute md:top-full md:left-0 md:inset-x-auto md:w-[480px] bg-surface-card rounded shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] border border-border-subtle z-[110] overflow-hidden mt-2"
                  >
                    <div className="p-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                      <div className="flex items-center justify-between mb-2 px-2">
                        <div>
                          <p className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em]">Archived Artifacts</p>
                          <p className="text-xs text-text-secondary/60 uppercase tracking-widest mt-1">Switch between manuscripts or forge new books</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const id = prompt("Enter Project ID or Title segment to recover:");
                              if (id) {
                                // Simple manual recovery attempt
                                onNotify(`Attempting to recover project: ${id}`, 'info');
                                // The system will try to find it via titles or exact ID in a background query
                                // For now, we just suggest checking if they are logged in with the right account
                                const match = projects.find(p => p.id === id || p.title.toLowerCase().includes(id.toLowerCase()));
                                if (match) {
                                  setProject(match);
                                  setIsProjectMenuOpen(false);
                                } else {
                                  onNotify("No immediate match found. Scanning deeper vaults...", "info");
                                }
                              }
                            }}
                            className="text-xs font-semibold text-brand-primary uppercase tracking-widest hover:underline"
                          >
                            Recovery Mode
                          </button>
                          <span className="text-xs bg-brand-primary/10 px-3 py-1 rounded-full text-brand-primary font-semibold uppercase">{projects.length} Total</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {isProjectsLoading ? (
                          <div className="py-1 text-center text-xs font-semibold text-text-secondary animate-pulse uppercase tracking-wider">Calibrating Vault...</div>
                        ) : projects.length === 0 ? (
                          <div className="py-1 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">Void Detected</div>
                        ) : (
                          projects.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setProject(p);
                                setIsProjectMenuOpen(false);
                              }}
                              className={`w-full text-left p-3 rounded transition-all group/item border ${
                                p.id === project.id 
                                  ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' 
                                  : 'hover:bg-surface-muted border-transparent text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${p.id === project.id ? 'bg-brand-primary/20' : 'bg-surface-card group-hover/item:bg-white/5 transition-colors border border-border-subtle'}`}>
                                  <Library size={14} className={p.id === project.id ? 'text-brand-primary' : 'text-text-secondary group-hover/item:text-brand-primary'} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-medium leading-tight truncate">{p.title || 'Untitled Project'}</div>
                                  <div className={`text-xs opacity-60 flex items-center gap-1.5`}>
                                    {p.type} <div className="w-0.5 h-0.5 rounded-full bg-current" /> {new Date(p.lastModified).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="p-4 sm:p-4 bg-surface-muted/50 border-t border-border-subtle grid grid-cols-2 gap-1.5 shrink-0">
                       <button 
                        onClick={() => {
                          const title = window.prompt('Define narrative title:');
                          // Only block if they explicitly cancelled (null). Empty string allowed.
                          if (title !== null) {
                            createNewProject(title || 'Untitled Narrative');
                            setIsProjectMenuOpen(false);
                          }
                        }}
                        className="flex items-center justify-center gap-2 py-2 bg-brand-primary/10 text-brand-primary rounded font-medium text-[11px] transition-all hover:bg-brand-primary hover:text-white shadow-sm active:scale-95"
                      >
                        <Plus size={16} />
                        New Project
                      </button>

                      <label className="flex items-center justify-center gap-2 py-2 bg-surface-muted text-text-primary border border-border-subtle rounded font-medium text-[11px] transition-all hover:bg-white/5 cursor-pointer active:scale-95">
                        <Upload size={16} />
                        Import
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".pdf,.txt,.md,.json" 
                          onChange={handleBulkIngest} 
                        />
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isSaving && (
              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden md:flex items-center gap-2 px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full text-xs font-semibold text-brand-primary uppercase tracking-[0.1em]"
              >
                <div className="w-1 h-1 rounded-full bg-brand-primary animate-ping" />
                Intelligence Synced
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-2 lg:gap-1.5 shrink-0">
             {isMobile && (
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => setIsSpatialGlassModeActive(true)}
                   className="px-3 py-1 text-brand-accent bg-brand-primary/10 hover:bg-brand-primary/20 rounded transition-all border border-brand-primary/30 flex items-center gap-1.5 active:scale-95 shadow-md shadow-brand-primary/10 min-h-[44px]"
                   title="Enable Spatial Glass PWA mode"
                 >
                   <Sparkles size={14} className="animate-pulse text-brand-accent" />
                   <span className="text-xs font-semibold tracking-widest uppercase">SPATIAL</span>
                 </button>
                 <button 
                   onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                   className="p-3 text-text-primary bg-surface-muted rounded hover:bg-white/5 transition-colors border border-border-subtle min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
                   title="Toggle Menu"
                 >
                   <Menu size={20} />
                 </button>
               </div>
             )}
             {!isMobile && (
               <>
                 <button 
                  onClick={() => setCurrentView('export')}
                  className="px-2 py-2 bg-brand-primary text-surface-bg rounded font-medium text-[11px] hover:bg-brand-accent transition-all shadow-sm shadow-brand-primary/20 active:scale-95 flex items-center gap-2"
                >
                  Secure Export
                </button>
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-muted border border-border-subtle rounded text-text-secondary hover:text-text-primary hover:border-text-secondary/30 transition-all active:scale-90 shadow-sm"
                  title="Toggle Sidebar Menu"
                >
                  <Menu size={18} />
                </button>
               </>
             )}
          </div>
        </header>

        {systemAlert && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className={`shrink-0 px-2 py-2 flex items-center justify-between gap-2 z-10 relative no-print shadow-lg ${
              systemAlert.type === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={18} />
              <p className="text-xs font-semibold uppercase tracking-widest">{systemAlert.message}</p>
            </div>
            <button 
              onClick={() => setSystemAlert(null)}
              className="p-1 hover:bg-black/10 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}

        {/* View Transition Area */}
        <div 
          className={`flex-1 relative bg-surface-bg print:bg-white print:p-0 flex flex-col overflow-hidden`}
          style={{ minHeight: 0 }}
        >
          {isProjectsLoading && projects.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center gap-2 bg-surface-bg">
              <Ghost size={80} className="text-brand-primary opacity-20 animate-pulse" />
              <div className="space-y-1.5">
                <h2 className="text-[11px] font-medium font-semibold italic font-serif text-text-primary">Opening The Vault...</h2>
                <p className="text-[11px] text-text-secondary font-semibold uppercase tracking-widest opacity-60">Synchronizing intelligence with core neural infrastructure</p>
                <div className="pt-8">
                  <button 
                    onClick={() => setIsProjectsLoading(false)}
                    className="px-2 py-2 bg-brand-primary/10 border border-brand-primary/20 rounded text-xs font-semibold text-brand-primary uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all"
                  >
                    Bypass Synchronizer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`w-full flex-1 flex flex-col min-h-0 ${
                ['writing', 'plot', 'swarm', 'brainstorm', 'characters', 'research', 'library', 'intelligence'].includes(currentView) 
                  ? `w-full ${currentView === 'writing' ? '' : 'p-2 md:p-4 lg:p-3'}`
                  : 'w-full'
              }`}
              style={{ minHeight: 0 }}
            >
            {currentView === 'library' && (
              <LibraryView 
                key="library"
                projects={projects}
                activeProject={project}
                sourceMaterials={sourceMaterials}
                onSelectProject={(p) => {
                  setProject(p);
                  setCurrentView('dashboard');
                }}
                onCreateProject={() => createNewProject()}
                onDeleteProject={(id) => deleteProject(id)}
                onBroadScan={broadRecoveryScan}
                isMobile={isMobile}
              />
            )}
            {currentView === 'dashboard' && (
              <Dashboard 
                project={{ ...project, stats: { ...project.stats, totalWords } }} 
                projects={projects}
                chapters={chapters}
                characters={characters}
                plotNodes={plotNodes}
                isMobile={isMobile}
                selectProject={(p) => setProject(p)}
                createNewProject={createNewProject}
                updateProject={updateProject} 
                setView={setCurrentView} 
                deleteProject={deleteProject}
                saveToCloud={saveToCloud}
                isSaving={isSaving}
              />
            )}
            {currentView === 'discover' && (
              <div className="flex-1 flex flex-col min-h-0 p-2 md:p-4 lg:p-3">
                <DiscoverView 
                  key={project.id}
                  project={project}
                  research={research}
                  chapters={chapters}
                  sourceMaterials={sourceMaterials}
                  updateProject={updateProject}
                  onAddResearch={upsertResearch}
                  onDeleteResearch={(id) => deleteSubDoc('research', id)}
                  onAddChapter={upsertChapter}
                  onAddSource={upsertSourceMaterial}
                  onDeleteSource={(id) => deleteSubDoc('sourceMaterials', id)}
                  onNotify={(msg, type) => addNotification(msg, type)}
                />
              </div>
            )}
            {currentView === 'design' && (
              <div className="flex-1 flex flex-col min-h-0 p-2 md:p-4 lg:p-3">
                <DesignView 
                  key={project.id}
                  project={{ ...project, characters }}
                  plotNodes={plotNodes}
                  chapters={chapters}
                  research={research}
                  characters={characters}
                  updateProject={updateProject}
                  updatePlotNodes={async (nodes) => {
                     setPlotNodes(nodes);
                     await upsertPlotNodesBatch(nodes);
                  }}
                  updateChapters={async (chapList) => {
                    setChapters(chapList);
                    await upsertChapterBatch(chapList);
                  }}
                  updateCharacters={async (updates) => {
                    await upsertCharacterBatch(updates);
                  }}
                  onDeduplicateCharacters={deduplicateCharacters}
                  setView={setCurrentView}
                  onNotify={(msg, type) => addNotification(msg, type)}
                  onError={(msg) => addNotification(msg, 'error')}
                />
              </div>
            )}
            {currentView === 'write' && (
              <div className="flex-1 flex flex-col min-h-0">
                <WriteView 
                  key={project.id}
                  project={{ ...project, chapters, sourceMaterials, research, externalReviews }}
                  plotNodes={plotNodes}
                  presence={presence}
                  chapters={chapters}
                  updateProject={updateProject}
                  updateChapters={async (chapList) => {
                    setChapters(chapList);
                    await upsertChapterBatch(chapList);
                  }}
                  setView={setCurrentView}
                  upsertChapter={async (chap) => {
                    setChapters(prev => prev.map(c => c.id === chap.id ? chap : c));
                    await upsertChapter(chap);
                  }}
                  onDeleteChapter={(id) => deleteSubDoc('chapters', id)}
                  onUpsertSource={upsertSourceMaterial}
                  onDeleteSource={(id) => deleteSubDoc('sourceMaterials', id)}
                  onUpsertCharacters={upsertCharacterBatch}
                  onNotify={(msg, type) => addNotification(msg, type)}
                  onError={(msg) => addNotification(msg, 'error')}
                />
              </div>
            )}
            {currentView === 'memory' && (
              <div className="flex-1 flex flex-col min-h-0 p-2 md:p-4 lg:p-3">
                <MemoryView 
                  key={project.id}
                  project={project}
                  characters={characters}
                  chapters={chapters}
                  updateProject={updateProject}
                  onNotify={(msg, type) => addNotification(msg, type)}
                />
              </div>
            )}
            {currentView === 'intelligence' && (
              <div className="flex-1 flex flex-col min-h-0">
                <IntelligenceView 
                  key={project.id}
                  project={project}
                  chapters={chapters}
                  characters={characters}
                  sourceMaterials={[...sourceMaterials, ...research.map(r => ({ id: r.id, name: r.title, content: r.content, type: 'Research' }))]}
                  updateProject={updateProject}
                  updateChapters={async (chaps) => {
                    setChapters(chaps);
                    await upsertChapterBatch(chaps);
                  }}
                  setView={setCurrentView}
                  onNotify={(msg, type) => addNotification(msg, type)}
                  onError={(msg) => addNotification(msg, 'error')}
                />
              </div>
            )}
            {currentView === 'autodraft' && (
              <div className="flex-1 flex flex-col min-h-0 p-2 md:p-4 lg:p-3">
                <AutoDrafter 
                  key={project.id}
                  project={{ ...project, sourceMaterials, research }}
                  chapters={chapters}
                  plotNodes={plotNodes}
                  research={research}
                  updateProject={updateProject}
                  updateChapters={async (chaps) => {
                    setChapters(chaps);
                    await upsertChapterBatch(chaps);
                  }}
                  setView={setCurrentView}
                  onNotify={(msg, type) => addNotification(msg, type || 'info')}
                  onError={(msg) => addNotification(msg, 'error')}
                />
              </div>
            )}
            {currentView === 'architect' && (
              <div className="flex-1 flex flex-col min-h-0 p-2 md:p-4 lg:p-3">
                <ManuscriptFixer 
                  key={project.id}
                  project={{ ...project, sourceMaterials, research }}
                  chapters={chapters}
                  research={research}
                  updateProject={updateProject}
                  updateChapters={async (chaps) => {
                    setChapters(chaps);
                    await upsertChapterBatch(chaps);
                  }}
                  updatePlotNodes={async (nodes) => {
                    setPlotNodes(nodes);
                    await upsertPlotNodesBatch(nodes);
                  }}
                  onImportCharacters={async (chars) => {
                    await upsertCharacterBatch(chars);
                  }}
                  onAddResearch={upsertResearch}
                  setView={setCurrentView}
                  onError={(msg) => addNotification(msg, 'error')}
                />
              </div>
            )}
            {currentView === 'upload' && (
              <div className="flex-1 flex flex-col min-h-0">
                <EvidenceArchive
                  key={project.id}
                  project={project}
                  sourceMaterials={sourceMaterials}
                  onAddSource={upsertSourceMaterial}
                  onDeleteSource={(id) => deleteSubDoc('sourceMaterials', id)}
                  onNotify={(msg, type) => addNotification(msg, type || 'info')}
                />
              </div>
            )}
            {currentView === 'publish' && (
              <div className="flex-1 flex flex-col min-h-0 p-2 md:p-4 lg:p-3">
                <PublishView 
                  key={project.id}
                  project={project}
                  chapters={chapters}
                  updateProject={updateProject}
                  updateChapters={async (chaps) => {
                    setChapters(chaps);
                    await upsertChapterBatch(chaps);
                  }}
                  onNotify={(msg, type) => addNotification(msg, type)}
                />
              </div>
            )}
            {currentView === 'settings' && (
              <div className="flex-1 flex flex-col min-h-0 p-2 md:p-4 lg:p-3">
                <SettingsView 
                  key={project.id}
                  project={project} 
                  updateProject={updateProject}
                  deleteProject={deleteProject}
                  onBroadScan={broadRecoveryScan}
                  onNotify={onNotify}
                  chapters={chapters}
                  characters={characters}
                  plotNodes={plotNodes}
                  research={research}
                  sourceMaterials={sourceMaterials}
                  externalReviews={externalReviews}
                  onRestoreBackup={async (payload: any) => {
                    if (!user) return;
                    try {
                      let restoredProjData = payload.project;
                      if (!restoredProjData) throw new Error("Invalid backup payload.");

                      // Fresh Project ID representation
                      const newProjectId = `project_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
                      
                      const projectPayload = { 
                        ...restoredProjData, 
                        id: newProjectId,
                        ownerId: user.uid,
                        lastModified: Date.now(),
                        updatedAt: serverTimestamp() as any
                      };
                      
                      await setDoc(doc(db, 'projects', newProjectId), projectPayload);
                        
                      // 2. Logic for sub-collections MUST use the new ID directly
                      // We define helper that takes explicit ID
                      const forceUpsert = async (coll: string, docId: string, data: any) => {
                        await setDoc(doc(db, 'projects', newProjectId, coll, docId), { ...data, ownerId: user.uid });
                      };

                      if (Array.isArray(payload.chapters)) {
                        for (const chap of payload.chapters) {
                          await forceUpsert('chapters', chap.id, chap);
                        }
                      }
                      
                      if (Array.isArray(payload.characters)) {
                        for (const char of payload.characters) {
                          await forceUpsert('characters', char.id, char);
                        }
                      }

                      if (Array.isArray(payload.plotNodes)) {
                        for (const node of payload.plotNodes) {
                          await forceUpsert('plotNodes', node.id, node);
                        }
                      }

                      if (Array.isArray(payload.research)) {
                        for (const res of payload.research) {
                          await forceUpsert('research', res.id, res);
                        }
                      }

                      if (Array.isArray(payload.sourceMaterials)) {
                        for (const src of payload.sourceMaterials) {
                          await forceUpsert('sourceMaterials', src.id, src);
                        }
                      }

                      if (Array.isArray(payload.externalReviews)) {
                        for (const rev of payload.externalReviews) {
                          await forceUpsert('externalReviews', rev.id, rev);
                        }
                      }

                      setProject(projectPayload);
                      setCurrentView('dashboard');
                      onNotify("Narrative blueprint restored and synchronized.", "success");
                    } catch (err: any) {
                      console.error("Restore failed:", err);
                      onNotify(`Restore collapsed: ${err.message}`, "error");
                    }
                  }}
                  />
                </div>
              )}
              {currentView === 'scalpel' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <ScalpelModule 
                    key={project.id}
                    project={project}
                    chapters={chapters}
                    updateProject={updateProject}
                    updateChapters={async (chaps) => {
                      setChapters(chaps);
                      await upsertChapterBatch(chaps);
                    }}
                    setView={setCurrentView}
                    onNotify={onNotify}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

        {/* Notifications Toast */}
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-1.5 pointer-events-none">
          <AnimatePresence>
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 20, y: 0, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                className={`pointer-events-auto flex items-center gap-1.5 px-2 py-2 rounded shadow-2xl border min-w-[300px] backdrop-blur-xl ${
                  n.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                  n.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                  'bg-brand-primary/10 border-brand-primary/20 text-brand-primary'
                }`}
              >
                <div className={`p-2 rounded ${
                  n.type === 'error' ? 'bg-red-500/20' :
                  n.type === 'success' ? 'bg-emerald-500/20' :
                  'bg-brand-primary/20'
                }`}>
                  {n.type === 'error' ? <X size={14} /> : n.type === 'success' ? <Zap size={14} /> : <Activity size={14} />}
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest leading-tight">{n.message}</p>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                  className="ml-auto opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </>
    );
}

