import React, { useState } from 'react';
import { Search, Book, Tags, Trash2, Library, Zap } from 'lucide-react';
import { Project, ResearchNote } from '../types';
import { AIService } from '../services/ai';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface ResearchLibraryProps {
  project: Project;
  research: ResearchNote[];
  onAdd: (note: ResearchNote) => void;
  onDelete: (id: string) => void;
  onError?: (message: string) => void;
}

export const ResearchLibrary: React.FC<ResearchLibraryProps> = ({ project, research, onAdd, onDelete, onError }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [createTopic, setCreateTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ResearchNote | null>(null);

  const filteredResearch = research.filter(note => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      (note.title || '').toLowerCase().includes(term) || 
      (note.content || '').toLowerCase().includes(term) ||
      (note.tags || []).some(tag => (tag || '').toLowerCase().includes(term)) ||
      (note.category || '').toLowerCase().includes(term)
    );
  });

  const handleResearch = async () => {
    if (!createTopic) return;
    setLoading(true);
    try {
      const context = `Genre: ${project.genre}, Premise: ${project.premise}, Tone: ${project.tone}`;
      const note = await AIService.compileResearch(createTopic, context, project.type);
      onAdd(note);
      setSelectedNote(note);
      setCreateTopic('');
    } catch (error: any) {
      console.error(error);
      onError?.(error.message || 'Research Archive query failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-8">
      {/* Left List */}
      <div className="w-full md:w-80 flex flex-col gap-6">
        <header>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-1">Research Archive</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Agentic knowledge compilation.</p>
        </header>

        <div className="flex flex-col gap-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search archive..."
              className="w-full bg-slate-100/50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white transition-all outline-none"
            />
          </div>

          <div className="h-px bg-slate-100" />

          {/* Create Input */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">New Specialist Search</label>
            <div className="relative">
              <input 
                value={createTopic}
                onChange={(e) => setCreateTopic(e.target.value)}
                placeholder="Topic: 1920s architecture..."
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 pr-12 transition-all outline-none shadow-sm placeholder:italic"
                onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
              />
              <button 
                onClick={handleResearch}
                disabled={loading || !createTopic}
                className="absolute right-2 top-1.5 p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg disabled:opacity-50 transition-all shadow-md"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap size={14} className="fill-white" />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar max-h-[50vh]">
            {filteredResearch.length > 0 ? (
              filteredResearch.map(note => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`w-full text-left p-4 rounded-xl border transition-all relative group ${
                    selectedNote?.id === note.id 
                      ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedNote?.id === note.id ? 'bg-blue-600' : 'bg-slate-300'}`} />
                    <div className="font-bold text-sm truncate text-slate-900">{note.title}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">{note.category}</div>
                    <div className="text-[9px] text-slate-300 group-hover:text-slate-400 transition-colors">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              ))
            ) : searchTerm ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                  No matches found for<br/>
                  <span className="text-slate-900 italic">"{searchTerm}"</span>
                </p>
              </div>
            ) : research.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                  Archive empty.<br/>
                  <span className="text-blue-600">Start a search above.</span>
                </p>
              </div>
            ) : (
                research.map(note => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className={`w-full text-left p-4 rounded-xl border transition-all relative group ${
                      selectedNote?.id === note.id 
                        ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${selectedNote?.id === note.id ? 'bg-blue-600' : 'bg-slate-300'}`} />
                      <div className="font-bold text-sm truncate text-slate-900">{note.title}</div>
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{note.category}</div>
                  </button>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Right Detail */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
        <AnimatePresence mode="wait">
          {selectedNote ? (
            <motion.div 
              key={selectedNote.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar"
            >
              <header className="flex items-start justify-between">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 mb-2 italic font-serif">{selectedNote.title}</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Book size={14} className="text-blue-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{selectedNote.category}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Tags size={14} className="text-slate-300" />
                      <div className="flex gap-2">
                        {selectedNote.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-bold text-slate-400">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => { onDelete(selectedNote.id); setSelectedNote(null); }}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </header>

              <div className="prose prose-slate prose-sm max-w-none prose-headings:font-serif prose-headings:italic prose-p:leading-relaxed text-slate-600">
                <Markdown>{selectedNote.content}</Markdown>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-slate-200">
              <Library size={64} strokeWidth={1} className="opacity-10 text-slate-900" />
              <div className="max-w-xs">
                <p className="text-lg font-bold text-slate-400">Library Offline</p>
                <p className="text-xs text-slate-300 font-medium italic">Initialize a specialist search to expand your narrative foundation.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
