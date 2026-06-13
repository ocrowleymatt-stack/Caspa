import React, { useState } from 'react';
import { Project, Chapter, Character, ViewType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BarChart2, Activity, ShieldCheck, RefreshCw, Wand2, ArrowLeft, Lightbulb } from 'lucide-react';
import { AIService } from '../services/ai';

interface IntelligenceViewProps {
  project: Project;
  chapters: Chapter[];
  characters: Character[];
  sourceMaterials: any[];
  updateProject: (p: Partial<Project>) => Promise<void>;
  updateChapters: (chaps: Chapter[]) => Promise<void>;
  setView: (v: ViewType) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onError: (msg: string) => void;
}

export default function IntelligenceView({
  project,
  chapters,
  characters,
  sourceMaterials,
  updateProject,
  updateChapters,
  setView,
  onNotify,
  onError
}: IntelligenceViewProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<string>('');

  const runMacroAnalysis = async () => {
    setIsAnalyzing(true);
    setReport('');
    onNotify?.('Calibrating neural scanners...', 'info');
    try {
      const prompt = `CRITICAL NARRATIVE ANALYSIS:
      Analyze the current metadata and chapters for "${project.title}".
      
      WORLD DESIGN CONFIG:
      - Genre: "${project.genre}"
      - Tone: "${project.tone}"
      - Maturity Target: "${project.maturity}"
      
      CURRENT CHAPTER ARCHITECTURE:
      ${chapters.map(c => `- ${c.title}: ${c.summary}`).join('\n')}

      Perform an elite structural assessment. Judge of:
      1. PROSE INTENSITY & RHYTHM METERS.
      2. DIALOGUE TENSION BALANCES.
      3. CRUDE SPATIAL OR HOLE GAPS.
      4. STYLE DNA COMPLIANCE.

      Write a gorgeous, formal editorial report with sections:
      - 📊 STATISTICAL VELOCITY
      - ♟️ STRUCTURAL TENSION assessment
      - 🔬 SENSORY GRAIN assessment
      - 💡 RECOMMENDATIONS`;

      const response = await AIService.callAI({
        prompt,
        model: 'gemini-2.0-flash'
      });

      if (response) {
        setReport(response);
        onNotify?.('Macro-analysis report generated.', 'success');
      } else {
        throw new Error('Analysis returned empty report');
      }
    } catch (e: any) {
      console.error(e);
      onNotify?.('Scanners congested or credentials missing.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div id="intelligence-view-container" className="flex-1 flex flex-col min-h-0 bg-neutral-900 border border-neutral-800/80 rounded-xl overflow-hidden text-neutral-100 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full space-y-6">
        {/* Header Toolbar */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <button 
              id="back-to-writing"
              onClick={() => setView('writing')}
              className="p-2 hover:bg-neutral-900 rounded-full text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-mono tracking-tight font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                INTELLIGENCE LAB <span className="text-xs px-2 py-0.5 bg-amber-950/50 border border-amber-900/50 text-amber-400 font-normal rounded font-mono">DYNAMIC DIAGNOSTICS</span>
              </h1>
              <p className="text-xs text-neutral-400 mt-1">Audit draft prose segments against style DNA target metrics and literary principles.</p>
            </div>
          </div>

          <button
            id="trigger-analysis-btn"
            onClick={runMacroAnalysis}
            disabled={isAnalyzing || chapters.length === 0}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded font-mono text-xs uppercase tracking-widest font-semibold transition-all shadow-md shadow-amber-950/40 flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                PERFORMING SCAN...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                RUN SCANNERS
              </>
            )}
          </button>
        </div>

        {/* Style DNA Metrics Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-neutral-950/60 border border-neutral-850 rounded-xl space-y-2">
            <span className="text-[10px] font-mono uppercase text-neutral-400">PROSE GRAIN METERS</span>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-neutral-300 font-mono">
                <span>INTENSITY</span>
                <span>{project.styleDNA?.proseIntensity || 50}%</span>
              </div>
              <div className="w-full bg-neutral-800 h-1 rounded overflow-hidden">
                <div className="bg-amber-500 h-full" style={{ width: `${project.styleDNA?.proseIntensity || 50}%` }} />
              </div>
            </div>
          </div>

          <div className="p-4 bg-neutral-950/60 border border-neutral-850 rounded-xl space-y-2">
            <span className="text-[10px] font-mono uppercase text-neutral-400">DIALOGUE TENSION</span>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-neutral-300 font-mono">
                <span>WEIGHT</span>
                <span>{project.styleDNA?.dialogueWeight || 50}%</span>
              </div>
              <div className="w-full bg-neutral-800 h-1 rounded overflow-hidden">
                <div className="bg-amber-500 h-full" style={{ width: `${project.styleDNA?.dialogueWeight || 50}%` }} />
              </div>
            </div>
          </div>

          <div className="p-4 bg-neutral-950/60 border border-neutral-850 rounded-xl space-y-2">
            <span className="text-[10px] font-mono uppercase text-neutral-400">VOCABULARY DEPTH</span>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-mono text-neutral-300 uppercase">{project.styleDNA?.vocabularyLevel || 'elevated'}</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Report Output */}
        <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-6 min-h-[350px] flex flex-col justify-start">
          {report ? (
            <div className="prose prose-invert max-w-none text-xs font-mono leading-relaxed text-neutral-300 whitespace-pre-wrap">
              {report}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-600">
              <BarChart2 className="w-10 h-10 text-neutral-800 mb-2" />
              <span className="text-xs font-mono uppercase tracking-widest">Awaiting Scanner Input</span>
              <p className="text-[10px] text-neutral-650 max-w-xs mt-1 font-mono">
                Tap 'RUN SCANNERS' to compile deep analytics reports and stylistic critique passes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
