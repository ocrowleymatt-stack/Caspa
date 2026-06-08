import React, { useState, useEffect, useRef } from 'react';
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
  Flame,
  ChevronDown,
  Eye,
  MessageSquare,
  Sparkles,
  Lock,
  Ghost,
  Fingerprint
} from 'lucide-react';
import { Project, ProjectType, MaturityLevel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { GENRES, TONES, MATURITY_LEVELS, PROJECT_TYPES } from '../constants';

interface Props {
  key?: React.Key;
  project: Project;
  updateProject: (updates: Partial<Project>) => void;
  deleteProject: () => void;
}

export default function SettingsView({ project, updateProject, deleteProject }: Props) {
  const [localTitle, setLocalTitle] = useState(project.title);
  const [localPremise, setLocalPremise] = useState(project.premise);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setLocalTitle(project.title);
    setLocalPremise(project.premise);
  }, [project.id]);

  const updateProjectRef = useRef(updateProject);
  useEffect(() => {
    updateProjectRef.current = updateProject;
  }, [updateProject]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localTitle !== project.title) {
        updateProjectRef.current({ title: localTitle });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [localTitle, project.title]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localPremise !== project.premise) {
        updateProjectRef.current({ premise: localPremise });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [localPremise, project.premise]);

  const handleStyleUpdate = (updates: Partial<NonNullable<Project['styleDNA']>>) => {
    updateProject({
      styleDNA: {
        ...(project.styleDNA || {
          proseIntensity: 50,
          dialogueWeight: 50,
          sensoryPriority: 'balanced',
          vocabularyLevel: 'simple',
          narrativeRhythm: 50
        }),
        ...updates
      }
    });
  };

  const downloadBackup = () => {
    const data = {
      project,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title || 'project'}-backup.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto overscroll-contain custom-scrollbar px-4 pb-32" style={{ minHeight: 0 }}>
      <div className="max-w-4xl mx-auto space-y-16 py-12">
      <header className="bg-surface-card p-10 rounded-[3rem] border border-border-subtle shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-[0.02] transition-opacity duration-1000" />
        <div className="flex items-center gap-4 mb-4 relative z-10">
          <div className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary shadow-inner">
            <Settings size={24} />
          </div>
          <h2 className="text-4xl font-black tracking-tighter text-text-primary italic font-serif">Project Engine</h2>
        </div>
        <p className="text-text-secondary font-black uppercase tracking-[0.4em] text-[10px] opacity-40 relative z-10 leading-relaxed">Configure the core parameters and narrative DNA of your archive.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Core Metadata */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 text-brand-primary mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Metadata Protocols</span>
          </div>
          
          <div className="space-y-6">
            <div className="p-8 bg-surface-card border border-border-subtle rounded-3xl group hover:border-brand-primary/30 transition-all shadow-sm">
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] mb-4 opacity-40">Project Title</label>
              <input 
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                className="w-full bg-surface-muted border border-border-subtle rounded-xl px-6 py-4 text-text-primary focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all font-serif italic text-2xl"
              />
            </div>

            <div className="p-8 bg-surface-card border border-border-subtle rounded-3xl group hover:border-brand-primary/30 transition-all shadow-sm">
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] mb-4 opacity-40">Narrative Format</label>
              <div className="relative">
                <select 
                  value={project.type}
                  onChange={(e) => updateProject({ type: e.target.value as ProjectType })}
                  className="w-full bg-surface-muted border border-border-subtle rounded-xl px-6 py-4 text-text-primary focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all font-black uppercase tracking-widest text-xs appearance-none"
                >
                  {PROJECT_TYPES.map(t => (
                    <option key={t.value} value={t.value} className="bg-brand-dark">{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={16} />
              </div>
            </div>

            <div className="p-8 bg-surface-card border border-border-subtle rounded-3xl group hover:border-brand-primary/30 transition-all shadow-sm">
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] mb-4 opacity-40">Narrative Premise</label>
              <textarea 
                value={localPremise}
                onChange={(e) => setLocalPremise(e.target.value)}
                rows={5}
                className="w-full bg-surface-muted border border-border-subtle rounded-xl px-6 py-4 text-text-primary focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all font-serif italic text-lg leading-relaxed resize-none"
                placeholder="A signal from a dead star..."
              />
            </div>
          </div>
        </section>

        {/* Narrative DNA */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 text-brand-primary mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Stylistic DNA</span>
          </div>

          <div className="bg-surface-card border border-border-subtle rounded-[2.5rem] p-10 space-y-10 shadow-xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                  <Fingerprint size={14} className="text-brand-primary" />
                  Prose Intensity
                </label>
                <span className="text-[10px] font-black text-brand-primary tabular-nums">{(project.styleDNA?.proseIntensity || 50)}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                value={project.styleDNA?.proseIntensity || 50}
                onChange={(e) => handleStyleUpdate({ proseIntensity: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-surface-muted rounded-full appearance-none cursor-pointer accent-brand-primary overflow-hidden"
              />
              <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-text-secondary opacity-30">
                <span>Minimalist</span>
                <span>Maximalist</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                  <MessageSquare size={14} className="text-brand-primary" />
                  Dialogue Weight
                </label>
                <span className="text-[10px] font-black text-brand-primary tabular-nums">{(project.styleDNA?.dialogueWeight || 50)}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                value={project.styleDNA?.dialogueWeight || 50}
                onChange={(e) => handleStyleUpdate({ dialogueWeight: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-surface-muted rounded-full appearance-none cursor-pointer accent-brand-primary overflow-hidden"
              />
              <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-text-secondary opacity-30">
                <span>Action Led</span>
                <span>Talk Heavy</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                  <Zap size={14} className="text-brand-primary" />
                  Narrative Rhythm
                </label>
                <span className="text-[10px] font-black text-brand-primary tabular-nums">{(project.styleDNA?.narrativeRhythm || 50)}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                value={project.styleDNA?.narrativeRhythm || 50}
                onChange={(e) => handleStyleUpdate({ narrativeRhythm: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-surface-muted rounded-full appearance-none cursor-pointer accent-brand-primary overflow-hidden"
              />
              <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-text-secondary opacity-30">
                <span>Staccato/Fast</span>
                <span>Lyrical/Slow</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="space-y-3">
                <label className="block text-[8px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-40">Sensory Map</label>
                <div className="relative">
                  <select 
                    value={project.styleDNA?.sensoryPriority || 'balanced'}
                    onChange={(e) => handleStyleUpdate({ sensoryPriority: e.target.value as any })}
                    className="w-full bg-surface-muted border border-border-subtle rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-primary outline-none appearance-none cursor-pointer"
                  >
                    <option value="balanced">Balanced</option>
                    <option value="visual">High Visual</option>
                    <option value="auditory">High Auditory</option>
                    <option value="tactile">Atmospheric/Tactile</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={12} />
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-[8px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-40">Lexical Level</label>
                <div className="relative">
                  <select 
                    value={project.styleDNA?.vocabularyLevel || 'simple'}
                    onChange={(e) => handleStyleUpdate({ vocabularyLevel: e.target.value as any })}
                    className="w-full bg-surface-muted border border-border-subtle rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-text-primary outline-none appearance-none cursor-pointer"
                  >
                    <option value="simple">Accessible</option>
                    <option value="elevated">Elevated</option>
                    <option value="erudite">Erudite</option>
                    <option value="technical">Technical</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={12} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-brand-dark border border-border-subtle rounded-3xl group transition-all shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Ghost size={18} className="text-brand-primary" />
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-40">Intelligence Persona</label>
            </div>
            <input 
              type="text"
              value={project.styleDNA?.aiPersona || ''}
              onChange={(e) => handleStyleUpdate({ aiPersona: e.target.value })}
              placeholder="e.g. A cynical detective, The silent observer..."
              className="w-full bg-surface-card border border-border-subtle rounded-xl px-6 py-4 text-text-primary focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all font-black uppercase tracking-widest text-[10px]"
            />
            <p className="text-[8px] font-black text-text-secondary uppercase tracking-widest opacity-20">Sets the ghostwriter behavior across the entire manuscript.</p>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12">
        {/* Core Config */}
        <section className="space-y-8">
           <div className="flex items-center gap-3 text-brand-primary mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Core Protocol</span>
          </div>
          <div className="space-y-4">
             <div className="p-6 bg-surface-card border border-border-subtle rounded-3xl flex items-center justify-between group">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Visibility Protocol</span>
                  <span className="text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-40">{project.isPublic ? 'Broadcasting to Network' : 'Classified/Offline'}</span>
                </div>
                <button 
                  onClick={() => updateProject({ isPublic: !project.isPublic })}
                  className={`w-12 h-6 rounded-full transition-all relative ${project.isPublic ? 'bg-brand-primary' : 'bg-surface-muted'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all transform ${project.isPublic ? 'translate-x-6' : ''}`} />
                </button>
             </div>
             
             <div className="p-8 bg-surface-card border border-border-subtle rounded-3xl group shadow-sm">
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] mb-4 opacity-40">Narrative Tone Archetype</label>
              <div className="relative">
                <select 
                  value={project.tone}
                  onChange={(e) => updateProject({ tone: e.target.value })}
                  className="w-full bg-surface-muted border border-border-subtle rounded-xl px-6 py-4 text-text-primary focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all font-black uppercase tracking-widest text-xs appearance-none"
                >
                  <option value="" className="bg-brand-dark">Select Tone...</option>
                  {TONES.map(t => <option key={t} value={t} className="bg-brand-dark">{t}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" size={16} />
              </div>
            </div>

            <div className="p-8 bg-brand-dark border border-border-subtle rounded-3xl group shadow-sm">
              <label className="block text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] mb-6">Target Synchronization Volume</label>
              <div className="flex gap-4">
                <input 
                  type="number"
                  value={project.targetWordCount || ''}
                  onChange={(e) => updateProject({ targetWordCount: parseInt(e.target.value) || 0 })}
                  className="flex-1 bg-surface-card border border-border-subtle rounded-2xl px-6 py-4 text-text-primary focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all font-black italic text-xl tabular-nums"
                  placeholder="e.g. 50000"
                />
                <div className="flex items-center px-6 bg-surface-muted border border-border-subtle rounded-2xl text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-40">
                  Units
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Intelligence Ecosystem */}
        <section className="space-y-10">
          <div className="flex items-center gap-3 text-brand-primary mb-8 px-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Intelligence Ecosystem</span>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {(['gemini', 'claude', 'openai', 'grok'] as const).map((provider) => (
                <button
                  key={provider}
                  onClick={() => updateProject({ primaryProvider: provider })}
                  className={`px-6 py-5 rounded-2xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden group/opt active:scale-95 ${
                    (project.primaryProvider || 'gemini') === provider
                      ? 'bg-brand-primary border-brand-primary text-white shadow-2xl shadow-brand-primary/30'
                      : 'bg-surface-card border-border-subtle text-text-secondary hover:border-brand-primary/40'
                  }`}
                >
                  <div className={`absolute inset-0 bg-white/10 opacity-0 group-hover/opt:opacity-100 transition-opacity`} />
                  <span className="relative z-10">{provider}</span>
                </button>
              ))}
            </div>
            
            <div className="p-8 bg-brand-dark border border-brand-primary/20 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-brand-primary opacity-[0.03] animate-pulse" />
              <div className="flex items-center gap-4 text-brand-primary relative z-10">
                <Zap size={18} className="fill-brand-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">Distributed Fallback active</h3>
              </div>
              <div className="space-y-2 relative z-10">
                {[
                  { key: 'GROK_API_KEY', label: 'Grok-Beta' },
                  { key: 'ANTHROPIC_API_KEY', label: 'Claude-3.5' },
                  { key: 'OPENAI_API_KEY', label: 'GPT-4o' }
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between px-4 py-2 bg-surface-card/50 rounded-lg border border-border-subtle group/key hover:border-brand-primary/20 transition-colors">
                    <code className="text-[8px] font-mono font-black text-brand-primary opacity-40 uppercase group-hover/key:opacity-100">{item.key}</code>
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary/40 shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        {/* Compliance & Export */}
        <section className="space-y-10">
          <div className="flex items-center gap-3 text-brand-primary mb-8 px-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Compliance & Resilience</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 bg-surface-card border border-border-subtle rounded-3xl flex items-center justify-between group">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
                  <Lock size={12} className={project.isLocked ? 'text-brand-primary' : 'text-text-secondary'} />
                  Write-Lock Protocol
                </span>
                <span className="text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-40">{project.isLocked ? 'Immutable State' : 'Operational/Mutable'}</span>
              </div>
              <button 
                onClick={() => updateProject({ isLocked: !project.isLocked })}
                className={`w-12 h-6 rounded-full transition-all relative ${project.isLocked ? 'bg-brand-primary' : 'bg-surface-muted'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all transform ${project.isLocked ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            <button 
              onClick={downloadBackup}
              className="p-8 bg-brand-dark border border-border-subtle rounded-3xl flex items-center justify-between group hover:border-brand-primary/50 transition-all text-left"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Neural Archive Export</span>
                <span className="text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-40">Download encrypted project JSON</span>
              </div>
              <Save size={20} className="text-brand-primary opacity-40 group-hover:opacity-100 transition-all" />
            </button>
          </div>
        </section>

        {/* Maturity Control */}
      <section className="space-y-10">
        <div className="flex items-center gap-3 text-brand-primary mb-8 px-2">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">Compliance & Narrative Depth</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MATURITY_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => updateProject({ maturity: level.value })}
              className={`p-10 rounded-[2.5rem] border text-left transition-all group relative overflow-hidden active:scale-[0.98] ${
                project.maturity === level.value 
                  ? 'bg-brand-primary border-brand-primary text-white shadow-2xl shadow-brand-primary/30' 
                  : 'bg-surface-card border-border-subtle text-text-primary hover:border-brand-primary/40 shadow-sm'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 shadow-inner transition-all duration-500 ${
                project.maturity === level.value ? 'bg-white/20' : 'bg-surface-muted text-text-secondary group-hover:bg-brand-primary/10 group-hover:text-brand-primary'
              }`}>
                {level.value === 'standard' && <Shield size={24} />}
                {level.value === 'mature' && <AlertCircle size={24} />}
                {level.value === 'transgressive' && <Flame size={24} className={`${project.maturity === level.value ? 'text-white' : 'text-brand-primary'}`} />}
              </div>
              <div className="font-black mb-2 uppercase tracking-[0.3em] text-[10px]">{level.label} Protocol</div>
              <p className={`text-[10px] font-medium leading-relaxed opacity-60 ${
                project.maturity === level.value ? 'text-white' : 'text-text-secondary'
              }`}>
                {level.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Danger Zone - Protected */}
      <section className="pt-20 border-t border-border-subtle">
        <div className={`rounded-[3.5rem] p-12 border transition-all duration-700 relative overflow-hidden group ${
          isConfirmingDelete ? 'bg-red-500/10 border-red-500/40 shadow-2xl' : 'bg-red-500/5 border-red-500/20'
        }`}>
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-10 transition-opacity duration-1000">
             <Trash2 size={160} className="text-red-500" />
          </div>
          <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
            <div className={`p-6 text-red-500 rounded-3xl shadow-inner border border-red-500/20 transition-transform duration-500 ${isConfirmingDelete ? 'rotate-12 scale-110' : ''}`}>
              <Flame size={32} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-3xl font-black text-text-primary italic font-serif tracking-tight mb-2">Destruct Sequence</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-8 font-medium italic opacity-60">
                Archive purging is absolute. All manuscript chapters, character ghosts, and logic nodes will be permanently neutralized.
              </p>
              
              <AnimatePresence mode="wait">
                {!isConfirmingDelete ? (
                  <motion.button 
                    key="trigger"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsConfirmingDelete(true)}
                    className="px-12 py-5 bg-red-500 hover:bg-red-600 text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl transition-all shadow-2xl shadow-red-500/20 active:scale-95"
                  >
                    Initiate Purge Sequence
                  </motion.button>
                ) : (
                  <motion.div 
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-6 max-w-sm mx-auto md:mx-0"
                  >
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/5 py-3 px-4 rounded-xl border border-red-500/20">
                        Type the project title to authorize: <span className="text-white bg-red-500 px-2 rounded ml-2">{project.title}</span>
                      </p>
                      <input 
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Project title..."
                        className="w-full bg-surface-card border border-red-500/30 rounded-xl px-6 py-4 text-text-primary focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all font-black uppercase tracking-widest text-xs"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={deleteProject}
                        disabled={deleteConfirmText !== project.title}
                        className={`flex-1 py-5 font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl transition-all shadow-2xl ${
                          deleteConfirmText === project.title 
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' 
                            : 'bg-surface-muted text-text-secondary cursor-not-allowed border border-border-subtle'
                        }`}
                      >
                        Execute
                      </button>
                      <button 
                        onClick={() => {
                          setIsConfirmingDelete(false);
                          setDeleteConfirmText('');
                        }}
                        className="px-8 py-5 bg-surface-muted text-text-secondary font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl border border-border-subtle hover:text-text-primary transition-colors"
                      >
                        Abort
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</div>
);
}
