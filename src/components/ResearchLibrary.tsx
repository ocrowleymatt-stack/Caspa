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
}

export const ResearchLibrary: React.FC<ResearchLibraryProps> = ({ project, research, onAdd, onDelete }) => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ResearchNote | null>(null);

  const filteredResearch = research.filter(note => 
    note.title?.toLowerCase().includes(topic.toLowerCase()) || 
    note.content?.toLowerCase().includes(topic.toLowerCase()) ||
    note.tags?.some(tag => tag.toLowerCase().includes(topic.toLowerCase())) ||
    note.category?.toLowerCase().includes(topic.toLowerCase())
  );

  const handleResearch = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      const context = `Genre: ${project.genre}, Premise: ${project.premise}, Tone: ${project.tone}`;
      const note = await AIService.compileResearch(topic, context, project.type);
      onAdd(note);
      setSelectedNote(note);
      setTopic('');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex gap-8">
      {/* Left List */}
      <div className="w-80 flex flex-col gap-6">
        <header>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Research Archive</h2>
          <p className="text-xs text-slate-500 font-medium italic">Agentic knowledge compilation.</p>
        </header>

        <div className="space-y-4">
          <div className="relative">
            <input 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Topic: Victorian medicine..."
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 pr-12 transition-all outline-none shadow-sm placeholder:italic"
              onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
            />
            <button 
              onClick={handleResearch}
              disabled={loading || !topic}
              className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50 transition-all shadow-lg shadow-blue-100"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={16} />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar max-h-[60vh]">
            {filteredResearch.length > 0 ? (
              filteredResearch.map(note => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedNote?.id === note.id 
                      ? 'bg-blue-50 border-blue-200 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <div className="font-bold text-sm truncate text-slate-900">{note.title}</div>
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{note.category}</div>
                </button>
              ))
            ) : topic ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                  No matching notes.<br/>
                  <span className="text-blue-600 cursor-pointer hover:underline" onClick={handleResearch}>
                    Generate research for "{topic}"?
                  </span>
                </p>
              </div>
            ) : (
              research.map(note => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedNote?.id === note.id 
                      ? 'bg-blue-50 border-blue-200 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
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
