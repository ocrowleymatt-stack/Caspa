/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Activity, Play, Pause, SkipForward, CheckCircle2, AlertCircle, RefreshCw, Layers, Sparkles, Flame, Fingerprint, BookOpen, Clock } from 'lucide-react';
import { Project, Chapter, PlotNode, ResearchNote, ViewType } from '../types';
import { AIService } from '../services/ai';
import { getDraftPassWordTarget } from './DraftStagePanel';

interface Props {
  project: Project;
  chapters: Chapter[];
  plotNodes: PlotNode[];
  research: ResearchNote[];
  updateProject: (updates: Partial<Project>) => void;
  updateChapters: (chapters: Chapter[]) => void;
  setView: (view: ViewType) => void;
  onNotify?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onError?: (message: string) => void;
}

export default function AutoDrafter({ 
  project, 
  chapters, 
  plotNodes, 
  research, 
  updateProject, 
  updateChapters, 
  setView,
  onNotify,
  onError
}: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [log, setLog] = useState<{ msg: string; type: 'info' | 'success' | 'err' | 'ai' }[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const abortRef = useRef<boolean>(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Filter out chapters that are actually planning documents (isPlan)
  const draftChapters = chapters.filter(c => !c.isPlan).sort((a, b) => a.order - b.order);
  const currentPass = project.draftStage || 1;
  const targetWordsPerChapter = getDraftPassWordTarget(currentPass, project.targetWordCount || 80000, draftChapters.length);

  const addLog = (msg: string, type: 'info' | 'success' | 'err' | 'ai' = 'info') => {
    setLog(prev => [{ msg, type }, ...prev].slice(0, 50));
  };

  const handleBootstrap = async () => {
    setIsBootstrapping(true);
    addLog("Initializing Project Bootstrap...", 'info');
    try {
      addLog("Synthesizing Plot Architecture Nodes...", 'ai');
      const nodes = await AIService.outlinePlotNodes(project, chapters, research);
      if (!nodes || nodes.length === 0) throw new Error("Neural Engine failed to generate structure.");
      
      addLog(`Generated ${nodes.length} Narrative Beats. Reconciling with Chapters...`, 'success');
      const reconciled = await AIService.reconcileChapters(project, nodes, chapters);
      
      const newChapters: Chapter[] = reconciled.map((item, index) => ({
        id: crypto.randomUUID(),
        title: item.title,
        summary: item.summary,
        content: "",
        order: index,
        plotNodeIds: item.plotNodeIds,
        tags: ['auto-bootstrap'],
        updatedAt: Date.now()
      }));

      updateChapters(newChapters);
      addLog("Bootstrap Complete: Global Architecture Online.", 'success');
      onNotify?.("Structural nodes and chapters synthesized successfully.", 'success');
    } catch (err: any) {
      addLog(`Bootstrap Failure: ${err.message}`, 'err');
    } finally {
      setIsBootstrapping(false);
    }
  };

  const advancementCheck = () => {
    if (currentPass < 4) {
      updateProject({ draftStage: (currentPass + 1) as 1 | 2 | 3 | 4 });
      addLog(`Operational Directive: Advanced to Pass ${currentPass + 1}.`, 'success');
    }
  };

  const draftingSession = async () => {
    if (isRunning) {
      abortRef.current = true;
      setIsRunning(false);
      addLog("Operational pause initiated by user.", 'err');
      return;
    }

    if (draftChapters.length === 0) {
      addLog("No narrative segments identified. Initialize Architecture first.", 'err');
      return;
    }

    setIsRunning(true);
    abortRef.current = false;
    addLog(`Neural Auto-Draft Core engaged. Target: Pass ${currentPass}.`, 'ai');

    // Create a mutable copy of chapters to prevent stale closure overwrites in the loop
    let currentChapters = [...chapters];

    for (let i = currentIndex; i < draftChapters.length; i++) {
      if (abortRef.current) break;
      setCurrentIndex(i);
      
      // Use the updated currentChapters array to ensure we reference active content
      const chapter = currentChapters.find(c => c.id === draftChapters[i].id) || draftChapters[i];
      
      // Check if chapter already meets target for this pass
      const wordCount = chapter.content?.trim() ? chapter.content.trim().split(/\s+/).length : 0;
      if (wordCount >= targetWordsPerChapter * 0.9 && chapter.content?.length > 0) {
        addLog(`Segment ${i + 1} finalized: Target reached (${wordCount} words). Skipping.`, 'success');
        continue;
      }

      addLog(`Synthesizing Segment ${i + 1}: ${chapter.title}...`, 'info');
      
      try {
        let content = "";
        let currentWords = 0;
        let iterations = 0;
        const maxIterations = 8;

        while (iterations < maxIterations) {
          const iterationDirectives = [...(chapter.directives || [])];
          let isAppending = false;
          
          if (iterations > 0) {
            const diff = currentWords - targetWordsPerChapter;
            if (Math.abs(diff) / targetWordsPerChapter <= 0.02) {
              break;
            }
            
            addLog(`Adjusting (Iteration ${iterations + 1}): Got ${currentWords} words, Target ${targetWordsPerChapter}...`, 'info');
            
            // Give a small break between runs to avoid rate limits and let the system breathe
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (diff > 0) {
              iterationDirectives.push(`CRITICAL: The current draft is ${currentWords} words. It MUST BE exactly ${targetWordsPerChapter} words (you are over by ${diff} words). You must CUT and COMPRESS the scene to meet the exact word count. Do not lose the narrative thread. Ban all filler and cut aggressively.`);
              iterationDirectives.push(`PREVIOUS ATTEMPT TEXT FOR REVISION:\n${content}`);
            } else {
              if (Math.abs(diff) > 300) {
                isAppending = true;
                iterationDirectives.push(`CRITICAL CONTINUATION REQUIRED: You are short by ${Math.abs(diff)} words. DO NOT REWRITE THE PREVIOUS SCENE. You MUST CONTINUE the narrative from where the previous text left off. Expand the plot organically, introduce new sub-conflicts, explore the character's internal wound, and propel the story forward. DO NOT just pad with words. ONLY output the continuation, DO NOT output the previous text.`);
              } else {
                iterationDirectives.push(`CRITICAL: The current draft is ${currentWords} words. It MUST BE exactly ${targetWordsPerChapter} words (you are short by ${Math.abs(diff)} words). Do NOT pad with useless adjectives, purple prose, or looped internal monologue. Instead, EXPAND STRUCTURALLY: deepen the subtext, escalate the tension, reveal the character's hidden wound, or add a necessary complication. Keep prose lean, precise, and sharp.`);
                iterationDirectives.push(`PREVIOUS ATTEMPT TEXT FOR REVISION:\n${content}`);
              }
            }
          }

          const earlierContent = currentChapters
            .filter(c => !c.isPlan)
            .sort((a, b) => a.order - b.order)
            .slice(Math.max(0, i - 3), i)
            .map(c => c.content)
            .join('\n\n')
            .slice(-15000);

          const activeNodes = plotNodes.filter(n => chapter.plotNodeIds?.includes(n.id));

          const generated = await AIService.writeDraft(
            chapter.title,
            chapter.summary + (isAppending ? `\n\nCONTINUING FROM PREVIOUS TEXT: Pick up exactly where the last paragraph left off.` : ""),
            isAppending ? (earlierContent + "\n\n" + content) : earlierContent,
            project.type,
            activeNodes,
            research || [],
            project.maturity,
            project.sourceMaterials || [],
            iterationDirectives,
            project.targetWordCount,
            project.externalReviews || [],
            currentPass as 1 | 2 | 3 | 4,
            draftChapters.length,
            project.cutMode
          );
          
          if (isAppending) {
            content = content + "\n\n" + generated;
          } else {
            content = generated;
          }
          
          currentWords = content.split(/\s+/).filter(w => w.length > 0).length;
          iterations++;
          
          if (Math.abs(currentWords - targetWordsPerChapter) / targetWordsPerChapter <= 0.02) {
            addLog(`Segment ${i + 1} Target achieved: ${currentWords} words (within 2% margin).`, 'success');
            break;
          } else if (iterations === maxIterations) {
            addLog(`Segment ${i + 1} Max iterations reached. Final words: ${currentWords} (Target: ${targetWordsPerChapter})`, 'err');
          }
        }

        const updatedChapters = currentChapters.map(c => 
          c.id === chapter.id ? { ...c, content: (c.content ? c.content + '\n\n' : '') + content.trim(), updatedAt: Date.now() } : c
        );
        currentChapters = updatedChapters; // Update local tracker
        updateChapters(updatedChapters);   // Update remote/database state
        addLog(`Sychronized Segment ${i + 1}. Growth: +${content.split(/\s+/).length} words.`, 'success');
        
        // Brief delay between requests to prevent rate limiting & allow UI rendering
        await new Promise(r => setTimeout(r, 1500));
        
      } catch (err: any) {
        addLog(`Critical Failure in Segment ${i + 1}: ${err.message || 'Connection lost'}.`, 'err');
        setIsRunning(false);
        return;
      }
    }

    if (!abortRef.current) {
      addLog("Neural Cycle 100% Optimized. Manuscript ready for review.", 'success');
      setIsRunning(false);
      setCurrentIndex(0);
    }
  };

  const overallProgress = draftChapters.length > 0 ? (currentIndex / draftChapters.length) * 100 : 0;

  return (
    <div className="h-full flex flex-col min-h-0 bg-brand-dark/20">
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-8 custom-scrollbar">
        <div className="py-12 pb-40 max-w-6xl mx-auto gap-8 flex flex-col w-full">
          <header className="flex flex-col md:flex-row items-center justify-between gap-8 ethereal-panel p-10 md:p-12 rounded-[3rem] border border-border-subtle shadow-4xl relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-brand-primary opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000 pointer-events-none" />
            <div className="flex flex-col gap-4 relative z-20">
              <div className="flex items-center gap-5">
                 <div className={`w-4 h-4 rounded-full ${isRunning ? 'bg-brand-primary animate-pulse shadow-[0_0_20px_rgba(168,85,247,1)]' : 'bg-surface-muted'}`} />
                 <h2 className="text-4xl font-black italic font-serif text-text-primary tracking-tighter">Neural Auto-Draft</h2>
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-text-secondary opacity-40">Recursive sequence engine & high-fidelity drafting</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 relative z-20">
              {draftChapters.length === 0 ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleBootstrap(); }}
                  disabled={isBootstrapping}
                  className="px-12 py-6 bg-brand-dark border border-brand-primary/40 text-brand-primary rounded-[1.8rem] font-black text-[11px] uppercase tracking-widest transition-all shadow-2xl flex items-center gap-5 active:scale-95 hover:bg-brand-primary/10 hover:border-brand-primary disabled:opacity-40"
                >
                  {isBootstrapping ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
                  Launch Initial Bootstrap
                </button>
              ) : (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); advancementCheck(); }}
                    disabled={isRunning}
                    className="px-8 py-6 bg-brand-dark border border-border-subtle text-text-secondary rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.2em] transition-all hover:text-text-primary active:scale-95 disabled:opacity-20 flex items-center gap-3 flex-col justify-center leading-tight"
                  >
                    <span>Pass 0{currentPass}</span>
                    <span className="text-[9px] text-brand-primary opacity-80 mt-1">Target: {targetWordsPerChapter.toLocaleString()} W/C</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); draftingSession(); }}
                    className={`px-12 py-6 rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center gap-5 active:scale-95 ${
                      isRunning 
                        ? 'bg-red-600 text-white shadow-red-600/20' 
                        : 'btn-nexus-primary shadow-brand-primary/30 hover:bg-brand-accent'
                    }`}
                  >
                    {isRunning ? <Pause size={22} /> : <Play size={22} className="fill-current" />}
                    {isRunning ? 'Pause Core' : 'Start Recursive Draft'}
                  </button>
                </>
              )}
            </div>
          </header>

          {targetWordsPerChapter > 4000 && draftChapters.length > 0 && !isRunning && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-red-900/20 border border-red-500/30 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex gap-4 items-center">
                <AlertCircle className="text-red-400 shrink-0" size={24} />
                <div className="text-sm">
                  <p className="font-bold text-red-200">High Word Count Strain Detected</p>
                  <p className="text-red-300 pr-4">
                    Your target is <strong>{targetWordsPerChapter.toLocaleString()} words per chapter</strong>. The AI will struggle to generate high-quality prose in blocks this large without excessive stretching or losing plot focus. We strongly recommend going to the <strong>Plot Architect</strong> to add more chapters and break up your story.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 flex-1 min-h-0">
            {/* Progress Array */}
            <div className="lg:col-span-12 space-y-8">
              <div className="h-5 bg-surface-muted rounded-full overflow-hidden border border-border-subtle p-1 shadow-inner">
                <motion.div 
                   className="h-full bg-brand-primary rounded-full shadow-[0_0_30px_rgba(168,85,247,0.8)]"
                   initial={{ width: 0 }}
                   animate={{ width: `${overallProgress}%` }}
                   transition={{ type: "spring", damping: 25, stiffness: 120 }}
                />
              </div>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-4">
                <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] flex items-center gap-4">
                  <Layers size={16} />
                  Operational Cycle: Pass {currentPass} Synthesis
                </span>
                <span className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] italic font-serif opacity-60">
                   Segment {currentIndex + 1} of {draftChapters.length} Architecture Nodes
                </span>
              </div>
            </div>

            {/* Neural Stream Log */}
            <div className="lg:col-span-8 flex flex-col bg-brand-dark border border-border-subtle rounded-[3rem] overflow-hidden shadow-3xl min-h-[500px]">
              <div className="p-10 border-b border-border-subtle flex items-center justify-between ethereal-panel/80 backdrop-blur-md">
                 <div className="flex items-center gap-5">
                    <Activity size={20} className="text-brand-primary" />
                    <span className="text-[11px] font-black uppercase tracking-[0.4em] text-text-primary">System Telemetry Stream</span>
                 </div>
                 <div className="flex items-center gap-4">
                   <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
                 </div>
              </div>
              <div className="flex-1 p-10 overflow-y-auto custom-scrollbar font-mono text-[12px] leading-relaxed space-y-4 bg-black/20">
                 <AnimatePresence initial={false}>
                   {log.map((entry, i) => (
                     <motion.div 
                       key={`${i}-${entry.msg.slice(0, 15)}`}
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className={`flex gap-5 p-4 rounded-2xl border transition-all hover:bg-white/[0.02] ${
                         entry.type === 'ai' ? 'bg-brand-primary/5 border-brand-primary/30 text-brand-primary shadow-[0_0_15px_rgba(168,85,247,0.1)]' :
                         entry.type === 'success' ? 'bg-green-500/5 border-green-500/30 text-green-400' :
                         entry.type === 'err' ? 'bg-red-500/5 border-red-500/30 text-red-500' :
                         'bg-white/5 border-border-subtle text-text-secondary opacity-80'
                       }`}
                     >
                       <span className="opacity-20 shrink-0 select-none">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                       <span className="flex-1 font-medium">{entry.msg}</span>
                     </motion.div>
                   ))}
                   {log.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center opacity-10 gap-6 grayscale">
                        <RefreshCw size={48} className="animate-spin-slow" />
                        <p className="uppercase tracking-[0.4em] text-[10px] font-black">Waiting for Recurse Initialization</p>
                     </div>
                   )}
                   <div ref={logEndRef} className="h-4" />
                 </AnimatePresence>
              </div>
            </div>

            {/* Config & Analysis */}
            <div className="lg:col-span-4 flex flex-col gap-8">
               <div className="ethereal-panel border border-border-subtle rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                    <Fingerprint size={120} />
                  </div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-brand-primary mb-8 flex items-center gap-4">
                    <Sparkles size={18} />
                    Neural Weights
                  </h3>
                  <div className="space-y-5 relative z-10">
                     <div className="flex items-center justify-between p-5 bg-brand-dark rounded-2xl border border-border-subtle group hover:border-brand-primary/40 transition-colors">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary opacity-40">Operational Stage</span>
                          <span className="text-sm font-black text-text-primary tracking-tight">Pass 0{currentPass}</span>
                        </div>
                        <Layers size={22} className="text-brand-primary/20 group-hover:text-brand-primary/40 transition-colors" />
                     </div>
                     <div className="flex items-center justify-between p-5 bg-brand-dark rounded-2xl border border-border-subtle group hover:border-brand-primary/40 transition-colors">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary opacity-40">Target Expansion</span>
                          <span className="text-sm font-black text-text-primary tracking-tight">~{targetWordsPerChapter.toLocaleString()} wds</span>
                        </div>
                        <Fingerprint size={22} className="text-brand-primary/20 group-hover:text-brand-primary/40 transition-colors" />
                     </div>
                     <div className="flex items-center justify-between p-5 bg-brand-dark rounded-2xl border border-border-subtle group hover:border-brand-primary/40 transition-colors">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary opacity-40">Active Provider</span>
                          <span className="text-sm font-black text-text-primary italic font-serif tracking-tight">{project.primaryProvider || 'Standard'}</span>
                        </div>
                        <Flame size={22} className="text-brand-primary/20 group-hover:text-brand-primary/40 transition-colors" />
                     </div>
                  </div>
                  <button 
                    onClick={() => setView('settings')}
                    className="w-full mt-8 py-5 bg-surface-muted hover:ethereal-panel border border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-text-primary transition-all flex items-center justify-center gap-4 active:scale-95 group/cal"
                  >
                    <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700" />
                    Calibration Center
                  </button>
               </div>

               <div className="bg-brand-dark border border-border-subtle rounded-[2.5rem] p-10 shadow-2xl flex-1 flex flex-col relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 p-8 opacity-[0.02] pointer-events-none">
                    <BookOpen size={140} />
                  </div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-text-secondary mb-8 flex items-center gap-4">
                    <BookOpen size={18} />
                    Active Node Context
                  </h3>
                  {draftChapters[currentIndex] ? (
                    <div className="flex-1 flex flex-col gap-6 relative z-10">
                      <div className="p-6 ethereal-panel rounded-2xl border border-border-subtle shadow-inner">
                        <p className="text-[9px] font-black uppercase tracking-widest text-brand-primary mb-3 flex items-center gap-2">
                           <Activity size={10} />
                           Neural Synthesis Goal
                        </p>
                        <p className="text-sm font-black text-text-primary italic font-serif leading-relaxed line-clamp-6 opacity-90">
                          {draftChapters[currentIndex].summary || "No architectural summary provided. Neural engine will extrapolate narrative intent based on global structure."}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-text-secondary/40 px-2 mt-auto">
                         <Clock size={16} />
                         <span className="text-[10px] font-black uppercase tracking-widest tracking-[0.2em]">Expected Latency: 45s-90s</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-10 gap-6 grayscale">
                      <Fingerprint size={64} strokeWidth={0.5} />
                      <p className="uppercase tracking-[0.3em] text-[10px] font-black">Architectural Void</p>
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
