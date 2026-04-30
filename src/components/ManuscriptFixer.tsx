import React, { useState } from 'react';
import { ShieldCheck, Zap, AlertCircle, CheckCircle2, ChevronRight, Play, Wand2, Hammer, Activity, FileUp } from 'lucide-react';
import { Project, Chapter, ProjectType } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  project: Project;
  chapters: Chapter[];
  updateChapters: (chaps: Chapter[]) => void;
  setView: (view: any) => void;
}

export default function ManuscriptFixer({ project, chapters, updateChapters, setView }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [autoPilot, setAutoPilot] = useState(false);
  const [isDeepDrafting, setIsDeepDrafting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    addLog(`Ingesting: ${file.name}...`);
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fullText = event.target?.result as string;
        addLog("Analyzing structural density and chapter boundaries...");
        
        try {
          const segments = await AIService.splitManuscript(fullText, project.type);
          addLog(`Identified ${segments.length} logical sequences.`);
          
          const newChapters: Chapter[] = segments.map((seg, i) => ({
            id: crypto.randomUUID(),
            title: seg.title,
            summary: seg.summary,
            content: seg.content,
            order: i,
            plotNodeIds: [],
            tags: ['bulk-imported'],
            updatedAt: Date.now()
          }));
          
          updateChapters(newChapters);
          addLog("Bulk Ingestion complete. Manuscript architecture updated.");
          setAnalysis(`## Import Success
Your manuscript has been analyzed and split into **${segments.length} logical chapters**. 

Each chapter has been initialized with its specific content and a structural summary to guide the AI. 

**Next Steps:**
1. Head to the **Writing Studio** to review the draft.
2. Use **Critic Swarm** to pressure-test the new sequences.
3. Use **Auto-Pilot** below to architect the missing conclusions.`);
        } catch (err) {
          console.error(err);
          addLog("Inversion failed: AI could not parse boundaries.");
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error(err);
      addLog("File read error.");
      setIsImporting(false);
    }
  };

  const runFinishAndFix = async () => {
    setIsFixing(true);
    addLog("Initializing Global Manuscript Scan...");
    try {
      const result = await AIService.finishAndFix(chapters, project.type, project.sourceMaterials || []);
      setAnalysis(result);
      addLog("Analysis complete. Found structural opportunities.");
    } catch (err) {
      console.error(err);
      addLog("Error during analysis. Check AI quota.");
    } finally {
      setIsFixing(false);
    }
  };

  const startAutoPilot = async () => {
    setAutoPilot(true);
    addLog("Engaging Auto-Pilot: Finalizing Narrative Path...");
    try {
      addLog("Calculating logical conclusion beats...");
      const beats = await AIService.automateNextSteps(project, chapters);
      
      addLog(`Architecting ${beats.length} new chapters...`);
      const newChapters: Chapter[] = [...chapters];
      
      for (const beat of beats) {
        const id = crypto.randomUUID();
        const newChap: Chapter = {
          id,
          title: beat.title,
          summary: beat.summary,
          content: '',
          order: newChapters.length,
          plotNodeIds: [],
          tags: ['automated-finalization'],
          updatedAt: Date.now()
        };
        newChapters.push(newChap);
        addLog(`Constructed: ${beat.title}`);
      }
      
      updateChapters(newChapters);
      addLog("Automation complete. Ready for drafting.");
    } catch (err) {
      console.error(err);
      addLog("Auto-Pilot sequence interrupted.");
    } finally {
      setAutoPilot(false);
    }
  };

  const runDeepDraft = async () => {
    setIsDeepDrafting(true);
    addLog("Initializing Deep Draft sequence...");
    try {
      const emptyChapters = chapters.filter(c => !c.content.trim());
      if (emptyChapters.length === 0) {
        addLog("No empty chapters found. Manuscript is fully drafted.");
        return;
      }

      addLog(`Found ${emptyChapters.length} sequences to draft. Starting synthesis...`);
      let updatedChaps = [...chapters];

      for (const chap of emptyChapters) {
        addLog(`Drafting: ${chap.title}...`);
        
        const earlierContent = updatedChaps
          .filter(c => c.order < chap.order)
          .map(c => c.content)
          .join('\n\n')
          .slice(-5000);

        const content = await AIService.writeDraft(
          chap.title,
          chap.summary,
          earlierContent,
          project.type,
          [],
          project.maturity,
          project.sourceMaterials || []
        );

        updatedChaps = updatedChaps.map(c => c.id === chap.id ? { ...c, content } : c);
        updateChapters(updatedChaps);
        addLog(`Successfully synthesized ${chap.title}.`);
      }
      addLog("Deep Draft series complete. The book is ready.");
    } catch (err) {
      console.error(err);
      addLog("Deep Draft interrupted by AI exhaustion.");
    } finally {
      setIsDeepDrafting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full mb-4">
          <ShieldCheck size={14} className="text-indigo-600" />
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Deep Architecture Engine</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight italic font-serif">Finish & Fix</h1>
        <p className="text-slate-500 max-w-2xl mx-auto font-medium">
          The Global Manuscript Engine analyzes your entire work for structural integrity, logical consistency, and thematic resolution.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Zap size={14} className="text-yellow-500" />
              Directives
            </h3>
            <div className="space-y-4">
              <button 
                onClick={runFinishAndFix}
                disabled={isFixing}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                  isFixing ? 'bg-slate-50 text-slate-400' : 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-black/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  < Hammer size={18} />
                  <span className="text-sm font-bold">Manuscript Scan</span>
                </div>
                {isFixing ? <Activity size={16} className="animate-spin" /> : <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />}
              </button>

              <button 
                onClick={startAutoPilot}
                disabled={autoPilot}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                  autoPilot ? 'bg-slate-50 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Play size={18} />
                  <span className="text-sm font-bold">Auto-Pilot Finish</span>
                </div>
                {autoPilot ? <Activity size={16} className="animate-spin" /> : <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />}
              </button>

              <button 
                onClick={runDeepDraft}
                disabled={isDeepDrafting}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                  isDeepDrafting ? 'bg-slate-50 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Activity size={18} />
                  <span className="text-sm font-bold">Deep Draft (Auto)</span>
                </div>
                {isDeepDrafting ? <Activity size={16} className="animate-spin" /> : <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />}
              </button>

              <div className="pt-4 border-t border-slate-50">
                <label 
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group cursor-pointer ${
                    isImporting ? 'bg-slate-50 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileUp size={18} />
                    <span className="text-sm font-bold">Bulk Import Manuscript</span>
                  </div>
                  {isImporting ? <Activity size={16} className="animate-spin" /> : <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                  <input type="file" className="hidden" onChange={handleBulkImport} accept=".txt,.md" disabled={isImporting} />
                </label>
                <p className="mt-2 text-[9px] text-slate-400 font-medium px-2 italic">
                  Upload a single file to intelligently split into chapters.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl shadow-xl">
             <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity size={14} className="text-emerald-500" />
              Architect Logs
            </h3>
            <div className="space-y-2 font-mono">
              {logs.map((log, i) => (
                <div key={i} className="text-[10px] text-emerald-400/80 last:text-emerald-400 animate-in fade-in slide-in-from-left-2 duration-300">
                  {log}
                </div>
              ))}
              {logs.length === 0 && <div className="text-[10px] text-slate-600 italic">Waiting for command...</div>}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {analysis ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm min-h-[600px]"
              >
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                  <h2 className="text-xl font-black text-slate-900">Reclamation Report</h2>
                  <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full">
                    <CheckCircle2 size={14} />
                    Ready
                  </div>
                </div>
                <div className="markdown-body prose prose-slate max-w-none">
                  <Markdown>{analysis}</Markdown>
                </div>
                {analysis?.includes('Import Success') && (
                  <button 
                    onClick={() => setView('writing')}
                    className="mt-8 w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 flex items-center justify-center gap-3 transition-all"
                  >
                    Enter Writing Studio
                    <ChevronRight size={18} />
                  </button>
                )}
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-6">
                  <Wand2 size={24} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2 tracking-tight">System Idle</h3>
                <p className="text-slate-400 text-sm max-w-xs font-medium">
                  Run a Manuscript Scan to identify structural issues or engage Auto-Pilot to architect the finale.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
