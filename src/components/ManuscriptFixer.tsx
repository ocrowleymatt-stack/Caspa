import React, { useState } from 'react';
import { ShieldCheck, Zap, AlertCircle, CheckCircle2, ChevronRight, Play, Wand2, Hammer, Activity, FileUp, Target } from 'lucide-react';
import { Project, Chapter, ProjectType } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  project: Project;
  chapters: Chapter[];
  updateChapters: (chaps: Chapter[]) => void;
  setView: (view: any) => void;
  onError?: (msg: string) => void;
}

export default function ManuscriptFixer({ project, chapters, updateChapters, setView, onError }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [autoPilot, setAutoPilot] = useState(false);
  const [isDeepDrafting, setIsDeepDrafting] = useState(false);
  const [isSlowCooking, setIsSlowCooking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  const runSlowCooker = async () => {
    setIsSlowCooking(true);
    addLog("System: Initializing SLOW COOKER [Economy Auto-Draft Mode]...");
    try {
      let updatedChaps = [...chapters];
      const emptyChapters = chapters.filter(c => !c.content.trim());
      
      if (emptyChapters.length === 0) {
        addLog("Status: No empty chapters found. The structure is fully drafted.");
        return;
      }

      addLog(`Analysis: Found ${emptyChapters.length} unwritten chapters. 'Simmering' to completion...`);

      for (const chap of emptyChapters) {
        addLog(`Simmering: Chapter ${chap.order + 1} - "${chap.title}"...`);
        
        // ECONOMY CONTEXT: Use only the last 1500 characters of the preceding chapters.
        const earlierContent = updatedChaps
          .filter(c => c.order < chap.order)
          .map(c => c.content)
          .join('\n\n')
          .slice(-1500);

        // ECONOMY: Omit source materials to save token cost
        const content = await AIService.writeDraft(
          chap.title,
          chap.summary,
          earlierContent,
          project.type,
          [],
          project.maturity,
          [] 
        );

        updatedChaps = updatedChaps.map(c => c.id === chap.id ? { ...c, content, updatedAt: Date.now() } : c);
        await updateChapters(updatedChaps);
        addLog(`Success: Synthesized Chapter ${chap.order + 1} (Economy Mode).`);
      }
      
      addLog("System: Slow Cooker sequence complete. Structure filled.");
    } catch (err: any) {
      console.error(err);
      const msg = `Slow Cooker sequence interrupted. ${err.message || ""}`;
      addLog(`Error: ${msg}`);
      onError?.(msg);
    } finally {
      setIsSlowCooking(false);
    }
  };

  const handleManualImport = async () => {
    if (!pasteContent.trim()) return;
    const mockFile = new File([pasteContent], "manual_paste.txt", { type: "text/plain" });
    processFile(mockFile);
    setShowManualPaste(false);
  };

  const processFile = async (file: File, bypassAI = false) => {
    if (!file) return;
    setIsImporting(true);
    setAnalysis(null);
    setLogs([]); 
    addLog(`System IO: Initializing stream for ${file.name}...`);
    addLog(`File Profile: ${(file.size / 1024).toFixed(1)} KB | Type: ${file.type || 'plain/text'}`);
    if (bypassAI) addLog("Bypass Active: Sequential fragmentation engaged.");
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const fullText = (event.target?.result as string) || "";
          if (!fullText.trim()) {
            addLog("IO Error: Manuscript content is null or empty.");
            setIsImporting(false);
            return;
          }

          addLog(`IO Success: ${fullText.length.toLocaleString()} characters buffered.`);
          addLog("Phase 1: Detecting narrative architecture...");
          
          let finalSegments: { title: string; summary: string; marker: string }[] = [];
          
          if (!bypassAI) {
            try {
              addLog("AI Core: Sourcing structural markers (Neural)...");
              const segments = await AIService.splitManuscript(fullText, project.type);
              if (segments && segments.length > 0) {
                finalSegments = segments;
                addLog(`AI Core Success: Found ${segments.length} logical boundaries.`);
              } else {
                addLog("AI Core responded with empty structure payload.");
              }
            } catch (err: any) {
              console.error("AI Split Error:", err);
              const msg = err.message || "Handshake failure";
              addLog(`AI Core Blocked: ${msg}.`);
              onError?.(`Neural Analysis Error: ${msg}`);
            }
          }
            
          if (finalSegments.length === 0) {
            addLog(bypassAI ? "Direct fragmentation engaged." : "Engaging fallback: Detecting boundary patterns (Regex)...");
            const chapterRegex = /(?:Chapter|CHAPTER|SECTION|Section|Part|PART)\s+([0-9A-Z]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)|(?:\n\n|^)(?:\* \* \*|# |### |---)(?:\n\n|$)/g;
            const matches = bypassAI ? [] : [...fullText.matchAll(chapterRegex)];
            
            if (matches.length >= 2) {
              addLog(`Pattern Match Success: Detected ${matches.length} boundaries.`);
              finalSegments = matches.map((m, i) => {
                const title = m[1] ? `Chapter ${m[1]}` : `Section ${i + 1}`;
                const markerSnippet = fullText.slice(m.index, m.index + 120);
                return {
                  title,
                  summary: "Imported via pattern matching.",
                  marker: markerSnippet
                };
              });
            } else {
              if (!bypassAI) addLog("Deterministic patterns absent. Executing density-based fragmentation...");
              const chunks = fullText.split(/\n\n\n+/);
              if (chunks.length > 2 && !bypassAI) {
                addLog(`Density Success: Fragmenting into ${chunks.length} blocks.`);
                finalSegments = chunks.map((c, i) => ({
                  title: `Sequence ${i + 1}`,
                  summary: "Imported via density-based chunking.",
                  marker: c.slice(0, 100)
                }));
              } else {
                addLog(`Info: Applying sequential blocks (10k char segments)...`);
                const pageSize = 10000;
                for (let i = 0; i < fullText.length; i += pageSize) {
                  finalSegments.push({
                    title: `Draft Fragment ${Math.floor(i / pageSize) + 1}`,
                    summary: "Forced split for monolithic text.",
                    marker: fullText.slice(i, i + 80)
                  });
                }
              }
            }
          }

          addLog(`Architecture: ${finalSegments.length} nodes ready for reconstruction.`);
            
          const generateId = () => {
             try { return crypto.randomUUID(); } 
             catch (e) { return Math.random().toString(36).substring(2) + Date.now().toString(36); }
          };

          const newChapters: Chapter[] = finalSegments.map((seg, i) => {
            const nextSeg = finalSegments[i + 1];
            let content = "";
            const normalize = (str: string) => (str || "").replace(/\s+/g, ' ').trim();
            const normalizedFullText = normalize(fullText);
            const normalizedMarker = normalize(seg.marker);
            const normalizedStartIndex = normalizedFullText.indexOf(normalizedMarker);
            
            if (normalizedStartIndex !== -1) {
              const escapedMarker = (seg.marker || "")
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\s+/g, '\\s+');
              
              const markerRegex = new RegExp(escapedMarker, 'g');
              const match = markerRegex.exec(fullText);
              
              if (match) {
                const startIndex = match.index;
                let endIndex = fullText.length;
                
                if (nextSeg) {
                   const nextEscapedMarker = (nextSeg.marker || "")
                    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\s+/g, '\\s+');
                  const nextRegex = new RegExp(nextEscapedMarker, 'g');
                  nextRegex.lastIndex = startIndex + match[0].length;
                  const nextMatch = nextRegex.exec(fullText);
                  if (nextMatch) {
                    endIndex = nextMatch.index;
                  } else {
                    const lowerFullText = fullText.toLowerCase();
                    const lowerMarker = (nextSeg.marker || "").toLowerCase().slice(0, 30);
                    if (lowerMarker) {
                      const fuzzyNext = lowerFullText.indexOf(lowerMarker, startIndex + match[0].length);
                      if (fuzzyNext !== -1) endIndex = fuzzyNext;
                    }
                  }
                }
                content = fullText.slice(startIndex, endIndex).trim();
              } else {
                const simpleStart = fullText.indexOf(seg.marker);
                if (simpleStart !== -1) {
                   let nextIndex = fullText.length;
                   if (nextSeg) {
                     const nextSimple = fullText.indexOf(nextSeg.marker, simpleStart + 1);
                     if (nextSimple !== -1) nextIndex = nextSimple;
                   }
                   content = fullText.slice(simpleStart, nextIndex).trim();
                } else {
                  content = `[INGESTION WARNING: CONTENT CONTINUITY AT RISK]`;
                }
              }
            } else {
              content = `[FRAGMENT RECOVERY FAILED: Marker not resolved]`;
            }

            return {
              id: generateId(),
              title: seg.title || `Chapter ${i + 1}`,
              summary: seg.summary || "Imported content.",
              content: content,
              order: i,
              plotNodeIds: [],
              tags: ['bulk-imported'],
              updatedAt: Date.now()
            };
          });
          
          addLog(`Phase 2: Synchronizing ${newChapters.length} chapters to cloud...`);
          await updateChapters(newChapters);
          addLog("Ingestion Sequence: 100% COMPLETE.");
          
          setAnalysis(`## Ingestion Successful
Your manuscript has been parsed into **${finalSegments.length} sequences**. 

**Diagnostic Overview:**
- Source Method: ${bypassAI ? "Manual Sequential" : (finalSegments.length > 5 ? "Neural Analysis" : "Structural Recovery")}
- Character Count: ${fullText.length.toLocaleString()}
- Node Density: ${Math.round(fullText.length / finalSegments.length)} chars/node

Go to the **Writing Studio** to review the reconstructed chapters.`);
        } catch (innerErr) {
          console.error("Internal processing error:", innerErr);
          addLog(`Process Error: ${innerErr instanceof Error ? innerErr.message : "Structure corrupted"}`);
        } finally {
          setIsImporting(false);
        }
      };
      reader.onerror = () => {
        addLog("FileReader Error: Access denied or storage failure.");
        setIsImporting(false);
      };
      reader.readAsText(file);
    } catch (err) {
      console.error(err);
      addLog("Fatal IO: Kernel crash during ingestion.");
      setIsImporting(false);
    }
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const runFinishAndFix = async () => {
    setIsFixing(true);
    addLog("Initializing Global Manuscript Scan...");
    try {
      const result = await AIService.finishAndFix(chapters, project.type, project.sourceMaterials || []);
      setAnalysis(result);
      addLog("Analysis complete. Found structural opportunities.");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Analysis failed";
      addLog(`Error during analysis: ${msg}`);
      onError?.(msg);
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
      
      await updateChapters(newChapters);
      addLog("Automation complete. Ready for drafting.");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Auto-Pilot sequence interrupted";
      addLog(msg);
      onError?.(msg);
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
        await updateChapters(updatedChaps);
        addLog(`Successfully synthesized ${chap.title}.`);
      }
      addLog("Deep Draft series complete. The book is ready.");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "AI exhaustion";
      addLog(`Deep Draft interrupted: ${msg}`);
      onError?.(msg);
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
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight italic font-serif">Finish & Fix <span className="text-[10px] not-italic text-slate-300 font-sans tracking-normal opacity-50">v2.55-stable</span></h1>
        <p className="text-slate-500 max-w-2xl mx-auto font-medium">
          The Global Manuscript Engine analyzes your entire work for structural integrity, logical consistency, and thematic resolution.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-1 bg-red-50 text-red-500 text-[10px] font-black uppercase rounded-full hover:bg-red-100 transition-all"
        >
          Force System Refresh (Bust Cache)
        </button>
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

              <button 
                onClick={runSlowCooker}
                disabled={isSlowCooking}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                  isSlowCooking ? 'bg-slate-50 text-slate-400' : 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-100 border-2 border-orange-400/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Activity size={18} className={isSlowCooking ? "animate-pulse" : ""} />
                    <div className="absolute inset-0 bg-white/20 blur-sm rounded-full animate-pulse" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold block">AI Slow Cooker</span>
                    <span className="text-[8px] font-medium opacity-70 block uppercase tracking-tighter">Economy Autopilot Drafting</span>
                  </div>
                </div>
                {isSlowCooking ? <Activity size={16} className="animate-spin" /> : <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />}
              </button>

              <div className="pt-4 border-t border-slate-50">
                <label 
                  htmlFor="bulk-import-input"
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group cursor-pointer ${
                    isImporting ? 'bg-slate-50 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileUp size={18} />
                    <span className="text-sm font-bold">Bulk Import Manuscript</span>
                  </div>
                  {isImporting ? <Activity size={16} className="animate-spin" /> : <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />}
                  <input id="bulk-import-input" type="file" className="hidden" onChange={handleBulkImport} accept=".txt,.md" disabled={isImporting} />
                </label>
                <p className="mt-2 text-[9px] text-slate-400 font-medium px-2 italic">
                  Upload a single file to intelligently split into chapters.
                </p>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => setShowManualPaste(true)}
                  className="w-full py-3 border border-slate-200 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                  <Zap size={12} className="text-blue-500" />
                  Manual Text Injection
                </button>
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
                  <h2 className="text-xl font-black text-slate-900">System Report</h2>
                  <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full">
                    <CheckCircle2 size={14} />
                    Success
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
            ) : isImporting ? (
              <div className="h-full min-h-[600px] flex flex-col items-center justify-center p-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div className="relative mb-8">
                  <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center animate-pulse">
                    <Activity size={32} className="text-blue-600" />
                  </div>
                  <div className="absolute inset-0 w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Reformatting Manuscript...</h3>
                <p className="text-slate-500 max-w-sm font-medium leading-relaxed mb-6">
                  Our neural engine is scanning for character names, setting transitions, and atmospheric shifts to identify logical chapter boundaries.
                </p>
                <div className="w-full max-w-md h-1.5 bg-slate-100 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: "100%" }}
                     transition={{ duration: 15, ease: "linear" }}
                     className="h-full bg-blue-600"
                   />
                </div>
              </div>
            ) : (
              <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`h-full min-h-[600px] flex flex-col items-center justify-center p-12 text-center rounded-3xl border-2 border-dashed transition-all group ${
                  dragActive 
                    ? 'bg-blue-50 border-blue-400 scale-[0.99] shadow-inner' 
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-8 transition-transform group-hover:scale-110 ${
                  dragActive ? 'scale-110 shadow-lg text-blue-600' : 'text-slate-300'
                }`}>
                  <FileUp size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight underline decoration-blue-500">Rapid Ingestion Hub v2.55</h3>
                <p className="text-slate-500 text-sm max-w-xs font-medium mb-8 leading-relaxed">
                  Drop your large `.txt` or `.md` manuscript here. 
                  <br /><br />
                  <span className="text-blue-600 font-bold">MANUAL OPTION NOW AVAILABLE BELOW</span>
                </p>
                
                <div className="flex flex-col gap-4 w-full max-w-xs mb-12">
                  <label htmlFor="hub-import-input" className="w-full text-center px-8 py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl cursor-pointer hover:bg-black transition-all shadow-xl">
                    1. Choose Source File
                    <input id="hub-import-input" type="file" className="hidden" onChange={handleBulkImport} accept=".txt,.md" />
                  </label>
                  
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-slate-200"></div>
                    <span className="text-[10px] font-black text-slate-300 uppercase">OR</span>
                    <div className="h-px flex-1 bg-slate-200"></div>
                  </div>

                  <button 
                    onClick={() => setShowManualPaste(true)}
                    className="w-full py-4 bg-white border-2 border-blue-600 text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-3"
                  >
                    <Zap size={16} />
                    2. Manual Text Injection (Stable)
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-4">
                   <button 
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.txt,.md';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) processFile(file, true);
                      };
                      input.click();
                    }}
                    className="text-[9px] font-black uppercase text-red-500 hover:text-red-600 tracking-widest border-b border-red-200"
                   >
                     Force Sequential Import (Bypass AI)
                   </button>

                   <button 
                    onClick={() => setShowManualPaste(true)}
                    className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 tracking-widest border-b border-blue-200"
                   >
                     Manual Text Injection
                   </button>
                </div>

                <AnimatePresence>
                  {showManualPaste && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                      <motion.div 
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        className="bg-white w-full max-w-3xl rounded-3xl p-8 shadow-2xl flex flex-col gap-6"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-black text-slate-900 tracking-tight">Manual Manuscript Injection</h3>
                          <button onClick={() => setShowManualPaste(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
                        </div>
                        <p className="text-sm text-slate-500 font-medium italic">
                          Paste your raw manuscript below. Use this if file ingestion is blocked by browser security.
                        </p>
                        <textarea 
                          value={pasteContent}
                          onChange={(e) => setPasteContent(e.target.value)}
                          placeholder="Paste your content here..."
                          className="w-full h-[400px] p-6 rounded-2xl bg-slate-50 border border-slate-100 font-mono text-sm focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                        />
                        <div className="flex gap-4">
                          <button 
                            onClick={handleManualImport}
                            disabled={!pasteContent.trim()}
                            className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-20"
                          >
                            Execute Ingestion Sequence
                          </button>
                          <button 
                            onClick={() => setShowManualPaste(false)}
                            className="px-8 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-md">
                   <div className="p-4 bg-white/50 rounded-2xl border border-slate-100 flex flex-col items-center gap-2">
                      <Zap size={14} className="text-yellow-500" />
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">AI Splitting</span>
                   </div>
                   <div className="p-4 bg-white/50 rounded-2xl border border-slate-100 flex flex-col items-center gap-2">
                      <Target size={14} className="text-blue-500" />
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Format Sync</span>
                   </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
