import React, { useState } from 'react';
import { Chapter, Project, ViewType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors, AlertTriangle, ArrowLeft, Sparkles, Wand2, Copy, Check, Eye } from 'lucide-react';
import { AIService } from '../services/ai';

interface ScalpelModuleProps {
  project: Project;
  chapters: Chapter[];
  updateProject: (p: Partial<Project>) => Promise<void>;
  updateChapters: (chaps: Chapter[]) => Promise<void>;
  setView: (v: ViewType) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ScalpelModule({
  project,
  chapters,
  updateProject,
  updateChapters,
  setView,
  onNotify
}: ScalpelModuleProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<string>(chapters[0]?.id || '');
  const [reductionTarget, setReductionTarget] = useState<number>(30); // 25-40% reduction target!
  const [isSlicing, setIsSlicing] = useState<boolean>(false);
  const [originalProse, setOriginalProse] = useState<string>('');
  const [slicedProse, setSlicedProse] = useState<string>('');
  const [surgeryReport, setSurgeryReport] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const selectedChapter = chapters.find(c => c.id === selectedChapterId);

  React.useEffect(() => {
    if (selectedChapter) {
      setOriginalProse(selectedChapter.content || '');
      setSlicedProse('');
      setSurgeryReport('');
    }
  }, [selectedChapterId, selectedChapter]);

  const handleSludgeSurgery = async () => {
    if (!originalProse.trim()) {
      onNotify('Select a chapter with content to perform surgery.', 'error');
      return;
    }
    setIsSlicing(true);
    onNotify('Analyzing prose matrix for padding and superficial flourishes...', 'info');
    try {
      const prompt = `EXCIZING SLUDGE (SURGICAL MODE):
      Apply direct surgical correction to the following segment of "${project.title}".
      Your goal is exactly ${reductionTarget}% prose volume reduction, in strict compliance with Literary Standing Rules:
      - Cut decorative phrases, repetitive adjectives, and unsolicited exposition.
      - Retain vital dramatic intention, the sensory texture, and underlying wound.
      - Reveal characters through behavior rather than explaining.
      
      PROSE TO STREAMLINE:
      ${originalProse}
      
      Return JSON:
      {
        "leanProse": "The absolute pristine, tightened prose here",
        "deletedLines": ["list of pretentious or unnecessary sentences excised"],
        "wordCountSaved": 124,
        "surgicalNote": "Brief, devastating editor justification for these cuts"
      }`;

      const response = await AIService.callAI({
        prompt,
        json: true,
        model: 'gemini-2.0-flash',
        schema: {
          type: 'OBJECT',
          properties: {
            leanProse: { type: 'STRING' },
            deletedLines: { type: 'ARRAY', items: { type: 'STRING' } },
            wordCountSaved: { type: 'NUMBER' },
            surgicalNote: { type: 'STRING' }
          },
          required: ['leanProse', 'deletedLines', 'wordCountSaved', 'surgicalNote']
        }
      });

      const parsed = JSON.parse(response || '{}');
      if (parsed.leanProse) {
        setSlicedProse(parsed.leanProse);
        setSurgeryReport(
          `**SURGICAL ARCHIVE REPORT**\n\n` +
          `*Cuts Made*: Saved ~${parsed.wordCountSaved} words (~${reductionTarget}%).\n` +
          `*Director Feedback*: ${parsed.surgicalNote}\n\n` +
          `**EXCISED SENTENCES (THE PRETTY SLUDGE):**\n` +
          (parsed.deletedLines?.map((l: string) => `❌ *"${l}"*`).join('\n') || '*None identified as purely decorative.*')
        );
        onNotify('Surgery successful. Sludge extracted cleanly.', 'success');
      } else {
        throw new Error('Invalid surgical response');
      }
    } catch (err: any) {
      console.error(err);
      onNotify('Surgery interrupted or API congested.', 'error');
    } finally {
      setIsSlicing(false);
    }
  };

  const applySurgery = async () => {
    if (!slicedProse || !selectedChapterId) return;
    const updated = chapters.map(c => 
      c.id === selectedChapterId 
        ? { ...c, content: slicedProse, wordCount: slicedProse.split(/\s+/).filter(Boolean).length, updatedAt: Date.now() } 
        : c
    );
    await updateChapters(updated);
    setOriginalProse(slicedProse);
    setSlicedProse('');
    setSurgeryReport('');
    onNotify('Excised prose permanently committed to the manuscript.', 'success');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(slicedProse || originalProse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="scalpel-view" className="flex-1 flex flex-col min-h-0 bg-neutral-950 text-neutral-100 p-6 overflow-y-auto">
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
                <Scissors className="w-5 h-5 text-red-500" />
                DRAFT SCALPEL <span className="text-xs px-2 py-0.5 bg-red-950/50 border border-red-900/50 text-red-400 font-normal rounded font-mono">SLUDGE REDUCTION ACTIVE</span>
              </h1>
              <p className="text-xs text-neutral-400 mt-1">Surgically slice 25%–40% decoration and boilerplate, revealing the raw sensory pulse.</p>
            </div>
          </div>
          <select
            id="chapter-selector"
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs rounded px-3 py-1.5 focus:border-red-500 font-mono outline-none"
          >
            <option value="">Select Chapter...</option>
            {chapters.map(c => (
              <option key={c.id} value={c.id}>{c.title || `Chapter ${c.order + 1}`}</option>
            ))}
          </select>
        </div>

        {selectedChapter ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            {/* Surgery Control Panel */}
            <div className="lg:col-span-4 bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-5 flex flex-col gap-5">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <Wand2 className="w-3.5 h-3.5 text-neutral-400" /> Surgery settings
              </h2>
              
              <div className="space-y-2">
                <label className="text-xs text-neutral-400 flex justify-between">
                  <span>EXCISION PRESSURE:</span>
                  <span className="font-mono text-red-400 font-bold">{reductionTarget}% REDUCTION</span>
                </label>
                <input 
                  type="range" 
                  min="15" 
                  max="50" 
                  value={reductionTarget} 
                  onChange={(e) => setReductionTarget(Number(e.target.value))}
                  className="w-full accent-red-500 bg-neutral-800 rounded-lg height-1.5 cursor-pointer"
                />
                <p className="text-[10px] text-neutral-500 italic">25%–40% is recommended. Anything above 45% risks structural narrative tissue loss.</p>
              </div>

              <div className="border border-neutral-800 rounded p-3 bg-neutral-950/40 text-[11px] text-neutral-400 space-y-2">
                <p className="font-semibold text-neutral-300">✂️ INGESTION INSTRUCTIONS:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Liquidation of redundant atmospheric markers.</li>
                  <li>Converting passive internal monologues to active gestures.</li>
                  <li>Forcing dialogue into shorter, high-tension beats.</li>
                </ul>
              </div>

              <button
                id="slice-button"
                onClick={handleSludgeSurgery}
                disabled={isSlicing || !originalProse.trim()}
                className="w-full py-2.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-red-950/40 flex items-center justify-center gap-1.5"
              >
                {isSlicing ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-white" />
                    PERFORMING RESECTION...
                  </>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" />
                    EXCISE PRETTY SLUDGE
                  </>
                )}
              </button>

              {surgeryReport && (
                <div className="mt-2 text-xs border border-neutral-800 bg-neutral-950/60 rounded p-4 overflow-y-auto max-h-[300px] leading-relaxed prose-invert scrollbar">
                  <div className="text-[10px] font-mono uppercase text-red-400 tracking-widest mb-1">SURGERY FEEDBACK:</div>
                  <pre className="whitespace-pre-wrap font-sans text-neutral-300 text-[11px]">
                    {surgeryReport}
                  </pre>
                </div>
              )}
            </div>

            {/* Prose Editor Side-by-Side */}
            <div className="lg:col-span-8 flex flex-col gap-4 min-h-[500px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                {/* Original Prose column */}
                <div className="flex flex-col bg-neutral-950 border border-neutral-800/80 rounded-xl overflow-hidden">
                  <div className="bg-neutral-900/80 px-4 py-2 border-b border-neutral-800 flex justify-between items-center">
                    <span className="text-xs font-mono font-semibold tracking-wider text-neutral-400">RAW UNTREATED MANUSCRIPT</span>
                    <span className="text-[10px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">
                      {originalProse.split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                  <textarea
                    id="prose-input"
                    value={originalProse}
                    onChange={(e) => setOriginalProse(e.target.value)}
                    placeholder="Chapter prose segment..."
                    className="flex-1 p-4 bg-neutral-950 text-neutral-300 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-neutral-800 scrollbar"
                  />
                </div>

                {/* Sliced Prose Column */}
                <div className="flex flex-col bg-neutral-950 border border-neutral-800/80 rounded-xl overflow-hidden relative">
                  <div className="bg-neutral-950/80 px-4 py-2 border-b border-neutral-800 flex justify-between items-center">
                    <span className="text-xs font-mono font-semibold tracking-wider text-red-400">PRISTINE SURGICAL CORE</span>
                    {slicedProse && (
                      <span className="text-[10px] font-mono text-green-400 bg-green-950/20 border border-green-900/50 px-1.5 py-0.5 rounded">
                        {slicedProse.split(/\s+/).filter(Boolean).length} words
                      </span>
                    )}
                  </div>
                  <div className="flex-1 p-4 font-mono text-xs leading-relaxed text-neutral-300 overflow-y-auto scrollbar bg-neutral-950/40">
                    {slicedProse ? (
                      <p className="whitespace-pre-wrap">{slicedProse}</p>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center text-neutral-600 p-6 font-sans">
                        <AlertTriangle className="w-8 h-8 text-neutral-800 mb-2" />
                        <span className="text-[11px] uppercase tracking-wider font-semibold">Ready for Incision</span>
                        <p className="text-[10px] text-neutral-600 max-w-xs mt-1">Select reduction pressure and tap 'EXCISE PRETTY SLUDGE' to begin.</p>
                      </div>
                    )}
                  </div>

                  {slicedProse && (
                    <div className="absolute bottom-4 right-4 flex items-center gap-2">
                      <button 
                        id="copy-sliced-button"
                        onClick={copyToClipboard}
                        className="p-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded transition-all"
                        title="Copy to Clipboard"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button 
                        id="apply-surgery-button"
                        onClick={applySurgery}
                        className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded text-[10px] font-mono font-bold tracking-widest transition-all hover:shadow-lg shadow-green-950/50"
                      >
                        APPLY TO DRAFT
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 py-16">
            <AlertTriangle className="w-12 h-12 text-neutral-700 mb-3" />
            <span className="font-mono uppercase tracking-widest text-xs font-semibold">No Chapters Active</span>
            <p className="text-xs text-neutral-600 mt-1">Please create a chapter first to mobilize the draft scalpel surgery module.</p>
          </div>
        )}
      </div>
    </div>
  );
}
