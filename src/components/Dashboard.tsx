/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Book, Users, GitBranch, PenTool, Sparkles, FileText, BookOpen, Layers, ShieldAlert, AlertCircle, Save, Trash2, Trophy, Target, Plus, ChevronDown } from 'lucide-react';
import { Project, ViewType, ProjectType, MaturityLevel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { PROJECT_TYPES, MATURITY_LEVELS, GENRES, TONES } from '../constants';

interface Props {
  project: Project;
  projects: Project[];
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
    { label: 'Characters', value: project.characters?.length || 0, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50', view: 'characters' },
    { label: 'Plot Nodes', value: project.plotNodes?.length || 0, icon: GitBranch, color: 'text-indigo-600', bgColor: 'bg-indigo-50', view: 'plot' },
    { label: 'Chapters', value: project.chapters?.length || 0, icon: Book, color: 'text-emerald-600', bgColor: 'bg-emerald-50', view: 'writing' },
    { 
      label: project.targetWordCount ? `${Math.round(((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}% Goal` : 'Set Target', 
      value: project.stats?.totalWords || 0, 
      icon: Target, 
      color: 'text-rose-600', 
      bgColor: 'bg-rose-50', 
      view: 'writing' 
    },
  ];

  return (
    <div className="space-y-12">
      {/* Target Prize Banner */}
      {project.targetPrize && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setView('prizes')}
          className="bg-amber-600 text-white px-6 py-3 rounded-full flex items-center justify-between cursor-pointer hover:bg-amber-500 transition-colors shadow-lg shadow-amber-100"
        >
          <div className="flex items-center gap-3">
            <Trophy size={16} className="text-amber-200" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Aiming For: {project.targetPrize}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1 w-24 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-1000" 
                style={{ width: `${project.prizeAssessments?.find(a => a.prizeName === project.targetPrize)?.eligibilityScore || 0}%` }}
              />
            </div>
            <Target size={14} className="text-amber-200" />
          </div>
        </motion.div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex-1">
          <div className="mb-4">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">Archive Focus</span>
          </div>
          <input 
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter italic font-serif bg-transparent border-none focus:ring-0 p-0 w-full"
            placeholder="Manuscript Title"
          />
        </div>
        
        <div className="flex gap-4 items-center bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
           <div className="flex items-center gap-1 border-r border-slate-100 pr-4 mr-2">
              <Layers className="text-slate-400 ml-2" size={18} />
              <select 
                value={project.type}
                onChange={(e) => updateProject({ type: e.target.value as ProjectType })}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none pr-8 py-2"
              >
                {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-1 border-r border-slate-100 pr-4 mr-2">
              <BookOpen className="text-slate-400 ml-2" size={18} />
              <select 
                value={project.genre}
                onChange={(e) => updateProject({ genre: e.target.value })}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none pr-8 py-2 max-w-[120px]"
              >
                <option value="">Select Genre...</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-1 border-r border-slate-100 pr-4 mr-2">
              <Sparkles className="text-slate-400 ml-2" size={18} />
              <select 
                value={project.tone}
                onChange={(e) => updateProject({ tone: e.target.value })}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none pr-8 py-2 max-w-[120px]"
              >
                <option value="">Select Tone...</option>
                {TONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-2 border-r border-slate-100 pr-4 mr-2">
              {MATURITY_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  onClick={() => updateProject({ maturity: lvl.value })}
                  title={`${lvl.label} Mode`}
                  className={`p-2 rounded-xl transition-all ${
                    project.maturity === lvl.value 
                      ? `${lvl.bgColor} ${lvl.color} shadow-sm ring-1 ring-inset ring-current/20` 
                      : 'bg-transparent text-slate-300 hover:text-slate-400'
                  }`}
                >
                  <lvl.icon size={18} />
                </button>
              ))}
           </div>

           <div className="flex items-center gap-2 pr-2">
              <button 
                onClick={saveToCloud}
                className={`p-2 rounded-xl transition-all ${isSaving ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-blue-600'}`}
                title="Sync Manuscript"
              >
                <Save size={18} />
              </button>
              <button 
                onClick={deleteProject}
                className="p-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                title="Wipe Project"
              >
                <Trash2 size={18} />
              </button>
           </div>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <motion.button
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setView(stat.view as ViewType)}
            className="p-4 md:p-6 bg-white border border-slate-200 rounded-xl flex flex-col items-start gap-3 md:gap-4 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50/50 transition-all group text-left shadow-sm truncate"
          >
            <div className={`p-2.5 md:p-3 rounded-lg ${stat.bgColor} ${stat.color} group-hover:scale-105 transition-transform shrink-0`}>
              <stat.icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">{stat.value}</div>
              <div className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none truncate">{stat.label}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Premise Editor */}
        <section className="md:col-span-12 p-8 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              <FileText size={16} className="text-blue-600" />
              Strategic Narrative Focus
            </h3>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Primary Architecture</span>
          </div>
          <textarea
            value={localPremise}
            onChange={(e) => setLocalPremise(e.target.value)}
            placeholder="A young astronomer discovers a signal from a dead star..."
            className="w-full h-32 bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white resize-none transition-all outline-none leading-relaxed text-lg font-serif italic"
          />
        </section>

        {/* Word Count Strategy */}
        <section className="md:col-span-12 p-8 bg-slate-900 rounded-[2.5rem] text-white space-y-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
             <Target size={180} />
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h3 className="text-xl font-black italic font-serif tracking-tight mb-1">Scale of Intent</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Architectural word count target</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black italic font-serif text-blue-400">
                {project.stats?.totalWords?.toLocaleString() || 0} / {project.targetWordCount?.toLocaleString() || '∞'}
              </div>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Current Transmissions</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
            {[1000, 5000, 20000, 50000, 80000, 100000].map(count => (
              <button 
                key={count}
                onClick={() => updateProject({ targetWordCount: count })}
                className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  project.targetWordCount === count 
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/50 scale-105' 
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {count >= 1000 ? `${count/1000}k` : count} Words
              </button>
            ))}
            <div className="md:col-span-1">
              <input 
                type="number"
                placeholder="Custom..."
                className="w-full py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-blue-400 placeholder:text-slate-600"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val > 0) updateProject({ targetWordCount: val });
                }}
              />
            </div>
          </div>

          {project.targetWordCount && (
            <div className="relative pt-4 z-10">
              <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}%` }}
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 relative"
                >
                  <div className="absolute inset-x-0 bottom-0 top-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                </motion.div>
              </div>
              <div className="mt-2 flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                <span>Origin: 0</span>
                <span className="text-blue-400">{Math.round(((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}% Realised</span>
                <span>Destination: {project.targetWordCount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
