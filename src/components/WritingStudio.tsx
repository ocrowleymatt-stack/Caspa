/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { PenTool, Plus, Zap, MessageSquare, BookOpen, Trash2, ChevronRight, FileText, Tag, Users, Upload, X, ArrowRight } from 'lucide-react';
import { SourceMaterial, Project, Chapter, PlotNode, Presence } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  project: Project;
  plotNodes: PlotNode[];
  presence: Presence[];
  updateProject: (updates: Partial<Project>) => void;
  updateChapters: (chapters: Chapter[]) => void;
  onUpsertSource: (source: SourceMaterial) => void;
  onDeleteSource: (id: string) => void;
}

export default function WritingStudio({ project, plotNodes, presence, updateProject, updateChapters, onUpsertSource, onDeleteSource }: Props) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [showCritique, setShowCritique] = useState(false);
  const [critiqueText, setCritiqueText] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [viewingSourceId, setViewingSourceId] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const chapters = (project as any).chapters || [];
  
  // Auto-select first chapter if none selected and chapters load
  useEffect(() => {
    if (!selectedChapterId && chapters.length > 0) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  const selectedChapter = chapters.find((c: Chapter) => c.id === selectedChapterId);
  const viewingSource = project.sourceMaterials?.find(s => s.id === viewingSourceId);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isMobile) setIsSidebarVisible(false);
    else setIsSidebarVisible(true);
  }, [isMobile]);

  const addChapter = () => {
    const newChapter: Chapter = {
      id: crypto.randomUUID(),
      title: `Chapter ${chapters.length + 1}`,
      summary: '',
      content: '',
      order: chapters.length,
      plotNodeIds: [],
      tags: [],
      updatedAt: Date.now()
    };
    updateChapters([...chapters, newChapter]);
    setSelectedChapterId(newChapter.id);
  };

  const [localTitle, setLocalTitle] = useState(selectedChapter?.title || '');
  const [localSummary, setLocalSummary] = useState(selectedChapter?.summary || '');
  const [localContent, setLocalContent] = useState(selectedChapter?.content || '');

  // Synchronize local state when chapter selection changes
  useEffect(() => {
    if (selectedChapter) {
      setLocalTitle(selectedChapter.title);
      setLocalSummary(selectedChapter.summary);
      setLocalContent(selectedChapter.content);
    }
  }, [selectedChapterId]);

  // Debounce updates to parent
  useEffect(() => {
    if (!selectedChapter) return;
    const timer = setTimeout(() => {
      if (localTitle !== selectedChapter.title || 
          localSummary !== selectedChapter.summary || 
          localContent !== selectedChapter.content) {
        updateChapter(selectedChapter.id, { 
          title: localTitle, 
          summary: localSummary, 
          content: localContent 
        });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localTitle, localSummary, localContent, selectedChapter]);

  const updateChapter = (id: string, updates: Partial<Chapter>) => {
    updateChapters(chapters.map((c: Chapter) => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteChapter = (id: string) => {
    updateChapters(chapters.filter((c: Chapter) => c.id !== id));
    if (selectedChapterId === id) setSelectedChapterId(chapters[0]?.id || null);
  };

  const moveChapterToSource = (chapter: Chapter) => {
    const newSource: SourceMaterial = {
      id: crypto.randomUUID(),
      name: `[MANUSCRIPT] ${chapter.title}`,
      content: chapter.content,
      type: 'text/markdown'
    };
    onUpsertSource(newSource);
  };

  const toggleNode = (nodeId: string) => {
    if (!selectedChapter) return;
    const currentNodes = selectedChapter.plotNodeIds || [];
    const newNodes = currentNodes.includes(nodeId)
      ? currentNodes.filter(id => id !== nodeId)
      : [...currentNodes, nodeId];
    updateChapter(selectedChapter.id, { plotNodeIds: newNodes });
  };

  const handleSmartWrite = async () => {
    if (!selectedChapter) return;
    setIsWriting(true);
    try {
      const earlierContent = chapters
        .filter((c: Chapter) => c.order < selectedChapter.order)
        .map((c: Chapter) => c.content)
        .join('\n\n')
        .slice(-3000);

      const activeNodes = plotNodes.filter(n => selectedChapter.plotNodeIds?.includes(n.id));

      const content = await AIService.writeDraft(
        selectedChapter.title, 
        selectedChapter.summary, 
        earlierContent, 
        project.type,
        activeNodes,
        project.maturity,
        project.sourceMaterials || []
      );
      updateChapter(selectedChapter.id, { content: (selectedChapter.content + '\n\n' + content).trim() });
    } catch (err) {
      console.error(err);
    } finally {
      setIsWriting(false);
    }
  };

  const handleCritique = async () => {
    if (!selectedChapter?.content) return;
    setIsCritiquing(true);
    setShowCritique(true);
    try {
      const feedback = await AIService.critique(selectedChapter.content);
      setCritiqueText(feedback);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCritiquing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const newSource: SourceMaterial = {
            id: crypto.randomUUID(),
            name: file.name,
            content: content,
            type: file.type || 'text/plain',
            updatedAt: Date.now()
          };
          onUpsertSource(newSource);
        } catch (err) {
          console.error("Error processing file:", file.name, err);
        }
      };
      reader.onerror = () => {
        console.error("Error reading file:", file.name);
      };
      reader.readAsText(file);
    });
    
    // Reset input so same file can be uploaded again
    e.target.value = '';
  };

  const removeSource = (id: string) => {
    onDeleteSource(id);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-0 -m-4 md:-m-8 relative overflow-hidden">
      {/* Sidebar: Combined Rail */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarVisible ? (isMobile ? '100%' : 320) : 0,
          x: isSidebarVisible ? 0 : -320
        }}
        className="border-r border-slate-200 bg-white flex flex-col shadow-sm relative z-20 h-full overflow-hidden"
      >
        {/* Manuscript Section */}
        <div className="flex-none p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <BookOpen size={14} className="text-blue-600" />
              Manuscript
            </h3>
            <div className="flex gap-1">
              <label className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-blue-600 rounded-lg transition-all cursor-pointer" title="Import Chapter">
                <Upload size={16} />
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".txt,.md" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = event.target?.result as string;
                      const newChapter: Chapter = {
                        id: crypto.randomUUID(),
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        summary: 'Imported manuscript segment.',
                        content: content,
                        order: chapters.length,
                        plotNodeIds: [],
                        tags: [],
                        updatedAt: Date.now()
                      };
                      updateChapters([...chapters, newChapter]);
                      setSelectedChapterId(newChapter.id);
                    };
                    reader.readAsText(file);
                  }} 
                />
              </label>
              <button 
                onClick={addChapter}
                className="p-1.5 hover:bg-slate-50 text-blue-600 rounded-lg transition-all"
                title="New Chapter"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {chapters.map((chapter: Chapter) => (
              <div key={chapter.id} className="group relative">
                <button
                  onClick={() => {
                    setSelectedChapterId(chapter.id);
                    if (isMobile) setIsSidebarVisible(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                    selectedChapterId === chapter.id 
                      ? 'bg-blue-50 text-blue-900 border border-blue-100 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <span className="text-[10px] font-black opacity-40 uppercase">CH{chapter.order + 1}</span>
                  <span className="text-xs font-bold truncate flex-1">{chapter.title}</span>
                </button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-all bg-white/90 backdrop-blur-sm rounded-lg pr-2">
                  <button 
                    onClick={() => moveChapterToSource(chapter)}
                    className="p-2 text-slate-300 hover:text-blue-500 transition-all"
                    title="Move to Source"
                  >
                    <ArrowRight size={12} />
                  </button>
                  <button 
                    onClick={() => deleteChapter(chapter.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Ingestion Section */}
        <div className="p-6 flex-1 flex flex-col gap-4 overflow-hidden bg-slate-50/30">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Upload size={14} className="text-blue-600" />
              Source Ingestion
            </h3>
            <label className="p-1.5 hover:bg-slate-50 text-blue-600 rounded-lg transition-all cursor-pointer">
              <Plus size={18} />
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.json" multiple />
            </label>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
            {project.sourceMaterials?.map(source => (
              <div 
                key={source.id} 
                onClick={() => {
                  setViewingSourceId(source.id);
                  if (isMobile) setIsSidebarVisible(false);
                }}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group relative cursor-pointer hover:border-blue-200 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="text-blue-500" size={16} />
                  <span className="text-[10px] font-black text-slate-900 uppercase truncate pr-4">{source.name}</span>
                </div>
                <p className="text-[9px] text-slate-400 font-medium line-clamp-2 italic font-serif">
                  {source.content.slice(0, 100)}...
                </p>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSource(source.id);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {(!project.sourceMaterials || project.sourceMaterials.length === 0) && (
              <div className="py-12 text-center text-slate-200">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-dashed border-slate-200">
                  <Upload size={20} className="text-slate-300" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest leading-loose">Upload Research<br/>or Manuscripts</p>
              </div>
            )}
          </div>
        </div>

        {/* Collaborative Presence */}
        {presence.length > 0 && (
          <div className="p-6 border-t border-slate-100 bg-slate-50/50">
            <div className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2">
              <Users size={12} />
              Architects Live
            </div>
            <div className="flex -space-x-2">
              {presence.map((p) => (
                <div 
                  key={p.userId} 
                  title={p.userName}
                  className="w-8 h-8 rounded-full border-2 border-white bg-slate-900 text-white flex items-center justify-center text-[10px] font-black shadow-lg"
                >
                  {p.userName.charAt(0)}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.aside>

      {/* Sidebar Toggle for Mobile/Compact */}
      {!isSidebarVisible && (
        <button 
          onClick={() => setIsSidebarVisible(true)}
          className="lg:hidden fixed bottom-6 left-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-[51]"
        >
          <BookOpen size={24} />
        </button>
      )}

      {/* Main Study Area */}
      <div className="flex-1 flex flex-col bg-slate-50 relative z-0 min-w-0">
        <AnimatePresence mode="wait">
          {selectedChapter ? (
            <motion.div 
              key={selectedChapter.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Internal Editor Header */}
              <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 md:px-8 bg-white/80 backdrop-blur-sm shadow-sm flex-none">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                    className="p-1.5 hover:bg-slate-50 text-slate-400 rounded-lg hidden lg:block"
                  >
                    <ChevronRight size={18} className={isSidebarVisible ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>
                  <input 
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 font-bold text-slate-900 text-sm italic font-serif"
                  />
                </div>
                <div className="flex items-center gap-4">
                  {/* Plot Node Tags */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowNodePicker(!showNodePicker)}
                      className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest"
                    >
                      <Tag size={12} />
                      {selectedChapter.plotNodeIds?.length || 0} Nodes
                    </button>
                    <AnimatePresence>
                      {showNodePicker && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-4"
                        >
                          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Meta-Tag Scene</h4>
                          <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                            {plotNodes.map(node => (
                              <button
                                key={node.id}
                                onClick={() => toggleNode(node.id)}
                                className={`w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between group transition-colors ${
                                  selectedChapter.plotNodeIds?.includes(node.id) 
                                    ? 'bg-blue-50 text-blue-700' 
                                    : 'text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {node.title}
                                {selectedChapter.plotNodeIds?.includes(node.id) && <Zap size={10} className="fill-current" />}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="h-4 w-px bg-slate-200" />

                  <button 
                    onClick={handleSmartWrite}
                    disabled={isWriting}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold transition-all shadow-md shadow-blue-50 uppercase tracking-widest"
                  >
                    {isWriting ? <div className="w-3 h-3 border border-white border-t-transparent animate-spin rounded-full" /> : <Zap size={14} className="fill-white" />}
                    SMART SPARK
                  </button>
                  <button 
                    onClick={handleCritique}
                    disabled={isCritiquing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold transition-all shadow-md uppercase tracking-widest"
                  >
                     {isCritiquing ? <div className="w-3 h-3 border border-white border-t-transparent animate-spin rounded-full" /> : <MessageSquare size={14} />}
                    Critique
                  </button>
                </div>
              </div>

              {/* Editor Split */}
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col p-12 overflow-y-auto custom-scrollbar relative bg-white m-6 rounded-xl border border-slate-200 shadow-sm">
                   {/* Summary Box */}
                  <div className="max-w-[70ch] mx-auto w-full mb-12">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 mb-2 uppercase tracking-[0.2em] pl-1">
                      <FileText size={12} className="text-blue-600" />
                      Scene Architecture
                    </div>
                    <textarea 
                      value={localSummary}
                      onChange={(e) => setLocalSummary(e.target.value)}
                      placeholder="Sequence objectives..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-lg p-4 text-slate-700 text-sm resize-none focus:ring-2 focus:ring-blue-100 focus:bg-white outline-none placeholder:opacity-30 leading-relaxed font-serif italic"
                    />
                  </div>
 
                  {/* Writing Area */}
                  <textarea 
                    value={localContent}
                    onChange={(e) => setLocalContent(e.target.value)}
                    placeholder="Begin the sequence..."
                    className="max-w-[70ch] mx-auto w-full flex-1 bg-transparent border-none focus:ring-0 text-xl text-slate-800 leading-[1.8] resize-none outline-none font-serif placeholder:text-slate-300 min-h-[500px]"
                    spellCheck={false}
                  />
                </div>

                {/* Critique Sidebar */}
                <AnimatePresence>
                  {showCritique && (
                    <motion.div 
                      key="critique"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 400, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="border-l border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xl"
                    >
                      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <h3 className="text-[10px] font-black text-slate-900 flex items-center gap-2 uppercase tracking-[0.2em]">
                          <Zap size={14} className="text-blue-600" />
                          Narrative Sync
                        </h3>
                        <button onClick={() => setShowCritique(false)} className="text-slate-300 hover:text-slate-900 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                        {isCritiquing ? (
                          <div className="h-full flex flex-col items-center justify-center gap-4 text-blue-600">
                             <motion.div 
                              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }}
                              transition={{ repeat: Infinity, duration: 1 }}
                              className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-md" 
                            />
                            <p className="text-[10px] font-black uppercase tracking-widest italic">Analyzing Manuscript...</p>
                          </div>
                        ) : (
                          <div className="prose prose-slate prose-sm max-w-none text-slate-600 prose-strong:text-slate-900 prose-headings:text-slate-900 prose-headings:font-bold prose-p:leading-relaxed">
                            <Markdown>{critiqueText}</Markdown>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 text-slate-200">
              <PenTool size={64} strokeWidth={1} className="opacity-10 text-slate-900" />
              <div className="max-w-xs space-y-2">
                <p className="text-lg font-bold text-slate-400">Manuscript Module Offline</p>
                <p className="text-xs text-slate-300 font-medium italic">Initialize a new sequence from the manuscript rail.</p>
                <button 
                  onClick={addChapter}
                  className="mt-6 px-6 py-2 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest shadow-sm"
                >
                  Create New Sequence
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Source Viewer Modal */}
      <AnimatePresence>
        {viewingSource && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-12 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl h-full rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">{viewingSource.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">{viewingSource.type}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingSourceId(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <div className="max-w-[70ch] mx-auto prose prose-slate prose-lg">
                  <div className="text-slate-800 leading-relaxed font-serif whitespace-pre-wrap">
                    {viewingSource.content}
                  </div>
                </div>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setViewingSourceId(null)}
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-lg"
                >
                  Close Archive
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
