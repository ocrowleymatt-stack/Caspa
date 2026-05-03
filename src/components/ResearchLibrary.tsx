import React, { useState } from 'react';
import { Search, Book, Tags, Trash2, Library, Zap, Globe, Sparkles, AlertCircle, Headphones, Wind, Hand, Eye } from 'lucide-react';
import { Project, ResearchNote, Chapter } from '../types';
import { AIService } from '../services/ai';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface ResearchLibraryProps {
  project: Project;
  research: ResearchNote[];
  chapters: Chapter[];
  onAdd: (note: ResearchNote) => void;
  onDelete: (id: string) => void;
  onError?: (message: string) => void;
}

export const ResearchLibrary: React.FC<ResearchLibraryProps> = ({ project, research, chapters, onAdd, onDelete, onError }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [createTopic, setCreateTopic] = useState('');
  const [isDeep, setIsDeep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedNote, setSelectedNote] = useState<ResearchNote | null>(null);

  const filteredResearch = research.filter(note => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    const tagsArray = Array.isArray(note.tags) ? note.tags : [];
    return (
      (note.title || '').toLowerCase().includes(term) || 
      (note.content || '').toLowerCase().includes(term) ||
      tagsArray.some(tag => {
        if (typeof tag === 'string') {
          return tag.toLowerCase().includes(term);
        }
        return false;
      }) ||
      (note.category || '').toLowerCase().includes(term)
    );
  });

  const handleResearch = async (topicOverride?: string) => {
    const topic = topicOverride || createTopic;
    if (!topic) return;
    setLoading(true);
    try {
      const context = `Genre: ${project.genre}, Premise: ${project.premise}, Tone: ${project.tone}`;
      const note = await AIService.compileResearch(topic, context, project.type, isDeep);
      onAdd(note);
      setSelectedNote(note);
      if (!topicOverride) setCreateTopic('');
      setSuggestedTopics(prev => prev.filter(t => t !== topic));
    } catch (error: any) {
      console.error(error);
      onError?.(error.message || 'Research Archive query failed.');
    } finally {
      setLoading(false);
    }
  };

  const scanProse = async () => {
    if (chapters.length === 0) {
      onError?.("No prose found to scan. Write some chapters first!");
      return;
    }
    setScanning(true);
    try {
      const allProse = chapters.map(c => c.content).join('\n\n');
      const topics = await AIService.extractResearchNeeds(allProse, project.type);
      setSuggestedTopics(topics);
    } catch (error: any) {
      onError?.("Scanning failure: " + (error.message || "Unknown error"));
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-8 min-h-0 overflow-hidden">
      {/* Left List */}
      <div className="w-full md:w-80 flex flex-col gap-6 shrink-0 h-full overflow-hidden">
      <header className="space-y-4 text-center md:text-left">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 mb-1">Research Archive</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center md:text-left">Agentic knowledge compilation.</p>
        </div>
        
        <button 
          onClick={scanProse}
          disabled={scanning}
          className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-blue-200 group"
        >
            {scanning ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <Sparkles size={16} className="group-hover:scale-110 transition-transform" />
            )}
            <span className="text-[10px] font-black uppercase tracking-widest">Analyze Manuscript</span>
          </button>
        </header>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <button 
              onClick={() => setIsDeep(false)}
              className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${!isDeep ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-200'}`}
            >
              Standard
            </button>
            <button 
              onClick={() => setIsDeep(true)}
              className={`flex-1 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${isDeep ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-400 border-slate-200'}`}
            >
              <Globe size={10} /> Deep Search
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search archive..."
              className="w-full bg-slate-100/30 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 focus:bg-white transition-all outline-none"
            />
          </div>

          <div className="h-px bg-slate-100" />

          {/* Suggested Topics from Scan */}
          <AnimatePresence>
            {suggestedTopics.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50"
              >
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[9px] font-black uppercase text-amber-600 tracking-widest px-1 flex items-center gap-2">
                    <AlertCircle size={10} /> Manuscript Discoveries
                  </label>
                  <button onClick={() => setSuggestedTopics([])} className="text-[9px] font-bold text-amber-400 hover:text-amber-600 transition-colors uppercase tracking-widest">Clear</button>
                </div>
                <div className="space-y-2">
                  {suggestedTopics.map(topic => (
                    <button 
                      key={topic}
                      onClick={() => handleResearch(topic)}
                      disabled={loading}
                      className="w-full text-left p-3 bg-white text-amber-900 rounded-xl text-[10px] font-black border border-amber-200 hover:border-amber-400 hover:shadow-md transition-all flex items-center justify-between group"
                    >
                      <span className="truncate">{topic}</span>
                      <Zap size={10} className="text-amber-400 group-hover:text-amber-600 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Create Input */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">New Specialist Search</label>
            <div className="relative">
              <input 
                value={createTopic}
                onChange={(e) => setCreateTopic(e.target.value)}
                placeholder="Topic: 1920s architecture..."
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 pr-12 transition-all outline-none shadow-sm placeholder:italic"
                onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
              />
              <button 
                onClick={() => handleResearch()}
                disabled={loading || !createTopic}
                className={`absolute right-2 top-2 p-1.5 rounded-lg disabled:opacity-50 transition-all shadow-md ${isDeep ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-900 hover:bg-slate-800'} text-white`}
              >
                {loading ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" 
                  />
                ) : <Zap size={14} className="fill-white" />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
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
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedNote?.id === note.id ? 'bg-blue-600' : (note.isDeepResearch ? 'bg-blue-400' : 'bg-slate-300')}`} />
                    <div className="font-bold text-sm truncate text-slate-900">{note.title}</div>
                    {note.isDeepResearch && <Globe size={10} className="text-blue-500 ml-auto" />}
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
                      <div className={`w-1.5 h-1.5 rounded-full ${selectedNote?.id === note.id ? 'bg-blue-600' : (note.isDeepResearch ? 'bg-blue-400' : 'bg-slate-300')}`} />
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
              className="p-4 md:p-10 space-y-8 md:space-y-10 overflow-y-auto flex-1 custom-scrollbar"
            >
              <header className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4">
                <div className="text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center gap-3 mb-2">
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 italic font-serif leading-none">{selectedNote.title}</h3>
                    {selectedNote.isDeepResearch && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded-full border border-blue-100">
                        Deep Focus
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Book size={14} className="text-blue-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{selectedNote.category}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Tags size={14} className="text-slate-300" />
                      <div className="flex gap-2">
                        {(Array.isArray(selectedNote.tags) ? selectedNote.tags : []).map(tag => (
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

              {/* Sensory Details Section */}
              {selectedNote.sensoryDetails && (
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-8 border-b border-slate-100">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye size={12} className="text-blue-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Visuals</span>
                    </div>
                    <div className="space-y-1">
                      {selectedNote.sensoryDetails.visuals?.map((v, i) => (
                        <div key={i} className="text-[10px] font-medium text-slate-600 leading-tight">• {v}</div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Headphones size={12} className="text-emerald-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sounds</span>
                    </div>
                    <div className="space-y-1">
                      {selectedNote.sensoryDetails.sounds?.map((v, i) => (
                        <div key={i} className="text-[10px] font-medium text-slate-600 leading-tight">• {v}</div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Wind size={12} className="text-amber-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Smells</span>
                    </div>
                    <div className="space-y-1">
                      {selectedNote.sensoryDetails.smells?.map((v, i) => (
                        <div key={i} className="text-[10px] font-medium text-slate-600 leading-tight">• {v}</div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Hand size={12} className="text-purple-500" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Textures</span>
                    </div>
                    <div className="space-y-1">
                      {selectedNote.sensoryDetails.textures?.map((v, i) => (
                        <div key={i} className="text-[10px] font-medium text-slate-600 leading-tight">• {v}</div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              <div className="prose prose-slate prose-sm max-w-none prose-headings:font-serif prose-headings:italic prose-p:leading-relaxed text-slate-600">
                <Markdown>{selectedNote.content}</Markdown>
              </div>

              {selectedNote.sources && selectedNote.sources.length > 0 && (
                <footer className="pt-8 border-t border-slate-100">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Verified Sources</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedNote.sources.map((src, i) => (
                      <div key={i} className="text-[10px] text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
                        <Globe size={10} className="mt-0.5 text-slate-300" /> {src}
                      </div>
                    ))}
                  </div>
                </footer>
              )}
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-slate-200">
              <Library size={64} strokeWidth={1} className="opacity-10 text-slate-900" />
              <div className="max-w-xs">
                <p className="text-lg font-bold text-slate-400">Archive Ready</p>
                <p className="text-xs text-slate-300 font-medium italic">Select a research note or initialize a new search to expand your foundation.</p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
