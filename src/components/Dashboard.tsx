/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Users, GitBranch, PenTool, Sparkles, FileText, BookOpen, Layers, Save, Trash2, Trophy, Target, Plus, ChevronDown, Activity } from 'lucide-react';
import { Project, ViewType, ProjectType, MaturityLevel, Chapter } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { PROJECT_TYPES, MATURITY_LEVELS, GENRES, TONES } from '../constants';
import DraftStagePanel from './DraftStagePanel';

interface Props {
  project: Project;
  projects: Project[];
  chapters: Chapter[];
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
    { label: 'Characters', value: project.characters?.length || 0, icon: Users, color: 'text-brand-primary', bgColor: 'bg-brand-primary/10', view: 'characters' },
    { label: 'Plot Nodes', value: project.plotNodes?.length || 0, icon: GitBranch, color: 'text-brand-primary', bgColor: 'bg-brand-primary/10', view: 'plot' },
    { label: 'Chapters', value: project.chapters?.length || 0, icon: BookOpen, color: 'text-brand-primary', bgColor: 'bg-brand-primary/10', view: 'writing' },
    { 
      label: project.targetWordCount ? `${Math.round(((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}% Synchronized` : 'Target Offline', 
      value: project.stats?.totalWords || 0, 
      icon: Target, 
      color: 'text-brand-primary', 
      bgColor: 'bg-brand-primary/10', 
      view: 'writing' 
    },
  ];

  return (
    <div className="h-full overflow-y-auto overscroll-contain custom-scrollbar" style={{ minHeight: 0 }}>
      <div className="max-w-6xl mx-auto space-y-5 pb-16 px-4 md:px-6 pt-6">
      {/* Target Prize Banner */}
      {project.targetPrize && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setView('prizes')}
          className="bg-brand-primary text-white p-1 rounded-[2.5rem] shadow-2xl shadow-brand-primary/30 group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="bg-brand-dark/20 backdrop-blur-md rounded-[2.4rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 border border-white/10">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                <Trophy size={28} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60 mb-1">Strategic Objective</span>
                <span className="text-xl md:text-2xl font-black italic font-serif leading-tight">{project.targetPrize}</span>
              </div>
            </div>
            <div className="flex items-center gap-8 w-full md:w-auto">
               <div className="flex flex-col items-end flex-1 md:flex-initial">
                 <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 mb-2">Eligibility Matrix</span>
                 <div className="h-2 w-full md:w-64 bg-white/10 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${project.prizeAssessments?.find(a => a.prizeName === project.targetPrize)?.eligibilityScore || 0}%` }}
                    className="h-full bg-white transition-all duration-1000 shadow-[0_0_15px_#fff] rounded-full" 
                  />
                 </div>
               </div>
              <div className="p-4 bg-white text-brand-primary rounded-2xl shadow-xl animate-pulse">
                <Target size={24} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Dashboard Header — Caspa style */}
      <header className="flex flex-col gap-3 border-b border-border-subtle pb-4">
        {/* Title row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="badge-teal flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                Active Project
              </span>
              <span className="text-[9px] text-text-tertiary">Rev {project.stats?.revCount || 1}</span>
            </div>
            <input 
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="text-2xl md:text-3xl font-bold text-text-primary italic font-serif bg-transparent border-none focus:ring-0 p-0 w-full leading-tight hover:text-brand-primary transition-colors cursor-text placeholder:opacity-20 outline-none"
              placeholder="Project Title..."
            />
          </div>

          {/* Controls toolbar */}
          <div className="flex flex-wrap items-center gap-2 bg-surface-card border border-border-subtle rounded-xl p-2">
            <div className="flex items-center gap-1.5 border-r border-border-subtle pr-2 mr-1">
              <Layers size={13} className="text-text-tertiary" />
              <select 
                value={project.type}
                onChange={(e) => updateProject({ type: e.target.value as ProjectType })}
                className="bg-transparent text-xs font-medium text-text-secondary outline-none cursor-pointer hover:text-text-primary transition-colors appearance-none"
              >
                {PROJECT_TYPES.map(t => <option key={t.value} value={t.value} className="bg-surface-bg">{t.label}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1.5 border-r border-border-subtle pr-2 mr-1">
              <BookOpen size={13} className="text-text-tertiary" />
              <select 
                value={project.genre}
                onChange={(e) => updateProject({ genre: e.target.value })}
                className="bg-transparent text-xs font-medium text-text-secondary outline-none cursor-pointer hover:text-text-primary transition-colors max-w-[120px] appearance-none"
              >
                <option value="" className="bg-surface-bg">Genre</option>
                {GENRES.map(g => <option key={g} value={g} className="bg-surface-bg">{g}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1.5 border-r border-border-subtle pr-2 mr-1 hidden sm:flex">
              <Sparkles size={13} className="text-text-tertiary" />
              <select 
                value={project.tone}
                onChange={(e) => updateProject({ tone: e.target.value })}
                className="bg-transparent text-xs font-medium text-text-secondary outline-none cursor-pointer hover:text-text-primary transition-colors max-w-[110px] appearance-none"
              >
                <option value="" className="bg-surface-bg">Tone</option>
                {TONES.map(t => <option key={t} value={t} className="bg-surface-bg">{t}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1 border-r border-border-subtle pr-2 mr-1">
              {MATURITY_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  onClick={() => updateProject({ maturity: lvl.value })}
                  title={lvl.label}
                  className={`p-1.5 rounded-lg transition-all ${
                    project.maturity === lvl.value 
                      ? 'bg-brand-primary/20 text-brand-primary' 
                      : 'text-text-tertiary hover:text-text-secondary grayscale opacity-40 hover:opacity-80 hover:grayscale-0'
                  }`}
                >
                  <lvl.icon size={13} />
                </button>
              ))}
            </div>

            <button 
              onClick={saveToCloud}
              className={`p-2 rounded-lg transition-all active:scale-95 ${
                isSaving ? 'text-brand-primary' : 'text-text-tertiary hover:text-brand-primary hover:bg-surface-overlay'
              }`}
              title="Save"
            >
              {isSaving ? <Activity size={15} className="animate-spin" /> : <Save size={15} />}
            </button>
            <button 
              onClick={deleteProject}
              className="p-2 text-text-tertiary hover:text-status-error hover:bg-status-error/10 rounded-lg transition-all active:scale-95"
              title="Delete project"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Stats Grid — Caspa card style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {stats.map((stat, i) => (
          <motion.button
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            onClick={() => setView(stat.view as ViewType)}
            className="p-3 bg-surface-card border border-border-subtle rounded-xl flex flex-col items-start gap-2 hover:border-brand-primary/40 transition-all group text-left active:scale-[0.98]"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
          >
            <div className="w-8 h-8 rounded-xl bg-brand-primary/10 flex items-center justify-center group-hover:bg-brand-primary/20 transition-colors">
              <stat.icon size={13} className="text-brand-primary" />
            </div>
            <div className="min-w-0 w-full">
              <div className="text-xl font-bold text-text-primary leading-none mb-1 tabular-nums">{stat.value.toLocaleString()}</div>
              <div className="text-xs text-text-tertiary leading-none truncate">{stat.label}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Premise Editor — Caspa card */}
        <section className="md:col-span-12 p-5 bg-surface-card border border-border-subtle rounded-2xl space-y-3 transition-all hover:border-brand-primary/30"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-secondary flex items-center gap-2">
              <FileText size={13} className="text-brand-primary" />
              Premise
            </h3>
            <span className="text-[9px] text-text-tertiary font-mono">{project.id.slice(-8)}</span>
          </div>
          <textarea
            value={localPremise}
            onChange={(e) => setLocalPremise(e.target.value)}
            placeholder="Describe the core premise of this project..."
            className="w-full h-28 bg-surface-raised border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary focus:ring-1 focus:ring-brand-primary/30 focus:border-brand-primary/50 resize-none transition-all outline-none leading-relaxed font-serif italic placeholder:text-text-tertiary/50"
          />
        </section>

        {/* Word Count Target — Caspa card */}
        <section className="md:col-span-12 p-5 bg-surface-card border border-border-subtle rounded-2xl space-y-4"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-secondary flex items-center gap-2">
              <Target size={13} className="text-brand-primary" />
              Word Count Target
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary tabular-nums">{project.stats?.totalWords?.toLocaleString() || 0}</span>
              <span className="text-text-tertiary text-xs">/</span>
              <span className="text-sm font-semibold text-brand-primary tabular-nums">{project.targetWordCount?.toLocaleString() || '—'}</span>
            </div>
          </div>

          {/* Progress bar */}
          {project.targetWordCount && (
            <div>
              <div className="progress-teal">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}%` }}
                  className="progress-teal-fill"
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-text-tertiary">
                <span>0</span>
                <span className="text-brand-primary font-semibold">{Math.round(((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}% complete</span>
                <span>{project.targetWordCount.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Word count presets */}
          <div className="flex flex-wrap gap-2">
            {[1000, 5000, 20000, 50000, 80000, 100000].map(count => (
              <button 
                key={count}
                onClick={() => updateProject({ targetWordCount: count })}
                className={`py-1.5 px-3 rounded-lg text-[10px] font-semibold transition-all border ${
                  project.targetWordCount === count 
                    ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary' 
                    : 'bg-surface-raised border-border-subtle text-text-tertiary hover:text-text-secondary hover:border-border-medium'
                }`}
              >
                {count >= 1000 ? `${count/1000}k` : count}
              </button>
            ))}
            <input 
              type="number"
              placeholder="Custom"
              value={![1000, 5000, 20000, 50000, 80000, 100000].includes(project.targetWordCount ?? 0) && project.targetWordCount ? project.targetWordCount : ''}
              className="py-1.5 px-3 bg-surface-raised border border-border-subtle rounded-lg text-[10px] font-semibold text-text-primary outline-none focus:border-brand-primary/50 transition-all placeholder:text-text-tertiary/50 w-20"
              onChange={(e) => { const val = parseInt(e.target.value); if (val > 0) updateProject({ targetWordCount: val }); }}
            />
          </div>
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
