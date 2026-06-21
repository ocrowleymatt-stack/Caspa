import React, { useState } from 'react';
import { 
  Chapter, Project, PlotNode, ResearchNote, SourceMaterial, 
  Character, ExternalReview, ViewType 
} from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Book, Sparkles, FolderOpen, Layers, Users, Sliders, ChevronRight,
  Database, RefreshCw, Smartphone, TrendingUp, Info
} from 'lucide-react';

interface SpatialGlassModeProps {
  currentView: ViewType;
  setCurrentView: (v: ViewType) => void;
  project: Project;
  projects: Project[];
  chapters: Chapter[];
  setChapters: (chaps: Chapter[]) => void;
  isMobile: boolean;
  onClose: () => void;
  selectProject: (p: Project) => void;
  createNewProject: () => Promise<void>;
  updateProject: (p: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  saveToCloud: () => Promise<void>;
  isSaving: boolean;
  totalWords: number;
  research: ResearchNote[];
  sourceMaterials: SourceMaterial[];
  upsertResearch: (r: ResearchNote) => Promise<void>;
  upsertSourceMaterial: (s: SourceMaterial) => Promise<void>;
  deleteSubDoc: (field: string, id: string) => Promise<void>;
  upsertChapter: (c: Chapter) => Promise<void>;
  upsertChapterBatch: (chaps: Chapter[]) => Promise<void>;
  characters: Character[];
  upsertCharacterBatch: (chars: Character[]) => Promise<void>;
  deduplicateCharacters: () => Promise<void>;
  plotNodes: PlotNode[];
  setPlotNodes: (nodes: PlotNode[]) => void;
  upsertPlotNodesBatch: (nodes: PlotNode[]) => Promise<void>;
  presence: any;
  externalReviews: ExternalReview[];
  upsertExternalReview: (r: ExternalReview) => Promise<void>;
  addNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'chapters' | 'characters' | 'settings'>('overview');

  return (
    <div id="spatial-glass-overlay" className="fixed inset-0 z-[1000] w-full h-full bg-neutral-950/90 backdrop-blur-3xl text-neutral-100 flex flex-col font-sans">
      {/* Dynamic Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 glass-header">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-mono tracking-tight font-bold text-white uppercase">{project.title}</h1>
            <p className="text-[10px] text-neutral-400">SPATIAL GLASS INTERFACE • ACTIVE</p>
          </div>
        </div>
        <button 
          id="close-glass"
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main glass workspace */}
      <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-white/5 rounded-lg border border-white/5">
          {(['overview', 'chapters', 'characters', 'settings'] as const).map(tab => (
            <button
              key={tab}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`py-2 text-[10px] font-semibold tracking-wider uppercase font-mono rounded-md transition-all ${
                activeTab === tab 
                  ? 'bg-neutral-800 text-white shadow-xl shadow-black/40 border border-white/5' 
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content area */}
        <div className="flex-1">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Quick stats bento box */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Prose Mass</span>
                  <div className="text-lg font-mono font-bold mt-1 text-white">{totalWords.toLocaleString()} <span className="text-[10px] text-neutral-500">w</span></div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Chapters</span>
                  <div className="text-lg font-mono font-bold mt-1 text-white">{chapters.length}</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Characters</span>
                  <div className="text-lg font-mono font-bold mt-1 text-white">{characters.length}</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">Plot Targets</span>
                  <div className="text-lg font-mono font-bold mt-1 text-white">{plotNodes.length}</div>
                </div>
              </div>

              {/* Engine metadata summary card */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-neutral-400" /> Active Creative Spine
                </h3>
                <div className="grid grid-cols-2 gap-2 text-[11px] leading-relaxed">
                  <div>
                    <span className="text-neutral-500 uppercase block font-mono text-[9px]">GENRE</span>
                    <span className="text-neutral-200 font-semibold">{project.genre || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 uppercase block font-mono text-[9px]">TONE ARCHETYPE</span>
                    <span className="text-neutral-200 font-semibold">{project.tone || 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Save progress component */}
              <button
                id="cloud-save-from-glass"
                onClick={saveToCloud}
                disabled={isSaving}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                {isSaving ? 'Synching with Brummage...' : 'SAVE CURRENT ARCHIVE'}
              </button>
            </div>
          )}

          {activeTab === 'chapters' && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-2">MANUSCRIPT SEGMENTS ({chapters.length})</h3>
              {chapters.length === 0 ? (
                <div className="text-center py-8 text-neutral-600 font-mono text-xs">No active chapters.</div>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto scrollbar">
                  {chapters.map(chap => (
                    <div key={chap.id} className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 flex items-center justify-between transition-all">
                      <div className="truncate pr-4">
                        <span className="text-xs font-mono font-semibold block text-neutral-200 truncate">{chap.title}</span>
                        <span className="text-[9px] text-neutral-500 font-mono">{chap.content?.split(/\s+/).filter(Boolean).length || 0} words • order {chap.order + 1}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-600" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'characters' && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-2">CHARACTER LATTICE ({characters.length})</h3>
              {characters.length === 0 ? (
                <div className="text-center py-8 text-neutral-600 font-mono text-xs">No characters documented.</div>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto scrollbar">
                  {characters.map(char => (
                    <div key={char.id} className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 flex items-center gap-3 transition-all">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center font-mono font-bold text-xs text-indigo-400 shrink-0">
                        {char.name?.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-mono font-semibold block text-neutral-200">{char.name}</span>
                        <span className="text-[9px] text-neutral-500 uppercase font-mono">{char.role || 'Secondary agent'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Style DNA sliders</span>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400 font-mono text-[10px]">PROSE INTENSITY:</span>
                    <span className="font-mono text-white text-[10px]">{project.styleDNA?.proseIntensity || 50}/100</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400 font-mono text-[10px]">DIALOGUE WEIGHT:</span>
                    <span className="font-mono text-white text-[10px]">{project.styleDNA?.dialogueWeight || 50}/100</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Maturity setting:</span>
                    <span className="text-indigo-400 uppercase font-mono text-[10px]">{project.maturity || 'Standard'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2 text-[10px] text-neutral-400 italic">
                <Database className="w-4 h-4 text-neutral-500 shrink-0" />
                <span>Synchronized targeting "Brummage" secure repository instance.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
