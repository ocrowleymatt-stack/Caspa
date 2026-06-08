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
  Scale
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
import { auth, db, loginWithGoogle, logout } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firestoreUtils';
import {
  createProject as persistCreateProject,
  saveProject as persistSaveProject,
  upsertChapter as persistUpsertChapter,
  upsertChapterBatch as persistUpsertChapterBatch,
  loadCachedChapters,
  loadCachedProject,
  loadCachedProjectId,
  setActiveProjectId,
  mergeChaptersWithLocalHardsaves,
  isLikelyOffline,
} from './lib/persistenceService';
import { 
  onSnapshot, 
  doc, 
  collection, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  query, 
  where,
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
import PinGate from './components/PinGate';
import PlotArchitect from './components/PlotArchitect';
import CourtBundleView from './components/CourtBundleView';

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
  // Safe defaults: new projects start at Pass 1 with an 80k word target.
  // Without these, writeDraft falls back to a 50k target and draftStage=undefined
  // which forces every chapter to be written at 10% depth (skeletal only).
  draftStage: 1,
  targetWordCount: 80000,
  cutMode: false,
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

  // Load project cache on mount
  useEffect(() => {
    if (user) {
      const cached = localStorage.getItem(`ls_projects_cache_${user.uid}`);
      if (cached) {
        setProjects(JSON.parse(cached));
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: 'error' | 'success' | 'info' }[]>([]);
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
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  // Mobile Detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
    else setIsSidebarOpen(true);
  }, [isMobile]);

  // History State
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isOfflineMode, setIsOfflineMode] = useState(false);

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
      try {
        const { handleRedirectLogin } = await import('./lib/firebase');
        await handleRedirectLogin();
      } catch (error) {
        console.error('Redirect login initialization failed:', error);
        setLoginError(error instanceof Error ? error.message : 'Unable to complete sign-in redirect.');
        setLoading(false);
      }
    };
    initAuth();

    return onAuthStateChanged(auth, (u) => {
      console.log('Auth state changed:', u?.uid || 'no user');
      setUser(u);
      if (u) {
        setLoginError(null);
      } else {
        setProject(INITIAL_PROJECT);
        setCharacters([]);
        setPlotNodes([]);
        setChapters([]);
        setResearch([]);
        setSourceMaterials([]);
        setExternalReviews([]);
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
      return;
    }

    // ── Local-first: immediately hydrate from cache so UI is never blank ──
    const cachedList = (() => {
      try {
        const raw = localStorage.getItem(`ls_projects_cache_${user.uid}`);
        return raw ? (JSON.parse(raw) as Project[]) : [];
      } catch { return []; }
    })();
    if (cachedList.length > 0) {
      setProjects(cachedList);
      setIsProjectsLoading(false);
      // Restore last active project from cache immediately
      const cachedId = localStorage.getItem(`lastProject_${user.uid}`);
      if (cachedId) {
        const cachedProj = cachedList.find(p => p.id === cachedId);
        if (cachedProj) {
          setProject(cachedProj);
          // Also restore cached chapters for instant display
          const cachedChaps = loadCachedChapters(cachedId);
          if (cachedChaps.length > 0) setChapters(cachedChaps);
        }
      }
    }

    const q = query(
      collection(db, 'projects'), 
      where('ownerId', '==', user.uid)
    );
    
    const unsubProjects = onSnapshot(q, (snap) => {
      const projectsList = snap.docs
        .map(d => d.data() as Project)
        .filter(p => p.ownerId === user.uid)
        .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

      setProjects(projectsList);
      setIsProjectsLoading(false);
      setIsOfflineMode(false);
      localStorage.setItem(`ls_projects_cache_${user.uid}`, JSON.stringify(projectsList));

      if (projectsList.length === 0 && !loading) return;

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
        }
        if (projectsList.length === 0) return INITIAL_PROJECT;
        return projectsList[0];
      });

    }, (err) => {
      setIsProjectsLoading(false);
      handleFirestoreError(err, OperationType.GET, 'projects');
      // ── Offline recovery: load from cache and show banner ──
      const cached = (() => {
        try {
          const raw = localStorage.getItem(`ls_projects_cache_${user.uid}`);
          return raw ? (JSON.parse(raw) as Project[]) : [];
        } catch { return []; }
      })();
      if (cached.length > 0) {
        setProjects(cached);
        setIsOfflineMode(true);
        addNotification('⚠️ Cloud sync failed. Showing locally cached projects — your work is safe.', 'error');
      } else {
        setIsOfflineMode(true);
        addNotification('⚠️ Cannot reach cloud storage. No local cache found. Please check your connection.', 'error');
      }
    });

    return unsubProjects;
  }, [user, loading]);

  // Clear sub-states when project changes to prevent data bleeding
  useEffect(() => {
    setCharacters([]);
    setPlotNodes([]);
    setChapters([]);
    setResearch([]);
    setSourceMaterials([]);
    setExternalReviews([]);
    setPresence([]);
    setHistory([]);
    setFuture([]);
  }, [project.id]);

  const createNewProject = async (title: string = 'Untitled Narrative') => {
    if (!user) return;
    const newId = `project_${crypto.randomUUID()}`;
    const newProjectData: Project = {
      ...INITIAL_PROJECT,
      title,
      id: newId,
      ownerId: user.uid,
      createdAt: Date.now(),
      lastModified: Date.now(),
      updatedAt: serverTimestamp() as any
    };

    // ── Local-first: update state + cache BEFORE awaiting Firestore ──
    setProject(newProjectData);
    setProjects(prev => [newProjectData, ...prev]);
    setCurrentView('dashboard');

    const result = await persistCreateProject(user.uid, newProjectData);
    if (!result.ok && 'error' in result) {
      addNotification(`\u26a0\ufe0f New project saved locally but cloud sync failed: ${result.error}`, 'error');
    }
  };

  // Auto-create initial project if none exist
  useEffect(() => {
    if (user && !loading && !isProjectsLoading && projects.length === 0 && project.id === 'default' && !isCreatingInitialProjectRef.current) {
      isCreatingInitialProjectRef.current = true;
      console.log('No projects found, triggering auto-creation...');
      createNewProject('My First Manuscript');
    }
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
      const cloudChapters = snap.docs.map(d => d.data() as Chapter).sort((a, b) => a.order - b.order);
      // Merge with local hardsaves: if a local hardsave is newer, prefer it
      const chapterList = mergeChaptersWithLocalHardsaves(cloudChapters);
      setChapters(chapterList);
      // Update hardsave cache and chapter registry
      chapterList.forEach(c => {
        localStorage.setItem(`ls_hardsave_${c.id}`, c.content ?? '');
      });
      try {
        localStorage.setItem(`ls_chapters_${projectId}`, JSON.stringify(chapterList));
      } catch { /* quota */ }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `projects/${projectId}/chapters`);
      // Fall back to cached chapters
      const cached = loadCachedChapters(projectId);
      if (cached.length > 0) {
        setChapters(cached);
        addNotification('\u26a0\ufe0f Chapter sync failed \u2014 showing locally cached chapters.', 'error');
      }
    });
    
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
      setTimeout(() => setIsSaving(false), 500);
    } catch (e) { 
      handleFirestoreError(e, OperationType.WRITE, path); 
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
    if (!user || !project.id || project.id === 'default') return;
    setIsSaving(true);
    setSaveStatus('saving');

    const result = await persistSaveProject(user.uid, project);

    setIsSaving(false);
    if (result.ok) {
      setSaveStatus('saved');
      addNotification('\u2713 Project saved successfully.', 'success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else if ('error' in result) {
      setSaveStatus('error');
      if (result.fromCache) {
        addNotification(`\u26a0\ufe0f Saved locally \u2014 cloud sync failed: ${result.error}`, 'error');
      } else {
        addNotification(`\u2717 Save failed: ${result.error}`, 'error');
      }
      setTimeout(() => setSaveStatus('idle'), 5000);
    }
  };

  const onNotify = addNotification;

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
    const result = await persistUpsertChapter(user.uid, project.id, chap);
    if (!result.ok && 'error' in result && !result.fromCache) {
      addNotification(`\u26a0\ufe0f Chapter saved locally \u2014 cloud sync failed: ${result.error}`, 'error');
    }
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
    try {
      await setDoc(doc(db, 'projects', project.id, 'research', note.id), { ...note, updatedAt: Date.now() });
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
    const result = await persistUpsertChapterBatch(user.uid, project.id, chapList, chapters);
    if (!result.ok && 'error' in result) {
      if (result.fromCache) {
        addNotification(`\u26a0\ufe0f Chapters saved locally \u2014 cloud sync failed: ${result.error}`, 'error');
      } else {
        addNotification(`\u2717 Chapter batch save failed: ${result.error}`, 'error');
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
      title: "Manuscripts",
      items: [
        { id: 'library', label: 'Universal Vault', icon: Library },
        { id: 'dashboard', label: 'Narrative Pulse', icon: BarChart3 },
      ]
    },
    {
      title: "1. Strategy",
      items: [
        { id: 'prizes', label: 'Prize Cabinet', icon: Trophy },
        { id: 'reviews', label: 'Critical Vault', icon: MessageSquare },
        { id: 'brainstorm', label: 'AI Spark', icon: Sparkles },
      ]
    },
    {
      title: "2. Foundations",
      items: [
        { id: 'characters', label: 'Character Forge', icon: Users },
        { id: 'intelligence', label: 'Intelligence Lab', icon: BrainCircuit },
      ]
    },    {
      title: "3. Structure",
      items: [
        { id: 'architect', label: 'Finish & Fix', icon: Construction },
      ]
    },
    {
      title: "4. Execution",
      items: [
        { id: 'writing', label: 'Writing Studio', icon: PenTool },
        { id: 'swarm', label: 'Critic Swarm', icon: Zap },
      ]
    },
    {
      title: "5. Delivery",
      items: [
        { id: 'export', label: 'Export & Publish', icon: Globe },
        { id: 'bundle', label: 'Evidence Bundle', icon: Scale },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  if (loading) {
    return (
      <div className="h-screen bg-surface-bg flex flex-col items-center justify-center gap-5">
        {/* Logo mark */}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', boxShadow: '0 0 32px rgba(20,184,166,0.3)' }}
        >
          <span className="font-black text-white text-xl font-serif italic">S</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="text-sm font-semibold text-text-primary">Shakespeare</div>
          <div className="text-[10px] text-text-tertiary">O'Crowley Nexus</div>
          <div className="w-40 h-0.5 bg-border-subtle rounded-full overflow-hidden mt-1">
            <motion.div 
              animate={{ x: [-160, 160] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
              className="w-1/2 h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #14b8a6, transparent)' }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isReading && readerProject) {
    return (
      <PinGate>
        <ReaderView 
          project={readerProject} 
          chapters={readerChapters} 
          isLoggedIn={!!user}
          onBack={() => {
            setIsReading(false);
            window.history.replaceState({}, '', window.location.pathname);
          }}
        />
      </PinGate>
    );
  }

  if (!user) {
    return (
      <PinGate>
        <div className="h-screen bg-surface-bg flex items-center justify-center p-6 relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, rgba(20,184,166,0.06) 0%, transparent 70%)' }}
          />
          
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="max-w-sm w-full relative z-10"
          >
            {/* Card */}
            <div className="bg-surface-card border border-border-medium rounded-2xl p-8 text-center"
              style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(20,184,166,0.08)' }}
            >
              {/* Logo */}
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-6"
                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', boxShadow: '0 8px 24px rgba(20,184,166,0.35)' }}
              >
                <span className="font-black text-white text-2xl font-serif italic">S</span>
              </div>

              <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-1 italic font-serif">Shakespeare</h1>
              <p className="text-[10px] font-semibold text-brand-primary uppercase tracking-[0.3em] mb-1">O'Crowley Nexus</p>
              <p className="text-xs text-text-tertiary mb-8">AI-powered book writing platform</p>

              <button 
                onClick={handleLogin}
                className="group w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-3 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', boxShadow: '0 8px 24px rgba(20,184,166,0.3)' }}
              >
                <LogIn size={16} className="group-hover:translate-x-0.5 transition-transform" />
                Sign in with Google
              </button>

              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-status-error/10 border border-status-error/20 rounded-xl text-xs text-status-error"
                >
                  {loginError}
                </motion.div>
              )}
            </div>

            <p className="text-center text-[10px] text-text-tertiary mt-4">Part of the O'Crowley Nexus suite</p>
          </motion.div>
        </div>
      </PinGate>
    );
  }

  return (
    <PinGate>
      <div 
        className="flex h-dvh bg-surface-bg text-text-primary font-sans selection:bg-brand-primary/30 overflow-hidden print:h-auto print:overflow-visible"
        style={{ minHeight: 0 }}
      >
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

      {/* Sidebar — Caspa × O'Crowley Nexus */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (isMobile ? '85%' : 256) : (isMobile ? 0 : 72),
          x: isMobile && !isSidebarOpen ? '-100%' : 0
        }}
        className={`flex flex-col bg-brand-dark text-text-primary relative border-r border-border-subtle overflow-hidden no-print ${
          isMobile ? 'fixed inset-y-0 left-0 z-[101]' : 'z-50'
        }`}
        style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.4)' }}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-3 border-b border-border-subtle">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', boxShadow: '0 0 16px rgba(20,184,166,0.35)' }}
          >
            <span className="font-black text-white text-base font-serif italic">S</span>
          </div>
          {isSidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
              <div className="font-black text-base italic tracking-tight font-serif text-text-primary leading-none">Shakespeare</div>
              <div className="text-[9px] font-semibold text-brand-primary uppercase tracking-[0.25em] opacity-80 mt-0.5">O'Crowley Nexus</div>
            </motion.div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="mb-4">
              {isSidebarOpen ? (
                <div className="text-[9px] font-bold text-text-tertiary uppercase tracking-[0.3em] px-3 mb-2">{group.title}</div>
              ) : (
                groupIndex > 0 && <div className="w-8 h-px bg-border-subtle mx-auto my-3" />
              )}
              <div className="space-y-0.5">
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
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-[11px] font-semibold ${
                        isActive 
                          ? 'bg-brand-primary/15 text-brand-primary' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay active:scale-95'
                      }`}
                      style={isActive ? { boxShadow: 'inset 2px 0 0 #14b8a6' } : {}}
                      title={item.label}
                    >
                      <Icon size={17} className={isActive ? 'text-brand-primary' : 'text-text-tertiary group-hover:text-text-secondary transition-colors'} />
                      {isSidebarOpen && (
                        <span className="flex-1 text-left truncate">{item.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 py-3 border-t border-border-subtle">
          <div className={`flex items-center gap-1 ${isSidebarOpen ? 'justify-between px-1' : 'justify-center flex-col'}`}>
            <button 
              onClick={undo}
              disabled={history.length === 0}
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-overlay rounded-lg transition-all disabled:opacity-20 active:scale-90"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={16} />
            </button>
            <button 
              onClick={redo}
              disabled={future.length === 0}
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-overlay rounded-lg transition-all disabled:opacity-20 active:scale-90"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw size={16} />
            </button>
            <button 
              onClick={saveToCloud}
              className={`p-2 rounded-lg transition-all active:scale-90 ${isSaving ? 'text-brand-primary' : 'text-text-tertiary hover:text-brand-primary hover:bg-surface-overlay'}`}
              title="Sync to Cloud"
            >
              <Save size={16} />
            </button>
          </div>
        </div>

        {/* User */}
        <div className="p-3 border-t border-border-subtle flex items-center gap-3">
          <img src={user.photoURL || ''} className="w-9 h-9 rounded-xl border border-border-medium object-cover shrink-0" alt="Profile" />
          {isSidebarOpen && (
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-semibold truncate text-text-primary">{user.displayName}</div>
              <button onClick={logout} className="text-[10px] text-text-tertiary hover:text-red-400 transition-colors flex items-center gap-1 mt-0.5">
                <LogOut size={10} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main 
        className="flex-1 flex flex-col relative overflow-hidden print:overflow-visible print:block print:static min-w-0"
        style={{ minHeight: 0 }}
      >
        {/* Top Header — Caspa style */}
        <header className="h-14 border-b border-border-subtle flex items-center justify-between px-4 md:px-6 bg-surface-card relative z-10 shrink-0 no-print"
          style={{ boxShadow: '0 1px 0 rgba(20,184,166,0.08)' }}
        >
          <div className="flex items-center gap-3 md:gap-5 overflow-hidden h-full">
            {!isMobile && <div className="text-[9px] font-mono text-text-tertiary border border-border-subtle/40 px-2 py-0.5 rounded-md opacity-60">v2.5.5</div>}
            
            {/* Project selector — Caspa style */}
            <div className="relative h-full flex items-center">
              <button 
                onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-overlay transition-all rounded-xl group border border-transparent hover:border-border-medium"
              >
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
                >
                  <span className="text-white text-[9px] font-black font-serif italic">{(project.title || 'U').charAt(0)}</span>
                </div>
                <div className="flex flex-col items-start min-w-0 text-left">
                  <span className="text-sm font-semibold text-text-primary truncate max-w-[120px] md:max-w-[320px] leading-tight">{project.title || 'Untitled'}</span>
                  <span className="text-[9px] text-text-tertiary capitalize">{project.type} · {chapters.length} chapters</span>
                </div>
                <ChevronDown size={14} className={`text-text-tertiary group-hover:text-brand-primary transition-all duration-200 shrink-0 ${isProjectMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isProjectMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 4, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    className="absolute top-full left-0 w-[90vw] md:w-[440px] bg-surface-card rounded-2xl border border-border-medium z-[110] overflow-hidden mt-1"
                    style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(20,184,166,0.08)' }}
                  >
                    <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Projects</span>
                      <span className="badge-teal">{projects.length}</span>
                    </div>
                    <div className="max-h-[380px] overflow-y-auto custom-scrollbar p-2">
                      {isProjectsLoading ? (
                        <div className="py-8 text-center text-xs text-text-tertiary">Loading...</div>
                      ) : projects.length === 0 ? (
                        <div className="py-8 text-center text-xs text-text-tertiary">No projects yet</div>
                      ) : (
                        projects.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setProject(p); setIsProjectMenuOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                              p.id === project.id 
                                ? 'bg-brand-primary/15 text-brand-primary' 
                                : 'hover:bg-surface-overlay text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              p.id === project.id ? 'bg-brand-primary/20' : 'bg-surface-muted'
                            }`}>
                              <Library size={14} className={p.id === project.id ? 'text-brand-primary' : 'text-text-tertiary'} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium leading-tight truncate italic font-serif">{p.title || 'Untitled'}</div>
                              <div className="text-[9px] text-text-tertiary mt-0.5 capitalize">{p.type} · {new Date(p.lastModified).toLocaleDateString()}</div>
                            </div>
                            {p.id === project.id && <div className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="p-3 border-t border-border-subtle grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => {
                          const title = window.prompt('New project name:');
                          if (title) createNewProject(title);
                          setIsProjectMenuOpen(false);
                        }}
                        className="flex items-center justify-center gap-2 py-2.5 bg-surface-raised hover:bg-surface-overlay text-text-primary rounded-xl text-xs font-semibold transition-all border border-border-medium active:scale-95"
                      >
                        <Plus size={14} />
                        New Project
                      </button>
                      <label className="flex items-center justify-center gap-2 py-2.5 bg-brand-primary hover:bg-brand-accent text-white rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95"
                        style={{ boxShadow: '0 4px 12px rgba(20,184,166,0.25)' }}
                      >
                        <Upload size={14} />
                        Import
                        <input type="file" className="hidden" accept=".pdf,.txt,.md,.json" onChange={handleBulkIngest} />
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Save status */}
            <AnimatePresence mode="wait">
              {saveStatus === 'saving' && (
                <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-lg text-[9px] font-semibold text-brand-primary"
                >
                  <div className="w-1 h-1 rounded-full bg-brand-primary animate-ping" />
                  Saving
                </motion.div>
              )}
              {saveStatus === 'saved' && (
                <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-status-success/10 border border-status-success/20 rounded-lg text-[9px] font-semibold text-status-success"
                >
                  <div className="w-1 h-1 rounded-full bg-status-success" />
                  Saved
                </motion.div>
              )}
              {(saveStatus === 'error' || (isOfflineMode && saveStatus === 'idle')) && (
                <motion.div key="offline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-status-warning/10 border border-status-warning/20 rounded-lg text-[9px] font-semibold text-status-warning"
                >
                  <div className="w-1 h-1 rounded-full bg-status-warning animate-pulse" />
                  {saveStatus === 'error' ? 'Local only' : 'Offline'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Header right */}
          <div className="flex items-center gap-2 shrink-0">
            {isMobile && (
              <button onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-overlay rounded-lg transition-all border border-border-subtle"
              >
                <Menu size={18} />
              </button>
            )}
            {!isMobile && (
              <button onClick={() => setCurrentView('export')}
                className="px-4 py-2 bg-brand-primary hover:bg-brand-accent text-white rounded-xl text-xs font-semibold transition-all active:scale-95"
                style={{ boxShadow: '0 4px 12px rgba(20,184,166,0.2)' }}
              >
                Export
              </button>
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-surface-overlay rounded-lg transition-all hidden lg:flex items-center justify-center active:scale-90 border border-border-subtle"
              title="Toggle Sidebar"
            >
              <GitBranch size={16} className={isSidebarOpen ? 'rotate-90 transition-transform duration-300' : 'transition-transform duration-300'} />
            </button>
          </div>
        </header>

        {/* View Transition Area */}
        <div 
          className={`flex-1 relative bg-surface-bg print:bg-white print:p-0 flex flex-col overflow-hidden`}
          style={{ minHeight: 0 }}
        >
          <div
            className={`w-full flex-1 flex flex-col min-h-0 ${
              ['writing', 'plot', 'swarm', 'brainstorm', 'characters', 'research', 'library', 'intelligence'].includes(currentView) 
                ? `w-full ${currentView === 'writing' ? '' : 'p-2 md:p-6 lg:p-8'}`
                : 'w-full'
            }`}
            style={{ minHeight: 0 }}
          >
            {currentView === 'library' && (
              <LibraryView 
                key="library"
                projects={projects}
                onSelectProject={(p) => {
                  setProject(p);
                  setCurrentView('dashboard');
                }}
                onCreateProject={() => createNewProject()}
                onDeleteProject={(id) => deleteProject(id)}
              />
            )}
            {(currentView === 'dashboard' || currentView === 'brainstorm') && (
                 <div key={project.id} className="flex-1 flex flex-col min-h-0">
                   {currentView === 'dashboard' && (
                     <Dashboard 
                       project={{ ...project, stats: { ...project.stats, totalWords } }} 
                       projects={projects}
                       chapters={chapters}
                       selectProject={(p) => setProject(p)}
                       createNewProject={createNewProject}
                       updateProject={updateProject} 
                       setView={setCurrentView} 
                       deleteProject={deleteProject}
                       saveToCloud={saveToCloud}
                       isSaving={isSaving}
                     />
                   )}
                   {currentView === 'brainstorm' && (
                     <Brainstorm 
                       project={project} 
                       research={research}
                       sourceMaterials={sourceMaterials}
                       updateProject={updateProject} 
                       onAddResearch={upsertResearch}
                       onError={(msg) => addNotification(msg, 'error')}
                     />
                   )}
                 </div>
              )}
              {currentView === 'characters' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <CharacterForge 
                    key={project.id}
                    project={{ ...project, characters }} 
                    research={research}
                    chapters={chapters}
                    updateProject={async (updates) => {
                      if (updates.characters) {
                        await upsertCharacterBatch(updates.characters);
                      }
                    }} 
                    onDeduplicateCharacters={deduplicateCharacters}
                    onError={(msg) => addNotification(msg, 'error')}
                  />
                </div>
              )}
              {currentView === 'plot' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <PlotArchitect 
                    key={project.id}
                    project={{ ...project, chapters, sourceMaterials }}
                    chapters={chapters} 
                    plotNodes={plotNodes} 
                    research={research}
                    updateProject={updateProject}
                    updatePlotNodes={async (nodes) => {
                       setPlotNodes(nodes);
                       await upsertPlotNodesBatch(nodes);
                    }}
                    updateChapters={async (chapList) => {
                      setChapters(chapList);
                      await upsertChapterBatch(chapList);
                    }}
                    onNotify={(msg, type) => addNotification(msg, type)}
                    onError={(msg) => addNotification(msg, 'error')}
                  />
                </div>
              )}
              {currentView === 'intelligence' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <IntelligenceLab 
                    key={project.id}
                    project={project} 
                    research={research} 
                    chapters={chapters}
                    sourceMaterials={sourceMaterials}
                    onAddResearch={upsertResearch}
                    onDeleteResearch={(id) => deleteSubDoc('research', id)}
                    onAddChapter={upsertChapter}
                    onAddSource={upsertSourceMaterial}
                    onDeleteSource={(id) => deleteSubDoc('sourceMaterials', id)}
                    onNotify={(msg, type) => addNotification(msg, type)}
                  />
                </div>
              )}
              {currentView === 'writing' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <WritingStudio 
                    key={project.id}
                    project={{ ...project, chapters, sourceMaterials, research, externalReviews }} 
                    plotNodes={plotNodes}
                    presence={presence}
                    updateProject={updateProject} 
                    updatePlotNodes={async (nodes) => {
                      setPlotNodes(nodes);
                      await upsertPlotNodesBatch(nodes);
                    }}
                    updateChapters={async (chapList) => {
                       setChapters(chapList);
                       await upsertChapterBatch(chapList);
                    }}
                    setView={setCurrentView}
                    upsertChapter={upsertChapter}
                    onDeleteChapter={(id) => deleteSubDoc('chapters', id)}
                    onUpsertSource={upsertSourceMaterial}
                    onDeleteSource={(id) => deleteSubDoc('sourceMaterials', id)}
                    onUpsertCharacters={upsertCharacterBatch}
                    onError={(msg) => addNotification(msg, 'error')}
                  />
                </div>
              )}
              {currentView === 'swarm' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <CriticSwarm 
                    key={project.id}
                    projectType={project.type}
                    maturity={project.maturity}
                    chapters={chapters}
                    sourceMaterials={[...sourceMaterials, ...research.map(r => ({ id: r.id, name: r.title, content: r.content, type: 'Research' }))]}
                    existingCritiques={project.critiques}
                    updateProject={updateProject}
                    updateChapters={async (chaps) => {
                      setChapters(chaps);
                      await upsertChapterBatch(chaps);
                    }}
                    setView={setCurrentView}
                    onError={(msg) => addNotification(msg, 'error')}
                  />
                </div>
              )}
              {currentView === 'prizes' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <PrizeView 
                    key={project.id}
                    project={project}
                    chapters={chapters}
                    updateProject={updateProject}
                  />
                </div>
              )}
              {currentView === 'reviews' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <ReviewVault 
                    key={project.id}
                    project={project}
                    reviews={externalReviews}
                    onUpsert={upsertExternalReview}
                    onDelete={(id) => deleteSubDoc('externalReviews', id)}
                  />
                </div>
              )}
              {currentView === 'bundle' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <CourtBundleView
                    key={project.id}
                    project={project}
                    chapters={chapters}
                    research={research}
                    characters={characters}
                    plotNodes={plotNodes}
                    onNotify={(msg, type) => addNotification(msg, type)}
                  />
                </div>
              )}
              {currentView === 'export' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <PublishView 
                    key={project.id}
                    project={project}
                    chapters={chapters}
                    updateProject={updateProject}
                    onNotify={(msg, type) => addNotification(msg, type)}
                  />
                </div>
              )}
              {currentView === 'architect' && (
                <div className="flex-1 flex flex-col min-h-0">
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
                      setCharacters(prev => [...prev, ...chars]); // Optimistic update
                      await upsertCharacterBatch(chars);
                    }}
                    onAddResearch={upsertResearch}
                    setView={setCurrentView}
                    onError={(msg) => addNotification(msg, 'error')}
                  />
                </div>
              )}
              {currentView === 'settings' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <SettingsView 
                    key={project.id}
                    project={project} 
                    updateProject={updateProject}
                    deleteProject={deleteProject}
                  />
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Notifications Toast */}
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 pointer-events-none">
          <AnimatePresence>
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 20, y: 0, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border min-w-[300px] max-w-[420px] backdrop-blur-xl ${
                  n.type === 'error' && n.message.startsWith('⚠') ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                  n.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                  n.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  'bg-brand-primary/10 border-brand-primary/20 text-brand-primary'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  n.type === 'error' && n.message.startsWith('\u26a0') ? 'bg-amber-500/20' :
                  n.type === 'error' ? 'bg-red-500/20' :
                  n.type === 'success' ? 'bg-emerald-500/20' :
                  'bg-brand-primary/20'
                }`}>
                  {n.type === 'error' ? <X size={14} /> : n.type === 'success' ? <Zap size={14} /> : <Activity size={14} />}
                </div>
                <p className="text-xs font-black uppercase tracking-widest leading-tight">{n.message}</p>
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
    </PinGate>
    );
}
