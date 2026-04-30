/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
  Construction
} from 'lucide-react';
import { 
  Project, 
  ViewType, 
  Character, 
  PlotNode, 
  Chapter, 
  ResearchNote, 
  SourceMaterial,
  Presence 
} from './types';
import { auth, db, loginWithGoogle, logout } from './lib/firebase';
import { 
  onSnapshot, 
  doc, 
  collection, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// Components
import Dashboard from './components/Dashboard';
import Brainstorm from './components/Brainstorm';
import CharacterForge from './components/CharacterForge';
import PlotArchitect from './components/PlotArchitect';
import WritingStudio from './components/WritingStudio';
import { ResearchLibrary } from './components/ResearchLibrary';
import CriticSwarm from './components/CriticSwarm';
import ManuscriptFixer from './components/ManuscriptFixer';

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
  createdAt: Date.now()
};

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [project, setProject] = useState<Project>(INITIAL_PROJECT);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [plotNodes, setPlotNodes] = useState<PlotNode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [research, setResearch] = useState<ResearchNote[]>([]);
  const [sourceMaterials, setSourceMaterials] = useState<SourceMaterial[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

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

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
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

  // Project Sync
  useEffect(() => {
    if (!user) return;

    const projectId = 'default_project'; // In real app, this would be dynamic
    const projectRef = doc(db, 'projects', projectId);

    // Initial check/create
    const initProject = async () => {
      try {
        await setDoc(projectRef, { 
          title: INITIAL_PROJECT.title,
          type: INITIAL_PROJECT.type,
          genre: INITIAL_PROJECT.genre,
          premise: INITIAL_PROJECT.premise,
          tone: INITIAL_PROJECT.tone,
          id: projectId,
          ownerId: user.uid,
          updatedAt: serverTimestamp() 
        }, { merge: true });
      } catch (e) { console.error(e); }
    };
    initProject();

    // Project Data
    const unsubProject = onSnapshot(projectRef, (snap) => {
      if (snap.exists()) setProject(snap.data() as Project);
    });

    // Subcollections Sync
    const unsubChars = onSnapshot(query(collection(db, 'projects', projectId, 'characters'), orderBy('updatedAt', 'desc')), (snap) => {
      setCharacters(snap.docs.map(d => d.data() as Character));
    });
    const unsubNodes = onSnapshot(query(collection(db, 'projects', projectId, 'plotNodes'), orderBy('order', 'asc')), (snap) => {
      setPlotNodes(snap.docs.map(d => d.data() as PlotNode));
    });
    const unsubChapters = onSnapshot(query(collection(db, 'projects', projectId, 'chapters'), orderBy('order', 'asc')), (snap) => {
      setChapters(snap.docs.map(d => d.data() as Chapter));
    });
    const unsubResearch = onSnapshot(query(collection(db, 'projects', projectId, 'research'), orderBy('updatedAt', 'desc')), (snap) => {
      setResearch(snap.docs.map(d => d.data() as ResearchNote));
    });
    const unsubSources = onSnapshot(query(collection(db, 'projects', projectId, 'sourceMaterials'), orderBy('name', 'asc')), (snap) => {
      setSourceMaterials(snap.docs.map(d => d.data() as SourceMaterial));
    });
    const unsubPresence = onSnapshot(collection(db, 'projects', projectId, 'presence'), (snap) => {
      setPresence(snap.docs.map(d => d.data() as Presence));
    });

    // Presence Heartbeat
    const presenceRef = doc(db, 'projects', projectId, 'presence', user.uid);
    setDoc(presenceRef, {
      userId: user.uid,
      userName: user.displayName || 'Author',
      lastActive: Date.now()
    });

    return () => {
      unsubProject();
      unsubChars();
      unsubNodes();
      unsubChapters();
      unsubResearch();
      unsubSources();
      unsubPresence();
      deleteDoc(presenceRef);
    };
  }, [user]);

  const updateProject = async (updates: Partial<Project>) => {
    if (!user) return;
    pushToHistory(project);
    const projectRef = doc(db, 'projects', project.id);
    await updateDoc(projectRef, { ...updates, updatedAt: serverTimestamp() });
  };

  const deleteProject = async () => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to permanently delete this project? Data cannot be recovered.")) return;
    
    const projectRef = doc(db, 'projects', project.id);
    await setDoc(projectRef, { ...INITIAL_PROJECT, ownerId: user.uid, id: project.id });
    setHistory([]);
    setFuture([]);
    setCurrentView('dashboard');
  };

  const saveToCloud = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const projectRef = doc(db, 'projects', project.id);
      await updateDoc(projectRef, { ...project, updatedAt: serverTimestamp() });
      setTimeout(() => setIsSaving(false), 1000);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  // Subcollection Handlers
  const upsertCharacter = async (char: Character) => {
    if (!user) return;
    await setDoc(doc(db, 'projects', project.id, 'characters', char.id), { ...char, updatedAt: Date.now() });
  };
  const upsertPlotNode = async (node: PlotNode) => {
    if (!user) return;
    await setDoc(doc(db, 'projects', project.id, 'plotNodes', node.id), { ...node, updatedAt: Date.now() });
  };
  const upsertChapter = async (chap: Chapter) => {
    if (!user) return;
    await setDoc(doc(db, 'projects', project.id, 'chapters', chap.id), chap);
  };
  const upsertSourceMaterial = async (source: SourceMaterial) => {
    if (!user) return;
    await setDoc(doc(db, 'projects', project.id, 'sourceMaterials', source.id), { ...source, updatedAt: Date.now() });
  };
  const deleteSubDoc = async (coll: string, id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'projects', project.id, coll, id));
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'brainstorm', label: 'AI Brainstorm', icon: Sparkles },
    { id: 'characters', label: 'Character Forge', icon: Users },
    { id: 'plot', label: 'Plot Architect', icon: GitBranch },
    { id: 'research', label: 'Research Library', icon: Library },
    { id: 'writing', label: 'Writing Studio', icon: PenTool },
    { id: 'swarm', label: 'Critic Swarm', icon: Zap },
    { id: 'architect', label: 'Finish & Fix', icon: Construction },
  ];

  if (loading) return null;

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
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 italic font-serif">NovelWrite <span className="text-blue-600">Pro</span></h1>
            <p className="text-slate-500 font-medium italic">Architecting tomorrow's narratives, today.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-4 transition-all shadow-xl shadow-slate-200"
          >
            <LogIn size={20} />
            Authorize Google Sync
          </button>
          {loginError && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium"
            >
              {loginError}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-surface-bg text-slate-900 font-sans selection:bg-blue-100 overflow-hidden">
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
        className={`flex flex-col bg-slate-950 text-white relative shadow-2xl border-r border-slate-900 ${
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
              NovelWrite <span className="text-blue-500 font-normal font-sans tracking-wide">PRO</span>
            </motion.h1>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] px-3 mb-4">Project Space</div>
          {navItems.map((item) => {
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
                  <span className="flex-1 text-left">{item.label}</span>
                )}
              </button>
            );
          })}
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
              className={`p-2 text-slate-400 hover:text-blue-500 hover:bg-white/5 rounded-lg transition-all ${isSaving ? 'animate-pulse text-blue-500' : ''}`}
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
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white relative z-10">
          <div className="flex items-center gap-10">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-3">
              <span className="text-slate-300 uppercase tracking-widest text-[9px]">Active Project:</span>
              <span className="italic font-serif truncate max-w-[200px]">{project.title}</span>
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-100">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                Relational Sync Active
              </div>
              <div className="flex -space-x-1">
                {presence.map(p => (
                   <div key={p.userId} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 text-slate-400 text-[8px] font-bold flex items-center justify-center uppercase" title={p.userName}>
                     {p.userName.charAt(0)}
                   </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {isMobile && (
               <button 
                 onClick={() => setIsSidebarOpen(true)}
                 className="p-2 text-slate-400 hover:text-slate-900"
               >
                 <Library size={20} />
               </button>
             )}
             <button className="px-5 py-2 bg-slate-900 text-white rounded font-black text-[10px] hover:bg-slate-800 transition-all uppercase tracking-[0.2em] shadow-lg shadow-slate-200">
              Export Archive
            </button>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-300 hover:text-slate-900 transition-colors"
            >
              <GitBranch size={20} className={isSidebarOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
            </button>
          </div>
        </header>

        {/* View Transition Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-12 relative bg-slate-50/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="max-w-7xl mx-auto h-full"
            >
              {(currentView === 'dashboard' || currentView === 'brainstorm') && (
                 <>
                   {currentView === 'dashboard' && (
                     <Dashboard 
                       project={{ ...project, characters, chapters }} 
                       updateProject={updateProject} 
                       setView={setCurrentView} 
                       deleteProject={deleteProject}
                       saveToCloud={saveToCloud}
                       isSaving={isSaving}
                     />
                   )}
                   {currentView === 'brainstorm' && <Brainstorm project={project} updateProject={updateProject} />}
                 </>
              )}
              {currentView === 'characters' && (
                <CharacterForge 
                  project={{ ...project, characters }} 
                  updateProject={async (updates) => {
                    const char = updates.characters?.[updates.characters.length - 1];
                    if (char) await upsertCharacter(char);
                  }} 
                />
              )}
              {currentView === 'plot' && (
                <PlotArchitect 
                  project={{ ...project, chapters }} 
                  plotNodes={plotNodes} 
                  updateProject={updateProject}
                  updatePlotNodes={(nodes) => {
                     // In real app, identify if new or delete. 
                     // Simplified: find diff. Actually better pass upsert callback.
                     setPlotNodes(nodes); // Immediate UI update
                     // Persist changes (this is simplified, ideally individual upserts)
                     nodes.forEach(n => upsertPlotNode(n));
                  }}
                />
              )}
              {currentView === 'research' && (
                <ResearchLibrary 
                  project={project} 
                  research={research} 
                  onAdd={(note) => setDoc(doc(db, 'projects', project.id, 'research', note.id), { ...note, updatedAt: Date.now() })}
                  onDelete={(id) => deleteSubDoc('research', id)}
                />
              )}
              {currentView === 'writing' && (
                <WritingStudio 
                  project={{ ...project, chapters, sourceMaterials }} 
                  plotNodes={plotNodes}
                  presence={presence}
                  updateProject={updateProject} 
                  updateChapters={(chapList) => {
                     setChapters(chapList);
                     chapList.forEach(c => upsertChapter(c));
                  }}
                  onUpsertSource={upsertSourceMaterial}
                  onDeleteSource={(id) => deleteSubDoc('sourceMaterials', id)}
                />
              )}
              {currentView === 'swarm' && (
                <CriticSwarm 
                  projectType={project.type}
                  maturity={project.maturity}
                  chapters={chapters}
                  sourceMaterials={sourceMaterials}
                />
              )}
              {currentView === 'architect' && (
                <ManuscriptFixer 
                  project={{ ...project, sourceMaterials }}
                  chapters={chapters}
                  updateChapters={(chaps) => {
                    setChapters(chaps);
                    chaps.forEach(c => upsertChapter(c));
                  }}
                  setView={setCurrentView}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

