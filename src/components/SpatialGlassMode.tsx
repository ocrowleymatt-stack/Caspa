/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Sparkles, 
  Users, 
  GitBranch, 
  PenTool, 
  Zap, 
  Settings, 
  Trophy, 
  MessageSquare,
  Construction,
  Globe,
  Scissors,
  Library,
  ChevronDown,
  X,
  Compass,
  Sunset,
  Moon,
  CloudRain,
  Sunrise,
  Sparkle,
  Battery,
  Wifi,
  Bookmark,
  Activity,
  UserCheck,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';
import { ViewType, Project, Chapter } from '../types';

// Live Workspace Imports
import Dashboard from './Dashboard';
import Brainstorm from './Brainstorm';
import CharacterForge from './CharacterForge';
import PlotArchitect from './PlotArchitect';
import WritingStudio from './WritingStudio';
import LibraryView from './Library';
import IntelligenceLab from './IntelligenceLab';
import CriticSwarm from './CriticSwarm';
import ManuscriptFixer from './ManuscriptFixer';
import SettingsView from './SettingsView';
import PublishView from './PublishView';
import PrizeView from './PrizeView';
import ReviewVault from './ReviewVault';
import ScalpelModule from './ScalpelModule';
import AutoDrafter from './AutoDrafter';

interface SpatialGlassModeProps {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  project: Project;
  projects: Project[];
  chapters: Chapter[];
  setChapters: React.Dispatch<React.SetStateAction<Chapter[]>>;
  isMobile: boolean;
  onClose?: () => void;
  selectProject: (p: Project) => void;
  createNewProject: () => Promise<void>;
  updateProject: (updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  saveToCloud: () => Promise<void>;
  isSaving: boolean;
  totalWords: number;
  research: any[];
  sourceMaterials: any[];
  upsertResearch: (note: any) => Promise<void>;
  upsertSourceMaterial: (source: any) => Promise<void>;
  deleteSubDoc: (col: any, id: string) => Promise<void>;
  upsertChapter: (chap: Chapter) => Promise<void>;
  upsertChapterBatch: (chapList: Chapter[]) => Promise<void>;
  characters: any[];
  upsertCharacterBatch: (characters: any[]) => Promise<void>;
  deduplicateCharacters: () => Promise<void>;
  plotNodes: any[];
  setPlotNodes: React.Dispatch<React.SetStateAction<any[]>>;
  upsertPlotNodesBatch: (nodes: any[]) => Promise<void>;
  presence: any[];
  externalReviews: any[];
  upsertExternalReview: (review: any) => Promise<void>;
  addNotification: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface Environment {
  id: string;
  name: string;
  icon: any;
  colorClass: string;
  accentGlow: string;
  description: string;
}

export default function SpatialGlassMode({
  currentView,
  setCurrentView,
  project,
  projects,
  chapters,
  setChapters,
  isMobile,
  onClose,
  selectProject,
  createNewProject,
  updateProject,
  deleteProject,
  saveToCloud,
  isSaving,
  totalWords,
  research,
  sourceMaterials,
  upsertResearch,
  upsertSourceMaterial,
  deleteSubDoc,
  upsertChapter,
  upsertChapterBatch,
  characters,
  upsertCharacterBatch,
  deduplicateCharacters,
  plotNodes,
  setPlotNodes,
  upsertPlotNodesBatch,
  presence,
  externalReviews,
  upsertExternalReview,
  addNotification
}: SpatialGlassModeProps) {
  // Read and store environment settings to feel solid & persistent
  const [activeEnvironment, setActiveEnvironment] = useState<string>(() => {
    return localStorage.getItem('ls_spatial_environment') || 'celestial_void';
  });

  const [depthOffset, setDepthOffset] = useState({ x: 0, y: 0 });
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSystemInfo, setShowSystemInfo] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('ls_spatial_environment', activeEnvironment);
  }, [activeEnvironment]);

  // Accelerometer/Parallax interaction simulating Spatial Depth deactivated to prevent items from sliding around
  useEffect(() => {
    // Keep offset flat as requested by user ("Stop things sliding around in containers, just scrolling up and down")
    setDepthOffset({ x: 0, y: 0 });
  }, []);

  const environments: Environment[] = [
    {
      id: 'celestial_void',
      name: 'Celestial Void',
      icon: Moon,
      colorClass: 'from-[#05010a] via-[#06041a] to-[#040110]',
      accentGlow: 'rgba(168, 85, 247, 0.12)',
      description: 'A stellar field of absolute darkness and violet stellar clouds.'
    },
    {
      id: 'joshua_tree',
      name: 'Joshua Tree Dusk',
      icon: Sunset,
      colorClass: 'from-[#1a110a] via-[#100914] to-[#0d091a]',
      accentGlow: 'rgba(247, 138, 85, 0.12)',
      description: 'Amber horizon light blending with the silent, vast Martian cooling sky.'
    },
    {
      id: 'mount_hood',
      name: 'Alpine Lake Alpenglow',
      icon: Sunrise,
      colorClass: 'from-[#0a1824] via-[#0f1026] to-[#12081c]',
      accentGlow: 'rgba(56, 189, 248, 0.12)',
      description: 'Pink dawn glow reflecting off a crystal blue, mirror-like glacial pool.'
    },
    {
      id: 'tokyo_rain',
      name: 'Tokyo Rain Loft',
      icon: CloudRain,
      colorClass: 'from-[#070d19] via-[#0b0c16] to-[#14061a]',
      accentGlow: 'rgba(236, 72, 153, 0.12)',
      description: 'Moody, soft slate windows with distant neon refraction and cool humidity.'
    },
    {
      id: 'orchid_mist',
      name: 'Orchid Greenhouse',
      icon: Sparkle,
      colorClass: 'from-[#040c0b] via-[#080d0d] to-[#0e0717]',
      accentGlow: 'rgba(52, 211, 153, 0.1)',
      description: 'Mist-shrouded green canopy that dampens sounds to unlock sensory memories.'
    }
  ];

  const primaryDockItems = [
    { id: 'dashboard', label: 'Spatial Center', icon: BarChart3 },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'writing', label: 'Manuscript', icon: PenTool },
    { id: 'brainstorm', label: 'Idea Gen', icon: Sparkles },
    { id: 'characters', label: 'Characters', icon: Users },
  ];

  const secondaryMenuItems = [
    { id: 'plot', label: 'Plot Outline', icon: GitBranch, group: 'Structure' },
    { id: 'architect', label: 'Structure Fixer', icon: Construction, group: 'Structure' },
    { id: 'scalpel', label: 'Prose Polish', icon: Scissors, group: 'Improvement' },
    { id: 'swarm', label: 'Critics', icon: Zap, group: 'Acoustics' },
    { id: 'reviews', label: 'External Reviews', icon: MessageSquare, group: 'Acoustics' },
    { id: 'prizes', label: 'Accolade Target', icon: Trophy, group: 'Strategy' },
    { id: 'export', label: 'Publish & Kindle', icon: Globe, group: 'Delivery' },
    { id: 'settings', label: 'System Settings', icon: Settings, group: 'System' },
    { id: 'intelligence', label: 'Intelligence Lab', icon: HelpCircle, group: 'Intelligence' }
  ];

  const currentEnv = environments.find(e => e.id === activeEnvironment) || environments[0];

  const wordsCount = chapters.reduce((sum, c) => {
    return sum + (c.content?.trim().split(/\s+/).filter(w => w.length > 0).length || 0);
  }, 0);

  // Render the actual active modular component directly inside the transparent responsive cards:
  const renderActiveWorkspace = () => {
    switch (currentView) {
      case 'library':
        return (
          <div className="bg-slate-900/60 p-4 rounded-3xl border border-white/10 text-white min-h-[300px]">
            <LibraryView 
              key="spatial_library"
              projects={projects}
              onSelectProject={(p) => {
                selectProject(p);
                setCurrentView('dashboard');
              }}
              onCreateProject={() => { createNewProject(); }}
              onDeleteProject={(id) => { deleteProject(id); }}
            />
          </div>
        );
      case 'brainstorm':
        return (
          <div className="bg-slate-900/40 p-3 rounded-2xl text-white">
            <Brainstorm 
              project={project} 
              research={research}
              sourceMaterials={sourceMaterials}
              updateProject={updateProject} 
              onAddResearch={upsertResearch}
              onError={(msg) => addNotification(msg, 'error')}
            />
          </div>
        );
      case 'characters':
        return (
          <div className="bg-slate-900/40 p-3 rounded-2xl text-white">
            <CharacterForge 
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
        );
      case 'plot':
        return (
          <div className="bg-slate-900/40 p-3 rounded-2xl text-white">
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
              setView={setCurrentView}
              onNotify={(msg, type) => addNotification(msg, type || 'info')}
              onError={(msg) => addNotification(msg, 'error')}
            />
          </div>
        );
      case 'intelligence':
        return (
          <div className="bg-slate-900/40 p-3 rounded-2xl text-white">
            <IntelligenceLab 
              project={project} 
              research={research} 
              chapters={chapters}
              sourceMaterials={sourceMaterials}
              onAddResearch={upsertResearch}
              onDeleteResearch={(id) => deleteSubDoc('research', id)}
              onAddChapter={upsertChapter}
              onAddSource={upsertSourceMaterial}
              onDeleteSource={(id) => deleteSubDoc('sourceMaterials', id)}
              onNotify={(msg, type) => addNotification(msg, type || 'info')}
            />
          </div>
        );
      case 'writing':
        return (
          <div className="bg-slate-900/50 rounded-2xl text-white overflow-hidden">
            <WritingStudio 
              project={{ ...project, chapters, sourceMaterials, research, externalReviews }} 
              plotNodes={plotNodes}
              presence={presence}
              updateProject={updateProject} 
              updateChapters={async (chapList) => {
                setChapters(chapList);
                if (chapList.length !== chapters.length) {
                  await upsertChapterBatch(chapList);
                }
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
              onError={(msg) => addNotification(msg, 'error')}
            />
          </div>
        );
      case 'swarm':
        return (
          <div className="bg-slate-900/40 p-3 rounded-2xl text-white">
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
          </div>
        );
      case 'autodraft':
        return (
          <div className="bg-slate-900/40 p-3 rounded-2xl text-white">
            <AutoDrafter 
              project={project}
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
        );
      case 'prizes':
        return (
          <div className="bg-slate-900/40 p-4 rounded-2xl text-white">
            <PrizeView 
              project={project}
              chapters={chapters}
              updateProject={updateProject}
            />
          </div>
        );
      case 'reviews':
        return (
          <div className="bg-slate-900/40 p-4 rounded-2xl text-white">
            <ReviewVault 
              project={project}
              reviews={externalReviews}
              onUpsert={upsertExternalReview}
              onDelete={(id) => deleteSubDoc('externalReviews', id)}
            />
          </div>
        );
      case 'export':
        return (
          <div className="bg-slate-900/40 p-4 rounded-2xl text-white">
            <PublishView 
              project={project}
              chapters={chapters}
              updateProject={updateProject}
              updateChapters={async (chaps) => {
                setChapters(chaps);
                await upsertChapterBatch(chaps);
              }}
              onNotify={(msg, type) => addNotification(msg, type || 'info')}
            />
          </div>
        );
      case 'architect':
        return (
          <div className="bg-slate-900/40 p-3 rounded-2xl text-white">
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
              onImportCharacters={async (chars) => {
                await upsertCharacterBatch(chars);
              }}
              onAddResearch={upsertResearch}
              setView={setCurrentView}
              onError={(msg) => addNotification(msg, 'error')}
            />
          </div>
        );
      case 'settings':
        return (
          <div className="bg-slate-900/40 p-4 rounded-2xl text-white">
            <SettingsView 
              project={project} 
              updateProject={updateProject}
              deleteProject={() => { deleteProject(project.id); }}
            />
          </div>
        );
      case 'scalpel':
        return (
          <div className="bg-slate-900/40 p-3 rounded-2xl text-white">
            <ScalpelModule 
              project={project}
              chapters={chapters}
              updateProject={updateProject}
              updateChapters={async (chaps) => {
                setChapters(chaps);
                await upsertChapterBatch(chaps);
              }}
              setView={setCurrentView}
              onNotify={(msg, type) => addNotification(msg, type || 'info')}
            />
          </div>
        );
      case 'dashboard':
      default: // default is 'dashboard' which serves as the premium overview summary center
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black text-white italic tracking-tighter font-serif">
                {project.title || 'Untitled Narrative'}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] uppercase tracking-widest text-[#a855f7] font-black">
                  {project.genre || 'Epic Narrative'}
                </span>
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <span className="text-[9px] uppercase tracking-widest text-white/60 font-bold">
                  {project.type || 'Novel'}
                </span>
              </div>
            </div>

            {/* Simulated Glass Accents and Workspace Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300 flex flex-col justify-between h-24">
                <span className="text-[9px] uppercase text-white/40 tracking-wider font-bold block">Streak Count</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-rose-400 font-serif">
                    {project.stats?.narrativeStreak || 0}
                  </span>
                  <span className="text-[9px] text-white/40 uppercase font-black">days</span>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300 flex flex-col justify-between h-24">
                <span className="text-[9px] uppercase text-white/40 tracking-wider font-bold block">Words Captured</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-black text-sky-400 font-serif">
                    {wordsCount || project.stats?.totalWords || 0}
                  </span>
                  {project.targetWordCount && (
                    <span className="text-[9px] text-white/40 uppercase">/ {project.targetWordCount}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Premise Float */}
            {project.premise && (
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-xs text-white/80 leading-relaxed italic relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 bg-gradient-to-bl from-white/10 to-transparent rounded-bl-xl h-6 w-6" />
                <strong>Architect's Premise Focus:</strong> "{project.premise}"
              </div>
            )}

            {/* Apple Glass Companion Guidance Tip Card */}
            <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-2xl p-4 border border-purple-500/20 text-xs text-white/80 space-y-2">
              <h4 className="font-bold flex items-center gap-1.5 text-purple-200">
                <Sparkles size={14} className="text-[#d8b4fe]" /> Spatial Pairing Guide
              </h4>
              <p className="leading-relaxed text-white/70 text-[11px]">
                To view this manuscript overlaid in physical space: Open Casper on your Apple Glass browser while holding this phone, allowing the device to act as an unencumbered high-precision touch controller or dynamic dictation terminal.
              </p>
            </div>

            <button 
              onClick={() => setCurrentView('library')}
              className="w-full py-3.5 bg-white/15 hover:bg-white/20 active:scale-95 border border-white/20 rounded-2xl text-xs text-white font-black uppercase tracking-wider transition-all shadow-[0_12px_24px_rgba(0,0,0,0.2)]"
            >
              Enter Project Library
            </button>
          </div>
        );
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[999] flex flex-col justify-between overflow-hidden transition-all duration-1000 bg-gradient-to-b ${currentEnv.colorClass}`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 16px)',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)'
      }}
    >
      {/* Immersive Refraction Orbs in Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {/* Soft Stationary Glow background element */}
        <div 
          className="absolute w-[400px] h-[400px] rounded-full blur-[140px] opacity-40"
          style={{
            background: currentEnv.accentGlow,
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%) scale(1.3)'
          }}
        />
        <div 
          className="absolute w-[280px] h-[280px] bg-indigo-500/5 rounded-full blur-[90px] bottom-1/4 right-1/4"
          style={{
            transform: 'none'
          }}
        />
        {/* Apple Glass style horizontal grid horizon line */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white/5 to-transparent border-t border-white/5 opacity-30 pointer-events-none" />
      </div>

      {/* PWA Glass Header */}
      <header className="px-6 py-4 flex items-center justify-between z-20 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-lg">
            <span className="font-serif italic font-bold text-white text-base">C</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white">Casper Spatial</span>
              <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest animate-pulse">PWA Active</span>
            </div>
            <p className="text-[9px] text-white/50 tracking-wider transition-colors duration-500">{currentEnv.name}</p>
          </div>
        </div>

        {/* Quick Ambient Actions */}
        <div className="flex items-center gap-2">
          {/* Spatial Acoustic/System button */}
          <button 
            onClick={() => setShowSystemInfo(!showSystemInfo)}
            className={`p-2.5 rounded-full border bg-white/5 backdrop-blur-xl transition-all duration-300 ${showSystemInfo ? 'border-brand-primary text-brand-primary bg-white/10' : 'border-white/10 text-white/70 active:scale-95'}`}
            aria-label="Toggle Spatial Status"
          >
            <Compass size={16} />
          </button>

          {/* Environmental selector toggle */}
          <div className="flex items-center bg-black/30 backdrop-blur-2xl rounded-full p-1 border border-white/10 max-w-[200px] overflow-x-auto no-scrollbar">
            {environments.map((env) => {
              const EnvIcon = env.icon;
              const isActive = activeEnvironment === env.id;
              return (
                <button
                  key={env.id}
                  onClick={() => setActiveEnvironment(env.id)}
                  className={`p-2 rounded-full transition-all duration-500 shrink-0 ${isActive ? 'bg-white text-black shadow-lg scale-110' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                  title={env.name}
                >
                  <EnvIcon size={14} />
                </button>
              );
            })}
          </div>

          {onClose && (
            <button 
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white/80 active:scale-95 animate-pulse"
              title="Return to Classic View"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Main Glass Workspace Window */}
      <main className="flex-1 px-4 py-2 flex flex-col justify-center items-center z-13 relative min-h-0">
        {/* Outer stable container */}
        <div 
          className="w-full max-w-lg h-full flex flex-col justify-between overflow-hidden"
          style={{
            transform: 'none',
          }}
        >
          {/* Main Floating Glass Card */}
          <div className="flex-1 bg-white/10 dark:bg-slate-900/30 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.5)] p-6 md:p-8 flex flex-col justify-between overflow-hidden min-h-0 relative">
            
            {/* Glossy Reflection Highlight overlay */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-[2.5rem]" />

            {/* Panel Area header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 z-10 shrink-0 select-none">
              <div className="flex items-center gap-3">
                <Bookmark className="text-white/80" size={16} />
                <span className="text-[10px] font-black uppercase text-white/50 tracking-widest">Active Workspace Element</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 uppercase">
                  {currentView}
                </span>
                {project.id !== 'default' && (
                  <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-ping" />
                )}
              </div>
            </div>

            {/* Floating Info Overlay (System and Hardware acoustics pairing details) */}
            <AnimatePresence>
              {showSystemInfo && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-x-0 top-16 mx-4 p-5 bg-slate-900/95 backdrop-blur-3xl border border-white/15 rounded-3xl z-40 shadow-2xl text-white select-none"
                >
                  <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <Compass className="text-brand-primary" size={14} />
                      <span className="text-[10px] font-black uppercase text-white tracking-widest">Apple Glass Integration Hub</span>
                    </div>
                    <button onClick={() => setShowSystemInfo(false)} className="text-white/40 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-3.5 text-xs text-white/80">
                    <p className="leading-relaxed">
                      This mobile view is rendered utilizing <strong>Casper Spatial Glass</strong> specifications to complement optical overlay technologies such as Apple Glass web engines.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-center">
                        <Activity className="mx-auto mb-1 text-emerald-300" size={16} />
                        <span className="block text-[8px] uppercase tracking-wider text-white/50">Holographic Latency</span>
                        <strong className="text-emerald-300 font-mono text-sm">6ms Realtime</strong>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-center">
                        <UserCheck className="mx-auto mb-1 text-purple-300" size={16} />
                        <span className="block text-[8px] uppercase tracking-wider text-white/50">Spatial Audio Dictation</span>
                        <strong className="text-purple-300 font-mono text-sm">Pair Ready</strong>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/40 border-t border-white/5 pt-2 flex items-center gap-2">
                      <Wifi size={10} /> Standalone local PWA syncing database via Firestore client layers.
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Primary View Display Zone */}
            <div className="flex-1 min-h-0 py-8 px-2 overflow-y-auto custom-scrollbar relative z-10 flex flex-col items-center">
              <div className="w-full max-w-2xl">
                {renderActiveWorkspace()}
              </div>
            </div>

            {/* Quick Action Dock Button Footer inside screen */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between shrink-0 text-xs text-white/40 z-10 select-none">
              <span className="uppercase text-[9px] font-black tracking-widest text-[#a855f7]">Tactile Sync System</span>
              <span className="flex items-center gap-1 text-[9px] font-mono">
                <Battery size={12} className="text-emerald-400" /> 100% Core Ready
              </span>
            </div>

          </div>
        </div>
      </main>

      {/* Floating visionOS Cylindrical Glass Command Dock & More Popups */}
      <footer className="relative px-4 pb-4 pt-1 z-30 shrink-0 select-none flex flex-col items-center">
        
        {/* secondary 'More View Architecture' Expand Drawer */}
        <AnimatePresence>
          {showMoreMenu && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: -20, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="absolute bottom-20 w-[92vw] max-w-sm bg-slate-950/90 backdrop-blur-3xl border border-white/15 rounded-[2.5rem] p-6 shadow-[0_45px_90px_rgba(0,0,0,0.8)] animate-none"
            >
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">More Craft Modules</span>
                <button
                  onClick={() => setShowMoreMenu(false)}
                  className="p-1 rounded-full bg-white/5 text-white/50 hover:bg-white/10 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Grid of secondary views */}
              <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto no-scrollbar">
                {secondaryMenuItems.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentView(item.id as ViewType);
                        setShowMoreMenu(false);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 ${
                        isActive 
                          ? 'bg-brand-primary border-brand-primary text-white shadow-lg' 
                          : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10 hover:border-white/10 hover:text-white active:scale-95'
                      }`}
                    >
                      <ItemIcon size={18} className="mb-1.5 opacity-90" />
                      <span className="text-[9px] text-center font-bold tracking-tight line-clamp-1">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 text-center text-[9px] text-white/30 truncate">
                Narrative Core Modules • Fully Isolated Sandbox
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The main Cylindrical visionOS floating Docker bar */}
        <div className="relative">
          {/* Opaque behind glow to trace active highlight */}
          <div className="absolute inset-0 bg-brand-primary/15 rounded-full blur-xl pointer-events-none" />

          <div
            className="flex items-center justify-between gap-3 bg-slate-900/40 backdrop-blur-3xl border border-white/20 p-2 text-white/80 shadow-[0_24px_48px_rgba(0,0,0,0.6)] rounded-full max-w-full"
            style={{
              boxShadow: 'inset 0 0 12px 1px rgba(255, 255, 255, 0.15), 0 20px 40px -10px rgba(0, 0, 0, 0.7)'
            }}
          >
            {/* Primary Navigation Dock Buttons */}
            {primaryDockItems.map((item) => {
              const ItemIcon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id as ViewType);
                    setShowMoreMenu(false);
                  }}
                  className={`relative p-3 rounded-full transition-all duration-300 group ${
                    isActive 
                      ? 'bg-white text-black scale-105 shadow-md font-bold' 
                      : 'text-white/60 hover:text-white hover:bg-white/5 active:scale-90'
                  }`}
                  aria-label={item.label}
                >
                  <ItemIcon size={18} />
                  
                  {/* Floating Label balloon on active */}
                  {isActive && (
                    <motion.span 
                      layoutId="activeDockLabel"
                      className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-lg border border-white/10 z-50 whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </button>
              );
            })}

            {/* Split Divider line for visionOS style sidebar dock */}
            <div className="w-px h-6 bg-white/15 my-auto shrink-0" />

            {/* "More Views" Popover Trigger */}
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`p-3 rounded-full transition-all duration-300 ${
                showMoreMenu 
                  ? 'bg-[#a855f7] text-white scale-110 shadow-lg' 
                  : 'text-white/60 hover:text-white hover:bg-white/5 active:scale-90'
              }`}
              title="More Modules"
            >
              <motion.div animate={{ rotate: showMoreMenu ? 180 : 0 }}>
                <ChevronUp size={18} />
              </motion.div>
            </button>
          </div>
        </div>

      </footer>
    </div>
  );
}
