/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Zap, BrainCircuit, Lightbulb, Save, Globe, RefreshCcw, Target, Activity } from 'lucide-react';
import { Project, ResearchNote, SourceMaterial } from '../types';
import { AIService } from '../services/ai';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  project: Project;
  research: ResearchNote[];
  sourceMaterials: SourceMaterial[];
  updateProject: (updates: Partial<Project>) => void;
  onAddResearch: (note: ResearchNote) => Promise<void>;
  onError?: (msg: string) => void;
}

export default function Brainstorm({ project, research, sourceMaterials, updateProject, onAddResearch, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string | null>(null);
  const [localPremise, setLocalPremise] = useState(project.premise);
  const [improvementGoal, setImprovementGoal] = useState<string>('narrative momentum');

  const goals = [
    { label: 'Narrative Momentum', value: 'narrative momentum', icon: <Zap size={14} /> },
    { label: 'Character Depth', value: 'character depth', icon: <BrainCircuit size={14} /> },
    { label: 'World Building', value: 'world building', icon: <Globe size={14} /> },
    { label: 'Thematic Resonance', value: 'thematic resonance', icon: <Sparkles size={14} /> },
    { label: 'Pacing & Tone', value: 'pacing and tone', icon: <RefreshCcw size={14} /> }
  ];

  const updateProjectRef = useRef(updateProject);
  useEffect(() => {
    updateProjectRef.current = updateProject;
  }, [updateProject]);

  // Debounced update to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localPremise !== project.premise) {
        updateProjectRef.current({ premise: localPremise });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localPremise, project.premise]);

  const handleBrainstorm = async () => {
    if (!localPremise) return;
    setLoading(true);
    try {
      const data = await AIService.brainstorm(
        localPremise, 
        project.genre, 
        project.tone, 
        project.type, 
        research, 
        sourceMaterials,
        project.maturity, 
        project.externalReviews,
        improvementGoal
      );
      setResults(data);
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Simulation request failed.');
    } finally {
      setLoading(false);
    }
  };

  const addToResearch = (text: string) => {
    if (!text) return;
    const newNote: ResearchNote = {
      id: crypto.randomUUID(),
      title: `Analysis: ${localPremise.slice(0, 30)}...`,
      content: text,
      category: 'AI Brainstorm',
      tags: ['brainstorm', 'automated-expansion'],
      updatedAt: Date.now(),
      isDeepResearch: false
    };

    // Persist to project state
    onAddResearch(newNote);
    
    setResults(null); // Clear after persisting
  };

  return (
    <div 
      className="h-full overflow-y-auto custom-scrollbar px-2 pb-32"
      style={{ minHeight: 0 }}
    >
      <div className="max-w-7xl mx-auto py-3 md:py-1 md:px-2 flex flex-col gap-1.5">
      <header className="flex flex-col md:flex-row items-center justify-between gap-2 ethereal-panel p-3 rounded-md border border-border-subtle shadow-[0_50px_100px_rgba(0,0,0,0.4)] relative overflow-hidden group">
        <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-[0.02] transition-opacity duration-1000" />
        <div className="text-center md:text-left relative z-10">
          <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
             <div className="w-2.5 h-2.5 rounded-full bg-brand-primary shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-pulse" />
             <h2 className="text-xs font-semibold md:text-xs font-semibold font-semibold tracking-tight text-text-primary italic font-serif">Inspiration Engine</h2>
          </div>
          <p className="text-xs md:text-xs text-text-secondary font-semibold uppercase tracking-widest opacity-40">Expand narrative branches with distributed high-level intelligence</p>
        </div>
        <div className="relative z-10">
           <div className="p-4 bg-brand-dark/50 rounded border border-border-subtle flex items-center gap-2">
              <div className="w-10 h-10 rounded-md bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                 <BrainCircuit size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest opacity-40">Neural Status</span>
                <span className="text-xs font-semibold text-brand-primary uppercase tracking-widest">Systems Synchronized</span>
              </div>
           </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-1.5 pb-12">
        {/* Left: Input */}
        <div className="space-y-3 flex flex-col min-h-[400px]">
          <div className="p-3 bg-brand-dark border border-border-subtle rounded space-y-3 flex-1 flex flex-col shadow-[0_50px_100px_rgba(0,0,0,0.5)] group relative">
            <div className="absolute top-0 right-0 p-3 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000">
              <Target size={200} />
            </div>

            <div className="flex flex-col gap-1.5 relative z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-brand-primary flex items-center gap-1.5 uppercase tracking-widest font-sans">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                  Improvement Strategy
                </h3>
                <span className="text-[10px] font-semibold text-text-secondary opacity-30 uppercase tracking-widest">Select Narrative Vector</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {goals.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setImprovementGoal(g.value)}
                    className={`flex items-center gap-1.5 px-2 py-3 rounded text-xs font-semibold transition-all border uppercase tracking-widest active:scale-95 group/btn ${
                      improvementGoal === g.value 
                        ? 'bg-brand-primary border-brand-primary text-white shadow-2xl shadow-brand-primary/20' 
                        : 'ethereal-panel border-border-subtle text-text-secondary hover:border-text-secondary/40 hover:text-text-primary'
                    }`}
                  >
                    <span className={`${improvementGoal === g.value ? 'text-white' : 'text-brand-primary group-hover/btn:scale-110 transition-transform'}`}>
                      {g.icon}
                    </span>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-1.5 relative z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-brand-primary flex items-center gap-1.5 uppercase tracking-widest font-sans">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                  Context Analysis
                </h3>
                <p className="text-[10px] font-semibold text-text-secondary leading-relaxed uppercase tracking-wider opacity-40">
                  Input Narrative Spark
                </p>
              </div>
              <div className="flex-1 relative group/textarea">
                <textarea
                  value={localPremise}
                  onChange={(e) => setLocalPremise(e.target.value)}
                  placeholder="Describe the specific scene, character dilemma, or narrative block you want to expand..."
                  className="w-full h-full min-h-[300px] ethereal-panel border border-border-subtle rounded-md p-3 text-text-primary focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary focus:bg-surface-muted/30 resize-none transition-all outline-none leading-[1.8] text-xs font-semibold font-serif italic shadow-inner placeholder:opacity-20 scrollbar-hide"
                />
                <div className="absolute bottom-8 right-8 p-4 bg-brand-dark rounded border border-border-subtle opacity-0 group-hover/textarea:opacity-100 transition-opacity">
                   <BrainCircuit size={20} className="text-brand-primary/40" />
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleBrainstorm}
              disabled={loading || !project.premise}
              className="w-full py-3 bg-brand-primary hover:bg-brand-accent disabled:opacity-30 text-white font-semibold rounded-md transition-all shadow-2xl shadow-brand-primary/30 flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-95 group/submit relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/submit:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
              {loading ? (
                 <Activity size={20} className="animate-spin" />
              ) : (
                <>
                  <Zap size={20} className="fill-white group-hover/submit:animate-pulse" />
                  Request Simulation
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="p-3 ethereal-panel border border-border-subtle rounded overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.3)] flex flex-col relative group/results">
          <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover/results:opacity-[0.02] transition-opacity duration-1000" />
          
          <div className="flex items-center justify-between mb-10 relative z-10">
            <h3 className="text-xs font-semibold text-brand-primary flex items-center gap-2 uppercase tracking-widest font-sans">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
              Intelligence Output
            </h3>
            {results && (
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => addToResearch(results)}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-brand-primary hover:text-white hover:bg-brand-primary px-2.5 py-3 rounded border border-brand-primary/20 transition-all uppercase tracking-widest active:scale-95 shadow-xl bg-brand-primary/5"
              >
                <Save size={16} />
                Persist Expansion
              </motion.button>
            )}
          </div>
          
          <div className="flex-1 pr-6 relative z-10">
            {results ? (
              <div className="prose prose-invert prose-brand prose-md max-w-none prose-p:text-text-secondary/90 prose-p:leading-[1.8] prose-p:font-serif prose-p:italic prose-headings:text-text-primary prose-headings:font-semibold prose-headings:font-serif prose-headings:tracking-tight">
                <Markdown>{results}</Markdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-1.5 text-text-secondary">
                {!loading && (
                  <div className="flex flex-col items-center gap-1.5 opacity-10 group-hover/results:opacity-20 transition-opacity duration-1000">
                    <div className="relative">
                       <Zap size={100} strokeWidth={0.5} className="text-text-secondary" />
                       <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0, 1, 0] }}
                        transition={{ repeat: Infinity, duration: 4 }}
                        className="absolute inset-0 bg-brand-primary rounded-full blur-[80px]" 
                       />
                    </div>
                    <p className="max-w-[240px] text-xs font-semibold uppercase tracking-widest leading-relaxed mx-auto italic">Processor idle. Provide a narrative spark to begin simulation protocols.</p>
                  </div>
                )}
                {loading && (
                   <div className="flex flex-col items-center gap-2">
                     <div className="relative">
                        <motion.div 
                          animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.4, 0.1] }}
                          transition={{ repeat: Infinity, duration: 2.5 }}
                          className="absolute inset-0 bg-brand-primary rounded-full blur-3xl opacity-20" 
                        />
                        <div className="relative z-10 p-2 bg-brand-primary/10 rounded-md border border-brand-primary/30 shadow-inner">
                          <BrainCircuit size={64} className="text-brand-primary animate-pulse" />
                        </div>
                     </div>
                     <p className="text-brand-primary font-semibold text-xs uppercase tracking-[0.6em] animate-shimmer italic">Processing Intelligence Vector...</p>
                   </div>
                )}
              </div>
            )}
          </div>
          
          <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-surface-card to-transparent pointer-events-none z-20" />
        </div>
      </div>
      </div>
    </div>
  );
}
