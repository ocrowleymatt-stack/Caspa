import React, { useState } from 'react';
import { Chapter, Project, PlotNode, ResearchNote, ViewType } from '../types';
import { motion } from 'motion/react';
import { Play, SkipForward, CheckCircle, AlertOctagon, Terminal, Flame, FileText, ArrowLeft, Cpu } from 'lucide-react';
import { AIService } from '../services/ai';

interface AutoDrafterProps {
  project: Project & { sourceMaterials?: any[]; research?: ResearchNote[] };
  chapters: Chapter[];
  plotNodes: PlotNode[];
  research: ResearchNote[];
  updateProject: (p: Partial<Project>) => Promise<void>;
  updateChapters: (chaps: Chapter[]) => Promise<void>;
  setView: (v: ViewType) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
  onError: (msg: string) => void;
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
}: AutoDrafterProps) {
  const [isDrafting, setIsDrafting] = useState<boolean>(false);
  const [draftLogs, setDraftLogs] = useState<string[]>(['Drafter initialized and ready.', 'Linked style DNA & plot lattice...']);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(chapters.find(c => !c.content.trim())?.id || chapters[0]?.id || '');
  const [wordsPerChapter, setWordsPerChapter] = useState<number>(2000);

  const selectedChapter = chapters.find(c => c.id === selectedChapterId);

  const addLog = (msg: string) => {
    setDraftLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleDeepDraft = async () => {
    if (!selectedChapterId || !selectedChapter) {
      onNotify('Select a chapter to draft.', 'error');
      return;
    }

    setIsDrafting(true);
    addLog(`Initiating Deep Draft sequence for: "${selectedChapter.title}"`);
    addLog(`Targeting ${wordsPerChapter} words with ${project.tone || 'standard'} tone.`);

    try {
      // Create high-craft prompt combining character backgrounds, plot nodes and research references
      const prompt = `DEEP DRAFTING SEQUENCE:
      Draft a full, high-fidelity scene for Chapter "${selectedChapter.title}".
      
      WORLD METADATA:
      - Title: "${project.title}"
      - Type: "${project.type}"
      - Style DNA Tone: "${project.tone}"
      - Summary: "${selectedChapter.summary}"
      - Directives/Guidelines: ${selectedChapter.directives?.join(', ') || 'Standard progression'}

      STYLE SPECIFICATION:
      - Vocabulary level: Elevate the vocabulary; select words matching the ${project.styleDNA?.vocabularyLevel || 'elevated'} level.
      - Prose intensity: ${project.styleDNA?.proseIntensity || 70}/100.
      - Prose Rhythm: ${project.styleDNA?.narrativeRhythm || 60}/100 duration mixes.
      
      CONTEXTUAL NOTES & BEATS:
      - Active Plot Points: ${plotNodes.filter(p => selectedChapter.plotNodeIds?.includes(p.id)).map(p => p.title).join(', ') || 'Progress the core narrative'}
      - Relevant research nodes: ${research.slice(0, 3).map(r => r.title + ': ' + r.content.slice(0, 500)).join('\n')}

      Write detailed, immersive prose without rushing. Ensure the scene ends on a lingering sensory image.
      Return the drafted prose string directly. Do NOT wrap in markdown blocks, JSON, or quotes.`;

      const response = await AIService.callAI({
        prompt,
        model: 'gemini-2.5-pro', // Large context model for deep writing
      });

      if (response && response.trim()) {
        const wordCount = response.split(/\s+/).filter(Boolean).length;
        const updatedChapters = chapters.map(c => 
          c.id === selectedChapterId 
            ? { ...c, content: response, wordCount, status: 'completed' as const, updatedAt: Date.now() } 
            : c
        );

        await updateChapters(updatedChapters);

        addLog(`Successfully generated prose! Output: ${wordCount} words.`);
        addLog(`Chapter "${selectedChapter.title}" committed successfully.`);
        onNotify(`Generated ${wordCount} words for "${selectedChapter.title}"!`, 'success');

        // Automatically select the next empty chapter
        const nextEmpty = chapters.find(c => c.id !== selectedChapterId && !c.content.trim());
        if (nextEmpty) {
          setSelectedChapterId(nextEmpty.id);
          addLog(`Sequence loaded next empty target chapter: "${nextEmpty.title}"`);
        }
      } else {
        throw new Error('Drafter returned empty response');
      }
    } catch (err: any) {
      console.error(err);
      addLog(`FATAL: drafting sequence interrupted.`);
      onError?.(err?.message || 'Drafting interrupted.');
      onNotify('Deep draft sequence crashed.', 'error');
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div id="autodraft-view" className="flex-1 flex flex-col min-h-0 bg-neutral-950 text-neutral-100 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full">
        {/* Header toolbar */}
        <div className="flex items-center justify-between mb-6 border-b border-neutral-800 pb-4">
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
                <Cpu className="w-5 h-5 text-purple-400" />
                AUTO-DRAFTER ENGINE <span className="text-xs px-2 py-0.5 bg-purple-950/50 border border-purple-900/50 text-purple-400 font-normal rounded font-mono">STANDBY POOL</span>
              </h1>
              <p className="text-xs text-neutral-400 mt-1">Harness high-context Gemini models to expand structural outlines into rich literary prose.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          {/* Drafter Config */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <Flame className="w-4 h-4 text-purple-400" /> SEQUENCE CALIBRATION
              </h2>

              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400 font-mono">SELECT TARGET CHAPTER:</label>
                <select
                  id="drafter-chapter-select"
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded px-3 py-2 focus:border-purple-500 font-mono outline-none"
                >
                  <option value="">Choose outline to expand...</option>
                  {chapters.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.content.trim() ? '✓' : '◌'} {c.title || `Chapter ${c.order + 1}`} ({c.content.trim() ? `${c.content.split(/\s+/).filter(Boolean).length}w` : 'empty'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400 font-mono flex justify-between">
                  <span>TARGET SCALE PROSE:</span>
                  <span className="text-purple-400 font-bold">{wordsPerChapter} WORDS</span>
                </label>
                <input 
                  type="range" 
                  min="500" 
                  max="4000" 
                  step="250"
                  value={wordsPerChapter} 
                  onChange={(e) => setWordsPerChapter(Number(e.target.value))}
                  className="w-full accent-purple-500 bg-neutral-800 rounded-lg height-1.5 cursor-pointer"
                />
              </div>

              {selectedChapter && (
                <div className="border border-neutral-800 rounded-lg bg-neutral-950/40 p-4 space-y-2 text-xs">
                  <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-neutral-500" /> Target chapter summary:
                  </span>
                  <p className="text-neutral-400 leading-relaxed italic">"{selectedChapter.summary || 'No summary configured'}"</p>
                  {selectedChapter.directives && selectedChapter.directives.length > 0 && (
                    <div className="pt-2 border-t border-neutral-800">
                      <span className="text-[10px] uppercase font-mono text-neutral-500">Active Directives:</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-neutral-400 mt-1">
                        {selectedChapter.directives.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <button
                id="ignite-draft-button"
                onClick={handleDeepDraft}
                disabled={isDrafting || !selectedChapterId}
                className="w-full py-3 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-purple-950/40 flex items-center justify-center gap-1.5"
              >
                {isDrafting ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin text-white" />
                    DEEP DRAFTING CORE...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    IGNITE AUTO-DRAFTER
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Console / Output Logging */}
          <div className="lg:col-span-7 flex flex-col bg-neutral-900/40 border border-neutral-800 rounded-xl overflow-hidden min-h-[450px]">
            <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center gap-2 text-neutral-300 font-mono text-xs">
              <Terminal className="w-4 h-4 text-neutral-400" />
              <span>LIVE AUTOPILOT CONSOLE</span>
              {isDrafting && (
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping ml-auto" />
              )}
            </div>
            <div className="flex-1 p-4 bg-neutral-950/80 font-mono text-xs text-green-400/90 space-y-2 overflow-y-auto max-h-[450px] leading-relaxed scrollbar">
              {draftLogs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-neutral-600 shrink-0">❯</span>
                  <p className="whitespace-pre-wrap">{log}</p>
                </div>
              ))}
              {isDrafting && (
                <div className="flex gap-2 animate-pulse text-purple-400">
                  <span className="shrink-0">⚙</span>
                  <p>Awaiting highly cohesive prose stream from Gemini...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
