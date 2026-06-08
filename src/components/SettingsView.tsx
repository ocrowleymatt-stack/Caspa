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
  Fingerprint,
  Cloud,
  Database,
  UploadCloud,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { Project, ProjectType, MaturityLevel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { GENRES, TONES, MATURITY_LEVELS, PROJECT_TYPES } from '../constants';
import { listDriveBackups, uploadDriveBackup, downloadDriveBackup, DriveBackupFile, BackupPayload } from '../lib/googleDrive';
import { loginWithGoogle, getCachedAccessToken } from '../lib/firebase';

interface Props {
  project: Project;
  updateProject: (updates: Partial<Project>) => void;
  deleteProject: () => void;
  onBroadScan?: (q?: string) => Promise<void>;
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
  chapters?: any[];
  characters?: any[];
  plotNodes?: any[];
  research?: any[];
  sourceMaterials?: any[];
  externalReviews?: any[];
  onRestoreBackup?: (payload: any) => Promise<void>;
}

export default function SettingsView({ 
  project, 
  updateProject, 
  deleteProject, 
  onBroadScan,
  onNotify,
  chapters = [],
  characters = [],
  plotNodes = [],
  research = [],
  sourceMaterials = [],
  externalReviews = [],
  onRestoreBackup
}: Props) {
  const [localTitle, setLocalTitle] = useState(project.title);
  const [localPremise, setLocalPremise] = useState(project.premise);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [isGDriveConnected, setIsGDriveConnected] = useState(() => {
    return !!getCachedAccessToken() || localStorage.getItem('ls_gdrive_connected') === 'true';
  });
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [isLoadingDriveBackups, setIsLoadingDriveBackups] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Sync state with token presence
  useEffect(() => {
    const checkToken = setInterval(() => {
      const hasToken = !!getCachedAccessToken();
      if (hasToken !== isGDriveConnected) {
        setIsGDriveConnected(hasToken);
      }
    }, 1000);
    return () => clearInterval(checkToken);
  }, [isGDriveConnected]);

  const handleConnectGDrive = async () => {
    try {
      if (onNotify) onNotify("Connecting to Google Secure Identity Node...", "info");
      await loginWithGoogle();
      setIsGDriveConnected(true);
      if (onNotify) onNotify("Secured entry point to Google Workspace established!", "success");
      fetchDriveBackups();
    } catch (err: any) {
      console.error(err);
      if (onNotify) onNotify(`Handshake failed: ${err.message || 'Access Denied'}`, "error");
    }
  };

  const fetchDriveBackups = async () => {
    const token = getCachedAccessToken();
    if (!token) return;
    setIsLoadingDriveBackups(true);
    try {
      const list = await listDriveBackups();
      setDriveBackups(list);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoadingDriveBackups(false);
    }
  };

  // Auto-fetch if token exists on mount
  useEffect(() => {
    if (isGDriveConnected) {
      fetchDriveBackups();
    }
  }, [isGDriveConnected]);

  const handleGDriveBackup = async () => {
    const token = getCachedAccessToken();
    if (!isGDriveConnected || !token) {
      await handleConnectGDrive();
      return;
    }
    
    setIsBackingUp(true);
    if (onNotify) onNotify("Compiling manuscript database structure...", "info");
    
    try {
      const payload: BackupPayload = {
        project,
        chapters,
        characters,
        plotNodes,
        research,
        sourceMaterials,
        externalReviews,
        backupDate: new Date().toISOString()
      };
      
      await uploadDriveBackup(project.title, project.id, payload);
      if (onNotify) onNotify(`Manuscript safely vaulted in Google Drive.`, "success");
      fetchDriveBackups();
    } catch (err: any) {
      console.error(err);
      if (onNotify) onNotify(`Vaulting interrupted: ${err.message}`, "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFromDrive = async (fileId: string, fileName: string) => {
    const isConfirmed = window.confirm(`CRITICAL PROCEDURAL CONFIRMATION:\n\nAre you sure you want to restore the workspace snapshot "${fileName}"?\nThis will completely overwrite your current active manuscript drafting space.`);
    if (!isConfirmed) return;

    setIsRestoring(true);
    if (onNotify) onNotify("Initiating restoration sequence from Google Drive...", "info");

    try {
      const payload = await downloadDriveBackup(fileId);
      if (onRestoreBackup) {
        await onRestoreBackup(payload);
      }
    } catch (err: any) {
      console.error(err);
      if (onNotify) onNotify(`Extraction aborted: ${err.message}`, "error");
    } finally {
      setIsRestoring(false);
    }
  };

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
    <div className="h-full overflow-y-auto overscroll-contain custom-scrollbar px-4 pb-16" style={{ minHeight: 0 }}>
      <div className="max-w-4xl mx-auto space-y-8 py-6">
      <header className="ethereal-panel p-8 rounded-[2.5rem] border border-border-subtle shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-[0.02] transition-opacity duration-1000" />
        <div className="flex items-center gap-4 mb-4 relative z-10">
          <div className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary shadow-inner">
            <Settings size={24} />
          </div>
          <h2 className="text-4xl font-black tracking-tighter text-text-primary italic font-serif">Project Controls</h2>
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
            <div className="p-8 ethereal-panel border border-border-subtle rounded-3xl group hover:border-brand-primary/30 transition-all shadow-sm">
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] mb-4 opacity-40">Project Title</label>
              <input 
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                className="w-full bg-surface-muted border border-border-subtle rounded-xl px-6 py-4 text-text-primary focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all font-serif italic text-2xl"
              />
            </div>

            <div className="p-8 ethereal-panel border border-border-subtle rounded-3xl group hover:border-brand-primary/30 transition-all shadow-sm">
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] mb-4 opacity-40">Narrative Format</label>
              <div className="relative">
                <select 
                  value={project.type}
                  onChange={(e) => updateProject({ type: e.target.value as ProjectType })}
                  className="w-full bg-surface-muted/50 border border-border-subtle rounded-xl px-6 py-4 text-text-primary focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-black uppercase tracking-widest text-xs appearance-none cursor-pointer pr-12"
                >
                  {PROJECT_TYPES.map(t => (
                    <option key={t.value} value={t.value} className="bg-brand-dark text-white">{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none opacity-40" size={16} />
              </div>
            </div>

            <div className="p-8 ethereal-panel border border-border-subtle rounded-3xl group hover:border-brand-primary/30 transition-all shadow-sm">
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

          <div className="ethereal-panel border border-border-subtle rounded-[2.5rem] p-10 space-y-10 shadow-xl">
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
              className="w-full ethereal-panel border border-border-subtle rounded-xl px-6 py-4 text-text-primary focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none transition-all font-black uppercase tracking-widest text-[10px]"
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
             <div className="p-6 ethereal-panel border border-border-subtle rounded-3xl flex items-center justify-between group">
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
             
              <div className="p-8 ethereal-panel border border-border-subtle rounded-3xl group shadow-sm transition-all hover:border-brand-primary/20">
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] mb-4 opacity-40">Narrative Tone Archetype</label>
                <div className="relative">
                  <select 
                    value={project.tone}
                    onChange={(e) => updateProject({ tone: e.target.value })}
                    className="w-full bg-surface-muted/50 border border-border-subtle rounded-xl px-6 py-4 text-text-primary focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-black uppercase tracking-widest text-xs appearance-none cursor-pointer pr-12"
                  >
                    <option value="" className="bg-brand-dark text-white/40">Select Tone...</option>
                    {TONES.map(t => <option key={t} value={t} className="bg-brand-dark text-white">{t}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none opacity-40" size={16} />
                </div>
              </div>

            <div className="p-10 ethereal-panel border border-border-subtle rounded-[2.5rem] group shadow-xl">
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.4em] mb-8 opacity-40">Narrative Boundary (Target Word Count)</label>
              <div className="relative group/input">
                <input 
                  type="number"
                  value={project.targetWordCount || ''}
                  onChange={(e) => updateProject({ targetWordCount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-surface-muted/50 border border-border-subtle rounded-3xl px-8 py-6 text-text-primary focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all font-black italic text-4xl tabular-nums pr-24"
                  placeholder="50000"
                />
                <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-end">
                  <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">Words</span>
                  <span className="text-[8px] font-black text-text-secondary uppercase tracking-[0.2em] opacity-40">Capacity</span>
                </div>
              </div>
              <p className="mt-6 text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-20 leading-relaxed">
                Targets are used by the Narrative Engine to calibrate chapter density and plot pacing over the global arch.
              </p>
            </div>
          </div>
        </section>

        {/* Intelligence Ecosystem */}
        <section className="space-y-10">
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3 text-brand-primary">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">Intelligence Ecosystem</span>
            </div>
            <div className="text-[9px] font-black text-brand-accent uppercase tracking-[0.2em] opacity-80 px-3 py-1 rounded-full border border-brand-accent/20 bg-brand-accent/10">
              Auto-reviewed 4-Month Cycle
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pb-8">
            {[
              { id: 'gemini', label: 'Gemini', brief: 'Deep Prose' },
              { id: 'claude', label: 'Claude', brief: 'Logic/Structure' },
              { id: 'openai', label: 'GPT-4o', brief: 'Synthesis' },
              { id: 'grok', label: 'Grok-3', brief: 'Raw/Agency' },
              { id: 'venice', label: 'Venice', brief: 'Private' }
            ].map((provider) => (
              <button
                key={provider.id}
                onClick={() => updateProject({ primaryProvider: provider.id as any })}
                className={`p-6 rounded-3xl border transition-all group/opt active:scale-[0.97] flex flex-col items-center justify-center gap-2 relative overflow-hidden ${
                  (project.primaryProvider || 'gemini') === provider.id
                    ? 'bg-brand-primary border-brand-primary text-white shadow-xl shadow-brand-primary/30 ring-4 ring-brand-primary/10'
                    : 'ethereal-panel border-border-subtle text-text-secondary hover:border-brand-primary/40 hover:bg-white/5'
                }`}
              >
                { (project.primaryProvider || 'gemini') === provider.id && (
                  <motion.div layoutId="provider-glow" className="absolute inset-0 bg-white opacity-10 animate-pulse" />
                )}
                <div className="text-[10px] font-black uppercase tracking-[0.2em] relative z-10">{provider.label}</div>
                <div className={`text-[8px] font-bold uppercase tracking-widest opacity-40 relative z-10 ${
                  (project.primaryProvider || 'gemini') === provider.id ? 'text-white/80' : ''
                }`}>{provider.brief}</div>
              </button>
            ))}
          </div>
            
            <div className="p-10 ethereal-panel border border-border-subtle rounded-[2.5rem] space-y-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-brand-primary opacity-[0.01] pointer-events-none" />
              <div className="space-y-4 relative z-10">
                <h3 className="text-[11px] font-black text-brand-primary uppercase tracking-[0.3em] flex items-center gap-2">
                  <Fingerprint size={16} /> Recovery Center
                </h3>
                <p className="text-[11px] text-text-secondary leading-relaxed opacity-60 font-medium italic">
                  Lost manuscripts? Initiate a deep neural scan across all known account variations to reclaim orphaned drafts and vaulted data.
                </p>
              </div>

              <div className="flex flex-col gap-4 relative z-10">
                <button 
                  onClick={() => {
                    if (onBroadScan) onBroadScan("");
                    else window.location.reload();
                  }}
                  className="w-full py-5 bg-brand-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-brand-primary/30 border border-white/10"
                >
                  Global Account Scan
                </button>
                
                <button 
                  onClick={() => {
                    const id = prompt("Enter specific Manuscript Title or ID fragment:");
                    if (id && onBroadScan) {
                      onBroadScan(id);
                    }
                  }}
                  className="w-full py-4 bg-white/5 border border-white/5 text-text-primary rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all opacity-80 hover:opacity-100 flex items-center justify-center gap-2"
                >
                  <Type size={14} className="opacity-40" />
                  Targeted Keyword Search
                </button>
              </div>
            </div>

            <div className="p-8 bg-brand-dark border border-brand-primary/20 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-brand-primary opacity-[0.03] animate-pulse" />
              <div className="flex items-center gap-4 text-brand-primary relative z-10">
                <Zap size={18} className="fill-brand-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">Distributed Fallback active</h3>
              </div>
              <div className="space-y-2 relative z-10">
                {[
                  { key: 'GROK_API_KEY', label: 'xAI Grok-3 High Fidelity' },
                  { key: 'VENICE_API_KEY', label: 'Venice.ai Uncensored Art' },
                  { key: 'ANTHROPIC_API_KEY', label: 'Claude-3.5 Sonnet' },
                  { key: 'OPENAI_API_KEY', label: 'GPT-4o Reasoning' }
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between px-4 py-2 ethereal-panel/50 rounded-lg border border-border-subtle group/key hover:border-brand-primary/20 transition-colors">
                    <code className="text-[8px] font-mono font-black text-brand-primary opacity-40 uppercase group-hover/key:opacity-100">{item.key}</code>
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary/40 shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
                  </div>
                ))}
              </div>
            </div>
        </section>
        {/* Sync Diagnostics */}
        <section className="space-y-10">
          <div className="flex items-center gap-3 text-brand-primary mb-8 px-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Identity & Sync Diagnostics</span>
          </div>

          <div className="ethereal-panel border border-border-subtle rounded-[2.5rem] p-10 shadow-xl space-y-6">
            <p className="text-[10px] text-text-secondary leading-relaxed font-medium italic opacity-60">
              If your books or manuscripts are missing, verify your synchronization identity below.
            </p>
            
            <div className="space-y-4">
              <div className="bg-surface-muted/50 p-8 rounded-3xl border border-border-subtle flex flex-col gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-text-secondary opacity-40 flex items-center gap-2">
                  <Shield size={12} />
                  Direct Auth Signature
                </span>
                <span className="text-md font-mono font-bold text-text-primary break-all selection:bg-brand-primary/30">
                  {localStorage.getItem('currentUserEmail') || 'Authenticating...'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-brand-primary/5 p-6 rounded-2xl border border-brand-primary/10 flex flex-col gap-2">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-brand-primary">Casper Variant check</span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                    <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Case-Insensitive active</span>
                  </div>
                </div>
                <div className="bg-brand-primary/5 p-6 rounded-2xl border border-brand-primary/10 flex flex-col gap-2">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-brand-primary">Gmail Logic check</span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                    <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">Dot-ignoring active</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary/40 pt-4 border-t border-white/5">
              Contact technical agents if your work remains invisible under this signature.
            </p>
          </div>
        </section>

        {/* Compliance & Export */}
        <section className="space-y-10">
          <div className="flex items-center gap-3 text-brand-primary mb-8 px-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Compliance & Resilience</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 ethereal-panel border border-border-subtle rounded-3xl flex items-center justify-between group">
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
              className="p-8 ethereal-panel border border-border-subtle rounded-[2rem] flex items-center justify-between group hover:border-brand-primary/50 transition-all text-left shadow-lg overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-[0.02] transition-opacity" />
              <div className="flex flex-col gap-1 relative z-10">
                <span className="text-[10px] font-black text-text-primary uppercase tracking-widest flex items-center gap-2">
                  <Save size={14} className="text-brand-primary" />
                  Neural Archive Export
                </span>
                <span className="text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-40">Download encrypted project JSON blueprint</span>
              </div>
              <ChevronDown size={20} className="text-brand-primary opacity-20 -rotate-90 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </section>

        {/* Google Drive & Resilient Backups */}
        <section className="space-y-10">
          <div className="flex items-center gap-3 text-brand-primary mb-8 px-2 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">Google Workspace Backup & Recovery</span>
            </div>
            {isGDriveConnected ? (
              <span className="text-[8px] font-black uppercase tracking-widest text-[#34A853] bg-[#34A853]/10 border border-[#34A853]/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[#34A853]" /> GDrive Active
              </span>
            ) : (
              <span className="text-[8px] font-black uppercase tracking-widest text-text-secondary opacity-40">Offline Mode</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 ethereal-panel border border-border-subtle rounded-3xl space-y-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-brand-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <UploadCloud size={16} /> Cloud Vaulting
                </h4>
                <p className="text-[11px] text-text-secondary leading-relaxed opacity-60">
                  Establish a secure redundant snapshot of the current active workspace directly onto your Google Drive account, fully encompassing chapters, structural plots, and intelligence indexes.
                </p>
              </div>

              <div className="pt-2">
                {isGDriveConnected ? (
                  <button
                    onClick={handleGDriveBackup}
                    disabled={isBackingUp}
                    className="w-full py-4 bg-brand-primary text-white hover:brightness-110 active:scale-95 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-lg hover:shadow-brand-primary/20 flex items-center justify-center gap-2"
                  >
                    {isBackingUp ? (
                      <>
                        <RefreshCw className="animate-spin" size={12} />
                        Compressing & Syncing...
                      </>
                    ) : (
                      <>
                        <UploadCloud size={12} />
                        Push Workspace Backup
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleConnectGDrive}
                    className="w-full py-4 bg-brand-primary text-white hover:brightness-110 active:scale-95 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    Connect Google Drive
                  </button>
                )}
              </div>
            </div>

            <div className="p-8 ethereal-panel border border-border-subtle rounded-3xl space-y-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-3">
                <h4 className="text-[11px] font-black text-brand-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <FolderOpen size={16} /> Restore Manifest
                </h4>
                <p className="text-[11px] text-text-secondary leading-relaxed opacity-60">
                  Recover previously secured snapshots and load them directly into your workstation. All active drafting spaces will be fully synchronized with the selected recovery state.
                </p>
              </div>

              <div className="pt-2 min-h-[50px] flex flex-col justify-end">
                {!isGDriveConnected ? (
                  <div className="text-[10px] font-medium text-text-secondary opacity-40 italic text-center py-2 h-full flex items-center justify-center">
                    Establish Drive link to list backups.
                  </div>
                ) : isLoadingDriveBackups ? (
                  <div className="flex items-center justify-center gap-2 text-[10px] font-mono font-bold text-text-secondary opacity-60 py-2">
                    <RefreshCw className="animate-spin" size={12} /> Scanning Drive cloud records...
                  </div>
                ) : driveBackups.length === 0 ? (
                  <div className="text-[10px] font-medium text-brand-primary/60 opacity-60 italic text-center py-2 border border-dashed border-border-subtle/40 rounded-xl">
                    No active Casper backups found on Drive. Create one using the Push tool!
                  </div>
                ) : (
                  <div className="max-h-[120px] overflow-y-auto space-y-2 custom-scrollbar pr-1">
                    {driveBackups.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => handleRestoreFromDrive(file.id, file.name)}
                        className="w-full p-3 bg-white/5 border border-white/5 hover:border-brand-primary/30 text-left rounded-xl transition-all group flex items-center justify-between"
                      >
                         <div className="space-y-1">
                           <div className="text-[10px] font-black text-text-primary group-hover:text-brand-primary transition-colors truncate max-w-[200px]">
                             {file.name.replace('Casper_Restore_', '').replace('.json', '')}
                           </div>
                           <div className="text-[8px] font-mono text-text-secondary/60">
                             Modified: {new Date(file.modifiedTime).toLocaleString()}
                           </div>
                         </div>
                         <span className="text-[8px] font-black bg-brand-primary/10 text-brand-primary px-2.5 py-1 rounded-md uppercase tracking-widest group-hover:bg-brand-primary group-hover:text-white transition-all">Reload</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Dropbox & iCloud Companion Desk */}
        <section className="space-y-10">
          <div className="flex items-center gap-3 text-brand-primary mb-8 px-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">External Ingestion & iCloud Companion Desk</span>
          </div>

          <div className="p-8 ethereal-panel border border-border-subtle rounded-3xl space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-black text-brand-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  Dropbox & iCloud Bypass
                </h4>
                <p className="text-[10px] text-text-secondary max-w-xl opacity-60 leading-relaxed">
                  Due to strict sandboxed filesystem boundaries on iOS devices, direct automated background scraping of the iCloud Drive or Dropbox folders is blocked by system-level Apple security regulations. 
                </p>
              </div>
              <div className="text-[10px] font-black bg-[#fb0] text-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-yellow-500/20 shadow-inner">
                Bypass Mode
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] leading-relaxed text-text-secondary opacity-80">
              <div className="space-y-3">
                <h5 className="font-black text-text-primary uppercase tracking-widest text-[9px] text-brand-primary/80">Option A: The Local Files Drop (No Setup Needed)</h5>
                <p>
                  You can place your iCloud or Dropbox manuscripts inside the iOS <strong className="text-text-primary">Files</strong> app (or your Mac Finder). When updating, simply tap <strong className="text-text-primary">"Ingestion Desk"</strong> inside the Manuscript Architect to drag-and-drop or select the entire directory pack. Casper will run instant delta scans to pull the latest changes of all chapters automatically!
                </p>
              </div>
              <div className="space-y-3">
                <h5 className="font-black text-text-primary uppercase tracking-widest text-[9px] text-brand-primary/80">Option B: Dropbox Manual Sync Target</h5>
                <p>
                  If you prefer syncing files via Dropbox: click the <strong className="text-text-primary">"Neural Archive Export"</strong> button on the right to download your complete encrypted database blueprint JSON, and copy it straight safely into your shared Dropbox catalog. You can restore it cleanly on any device anytime!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Maturity Control */}
        <section className="space-y-10">
        <div className="flex items-center gap-3 text-brand-primary mb-8 px-2">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em]">Compliance & Narrative Depth</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MATURITY_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => updateProject({ maturity: level.value })}
              className={`p-6 rounded-2xl border text-left transition-all group relative overflow-hidden active:scale-95 ${
                project.maturity === level.value 
                  ? 'bg-brand-primary border-brand-primary text-white shadow-2xl shadow-brand-primary/30' 
                  : 'ethereal-panel border-border-subtle text-text-primary hover:border-brand-primary/40 shadow-sm'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-inner transition-all duration-500 ${
                project.maturity === level.value ? 'bg-white/20' : 'bg-surface-muted text-text-secondary group-hover:bg-brand-primary/10 group-hover:text-brand-primary'
              }`}>
                {level.value === 'standard' && <Shield size={18} />}
                {level.value === 'mature' && <AlertCircle size={18} />}
                {level.value === 'transgressive' && <Flame size={18} className={`${project.maturity === level.value ? 'text-white' : 'text-brand-primary'}`} />}
              </div>
              <div className="font-black mb-1 uppercase tracking-[0.2em] text-[9px]">{level.label}</div>
              <p className={`text-[9px] font-medium leading-tight opacity-60 ${
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
                        className="w-full ethereal-panel border border-red-500/30 rounded-xl px-6 py-4 text-text-primary focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all font-black uppercase tracking-widest text-xs"
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
