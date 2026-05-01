import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Target, 
  Shield, 
  Type, 
  Save, 
  Trash2, 
  AlertCircle,
  FileText,
  Volume2,
  Zap,
  Flame
} from 'lucide-react';
import { Project, ProjectType, MaturityLevel } from '../types';
import { motion } from 'motion/react';

interface Props {
  project: Project;
  updateProject: (updates: Partial<Project>) => void;
  deleteProject: () => void;
}

const GENRES = [
  'Science Fiction',
  'Fantasy',
  'Mystery',
  'Thriller',
  'Romance',
  'Historical Fiction',
  'Horror',
  'Literary Fiction',
  'Non-Fiction',
  'Legal Thriller',
  'Academic Journal',
  'Experimental'
];

const TONES = [
  'Cinematic',
  'Noir',
  'Gritty',
  'Whimsical',
  'Formal',
  'Academic',
  'Poetic',
  'Minimalist',
  'Humorous',
  'Suspenseful'
];

const MATURITY_LEVELS: { value: MaturityLevel; label: string; description: string }[] = [
  { 
    value: 'standard', 
    label: 'Standard', 
    description: 'Safe for general audiences. Focuses on narrative structure without explicit content.' 
  },
  { 
    value: 'mature', 
    label: 'Mature', 
    description: 'Contains complex themes, strong language, or non-graphic violence appropriate for adult readers.' 
  },
  { 
    value: 'transgressive', 
    label: 'Transgressive', 
    description: 'Highly experimental or boundary-pushing content. Exploring darker psychological depths.' 
  }
];

export default function SettingsView({ project, updateProject, deleteProject }: Props) {
  const [localTitle, setLocalTitle] = useState(project.title);

  useEffect(() => {
    setLocalTitle(project.title);
  }, [project.id]); // Just reset when project changes, don't override on every DB update

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localTitle !== project.title) {
        updateProject({ title: localTitle });
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [localTitle, project.title, updateProject]);

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-slate-900 rounded-lg text-white">
            <Settings size={20} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Project Engine</h2>
        </div>
        <p className="text-slate-500 font-medium italic">Configure the core parameters and narrative DNA of your archive.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Core Metadata */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-slate-400 mb-4">
            <Type size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Metadata</span>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Project Title</label>
              <input 
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-serif italic text-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Narrative Format</label>
              <select 
                value={project.type}
                onChange={(e) => updateProject({ type: e.target.value as ProjectType })}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              >
                <option value="novel">Novel</option>
                <option value="screenplay">Screenplay</option>
                <option value="stageplay">Stageplay</option>
                <option value="radioplay">Radioplay</option>
                <option value="legal">Legal Document</option>
                <option value="academic">Academic Paper</option>
                <option value="experimental">Experimental Archive</option>
              </select>
            </div>
          </div>
        </section>

        {/* Narrative Style */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-slate-400 mb-4">
            <Target size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Aesthetic Direction</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Genre Archetype</label>
              <select 
                value={project.genre}
                onChange={(e) => updateProject({ genre: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              >
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Narrative Tone</label>
              <select 
                value={project.tone}
                onChange={(e) => updateProject({ tone: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-medium"
              >
                {TONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </section>
      </div>

      {/* Billing & Subscription */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 text-slate-400 mb-4">
          <Zap size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Billing & Subscription</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 bg-white border border-emerald-200 rounded-3xl group shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
               <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full">Active</div>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 mb-2 italic">Pro Subscription</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                You are currently subscribed to the Unlimited Plan. You have full access to Neural Processing and large context windows.
              </p>
            </div>
            <div className="mt-8">
              <button disabled className="px-6 py-2 bg-slate-100 text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl cursor-not-allowed">
                Subscribed
              </button>
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-200 rounded-3xl group shadow-sm flex flex-col justify-between relative overflow-hidden opacity-50 pointer-events-none">
            <div>
              <h3 className="text-lg font-black text-slate-900 mb-2 italic">Pay-Per-Request Mode</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Connect a billing account to only pay for the exact compute time used by the Swarm and Architect engines.
              </p>
            </div>
            <div className="mt-8">
              <button disabled className="px-6 py-2 border-2 border-slate-200 text-slate-400 font-bold text-xs uppercase tracking-widest rounded-xl">
                Switch to Pay-Per-Request
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* AI Fallback Notice */}
      <section className="p-6 bg-blue-50 border border-blue-100 rounded-3xl space-y-4">
        <div className="flex items-center gap-2 text-blue-600">
          <Zap size={18} className="fill-blue-600" />
          <h3 className="text-sm font-black uppercase tracking-widest">Distributed Intelligence Fallback</h3>
        </div>
        <p className="text-xs text-blue-700 leading-relaxed font-medium italic">
          To ensure uninterrupted narrative architecture when primary Gemini quotas are exceeded, this engine supports an automatic fallback to <b>xAI Grok</b>.
        </p>
        <div className="flex items-center gap-3 p-4 bg-white/50 rounded-xl border border-blue-200">
          <div className="flex-1">
            <code className="text-[10px] font-mono font-bold text-blue-900">VITE_GROK_API_KEY</code>
            <p className="text-[9px] text-blue-500 mt-1 uppercase font-black tracking-tighter">Required for fallback stability</p>
          </div>
          <div className="text-[10px] font-bold text-blue-400 italic">
            Configured in environment
          </div>
        </div>
      </section>

      {/* Maturity Control */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 text-slate-400 mb-4">
          <Shield size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Compliance & Depth</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MATURITY_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => updateProject({ maturity: level.value })}
              className={`p-6 rounded-2xl border text-left transition-all group ${
                project.maturity === level.value 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20' 
                  : 'bg-white border-slate-200 text-slate-900 hover:border-blue-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${
                project.maturity === level.value ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
              }`}>
                {level.value === 'standard' && <Shield size={16} />}
                {level.value === 'mature' && <AlertCircle size={16} />}
                {level.value === 'transgressive' && <Flame size={16} className="text-orange-500" />}
              </div>
              <div className="font-bold mb-1 uppercase tracking-widest text-xs">{level.label}</div>
              <p className={`text-[11px] leading-relaxed ${
                project.maturity === level.value ? 'text-blue-100' : 'text-slate-500'
              }`}>
                {level.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="pt-12 border-t border-slate-200">
        <div className="bg-red-50 rounded-3xl p-8 border border-red-100">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-2xl mt-1">
              <Trash2 size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">Archive Deletion</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium italic">
                Destroying this project will permanently erase all chapters, characters, and plot architecture. This action cannot be revoked.
              </p>
              <button 
                onClick={deleteProject}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-red-100"
              >
                Execute Global Deletion
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
