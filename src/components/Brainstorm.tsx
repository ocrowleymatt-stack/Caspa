/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Zap, BrainCircuit, Lightbulb, Save } from 'lucide-react';
import { Project } from '../types';
import { AIService } from '../services/ai';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  project: Project;
  updateProject: (updates: Partial<Project>) => void;
  onError?: (msg: string) => void;
}

export default function Brainstorm({ project, updateProject, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string | null>(null);
  const [localPremise, setLocalPremise] = useState(project.premise);

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
      const data = await AIService.brainstorm(localPremise, project.genre, project.tone, project.type, project.maturity);
      setResults(data);
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Simulation request failed.');
    } finally {
      setLoading(false);
    }
  };

  const addToResearch = (text: string) => {
    // In progress: will link to ResearchLibrary
  };

  return (
    <div className="h-full flex flex-col gap-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Inspiration Engine</h2>
        <p className="text-slate-500 font-medium italic text-sm">Expand narrative branches with distributed intelligence.</p>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Left: Input */}
        <div className="space-y-6 flex flex-col min-h-[400px]">
          <div className="p-8 bg-white border border-slate-200 rounded-xl space-y-4 flex-1 flex flex-col shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                <BrainCircuit size={16} className="text-blue-600" />
                Scenario Input
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Describe a character dilemma, a setting, or an inciting incident.
            </p>
            <textarea
              value={localPremise}
              onChange={(e) => setLocalPremise(e.target.value)}
              placeholder="The starship's core begins to hum with an ancient, biological rhythm..."
              className="flex-1 w-full min-h-[250px] bg-slate-50 border border-slate-200 rounded-lg p-6 text-slate-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white resize-none transition-all outline-none leading-relaxed text-lg"
            />
            <button 
              onClick={handleBrainstorm}
              disabled={loading || !project.premise}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Zap size={18} className="fill-white" />
                  Request Simulation
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="p-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col relative">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              <Lightbulb size={16} className="text-amber-500" />
              Analytical Output
            </h3>
            {results && (
              <button 
                onClick={() => addToResearch(results)}
                className="flex items-center gap-2 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-widest"
              >
                <Save size={14} />
                Persist Expansion
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
            {results ? (
              <div className="prose prose-slate prose-sm max-w-none prose-p:text-slate-600 prose-p:leading-relaxed prose-headings:text-slate-900 prose-headings:font-bold">
                <Markdown>{results}</Markdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-slate-300">
                {!loading && (
                  <>
                    <Zap size={48} strokeWidth={1} className="text-slate-100" />
                    <p className="max-w-[180px] text-xs font-medium italic text-slate-400">Processor idle. Provide a narrative spark to begin.</p>
                  </>
                )}
                {loading && (
                   <motion.div 
                    animate={{ scale: [1, 1.02, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="flex flex-col items-center gap-4"
                   >
                     <div className="w-10 h-10 rounded-lg border-2 border-blue-100 border-t-blue-600 animate-spin" />
                     <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest">Processing Intelligence...</p>
                   </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
