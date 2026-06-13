import React, { useState } from 'react';
import { 
  Project, Chapter, PlotNode, SourceMaterial, ResearchNote, ExternalReview, Character, ViewType 
} from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Edit, BookOpen, Trash2, Plus, Sparkles, Sidebar, Scissors, Cpu, BookMarked, Layers, Eye, CheckCircle 
} from 'lucide-react';

interface WriteViewProps {
  project: Project & { chapters: Chapter[], sourceMaterials: SourceMaterial[], research: ResearchNote[], externalReviews: ExternalReview[] };
  plotNodes: PlotNode[];
  presence: any;
  chapters: Chapter[];
  updateProject: (p: Partial<Project>) => Promise<void>;
  updateChapters: (chaps: Chapter[]) => Promise<void>;
  setView: (v: ViewType) => void;
  upsertChapter: (c: Chapter) => Promise<void>;
  onDeleteChapter: (id: string) => Promise<void>;
  onUpsertSource: (s: SourceMaterial) => Promise<void>;
  onDeleteSource: (id: string) => Promise<void>;
  onUpsertCharacters: (chars: Character[]) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onError: (msg: string) => void;
}

export default function WriteView({
  project,
  plotNodes,
  presence,
  chapters,
  updateProject,
  updateChapters,
  setView,
  upsertChapter,
  onDeleteChapter,
  onUpsertSource,
  onDeleteSource,
  onUpsertCharacters,
  onNotify,
  onError
}: WriteViewProps) {
  const [activeChapterId, setActiveChapterId] = useState<string>(chapters[0]?.id || '');
  const [editorText, setEditorText] = useState<string>('');
  const [isNoteDrawerOpen, setIsNoteDrawerOpen] = useState<boolean>(true);

  const activeChapter = chapters.find(c => c.id === activeChapterId);

  React.useEffect(() => {
    if (activeChapter) {
      setEditorText(activeChapter.content || '');
    }
  }, [activeChapterId, activeChapter]);

  const handleSaveDraft = async () => {
    if (!activeChapterId || !activeChapter) return;
    const wordCount = editorText.split(/\s+/).filter(Boolean).length;
    const updated: Chapter = {
      ...activeChapter,
      content: editorText,
      wordCount,
      updatedAt: Date.now()
    };
    await upsertChapter(updated);
    onNotify?.('Draft segment securely synched with storage buffer.', 'success');
  };

  const createChapterDraftOutline = async () => {
    const order = chapters.length;
    const newChap: Chapter = {
      id: crypto.randomUUID(),
      title: `Chapter ${order + 1}: Staged Ascent`,
      summary: 'Draft summary outline...',
      content: '',
      order,
      plotNodeIds: [],
      tags: [],
      updatedAt: Date.now()
    };
    await upsertChapter(newChap);
    setActiveChapterId(newChap.id);
    onNotify?.(`New narrative outline instantiated.`, 'success');
  };

  const removeChapterOutline = async (id: string) => {
    if (confirm('Are you sure you want to permanently dismantle this chapter fragment?')) {
      await onDeleteChapter(id);
      onNotify?.('Chapter outline excised.', 'success');
      const remaining = chapters.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setActiveChapterId(remaining[0].id);
      } else {
        setActiveChapterId('');
      }
    }
  };

  return (
    <div id="write-view-container" className="flex-1 flex min-h-0 bg-neutral-900 overflow-hidden text-neutral-100">
      {/* Chapter Sidebar */}
      <div className="w-64 border-r border-neutral-800 bg-neutral-950 flex flex-col justify-between shrink-0">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 font-bold">CHAPTERS BLUEPRINT</span>
            <button
              id="create-chap-outline"
              onClick={createChapterDraftOutline}
              className="p-1 hover:bg-neutral-900 border border-neutral-800 rounded text-neutral-300 hover:text-white transition-all"
              title="Instantiate chapter outline"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar">
            {chapters.map(c => (
              <button
                key={c.id}
                id={`sidebar-chap-${c.id}`}
                onClick={() => {
                  if (activeChapterId) handleSaveDraft();
                  setActiveChapterId(c.id);
                }}
                className={`w-full p-2.5 rounded-lg text-left text-xs font-mono transition-all flex items-center justify-between ${
                  activeChapterId === c.id 
                    ? 'bg-neutral-800 text-white border border-neutral-750' 
                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                }`}
              >
                <span className="truncate pr-2">{c.title || `Chapter ${c.order + 1}`}</span>
                <span className="text-[9px] text-neutral-600 shrink-0 font-bold uppercase">{c.content?.split(/\s+/).filter(Boolean).length || 0}w</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-neutral-850 space-y-1.5 shrink-0 bg-neutral-950/40">
          <button
            id="open-scalpel"
            onClick={() => setView('scalpel')}
            className="w-full py-1.5 border border-red-950/50 hover:bg-red-950/20 text-red-400 font-mono text-[10px] font-bold tracking-widest uppercase rounded flex items-center justify-center gap-1.5 transition-all"
          >
            <Scissors className="w-3.5 h-3.5" />
            OPEN SCALPEL SURGERY
          </button>
          <button
            id="open-autodrafter"
            onClick={() => setView('autodraft')}
            className="w-full py-1.5 border border-purple-900/50 hover:bg-purple-950/20 text-purple-400 font-mono text-[10px] font-bold tracking-widest uppercase rounded flex items-center justify-center gap-1.5 transition-all"
          >
            <Cpu className="w-3.5 h-3.5" />
            ENGAGE AUTO-DRAFTER
          </button>
        </div>
      </div>

      {/* Editor Main Pane */}
      <div className="flex-1 flex flex-col min-h-0 bg-neutral-900">
        {activeChapter ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <div className="bg-neutral-950 px-6 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60 shrink-0">
              <div className="flex items-center gap-2">
                <Edit className="w-4 h-4 text-neutral-400" />
                <input
                  id="active-chapter-title-input"
                  type="text"
                  value={activeChapter.title}
                  onChange={async (e) => {
                    const title = e.target.value;
                    await upsertChapter({ ...activeChapter, title, updatedAt: Date.now() });
                  }}
                  className="bg-transparent border-none text-xs font-mono font-bold text-white tracking-wide outline-none focus:ring-0 focus:border-neutral-700 max-w-[300px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-neutral-500">
                  {editorText.split(/\s+/).filter(Boolean).length} WORDS
                </span>
                <button
                  id="save-draft-btn"
                  onClick={handleSaveDraft}
                  className="px-3 py-1 bg-neutral-850 hover:bg-neutral-750 border border-neutral-750 rounded text-xs uppercase tracking-widest font-mono font-bold transition-all text-neutral-300 hover:text-white"
                >
                  SAVE BUFFER
                </button>
                <button
                  id="delete-chap-btn"
                  onClick={() => removeChapterOutline(activeChapter.id)}
                  className="p-1.5 hover:bg-red-950/30 text-neutral-500 hover:text-red-400 rounded transition-all"
                  title="Dismantle fragment outline"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Prose workspace */}
            <div className="flex-1 flex min-h-0">
              <textarea
                id="manuscript-editor-textarea"
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                placeholder="Unfurl atmospheric prose according to Style DNA here..."
                className="flex-1 p-8 bg-neutral-900 border-none resize-none outline-none text-neutral-300 font-mono text-sm leading-relaxed focus:ring-0 scrollbar select-text text-left"
              />

              {/* collapsible notes sidebar */}
              <AnimatePresence>
                {isNoteDrawerOpen && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 280, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="border-l border-neutral-800 bg-neutral-950 flex flex-col shrink-0 min-h-0"
                  >
                    <div className="p-3 border-b border-neutral-800 flex items-center justify-between uppercase font-mono text-[9px] text-neutral-400 tracking-wider">
                      <span>PLANNING & REFERENCES</span>
                      <button onClick={() => setIsNoteDrawerOpen(false)} className="hover:text-white">✕</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar">
                      <div>
                        <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500 block mb-1">CHAPTER SUMMARY</span>
                        <p className="text-[11px] font-mono text-neutral-400 leading-relaxed italic p-2 bg-neutral-900/60 border border-neutral-850 rounded">
                          "{activeChapter.summary || 'Summary outline empty.'}"
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[9px] uppercase font-mono tracking-widest text-neutral-500 block">CONNECTED PLOT TURNS</span>
                        {plotNodes.length === 0 ? (
                          <span className="text-[10px] italic text-neutral-600 block">None mapped.</span>
                        ) : (
                          plotNodes.slice(0,2).map(n => (
                            <div key={n.id} className="p-2 border border-neutral-850 bg-neutral-900/30 rounded text-[10px] font-mono leading-relaxed">
                              <span className="text-white block font-bold mb-0.5">{n.title}</span>
                              <span className="text-neutral-500">{n.description}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-600">
            <BookOpen className="w-12 h-12 text-neutral-800 mb-2" />
            <span className="text-xs uppercase font-mono tracking-widest">CHAPTER BUFFER VACANT</span>
            <p className="text-[10px] max-w-xs mt-1 text-neutral-600 font-mono">Create an outline in the sidebar or import references to initiate draft work.</p>
          </div>
        )}
      </div>
    </div>
  );
}
