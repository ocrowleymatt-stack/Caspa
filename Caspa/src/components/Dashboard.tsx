/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Users, 
  GitBranch, 
  PenTool, 
  Sparkles, 
  BookOpen, 
  Layers, 
  Save, 
  Trash2, 
  Target, 
  Activity, 
  Compass, 
  AlertTriangle,
  Lightbulb, 
  Eye, 
  ShieldAlert,
  ArrowRight,
  ClipboardList,
  Sparkle,
  BrainCircuit
} from 'lucide-react';
import { Project, ViewType, ProjectType, Chapter, Character, PlotNode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { PROJECT_TYPES, GENRES, TONES } from '../constants';

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
  chapters,
  characters,
  plotNodes,
  isMobile,
  updateProject, 
  setView, 
  deleteProject, 
  saveToCloud, 
  isSaving 
}: Props) {
  const [localTitle, setLocalTitle] = useState(project.title);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [auditComplete, setAuditComplete] = useState(false);

  useEffect(() => {
    setLocalTitle(project.title);
  }, [project.id]);

  // Debounced update for title
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localTitle !== project.title) {
        updateProject({ title: localTitle });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localTitle, project.title]);

  // Dynamic calculations for Project Health
  const calculateProjectHealth = () => {
    let score = 75; // base
    
    // Add parameters based on level of completion
    if (project.premise) score += 5;
    if (characters.length >= 3) score += 5;
    
    // Check characters have goals/fears
    const completeChars = characters.filter(c => c.goals?.length && c.fears?.length).length;
    if (characters.length > 0 && completeChars === characters.length) score += 5;
    
    // Active plot node beats
    if (plotNodes.length >= 5) score += 5;
    
    // Chapters drafted
    if (chapters.length > 0) score += 5;
    
    // Target word count alignment
    if (project.targetWordCount && project.stats?.totalWords) {
      const ratio = project.stats.totalWords / project.targetWordCount;
      if (ratio > 0.1 && ratio < 1.1) score += 5;
    }

    return Math.min(100, score);
  };

  const healthScore = calculateProjectHealth();

  // Run audit animation
  const runLatticeAudit = () => {
    setIsAuditing(true);
    setAuditComplete(false);
    setAuditProgress(0);
    
    const interval = setInterval(() => {
      setAuditProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsAuditing(false);
            setAuditComplete(true);
          }, 600);
          return 100;
        }
        return p + 10;
      });
    }, 150);
  };

  // Pre-configured intelligent suggestions
  const recommendations = [
    {
      id: 'antagonist',
      title: 'Define Antagonist Motivation',
      desc: 'The antagonist lacks an explicit fear or immediate desire in the Design matrix. Align motivation to intensify narrative tension.',
      type: 'motivation',
      severity: 'high',
      targetView: 'design' as ViewType,
      subTab: 'characters'
    },
    {
      id: 'conflict_france',
      title: 'Resolve Factual Contradiction',
      desc: 'Arthur describes his year living in Paris in Chapter 4, but details in Chapter 17 assert he has never visited France.',
      type: 'continuity',
      severity: 'critical',
      targetView: 'intelligence' as ViewType,
      subTab: 'continuity'
    },
    {
      id: 'revisit_mystery',
      title: 'Revisit Dormant Promise Ledger',
      desc: 'The "unopened brass letter casket" introduced in Chapter 2 has not been referenced since. Expectation risk elevated.',
      type: 'mystery',
      severity: 'medium',
      targetView: 'memory' as ViewType,
      subTab: 'promises'
    },
    {
      id: 'outline_next',
      title: `Plan Chapter ${chapters.length + 1} Outline`,
      desc: 'Formulate structural plot beats before initiating drafting. Respect the established Style DNA.',
      type: 'structure',
      severity: 'low',
      targetView: 'design' as ViewType,
      subTab: 'structure'
    }
  ];

  const forgottenItems = [
    {
      id: 'alpha_absence',
      title: 'Anna Absent for 11 Chapters',
      context: 'Last seen Chapter 3. Major motivation drift detected.',
      severity: 'danger'
    },
    {
      id: 'missing_seal',
      title: 'Great Seal Ring Unresolved',
      context: 'Promised artifact in Chapter 5. Risk of memory leakage.',
      severity: 'warning'
    },
    {
      id: 'secret_not_ref',
      title: 'Secret Will Untouched',
      context: 'Introduced in Chapter 1. Not referenced for 14,500 words.',
      severity: 'danger'
    },
    {
      id: 'logic_drift',
      title: 'Arthur\'s Core Motivation Drift',
      context: 'Fears regarding the forged dossier show narrative decay.',
      severity: 'warning'
    }
  ];

  const manuscriptStatus = () => {
    if (project.draftStage === 1) return 'Pass 1 : Skeletal Architecture';
    if (project.draftStage === 2) return 'Pass 2 : Staged Expansion';
    if (project.draftStage === 3) return 'Pass 3 : Immersive Draft';
    if (project.draftStage === 4) return 'Pass 4 : Final Master Polish';
    return 'Dynamic Assembly';
  };

  return (
    <div id="command-centre" className="h-full overflow-y-auto overscroll-contain custom-scrollbar select-none" style={{ minHeight: 0 }}>
      <div className="max-w-6xl mx-auto space-y-8 pb-20 pt-4 px-4 md:px-6">
        
        {/* Answer 1: Where am I? (Top Section) */}
        <section aria-labelledby="project-header" className="relative border-b border-border-subtle pb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#d4af37] bg-brand-dark/30 border border-brand-primary/20 px-2.5 py-1 rounded font-serif italic">
                Narrative Intelligence OS v2
              </span>
              <span className="text-[10px] uppercase tracking-widest text-text-secondary border border-border-subtle px-2 py-1 rounded">
                {manuscriptStatus()}
              </span>
            </div>
            
            <div className="relative max-w-xl group">
              <input 
                id="manuscript-title-input"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                aria-label="Manuscript Title"
                className="text-2xl md:text-3xl font-serif text-text-primary bg-transparent border-none focus:ring-0 p-0 w-full font-semibold focus:outline-none placeholder:text-text-secondary/25 selection:bg-brand-primary/20"
                placeholder="Define Narrative..."
              />
              <div className="absolute -bottom-1 left-0 w-12 h-[1px] bg-brand-primary/30 group-focus-within:w-full group-focus-within:bg-brand-primary transition-all duration-500" />
            </div>

            <p className="text-xs text-text-secondary font-serif italic max-w-lg">
              {project.premise ? `"${project.premise.slice(0, 160)}${project.premise.length > 160 ? '...' : ''}"` : "The canvas remains empty. Define the story premise under Discover to activate core intelligence modules."}
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Health Score Shield */}
            <div className="bg-surface-card border border-border-subtle p-3.5 rounded-lg flex items-center gap-3.5 min-w-[150px]">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path className="text-surface-muted" strokeWidth="2.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-brand-primary" strokeWidth="2.5" strokeDasharray={`${healthScore}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="text-[11px] font-mono font-semibold text-[#d4af37]">{healthScore}%</span>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-[#a3a3a3]">Project Health</div>
                <div className="text-[11px] font-serif font-semibold text-text-primary capitalize">
                  {healthScore >= 90 ? 'Pristine' : healthScore >= 75 ? 'Cohesive' : 'Decaying focus'}
                </div>
              </div>
            </div>

            {/* Word count block */}
            <div className="bg-surface-card border border-border-subtle p-3.5 rounded-lg min-w-[150px]">
              <div className="text-[11px] font-mono font-semibold text-text-primary">
                {(project.stats?.totalWords || 0).toLocaleString()} <span className="text-[10px] text-text-secondary/40">/</span> {(project.targetWordCount || 75000).toLocaleString()}
              </div>
              <div className="text-[9px] uppercase tracking-widest text-text-secondary mt-1">Word Count Scope</div>
              <div className="h-[2px] bg-surface-muted rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-[#d4af37]" 
                  style={{ width: `${Math.min(100, ((project.stats?.totalWords || 0) / (project.targetWordCount || 75000)) * 100)}%` }} 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Project Settings Quick Rail */}
        <section aria-label="Project parameters" className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-border-subtle/50 bg-surface-card/30 p-3.5 rounded-lg">
          <div className="flex items-center gap-2 px-2 py-1">
            <Layers className="text-[#d5af37] h-4 w-4 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase tracking-wider text-[#90939a]">Format Archetype</span>
              <span className="text-[11px] font-serif font-semibold text-text-primary uppercase tracking-wide">{project.type}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 border-t sm:border-t-0 sm:border-x border-border-subtle/40">
            <Compass className="text-[#d5af37] h-4 w-4 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase tracking-wider text-[#90939a]">Established Genre</span>
              <span className="text-[11px] font-serif font-semibold text-text-primary">{project.genre || "Not configured"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 py-1">
            <Sparkles className="text-[#d5af37] h-4 w-4 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase tracking-wider text-[#90939a]">Atmosphere / Tone</span>
              <span className="text-[11px] font-serif font-semibold text-text-primary capitalize">{project.tone || "Cinematic"}</span>
            </div>
          </div>
        </section>

        {/* Narrative Acceleration Engines */}
        <section aria-label="Narrative acceleration engines" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setView('autodraft')}
            className="text-left bg-surface-card border border-border-subtle/50 hover:border-brand-primary p-5 rounded-lg flex flex-col justify-between transition-all group duration-300 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <Sparkles size={48} className="text-brand-primary" />
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[#d4af37] group-hover:text-brand-primary transition-colors leading-relaxed">
                Auto Draft Engine
              </h3>
              <p className="text-[11px] text-[#90939a] font-serif leading-relaxed italic">
                Generate high-fidelity outline structures and assemble complete scene drafts automatically based on memory canon.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-brand-primary/60 group-hover:text-brand-primary pt-4 transition-colors font-mono font-semibold">
              <span>Initialize Drafter</span>
              <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => setView('architect')}
            className="text-left bg-surface-card border border-border-subtle/50 hover:border-brand-primary p-5 rounded-lg flex flex-col justify-between transition-all group duration-300 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <Activity size={48} className="text-brand-primary" />
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-[#d4af37]/10 text-[#d4af37] flex items-center justify-center">
                <Activity size={16} />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[#d4af37] group-hover:text-brand-primary transition-colors leading-relaxed">
                Fix a Bad Book
              </h3>
              <p className="text-[11px] text-[#90939a] font-serif leading-relaxed italic">
                Engage complete diagnostic scans on uploaded books, messy manuscript drafts, or raw outline archives to fix structural flaws.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-brand-primary/60 group-hover:text-brand-primary pt-4 transition-colors font-mono font-semibold">
              <span>Run Diagnostics</span>
              <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => setView('upload')}
            className="text-left bg-surface-card border border-border-subtle/50 hover:border-brand-primary p-5 rounded-lg flex flex-col justify-between transition-all group duration-300 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-10 transition-opacity">
              <BrainCircuit size={48} className="text-brand-primary" />
            </div>
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-[#2dd4bf]/10 text-[#2dd4bf] flex items-center justify-center">
                <BrainCircuit size={16} />
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[#d4af37] group-hover:text-brand-primary transition-colors leading-relaxed">
                Evidence Ingestion
              </h3>
              <p className="text-[11px] text-[#90939a] font-serif leading-relaxed italic">
                Injest background project briefs, historical archive materials, research dossiers, or PDF sources directly into memory.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-brand-primary/60 group-hover:text-brand-primary pt-4 transition-colors font-mono font-semibold">
              <span>Open Evidence Lab</span>
              <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </section>

        {/* Central Split Layout: Answer 2, 3, and 4 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Answer 4: WHAT SHOULD I DO NEXT? (Central Panel) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-[#d4af37]" id="recommended-actions-heading" size={18} />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[#d3af37]">
                  Next Recommended Actions
                </h2>
              </div>
              <span className="text-[9px] uppercase tracking-widest text-text-secondary/60">Actionable Plan</span>
            </div>

            <div className="space-y-4">
              {recommendations.map((action, idx) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  onClick={() => {
                    setView(action.targetView);
                    // Pass active sub-tab via state or storage if supported, but standard view switching is great!
                    localStorage.setItem(`ls_subtab_${action.targetView}`, action.subTab);
                  }}
                  className="w-full text-left bg-surface-card border border-border-subtle hover:border-[#d4af37]/40 p-4 rounded-lg flex gap-4 transition-all group duration-300 relative overflow-hidden"
                >
                  <div className="mt-0.5 shrink-0 flex items-center justify-center">
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${
                      action.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                      action.severity === 'high' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-brand-primary/10 text-brand-primary'
                    }`}>
                      {action.type === 'motivation' && <Users size={16} />}
                      {action.type === 'continuity' && <ShieldAlert size={16} />}
                      {action.type === 'mystery' && <Lightbulb size={16} />}
                      {action.type === 'structure' && <GitBranch size={16} />}
                    </div>
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold text-text-primary group-hover:text-[#d3af37] transition-colors leading-none pr-2">
                        {action.title}
                      </h3>
                      <span className={`text-[8px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded leading-none shrink-0 ${
                        action.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        action.severity === 'high' ? 'bg-[#d4af37]/20 text-[#e5be60]' :
                        'bg-surface-muted text-text-secondary'
                      }`}>
                        {action.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#90939a] leading-relaxed font-serif">
                      {action.desc}
                    </p>
                    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-brand-primary/60 group-hover:text-brand-primary pt-1.5 transition-colors font-mono font-semibold">
                      <span>Initiate resolution workflow</span>
                      <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Answer 3: WHAT HAVE I FORGOTTEN? (Right Panel) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <div className="flex items-center gap-2">
                <BrainCircuit className="text-[#d4af37]" id="forgotten-panel-heading" size={18} />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[#d3af37]">
                  What Have I Forgotten?
                </h2>
              </div>
              <span className="text-[9px] uppercase tracking-widest text-text-secondary/60">Narrative Decay</span>
            </div>

            <div className="bg-surface-card/60 border border-border-subtle p-5 rounded-lg space-y-5">
              <p className="text-[11px] text-text-secondary leading-relaxed font-serif">
                Unresolved threads, absent characters, and structural assumptions decay silently. Arthur's universe remains aligned only under active surveillance.
              </p>

              {/* Audit Button */}
              <button
                onClick={runLatticeAudit}
                disabled={isAuditing}
                className="w-full py-2.5 px-4 bg-surface-muted border border-border-subtle hover:border-[#d4af37]/40 rounded text-[10px] font-semibold text-text-primary tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAuditing ? (
                  <>
                    <Activity size={12} className="animate-pulse text-brand-primary" />
                    <span>Scanning Narrative Lattice ({auditProgress}%)</span>
                  </>
                ) : (
                  <>
                    <Sparkle size={12} className="text-[#d4af37]" />
                    <span>Audit Narrative Memories</span>
                  </>
                )}
              </button>

              <AnimatePresence mode="wait">
                {isAuditing && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden bg-[#131416] p-3 rounded border border-border-subtle/30"
                  >
                    <div className="text-[9px] font-mono text-brand-primary/80 uppercase tracking-widest">Compiler status:</div>
                    <div className="text-[10px] font-mono text-text-secondary mt-1 animate-pulse">
                      Analyzing chapter handshakes, character goals, unresolved mysteries...
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="divide-y divide-border-subtle/30 pt-2 space-y-3">
                {forgottenItems.map((item) => (
                  <div key={item.id} className="pt-3 flex gap-3 min-w-0">
                    <div className="mt-1 shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.severity === 'danger' ? 'bg-red-400 shadow-[0_0_8px_#f87171]' : 'bg-amber-400 shadow-[0_0_8px_#facc15]'}`} />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <h4 className="text-[11px] font-semibold text-text-primary truncate">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-[#90939a] leading-tight font-serif italic">
                        {item.context}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Answer 2: What Matters? (Brief overview of characters & secrets) */}
            <div className="bg-brand-dark/20 border border-brand-primary/10 p-5 rounded-lg space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Users size={60} />
              </div>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#d4af37] flex items-center gap-1.5">
                <Compass size={14} />
                Current Focus Vector
              </h3>
              <p className="text-[11px] text-[#90939a] font-serif leading-relaxed">
                You are currently tracking **{characters.length} characters** and **{plotNodes.length} active plot beads** across **{chapters.length} drafted chapters**. Keep characters lied to and ensure subtext carries the weight of the secrets.
              </p>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
