import React, { useState } from 'react';
import { 
  Project, ResearchNote, Chapter, SourceMaterial 
} from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, Plus, Trash2, Tag, Compass, FileText, Check, Search, Filter 
} from 'lucide-react';

interface DiscoverViewProps {
  project: Project;
  research: ResearchNote[];
  chapters: Chapter[];
  sourceMaterials: SourceMaterial[];
  updateProject: (p: Partial<Project>) => Promise<void>;
  onAddResearch: (r: ResearchNote) => Promise<void>;
  onDeleteResearch: (id: string) => Promise<void>;
  onAddChapter: (c: Chapter) => Promise<void>;
  onAddSource: (s: SourceMaterial) => Promise<void>;
  onDeleteSource: (id: string) => Promise<void>;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function DiscoverView({
  project,
  research,
  chapters,
  sourceMaterials,
  updateProject,
  onAddResearch,
  onDeleteResearch,
  onAddChapter,
  onAddSource,
  onDeleteSource,
  onNotify
}: DiscoverViewProps) {
  const [activeTab, setActiveTab] = useState<'sources' | 'notes'>('sources');
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [newSourceType, setNewSourceType] = useState('Atmospheric Background');
  const [isAddingSource, setIsAddingSource] = useState(false);

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('brainstorm');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceContent.trim()) {
      onNotify('Ensure all fields are populated before creating source.', 'error');
      return;
    }
    const newSource: SourceMaterial = {
      id: crypto.randomUUID(),
      name: newSourceName,
      content: newSourceContent,
      type: newSourceType,
      updatedAt: Date.now()
    };
    await onAddSource(newSource);
    setNewSourceName('');
    setNewSourceContent('');
    setIsAddingSource(false);
    onNotify(`Source document "${newSource.name}" cataloged safely.`, 'success');
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) {
      onNotify('Ensure all fields are populated before creating research entry.', 'error');
      return;
    }
    const newNote: ResearchNote = {
      id: crypto.randomUUID(),
      title: newNoteTitle,
      content: newNoteContent,
      category: newNoteCategory,
      tags: ['manual-entry'],
      updatedAt: Date.now()
    };
    await onAddResearch(newNote);
    setNewNoteTitle('');
    setNewNoteContent('');
    setIsAddingNote(false);
    onNotify(`Research Note "${newNote.title}" cataloged safely.`, 'success');
  };

  return (
    <div id="discover-view-container" className="flex-1 flex flex-col min-h-0 bg-neutral-900 border border-neutral-800/80 rounded-xl overflow-hidden text-neutral-100">
      {/* Title Header Bar */}
      <div className="bg-neutral-950 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-sky-950/40 border border-sky-800/50 rounded text-sky-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Atmospheric discovery laboratory</h1>
            <p className="text-[10px] text-neutral-400 mt-0.5">Collect atmospheric signals, deep research coordinates, and external citation foundations.</p>
          </div>
        </div>

        <div className="flex bg-neutral-900 border border-neutral-800 rounded p-0.5">
          <button
            id="tab-btn-sources"
            onClick={() => setActiveTab('sources')}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-all ${
              activeTab === 'sources' ? 'bg-neutral-850 text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Source docs ({sourceMaterials.length})
          </button>
          <button
            id="tab-btn-notes"
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-all ${
              activeTab === 'notes' ? 'bg-neutral-850 text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Research notes ({research.length})
          </button>
        </div>
      </div>

      {/* Main Panel Pane */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar">
        {activeTab === 'sources' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">PRIMARY ATOMIZED REFERENCE MATERIALS</span>
              <button
                id="toggle-add-source"
                onClick={() => setIsAddingSource(!isAddingSource)}
                className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-850 text-xs text-sky-400 border border-sky-950 rounded font-mono font-bold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingSource ? 'CANCEL' : 'ADD NEW SOURCE'}
              </button>
            </div>

            <AnimatePresence>
              {isAddingSource && (
                <motion.form
                  id="add-source-form"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleCreateSource}
                  className="p-5 border border-neutral-800 rounded-xl bg-neutral-950/40 space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono text-neutral-400">Source Name or Identifier:</label>
                      <input
                        id="source-name-input"
                        type="text"
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                        placeholder="e.g. Victorian Coroner Reports, 1888"
                        className="w-full bg-neutral-900 border border-neutral-800 text-xs rounded px-3 py-2 text-white outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono text-neutral-400">Reference Category:</label>
                      <select
                        id="source-type-select"
                        value={newSourceType}
                        onChange={(e) => setNewSourceType(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 text-xs rounded px-3 py-2 text-neutral-350 outline-none focus:border-sky-500 font-mono"
                      >
                        <option value="Atmospheric Background">Atmospheric Background</option>
                        <option value="Scientific Treatise">Scientific Treatise</option>
                        <option value="Historic Archive">Historic Archive</option>
                        <option value="Legal Contract">Legal Contract</option>
                        <option value="Audio Interview Log">Audio Interview Log</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-mono text-neutral-400">Content / Verbatim Excerpt:</label>
                    <textarea
                      id="source-content-input"
                      value={newSourceContent}
                      onChange={(e) => setNewSourceContent(e.target.value)}
                      placeholder="Paste historical records, style guide rules, or transcripts here..."
                      className="w-full h-32 bg-neutral-900 border border-neutral-800 text-xs rounded p-3 text-neutral-300 outline-none focus:border-sky-500 font-mono resize-none"
                    />
                  </div>

                  <button
                    id="submit-source"
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded font-mono text-xs uppercase tracking-widest font-semibold transition-all active:scale-95 text-center block"
                  >
                    COMMITT SOURCE
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {sourceMaterials.length === 0 ? (
              <div className="border border-neutral-800 border-dashed rounded-xl py-12 text-center text-neutral-500 font-mono text-xs">
                No active source references cataloged. Use 'ADD NEW SOURCE' to load background signals.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sourceMaterials.map(src => (
                  <div key={src.id} className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl relative hover:border-neutral-700 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-xs font-mono font-bold text-white truncate max-w-[200px]">{src.name}</span>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-neutral-400 tracking-wider">
                          {src.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed font-mono line-clamp-3 italic">"{src.content}"</p>
                    </div>
                    <button
                      id={`delete-source-${src.id}`}
                      onClick={() => {
                        onDeleteSource(src.id);
                        onNotify('Reference deleted.', 'success');
                      }}
                      className="p-1.5 hover:bg-red-950/30 text-neutral-500 hover:text-red-400 border border-transparent hover:border-red-900/50 rounded self-end mt-4 transition-all"
                      title="Deport reference source"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">ATOMIZED RESEARCH BINDERS</span>
              <button
                id="toggle-add-note"
                onClick={() => setIsAddingNote(!isAddingNote)}
                className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-850 text-xs text-sky-400 border border-sky-950 rounded font-mono font-bold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingNote ? 'CANCEL' : 'ADD NEW RESEARCH'}
              </button>
            </div>

            <AnimatePresence>
              {isAddingNote && (
                <motion.form
                  id="add-note-form"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleCreateNote}
                  className="p-5 border border-neutral-800 rounded-xl bg-neutral-950/40 space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono text-neutral-400">Research Entry Title:</label>
                      <input
                        id="note-title-input"
                        type="text"
                        value={newNoteTitle}
                        onChange={(e) => setNewNoteTitle(e.target.value)}
                        placeholder="e.g. Poison types: Belladonna Extraction"
                        className="w-full bg-neutral-900 border border-neutral-800 text-xs rounded px-3 py-2 text-white outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono text-neutral-400">Category Tag:</label>
                      <select
                        id="note-category-select"
                        value={newNoteCategory}
                        onChange={(e) => setNewNoteCategory(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 text-xs rounded px-3 py-2 text-neutral-350 outline-none focus:border-sky-500 font-mono"
                      >
                        <option value="brainstorm">Brainstorm Spark</option>
                        <option value="location">Location Geometry</option>
                        <option value="sensory">Sensory Detail Grain</option>
                        <option value="medical">Medical/Forensic Accuracy</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-mono text-neutral-400">Elaboration / Contextual details:</label>
                    <textarea
                      id="note-content-input"
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Brainstorm sequence details, plot constraints or thematic motifs..."
                      className="w-full h-32 bg-neutral-900 border border-neutral-800 text-xs rounded p-3 text-neutral-300 outline-none focus:border-sky-500 font-mono resize-none"
                    />
                  </div>

                  <button
                    id="submit-note"
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded font-mono text-xs uppercase tracking-widest font-semibold transition-all active:scale-95 text-center block"
                  >
                    COMMITT RESEARCH
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {research.length === 0 ? (
              <div className="border border-neutral-800 border-dashed rounded-xl py-12 text-center text-neutral-500 font-mono text-xs">
                No active research notes cataloged. Use 'ADD NEW RESEARCH' to record creative grains.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {research.map(note => (
                  <div key={note.id} className="p-4 bg-neutral-950/60 border border-neutral-800 hover:border-neutral-750 rounded-xl relative hover:shadow-xl hover:shadow-black/25 flex flex-col justify-between transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Tag className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="text-xs font-mono font-bold text-white truncate">{note.title}</span>
                        </div>
                        <span className="text-[9px] font-mono uppercase bg-sky-950/40 border border-sky-900/50 px-1.5 py-0.5 rounded text-sky-400 shrink-0">
                          {note.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed font-sans line-clamp-4">{note.content}</p>
                    </div>
                    <button
                      id={`delete-note-${note.id}`}
                      onClick={() => {
                        onDeleteResearch(note.id);
                        onNotify('Research note excised.', 'success');
                      }}
                      className="p-1.5 hover:bg-red-950/30 text-neutral-500 hover:text-red-400 border border-transparent hover:border-red-900/50 rounded self-end mt-4 transition-all"
                      title="Exterminate research node"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
