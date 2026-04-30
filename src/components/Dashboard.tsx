/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Book, Users, GitBranch, PenTool, Sparkles, FileText, BookOpen, Layers, ShieldAlert, AlertCircle, Save, Trash2 } from 'lucide-react';
import { Project, ViewType, ProjectType, MaturityLevel } from '../types';
import { motion } from 'motion/react';

interface Props {
  project: Project;
  updateProject: (updates: Partial<Project>) => void;
  setView: (view: ViewType) => void;
  deleteProject: () => void;
  saveToCloud: () => void;
  isSaving: boolean;
}

export default function Dashboard({ project, updateProject, setView, deleteProject, saveToCloud, isSaving }: Props) {
  const [localPremise, setLocalPremise] = useState(project.premise);
  const [localTitle, setLocalTitle] = useState(project.title);

  // Debounced update for premise
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localPremise !== project.premise) {
        updateProject({ premise: localPremise });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localPremise, project.premise, updateProject]);

  // Debounced update for title
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localTitle !== project.title) {
        updateProject({ title: localTitle });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localTitle, project.title, updateProject]);

  const projectTypes: { value: ProjectType; label: string }[] = [
    { value: 'novel', label: 'Novel' },
    { value: 'screenplay', label: 'Screenplay' },
    { value: 'legal', label: 'Legal Brief' },
    { value: 'academic', label: 'Academic Paper' },
    { value: 'stageplay', label: 'Stage Play' },
    { value: 'radioplay', label: 'Radio Drama' },
  ];

  const maturityLevels: { value: MaturityLevel; label: string; icon: any; color: string; bgColor: string }[] = [
    { value: 'standard', label: 'Standard', icon: Book, color: 'text-slate-600', bgColor: 'bg-slate-100' },
    { value: 'mature', label: 'Mature', icon: AlertCircle, color: 'text-amber-600', bgColor: 'bg-amber-100' },
    { value: 'transgressive', label: 'Transgressive', icon: ShieldAlert, color: 'text-red-600', bgColor: 'bg-red-100' },
  ];

  const stats = [
    { label: 'Characters', value: project.characters?.length || 0, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50', view: 'characters' },
    { label: 'Plot Nodes', value: project.plotNodes?.length || 0, icon: GitBranch, color: 'text-indigo-600', bgColor: 'bg-indigo-50', view: 'plot' },
    { label: 'Chapters', value: project.chapters?.length || 0, icon: Book, color: 'text-emerald-600', bgColor: 'bg-emerald-50', view: 'writing' },
    { label: 'Research', value: project.research?.length || 0, icon: BookOpen, color: 'text-amber-600', bgColor: 'bg-amber-50', view: 'research' },
  ];

  return (
    <div className="space-y-12">
      <header className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3 mb-4">
             <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-full">Project Control</span>
          </div>
          <input 
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            className="text-5xl font-black text-slate-900 tracking-tighter italic font-serif bg-transparent border-none focus:ring-0 p-0 w-full"
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
                {projectTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-2 border-r border-slate-100 pr-4 mr-2">
              {maturityLevels.map((lvl) => (
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.button
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setView(stat.view as ViewType)}
            className="p-6 bg-white border border-slate-200 rounded-xl flex flex-col items-start gap-4 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50/50 transition-all group text-left shadow-sm"
          >
            <div className={`p-3 rounded-lg ${stat.bgColor} ${stat.color} group-hover:scale-105 transition-transform`}>
              <stat.icon size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">{stat.label}</div>
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
      </div>
    </div>
  );
}
