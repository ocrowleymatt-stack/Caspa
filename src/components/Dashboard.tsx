/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Users, GitBranch, PenTool, Sparkles, FileText, BookOpen, Layers, Save, Trash2, Trophy, Target, Plus, ChevronDown, Activity } from 'lucide-react';
import { Project, ViewType, ProjectType, MaturityLevel, Chapter, Character, PlotNode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { PROJECT_TYPES, MATURITY_LEVELS, GENRES, TONES } from '../constants';
import DraftStagePanel from './DraftStagePanel';

interface Props {
  project: Project;
  projects: Project[];
  chapters: Chapter[];
  characters: Character[];
  plotNodes: PlotNode[];
  isMobile: boolean;
  selectProject: (project: Project) => void;
  createNewProject: (title?: string) => void;
  updateProject: (updates: Partial<Project>) => void;
  setView: (view: ViewType) => void;
  deleteProject: () => void;
  saveToCloud: () => void;
  isSaving: boolean;
}

export default function Dashboard({ 
  project, 
  projects, 
  chapters,
  characters,
  plotNodes,
  isMobile,
  selectProject, 
  createNewProject, 
  updateProject, 
  setView, 
  deleteProject, 
  saveToCloud, 
  isSaving 
}: Props) {
  const [localPremise, setLocalPremise] = useState(project.premise);
  const [localTitle, setLocalTitle] = useState(project.title);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  const updateProjectRef = useRef(updateProject);
  useEffect(() => {
    updateProjectRef.current = updateProject;
  }, [updateProject]);

  useEffect(() => {
    setLocalTitle(project.title);
    setLocalPremise(project.premise);
  }, [project.id]);

  // Debounced update for premise
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localPremise !== project.premise) {
        updateProjectRef.current({ premise: localPremise });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localPremise, project.premise]);

  // Debounced update for title
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localTitle !== project.title) {
        updateProjectRef.current({ title: localTitle });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localTitle, project.title]);

  const stats = [
    { label: 'Narrative Personnel', value: characters.length, icon: Users, color: 'text-brand-primary', bgColor: 'bg-brand-primary/10', view: 'characters' },
    { label: 'Structural Beats', value: plotNodes.length, icon: GitBranch, color: 'text-brand-primary', bgColor: 'bg-brand-primary/10', view: 'plot' },
    { label: 'Draft Chapters', value: chapters.length, icon: BookOpen, color: 'text-brand-primary', bgColor: 'bg-brand-primary/10', view: 'writing' },
    { 
      label: project.targetWordCount ? `${Math.round(((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}% Milestone` : 'Target Unset', 
      value: project.stats?.totalWords || 0, 
      icon: Target, 
      color: 'text-brand-primary', 
      bgColor: 'bg-brand-primary/10', 
      view: 'writing' 
    },
  ];

  return (
    <div className="h-full overflow-y-auto overscroll-contain custom-scrollbar" style={{ minHeight: 0 }}>
      <div className="max-w-7xl mx-auto space-y-12 pb-32 px-4 md:px-8">
      {/* Target Prize Banner */}
      {project.targetPrize && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setView('prizes')}
          className="btn-nexus-primary p-0.5 rounded-[2rem] shadow-xl shadow-brand-primary/20 group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="bg-brand-dark/40 backdrop-blur-md rounded-[1.9rem] p-4 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10 border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                <Trophy size={20} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/60 mb-0.5">Primary Target</span>
                <span className="text-lg md:text-xl font-black italic font-serif leading-tight">{project.targetPrize}</span>
              </div>
            </div>
            <div className="flex items-center gap-6 w-full md:w-auto">
               <div className="flex flex-col items-end flex-1 md:flex-initial">
                 <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/50 mb-1.5">Award Eligibility</span>
                 <div className="h-1.5 w-full md:w-48 bg-white/10 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${project.prizeAssessments?.find(a => a.prizeName === project.targetPrize)?.eligibilityScore || 0}%` }}
                    className="h-full bg-white transition-all duration-1000 shadow-[0_0_10px_#fff] rounded-full" 
                  />
                 </div>
               </div>
              <div className="p-3 bg-white text-brand-primary rounded-xl shadow-lg animate-pulse">
                <Target size={20} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 md:gap-12 border-b border-border-subtle pb-8 md:pb-16 relative">
          <div className="flex-1 space-y-4 md:space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-[8px] md:text-[10px] font-black text-brand-primary uppercase tracking-[0.4em] md:tracking-[0.5em] bg-brand-primary/10 border border-brand-primary/20 px-3 md:px-5 py-1 md:py-2 rounded-xl md:rounded-2xl flex items-center gap-2" role="status">
              <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-brand-primary animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
              Project Active
            </span>
            <span className="text-[8px] md:text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-30 italic">Rev: {project.stats?.revCount || 1}</span>
          </div>
          <div className="relative group">
            <input 
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              aria-label="Manuscript Title"
              className="text-3xl sm:text-4xl md:text-6xl lg:text-8xl font-black text-text-primary tracking-tighter italic font-serif bg-transparent border-none focus:ring-0 p-0 w-full leading-tight md:leading-none hover:text-brand-primary transition-all cursor-text placeholder:opacity-10"
              placeholder="Define Narrative..."
            />
            <div className="absolute -bottom-2 left-0 w-24 h-1 bg-brand-primary opacity-20 group-focus-within:w-full group-focus-within:opacity-100 transition-all duration-700" />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-center ethereal-panel p-4 rounded-[1.5rem] md:rounded-[2.5rem] border border-border-subtle shadow-[0_30px_60px_rgba(0,0,0,0.4)] relative z-20">
           <div className="flex items-center gap-2 md:gap-3 border-b sm:border-b-0 sm:border-r border-border-subtle pb-3 sm:pb-0 pr-3 md:pr-5 mr-1 group/sel w-full sm:w-auto">
              <Layers className="text-text-secondary group-hover/sel:text-brand-primary transition-colors h-4 w-4 md:h-5 md:w-5 shrink-0" />
              <select 
                value={project.type}
                onChange={(e) => updateProject({ type: e.target.value as ProjectType })}
                aria-label="Project Type"
                className="bg-transparent text-[11px] font-black text-text-primary outline-none py-1 md:py-2 uppercase tracking-[0.1em] md:tracking-[0.2em] cursor-pointer hover:text-brand-primary transition-colors appearance-none min-w-[100px] md:min-w-[120px] w-full sm:w-auto"
              >
                {PROJECT_TYPES.map(t => <option key={t.value} value={t.value} className="bg-brand-dark">{t.label}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-2 md:gap-3 border-b sm:border-b-0 sm:border-r border-border-subtle pb-3 sm:pb-0 sm:pr-3 md:pr-5 sm:mr-1 group/sel w-full sm:w-auto">
              <BookOpen className="text-text-secondary group-hover/sel:text-brand-primary transition-colors h-4 w-4 md:h-5 md:w-5 shrink-0" />
              <select 
                value={project.genre}
                onChange={(e) => updateProject({ genre: e.target.value })}
                aria-label="Project Genre"
                className="bg-transparent text-[11px] font-black text-text-primary outline-none py-1 md:py-2 uppercase tracking-[0.1em] md:tracking-[0.2em] cursor-pointer hover:text-brand-primary transition-colors max-w-[140px] md:max-w-[160px] w-full sm:w-auto appearance-none"
              >
                <option value="" className="bg-brand-dark">Unset Genre</option>
                {GENRES.map(g => <option key={g} value={g} className="bg-brand-dark">{g}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-2 md:gap-3 border-r border-border-subtle pr-3 md:pr-5 mr-1 group/sel hidden sm:flex">
              <Sparkles className="text-text-secondary group-hover/sel:text-brand-primary transition-colors h-4 w-4 md:h-5 md:w-5 shrink-0" />
              <select 
                value={project.tone}
                onChange={(e) => updateProject({ tone: e.target.value })}
                aria-label="Project Tone"
                className="bg-transparent text-[11px] font-black text-text-primary outline-none py-1 md:py-2 uppercase tracking-[0.1em] md:tracking-[0.2em] cursor-pointer hover:text-brand-primary transition-colors max-w-[140px] md:max-w-[160px] appearance-none"
              >
                <option value="" className="bg-brand-dark">Unset Tone</option>
                {TONES.map(t => <option key={t} value={t} className="bg-brand-dark">{t}</option>)}
              </select>
           </div>

           <div className="flex items-center justify-between sm:justify-start gap-2 md:gap-4 border-b sm:border-b-0 sm:border-r border-border-subtle pb-3 sm:pb-0 pr-4 md:pr-8 mr-1 px-2 md:px-4 w-full sm:w-auto" role="group" aria-label="Maturity Level Selection">
              <span className="sm:hidden text-[9px] font-black text-text-secondary uppercase tracking-[0.2em]">Scale:</span>
              <div className="flex items-center gap-2 md:gap-4">
                {MATURITY_LEVELS.map((lvl) => (
                  <button
                    key={lvl.value}
                    onClick={() => updateProject({ maturity: lvl.value })}
                    aria-label={`${lvl.label} Protocol`}
                    aria-pressed={project.maturity === lvl.value}
                    className={`p-2.5 md:p-3 rounded-lg md:rounded-2xl transition-all relative group/maturity min-h-[38px] min-w-[38px] flex items-center justify-center ${
                      project.maturity === lvl.value 
                        ? `btn-nexus-primary shadow-2xl shadow-brand-primary/30 scale-110` 
                        : 'bg-surface-muted text-text-secondary hover:text-brand-primary grayscale opacity-30 hover:opacity-100 hover:grayscale-0'
                    }`}
                  >
                    <lvl.icon size={16} className="md:w-5 md:h-5" />
                    {project.maturity === lvl.value && (
                      <motion.div layoutId="maturity-glow" className="absolute inset-0 bg-white/20 rounded-lg md:rounded-2xl blur-md" />
                    )}
                  </button>
                ))}
              </div>
           </div>

           <div className="flex items-center justify-end gap-3 pr-2 w-full sm:w-auto mt-2 sm:mt-0">
               <button 
                onClick={saveToCloud}
                className={`p-3.5 rounded-2xl transition-all shadow-xl active:scale-95 border min-h-[44px] min-w-[44px] flex items-center justify-center ${isSaving ? 'bg-brand-primary border-brand-primary text-white shadow-brand-primary/20' : 'bg-surface-muted border-border-subtle text-text-secondary hover:text-brand-primary hover:border-brand-primary/40'}`}
                title="Save into Cloud"
              >
                {isSaving ? <Activity size={20} className="animate-spin" /> : <Save size={20} />}
              </button>
              <button 
                onClick={deleteProject}
                className="p-3.5 bg-surface-muted text-text-secondary hover:text-red-500 hover:bg-red-500/10 border border-border-subtle hover:border-red-500/30 rounded-2xl transition-all active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Delete Project"
              >
                <Trash2 size={20} />
              </button>
           </div>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 md:gap-8">
        {stats.map((stat, i) => (
          <motion.button
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
            onClick={() => setView(stat.view as ViewType)}
            className="p-4 md:p-8 ethereal-panel border border-border-subtle rounded-2xl md:rounded-[2.5rem] flex flex-col items-start gap-2 md:gap-6 hover:border-brand-primary/50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] transition-all group text-left relative overflow-hidden active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
               <stat.icon size={isMobile ? 40 : 80} />
            </div>
            <div className={`p-2 md:p-4 rounded-lg md:rounded-2xl bg-surface-muted text-text-secondary group-hover:bg-brand-primary group-hover:text-white transition-all duration-500 shadow-sm`}>
              <stat.icon className="w-4 h-4 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xl md:text-4xl font-black text-text-primary leading-none mb-1 md:mb-2 tabular-nums">{stat.value.toLocaleString()}</div>
              <div className="text-[8px] md:text-[10px] text-text-secondary font-black uppercase tracking-[0.2em] leading-none opacity-60 group-hover:opacity-100 transition-opacity">{stat.label}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        {/* Premise Editor */}
        <section className="md:col-span-12 p-8 ethereal-panel border border-border-subtle rounded-[2.5rem] space-y-4 shadow-xl group transition-all hover:border-brand-primary/30">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-brand-primary flex items-center gap-3 uppercase tracking-[0.3em]">
              <FileText size={16} />
              The Core Premise
            </h3>
            <span className="text-[9px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-40">Artifact: {project.id.slice(-8)}</span>
          </div>
          <textarea
            value={localPremise}
            onChange={(e) => setLocalPremise(e.target.value)}
            placeholder="Dictate your rudimentary concept here. Even a shopping receipt will suffice; I shall elevate it."
            className="w-full h-32 bg-surface-muted border border-border-subtle rounded-2xl p-6 text-text-primary focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:ethereal-panel resize-none transition-all outline-none leading-relaxed text-lg md:text-xl font-serif italic placeholder:opacity-40"
          />
        </section>

        {/* Word Count Strategy */}
        <section className="md:col-span-12 p-8 bg-brand-dark rounded-[2.5rem] text-text-primary space-y-6 shadow-xl border border-border-subtle relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000 grayscale">
             <Target size={120} />
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
            <div>
              <div className="text-[10px] font-black text-brand-primary uppercase tracking-[0.4em] mb-2">Monumental Scope</div>
              <h3 className="text-2xl font-black italic font-serif tracking-tight leading-none">The Required Canvas</h3>
              <p className="text-xs text-text-secondary mt-2 max-w-md">I require an adequate medium if I am to produce a masterpiece. Specify the extent of the labor.</p>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              <div className="text-3xl md:text-5xl font-black italic font-serif text-brand-primary leading-none tabular-nums drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                {project.stats?.totalWords?.toLocaleString() || 0} <span className="text-text-secondary/40 text-xl md:text-2xl font-normal not-italic mx-2">/</span> {project.targetWordCount?.toLocaleString() || '∞'}
              </div>
              
              <div className="flex items-center gap-2">
                <select 
                  className="bg-surface-muted text-text-primary text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-border-subtle hover:border-brand-primary/50 transition-colors outline-none cursor-pointer rounded-xl"
                  value={project.targetWordCount || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val > 0) updateProject({ targetWordCount: val });
                  }}
                >
                  <option value="" disabled>Select Ambition...</option>
                  <option value="1000">1,000 (Pamphlet)</option>
                  <option value="5000">5,000 (Short Story)</option>
                  <option value="20000">20,000 (Novella)</option>
                  <option value="50000">50,000 (Novel)</option>
                  <option value="80000">80,000 (Standard Epic)</option>
                  <option value="100000">100,000 (Masterpiece)</option>
                </select>
                
                <input 
                  type="number"
                  placeholder="Custom..."
                  value={![1000, 5000, 20000, 50000, 80000, 100000].includes(project.targetWordCount ?? 0) && project.targetWordCount ? project.targetWordCount : ''}
                  className="w-24 py-2 px-3 bg-surface-muted border border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest text-text-primary outline-none focus:border-brand-primary transition-all placeholder:text-text-secondary/50 hidden md:block"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val > 0) updateProject({ targetWordCount: val });
                  }}
                />
              </div>
            </div>
          </div>

          {project.targetWordCount && (
            <div className="relative pt-2 z-10">
              <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}%` }}
                  className="h-full bg-brand-primary relative rounded-full shadow-[0_0_20px_rgba(168,85,247,0.6)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/30 animate-shimmer" />
                </motion.div>
              </div>
              <div className="mt-2 flex justify-between items-center text-[9px] font-black uppercase tracking-[0.3em] text-text-secondary">
                <span>Blank Void</span>
                <span className="text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-md border border-brand-primary/20">
                  {Math.round(((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}% Orchestrated
                </span>
                <span>Limit: {project.targetWordCount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </section>

        {/* Draft Stage System */}
        <section className="md:col-span-12">
          <DraftStagePanel 
            project={project} 
            chapters={chapters} 
            updateProject={updateProject} 
          />
        </section>
      </div>
      </div>
    </div>
  );
}
