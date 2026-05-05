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
  Activity
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
import PlotArchitect from './components/PlotArchitect';
import WritingStudio from './components/WritingStudio';
import { ResearchLibrary } from './components/ResearchLibrary';
import CriticSwarm from './components/CriticSwarm';
import ManuscriptFixer from './components/ManuscriptFixer';
import SettingsView from './components/SettingsView';
import PublishView from './components/PublishView';
import PrizeView from './components/PrizeView';
import ReaderView from './components/ReaderView';
import ResearchAssistant from './components/ResearchAssistant';
import ReviewVault from './components/ReviewVault';

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
  const [authInitError, setAuthInitError] = useState<string | null>(null);
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

  const addNotification = (_message: string, _type: 'error' | 'success' | 'info' = 'info') => {
    return; // Silenced per user request to "stop them totally"
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
    let authResolved = false;
    const authTimeout = window.setTimeout(() => {
      if (!authResolved) {
        console.error('Auth initialization timed out. Falling back to signed-out state.');
        setAuthInitError('Authentication service took too long to initialize. Please refresh and try again.');
        setUser(null);
        setLoading(false);
      }
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      authResolved = true;
      window.clearTimeout(authTimeout);
      console.log('Auth state changed:', u?.uid || 'no user');
      setUser(u);
      setAuthInitError(null);
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
    }, (error) => {
      authResolved = true;
      window.clearTimeout(authTimeout);
      console.error('Auth state listener error:', error);
      setAuthInitError(error?.message || 'Failed to initialize authentication.');
      setUser(null);
      setLoading(false);
    });

    return () => {
      window.clearTimeout(authTimeout);
      unsubscribe();
    };
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

  // Project List Sync
  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
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
      console.log('Project List Synced:', projectsList.length, 'projects found');

      if (projectsList.length === 0 && !loading) {
        return;
      }

      // Select project only on initial load or if current is missing
      setProject(current => {
        const savedId = localStorage.getItem(`lastProject_${user.uid}`);
        
        // If we have a real project, keep it unless it was deleted
        if (current.id && current.id !== 'default') {
          const stillExists = projectsList.find(p => p.id === current.id);
          if (stillExists) return current;
        }

        // Try saved ID from localStorage
        if (savedId) {
          const found = projectsList.find(p => p.id === savedId);
          if (found) return found;
        }

        // Fallback to first in list
        return projectsList.length > 0 ? projectsList[0] : current;
      });
    }, (err) => {
      setIsProjectsLoading(false);
      try {
        handleFirestoreError(err, OperationType.GET, 'projects');
      } catch (e) {
        console.error("Projects sync failure:", e);
        addNotification("Failed to load projects. Please refresh.", "error");
      }
    });

    return unsubProjects;
  }, [user]);

  const createNewProject = async (title: string = 'Untitled Narrative') => {
    if (!user) return;
    const newId = `project_${crypto.randomUUID()}`;
    const projectRef = doc(db, 'projects', newId);
    const path = `projects/${newId}`;
    try {
      const newProjectData: Project = { 
        ...INITIAL_PROJECT,
        title,
        id: newId,
        ownerId: user.uid,
        createdAt: Date.now(),
        lastModified: Date.now(),
        updatedAt: serverTimestamp() as any
      };
      
      // Update localStorage immediately to prevent sync races
      localStorage.setItem(`lastProject_${user.uid}`, newId);
      
      await setDoc(projectRef, newProjectData);
      setProject(newProjectData);
      setCurrentView('dashboard');
      // Suppressed per user request: addNotification('New project created successfully.', 'success');
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, path); }
  };

  // Auto-create initial project if none exist
  useEffect(() => {
    if (user && !loading && !isProjectsLoading && projects.length === 0 && project.id === 'default') {
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
      setCharacters(snap.docs.map(d => d.data() as Character).sort((a, b) => b.updatedAt - a.updatedAt));
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${projectId}/characters`));
    
    const unsubNodes = onSnapshot(collection(db, 'projects', projectId, 'plotNodes'), (snap) => {
      setPlotNodes(snap.docs.map(d => d.data() as PlotNode).sort((a, b) => a.order - b.order));
    }, (err) => handleFirestoreError(err, OperationType.GET, `projects/${projectId}/plotNodes`));
    
    const unsubChapters = onSnapshot(collection(db, 'projects', projectId, 'chapters'), (snap) => {
      setChapters(snap.docs.map(d => d.data() as Chapter).sort((a, b) => a.order - b.order));
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


  const updateProject = async (updates: Partial<Project>) => {
    if (!user || !project.id || project.id === 'default') return;
    
    // Ensure publishing config exists if being updated or requested
    const finalUpdates = { ...updates };
    if (!project.publishing && !updates.publishing) {
      // Lazy init publishing config if needed, or just let it be Partial
    }

    // Optimistic Update
    setProject(prev => ({ ...prev, ...finalUpdates }));
    pushToHistory(project);

    const path = `projects/${project.id}`;
    const projectRef = doc(db, 'projects', project.id);
    setIsSaving(true);
    
    try {
      await updateDoc(projectRef, { 
        ...updates, 
        lastModified: Date.now(),
        updatedAt: serverTimestamp() 
      });
      setTimeout(() => setIsSaving(false), 500);
    } catch (e) { 
      handleFirestoreError(e, OperationType.WRITE, path); 
      setIsSaving(false);
    }
  };

  const deleteProject = async () => {
    if (!user || !project.id || project.id === 'default') return;
    if (!window.confirm("Are you sure you want to permanently delete this project? Data cannot be recovered.")) return;
    
    const path = `projects/${project.id}`;
    const projectRef = doc(db, 'projects', project.id);
    try {
      await deleteDoc(projectRef);
      setHistory([]);
      setFuture([]);
      setCurrentView('dashboard');
      // Suppressed per user request: addNotification('Project permanently deleted.', 'info');
    } catch (e) { handleFirestoreError(e, OperationType.DELETE, path); }
  };

  const saveToCloud = async () => {
    if (!user || !project.id || project.id === 'default') return;
    setIsSaving(true);
    const path = `projects/${project.id}`;
    try {
      const projectRef = doc(db, 'projects', project.id);
      
      // Explicitly pick only fields allowed by firestore.rules to avoid Permission Denied
      const allowedFields = {
        title: project.title,
        type: project.type,
        maturity: project.maturity,
        genre: project.genre,
        premise: project.premise,
        tone: project.tone,
        collaborators: project.collaborators || [],
        lastModified: Date.now(),
        stats: project.stats || {},
        critiques: project.critiques || {},
        id: project.id,
        targetPrize: project.targetPrize || '',
        prizeAssessments: project.prizeAssessments || [],
        sourceMaterials: project.sourceMaterials || [],
        externalReviews: project.externalReviews || [],
        isPublic: project.isPublic || false,
        publicId: project.publicId || '',
        targetWordCount: project.targetWordCount || 0,
        publishing: project.publishing || null,
        updatedAt: serverTimestamp()
      };

      await updateDoc(projectRef, allowedFields);
      setTimeout(() => setIsSaving(false), 1000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      setIsSaving(false);
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
    if (!user || charList.length === 0) return;
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    charList.forEach(char => {
      const ref = doc(db, 'projects', project.id, 'characters', char.id);
      batch.set(ref, { ...char, updatedAt: Date.now() });
    });
    try {
      await batch.commit();
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, `projects/${project.id}/characters (batch)`); }
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
      await setDoc(doc(db, 'projects', project.id, 'chapters', chap.id), chap);
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

  const upsertPlotNodesBatch = async (nodes: PlotNode[]) => {
    if (!user || nodes.length === 0) return;
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    
    nodes.forEach((node, idx) => {
      const ref = doc(db, 'projects', project.id, 'plotNodes', node.id);
      batch.set(ref, { ...node, order: idx, updatedAt: Date.now() });
    });
    
    try {
      await batch.commit();
    } catch (e) { handleFirestoreError(e, OperationType.WRITE, `projects/${project.id}/plotNodes (batch)`); }
  };
  const upsertChapterBatch = async (chapList: Chapter[]) => {
    if (!user) return;
    const { writeBatch } = await import('firebase/firestore');
    
    // Split into chunks of 100 (well within Firebase 500 limit)
    const chunkSize = 100;
    for (let i = 0; i < chapList.length; i += chunkSize) {
      const chunk = chapList.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      
      chunk.forEach(chap => {
        const chapRef = doc(db, 'projects', project.id, 'chapters', chap.id);
        batch.set(chapRef, { ...chap, updatedAt: Date.now() });
      });

      try {
        await batch.commit();
        console.log(`Cloud Sync: Batch ${Math.floor(i / chunkSize) + 1} finalized.`);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `projects/${project.id}/chapters/BATCH_${i}`);
      }
    }
  };

  const navGroups = [
    {
      title: "1. Conception",
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'prizes', label: 'Prize Cabinet', icon: Trophy },
        { id: 'reviews', label: 'Review Vault', icon: MessageSquare },
        { id: 'brainstorm', label: 'AI Brainstorm', icon: Sparkles },
      ]
    },
    {
      title: "2. World Building",
      items: [
        { id: 'characters', label: 'Character Forge', icon: Users },
        { id: 'research', label: 'Research Library', icon: Library },
        { id: 'research_assistant', label: 'Research Agent', icon: BrainCircuit },
      ]
    },
    {
      title: "3. Structure",
      items: [
        { id: 'plot', label: 'Plot Architect', icon: GitBranch },
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
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full shadow-[0_0_15px_rgba(37,99,235,0.3)]"
        />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Initializing Narrative Systems...</p>
      </div>
    );
  }

  if (isReading && readerProject) {
    return (
      <ReaderView 
        project={readerProject} 
        chapters={readerChapters} 
        isLoggedIn={!!user}
        onBack={() => {
          setIsReading(false);
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl p-12 shadow-2xl text-center space-y-8"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl rotate-3">
             <Globe size={40} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 italic font-serif">NovelWrite <span className="text-blue-600 font-sans tracking-wide">PRO</span></h1>
            <p className="text-slate-500 font-medium italic">Architecting tomorrow's narratives, today.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-4 transition-all shadow-xl shadow-slate-200"
          >
            <LogIn size={20} />
            Authorize Google Sync
          </button>
          {(loginError || authInitError) && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium"
            >
              {loginError || authInitError}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-surface-bg text-slate-900 font-sans selection:bg-blue-100 overflow-hidden print:h-auto print:overflow-visible">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (isMobile ? '85%' : 260) : (isMobile ? 0 : 80),
          x: isMobile && !isSidebarOpen ? '-100%' : 0
        }}
        className={`flex flex-col bg-slate-950 text-white relative shadow-2xl border-r border-slate-900 overflow-hidden no-print ${
          isMobile ? 'fixed inset-y-0 left-0 z-[101]' : 'z-20'
        }`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shadow-inner font-bold text-lg rotate-3">
            N
          </div>
          {isSidebarOpen && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-black text-xl italic tracking-tight font-serif"
            >
              NovelWrite <span className="text-blue-500 font-normal font-sans tracking-widest text-[10px] uppercase ml-1 relative -top-1">PRO</span>
            </motion.h1>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-4 mt-4 overflow-y-auto custom-scrollbar">
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-1">
              {isSidebarOpen ? (
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] px-3 mb-2">{group.title}</div>
              ) : (
                <div className="w-full h-px bg-slate-800 my-2" />
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
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group text-xs font-bold uppercase tracking-widest ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                        : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                    title={item.label}
                  >
                    <Icon size={18} className={isActive ? 'text-white' : 'group-hover:text-blue-400 transition-colors'} />
                    {isSidebarOpen && (
                      <span className="flex-1 text-left truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-4 py-4 space-y-2 border-t border-slate-900 mx-3">
          <div className={`flex items-center gap-1 ${isSidebarOpen ? 'justify-between' : 'justify-center flex-col'}`}>
            <button 
              onClick={undo}
              disabled={history.length === 0}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all disabled:opacity-20"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={16} />
            </button>
            <button 
              onClick={redo}
              disabled={future.length === 0}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all disabled:opacity-20"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw size={16} />
            </button>
            <button 
              onClick={saveToCloud}
              className={`p-2 text-slate-400 hover:text-blue-500 hover:bg-white/5 rounded-lg transition-all ${isSaving ? 'text-blue-500' : ''}`}
              title="Manual Sync"
            >
              <Save size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-slate-900 flex items-center gap-4 bg-slate-900/50">
          <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-slate-800 shadow-lg" alt="Profile" />
          {isSidebarOpen && (
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-black truncate text-slate-200 uppercase tracking-widest">{user.displayName}</div>
              <button onClick={logout} className="text-[9px] font-bold text-slate-500 hover:text-red-400 transition-colors uppercase flex items-center gap-1 mt-1">
                <LogOut size={10} />
                Disconnect
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden print:overflow-visible print:block print:static">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-4 md:px-8 bg-white relative z-10 shrink-0 no-print">
          <div className="flex items-center gap-4 md:gap-10 overflow-hidden h-full">
            {!isMobile && <div className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-400">v2.55</div>}
            
            <div className="relative">
              <button 
                onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition-all rounded-xl group overflow-hidden"
              >
                <div className="flex flex-col items-start min-w-0">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Active Manuscript</div>
                  <div className="flex items-center gap-2 text-slate-900">
                    <span className="italic font-serif truncate max-w-[150px] md:max-w-[250px] font-bold md:text-lg">{project.title}</span>
                    <GitBranch size={14} className={`text-slate-300 group-hover:text-blue-500 transition-all ${isProjectMenuOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isProjectMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="fixed top-16 left-4 md:left-72 w-[85vw] md:w-80 bg-white rounded-2xl shadow-[0_30px_100px_-20px_rgba(0,0,0,0.3)] border border-slate-100 z-[110] overflow-hidden"
                  >
                    <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                      <div className="flex items-center justify-between mb-4 px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory</p>
                        <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-bold">{projects.length} Total</span>
                      </div>
                      <div className="space-y-1">
                        {isProjectsLoading ? (
                          <div className="py-8 text-center text-[10px] font-bold text-slate-400 animate-pulse uppercase tracking-widest">Hydrating Archives...</div>
                        ) : projects.length === 0 ? (
                          <div className="py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Manuscripts Found</div>
                        ) : (
                          projects.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setProject(p);
                                setIsProjectMenuOpen(false);
                              }}
                              className={`w-full text-left p-4 rounded-xl transition-all group/item ${
                                p.id === project.id 
                                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                                  : 'hover:bg-slate-50 text-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.id === project.id ? 'bg-white/20' : 'bg-slate-100 group-hover/item:rotate-3 transition-transform'}`}>
                                  <PenTool size={14} className={p.id === project.id ? 'text-white' : 'text-slate-400'} />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-black leading-tight truncate">{p.title || 'Untitled'}</div>
                                  <div className={`text-[9px] uppercase mt-1 tracking-tighter ${p.id === project.id ? 'text-blue-100' : 'text-slate-400'}`}>
                                    {p.type} • Last Edited {new Date(p.lastModified).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
                       <button 
                        onClick={() => {
                          const title = window.prompt('Enter manuscript title:', 'New Narrative');
                          if (title) createNewProject(title);
                          setIsProjectMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95"
                      >
                        <PenTool size={14} />
                        New Archive Entry
                      </button>

                      <label className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-200 cursor-pointer active:scale-95">
                        <Upload size={14} />
                        Bulk Ingest (.pdf, .txt, .json)
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".pdf,.txt,.md,.json" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !user) return;
                            
                            if (file.size > 10 * 1024 * 1024) {
                              window.alert("File too large. Max 10MB allowed.");
                              return;
                            }

                            setIsProjectMenuOpen(false);
                            
                            try {
                              let content = '';
                              if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                                // Dynamic import for worker if possible or use a reliable CDN
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

                              // Split into chapters if > 800kb
                              const CHUNK_SIZE = 800000;
                              let chaptersCreated = 0;
                              for (let i = 0; i < content.length; i += CHUNK_SIZE) {
                                const chunk = content.substring(i, i + CHUNK_SIZE);
                                const chapterId = crypto.randomUUID();
                                const chapterRef = doc(db, 'projects', newId, 'chapters', chapterId);
                                const newChapter: Chapter = {
                                  id: chapterId,
                                  title: content.length > CHUNK_SIZE ? `Ingested Manuscript (Part ${chaptersCreated + 1})` : 'Ingested Manuscript',
                                  content: chunk,
                                  summary: 'Full manuscript ingest.',
                                  order: chaptersCreated,
                                  plotNodeIds: [],
                                  tags: [],
                                  updatedAt: Date.now()
                                };
                                await setDoc(chapterRef, newChapter);
                                chaptersCreated++;
                              }
                              
                              localStorage.setItem(`lastProject_${user.uid}`, newId);
                              setProject(newProjectData);
                              setCurrentView('dashboard');
                              
                              // Clear the input
                              e.target.value = '';
                            } catch (err) {
                              console.error("Bulk Ingest failed:", err);
                              window.alert(`Ingest failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                              handleFirestoreError(err, OperationType.WRITE, 'projects (bulk ingest)');
                            }
                          }}
                        />
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isSaving && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 animate-pulse hidden md:flex"
              >
                <Save size={10} />
                Manuscript Intelligence Indexed
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
             {isMobile && (
               <button 
                 onClick={() => setIsSidebarOpen(true)}
                 className="p-2 text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
               >
                 <Menu size={20} />
               </button>
             )}
             {!isMobile && (
               <button 
                onClick={() => setCurrentView('export')}
                className="px-5 py-2 bg-slate-900 text-white rounded font-black text-[10px] hover:bg-slate-800 transition-all uppercase tracking-[0.2em] shadow-lg shadow-slate-200"
              >
                Export & Publish
              </button>
             )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-300 hover:text-slate-900 transition-colors hidden lg:block"
            >
              <GitBranch size={20} className={isSidebarOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
            </button>
          </div>
        </header>

        {/* View Transition Area */}
        <div className={`flex-1 relative bg-slate-50/50 print:bg-white print:p-0 ${
          ['writing', 'plot', 'swarm', 'brainstorm', 'characters', 'research'].includes(currentView) 
            ? 'overflow-hidden print:overflow-visible' 
            : 'overflow-y-auto p-4 md:p-12 print:overflow-visible print:p-0'
        }`}>
          <div
            className={`w-full h-full print:h-auto ${
              ['writing', 'plot', 'swarm', 'brainstorm', 'characters', 'research'].includes(currentView) 
                ? `h-full w-full ${currentView === 'writing' ? '' : 'p-4 md:p-8'}`
                : 'min-h-full max-w-7xl mx-auto'
            }`}
          >
            {(currentView === 'dashboard' || currentView === 'brainstorm') && (
                 <>
                   {currentView === 'dashboard' && (
                     <Dashboard 
                       project={{ ...project, stats: { ...project.stats, totalWords } }} 
                       projects={projects}
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
                       updateProject={updateProject} 
                       onAddResearch={upsertResearch}
                       onError={(msg) => addNotification(msg, 'error')}
                     />
                   )}
                 </>
              )}
              {currentView === 'characters' && (
                <CharacterForge 
                  project={{ ...project, characters }} 
                  research={research}
                  chapters={chapters}
                  updateProject={async (updates) => {
                    if (updates.characters) {
                      await upsertCharacterBatch(updates.characters);
                    }
                  }} 
                  onError={(msg) => addNotification(msg, 'error')}
                />
              )}
              {currentView === 'plot' && (
                <PlotArchitect 
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
              )}
              {currentView === 'research' && (
                <ResearchLibrary 
                  project={project} 
                  research={research} 
                  chapters={chapters}
                  onAdd={async (note) => {
                    const path = `projects/${project.id}/research/${note.id}`;
                    try {
                      await setDoc(doc(db, 'projects', project.id, 'research', note.id), { ...note, updatedAt: Date.now() });
                    } catch (e) {
                      handleFirestoreError(e, OperationType.WRITE, path);
                    }
                  }}
                  onDelete={(id) => deleteSubDoc('research', id)}
                  onError={(msg) => addNotification(msg, 'error')}
                />
              )}
              {currentView === 'research_assistant' && (
                <ResearchAssistant 
                  project={project} 
                  research={research} 
                  chapters={chapters}
                  onAddResearch={upsertResearch}
                  onAddChapter={upsertChapter}
                  onNotify={(msg, type) => addNotification(msg, type)}
                />
              )}
              {currentView === 'writing' && (
                <WritingStudio 
                  project={{ ...project, chapters, sourceMaterials, research, externalReviews }} 
                  plotNodes={plotNodes}
                  presence={presence}
                  updateProject={updateProject} 
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
              )}
              {currentView === 'swarm' && (
                <CriticSwarm 
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
              )}
              {currentView === 'prizes' && (
                <PrizeView 
                  project={project}
                  chapters={chapters}
                  updateProject={updateProject}
                />
              )}
              {currentView === 'reviews' && (
                <ReviewVault 
                  project={project}
                  reviews={externalReviews}
                  onUpsert={upsertExternalReview}
                  onDelete={(id) => deleteSubDoc('externalReviews', id)}
                />
              )}
              {currentView === 'export' && (
                <PublishView 
                  project={project}
                  chapters={chapters}
                  updateProject={updateProject}
                  onNotify={(msg, type) => addNotification(msg, type)}
                />
              )}
              {currentView === 'architect' && (
                <ManuscriptFixer 
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
                  setView={setCurrentView}
                  onError={(msg) => addNotification(msg, 'error')}
                />
              )}
              {currentView === 'settings' && (
                <SettingsView 
                  project={project} 
                  updateProject={updateProject}
                  deleteProject={deleteProject}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    );
}

