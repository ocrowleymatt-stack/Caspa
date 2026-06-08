import React, { useState, useEffect } from 'react';
import { Scissors, Trash2, Zap, AlertCircle, CheckCircle2, ChevronRight, Play, Wand2, Hammer, Activity, FileUp, Target, Plus, X, Flame, BookOpen, Layers, Split } from 'lucide-react';
import { Project, Chapter, ProjectType, ResearchNote } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  project: Project;
  chapters: Chapter[];
  updateProject: (updates: Partial<Project>) => void;
  updateChapters: (chaps: Chapter[]) => void;
  setView: (view: any) => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ScalpelModule({ project, chapters, updateProject, updateChapters, setView, onNotify }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'selection' | 'analysis' | 'surgery' | 'results'>('selection');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [seriesAnalysis, setSeriesAnalysis] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [refinedContent, setRefinedContent] = useState<Record<string, string>>({});

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-10), `> [${new Date().toLocaleTimeString()}] ${msg}`]);

  const runSeriesAnalysis = async () => {
    setIsProcessing(true);
    addLog("Initializing Series Decompression Engine...");
    try {
      const result = await AIService.scalpelSeriesAnalysis(project, chapters);
      setSeriesAnalysis(result);
      addLog("Analysis Complete: " + result.recommendation.slice(0, 50) + "...");
    } catch (err) {
      addLog("ERROR: Analysis failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const executeSurgery = async () => {
    setIsProcessing(true);
    setStep('surgery');
    addLog("ENGAGING THE SCALPEL. Stand back.");
    
    const chaptersToProcess = chapters.filter(c => selectedChapters.includes(c.id));
    const newRefined: Record<string, string> = {};

    try {
      for (const chap of chaptersToProcess) {
        addLog(`Surgically editing: ${chap.title}...`);
        const refined = await AIService.scalpelRefine(chapters, chap, project);
        newRefined[chap.id] = refined;
        addLog(`Excision complete for ${chap.title}.`);
      }
      setRefinedContent(newRefined);
      addLog("ALL SURGICAL OPERATIONS COMPLETE.");
      setStep('results');
    } catch (err) {
      addLog("CRITICAL FAILURE during excision.");
    } finally {
      setIsProcessing(false);
    }
  };

  const applyChanges = () => {
    const updated = chapters.map(c => refinedContent[c.id] ? { ...c, content: refinedContent[c.id], updatedAt: Date.now() } : c);
    updateChapters(updated);
    if (onNotify) onNotify("Manunscript successfully tightened and reconciled.", "success");
    setView('writing');
  };

  return (
    <div className="h-full flex flex-col min-h-0 text-white font-sans">
      {/* Background FX */}
      <div className="fixed inset-0 bg-black pointer-events-none -z-10" />
      <div className="fixed inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-red-900/5 pointer-events-none -z-10" />
      
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 md:p-12">
        <div className="max-w-5xl mx-auto space-y-12">
          
          {/* Header */}
          <header className="flex flex-col md:flex-row items-center gap-8 border-b border-red-500/20 pb-12">
            <div className="w-24 h-24 bg-red-600 rounded-[2rem] flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.3)] animate-pulse shrink-0">
              <Scissors className="text-white bg-red-600" size={48} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic leading-none mb-4">The Scalpel</h1>
              <p className="text-lg text-red-500/60 font-medium tracking-widest uppercase flex items-center gap-2 justify-center md:justify-start">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Elite Literary Surgery Module
              </p>
              <p className="mt-4 text-zinc-400 font-serif italic max-w-2xl leading-relaxed">
                "I am the English teacher from hell. I am the acquisitions editor with a deadline and no patience. If your prose is woolly, I will excise it. If your story is bloated, I will split it. I am the machine that turns drafts into literature."
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Left Col: Target & Controls */}
            <div className="lg:col-span-1 space-y-8">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Operation Parameters</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Chapters Detected</span>
                    <span className="text-xl font-black">{chapters.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Word Complexity</span>
                    <span className="text-sm font-bold text-red-400">{project.targetWordCount ? 'STUFFED' : 'STANDARD'}</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-800 space-y-4">
                  <button 
                    onClick={runSeriesAnalysis}
                    disabled={isProcessing}
                    className="w-full py-4 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/50 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    <Layers size={16} />
                    Series Scan
                  </button>
                  <button 
                    onClick={executeSurgery}
                    disabled={isProcessing || selectedChapters.length === 0}
                    className="w-full py-5 bg-red-600 hover:bg-red-500 text-white rounded-2xl flex items-center justify-center gap-3 text-sm font-black uppercase tracking-[0.2em] transition-all shadow-[0_10px_30px_rgba(220,38,38,0.2)] disabled:opacity-50"
                  >
                    {isProcessing ? <Activity className="animate-spin" size={20} /> : <Zap size={20} />}
                    Execute Excision
                  </button>
                </div>
              </div>

              {/* Console */}
              <div className="bg-black border border-zinc-800 rounded-3xl p-6 h-[300px] flex flex-col">
                <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2">
                  <Activity size={12} className="text-red-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Surgical Telemetry</span>
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 text-zinc-400 custom-scrollbar">
                  {logs.map((log, i) => <div key={i} className={log.includes('COMPLETE') ? 'text-green-400' : log.includes('ERROR') ? 'text-red-500' : ''}>{log}</div>)}
                  {isProcessing && <div className="text-red-500 animate-pulse">&gt; PROCESSING...</div>}
                </div>
              </div>
            </div>

            {/* Main Col: Analysis & Results */}
            <div className="lg:col-span-2 space-y-8">
              
              <AnimatePresence mode="wait">
                {step === 'selection' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8"
                  >
                    {seriesAnalysis?.volumes && Array.isArray(seriesAnalysis.volumes) && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-8 mb-8">
                        <div className="flex items-start gap-4">
                          <AlertCircle className="text-red-500 shrink-0 mt-1" />
                          <div>
                            <h3 className="text-xl font-black uppercase tracking-tight mb-2">Series Potential Identified</h3>
                            <p className="text-zinc-400 italic mb-6 leading-relaxed">{seriesAnalysis.recommendation}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {(seriesAnalysis.volumes || []).map((v: any, i: number) => (
                                <div key={i} className="bg-black/40 border border-red-500/20 p-6 rounded-2xl">
                                  <h4 className="text-red-400 font-black uppercase text-xs tracking-widest mb-2">Volume {i+1}</h4>
                                  <p className="font-bold text-white mb-2">{v.title}</p>
                                  <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-tight">{v.reasoning}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Select Chapters for Excision</h3>
                        <button 
                          onClick={() => setSelectedChapters(chapters.map(c => c.id))}
                          className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:opacity-70"
                        >
                          Select All
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {chapters.map(chap => (
                          <button 
                            key={chap.id}
                            onClick={() => setSelectedChapters(prev => prev.includes(chap.id) ? prev.filter(id => id !== chap.id) : [...prev, chap.id])}
                            className={`p-6 border rounded-3xl text-left transition-all group ${
                              selectedChapters.includes(chap.id) 
                                ? 'bg-red-600/10 border-red-500 shadow-[inset_0_0_20px_rgba(220,38,38,0.1)]' 
                                : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Chapter {chap.order + 1}</span>
                              {selectedChapters.includes(chap.id) && <CheckCircle2 size={16} className="text-red-500" />}
                            </div>
                            <h4 className="font-black text-lg text-white group-hover:text-red-400 transition-colors">{chap.title}</h4>
                            <p className="text-xs text-zinc-500 italic mt-2 line-clamp-1">{chap.summary}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 'results' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-8"
                  >
                    <div className="bg-green-500/10 border border-green-500/30 rounded-3xl p-8 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
                          <CheckCircle2 className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black uppercase tracking-tight">Surgical Success</h3>
                          <p className="text-green-500/60 text-xs font-bold uppercase tracking-widest">Biometric Narrative Integrity: 100%</p>
                        </div>
                      </div>
                      <button 
                        onClick={applyChanges}
                        className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-green-600/20 active:scale-95"
                      >
                        Commit to Archive
                      </button>
                    </div>

                    <div className="space-y-8">
                       {chapters.filter(c => refinedContent[c.id]).map(chap => (
                         <div key={chap.id} className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] overflow-hidden">
                           <div className="p-6 bg-black/40 border-b border-zinc-800 flex items-center justify-between">
                             <h4 className="font-black uppercase tracking-widest text-zinc-300 text-sm">{chap.title}</h4>
                             <span className="text-[10px] text-green-500 font-black uppercase tracking-[0.2em]">Refined & Reconciled</span>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-800">
                             <div className="bg-zinc-900/80 p-8 space-y-4">
                               <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Pre-Surgery Draft</p>
                               <p className="text-xs text-zinc-500 font-serif leading-none italic blur-[1px] opacity-40 select-none">
                                 {chap.content.slice(0, 1000)}...
                               </p>
                               <div className="text-xs text-zinc-500 italic mt-8 border-t border-zinc-800 pt-4">Original: {chap.content.split(/\s+/).length} words</div>
                             </div>
                             <div className="bg-black/60 p-8 space-y-4">
                               <p className="text-[10px] font-black uppercase tracking-widest text-green-500/80">Refined Manuscript</p>
                               <p className="text-sm text-zinc-200 font-serif leading-relaxed line-clamp-6">
                                 {refinedContent[chap.id]}
                               </p>
                               <div className="text-xs text-green-500 font-black italic mt-8 border-t border-zinc-800 pt-4 uppercase tracking-widest flex items-center gap-2">
                                 <Scissors size={12} />
                                 New: {refinedContent[chap.id].split(/\s+/).length} words
                               </div>
                             </div>
                           </div>
                         </div>
                       ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
