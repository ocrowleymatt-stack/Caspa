/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { PenTool, Plus, Zap, MessageSquare, BookOpen, Trash2, ChevronRight, FileText, Tag, Users, Upload, X, ArrowRight, Search, Filter, Activity, Maximize2, Minimize2, Type, Flame } from 'lucide-react';
import { SourceMaterial, Project, Chapter, PlotNode, Presence, Critique, ViewType } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import Fuse from 'fuse.js';

interface Props {
  project: Project;
  plotNodes: PlotNode[];
  presence: Presence[];
  updateProject: (updates: Partial<Project>) => void;
  updateChapters: (chapters: Chapter[]) => void;
  setView: (view: ViewType) => void;
  upsertChapter?: (chapter: Chapter) => void;
  onDeleteChapter?: (id: string) => void;
  onUpsertSource: (source: SourceMaterial) => void;
  onDeleteSource: (id: string) => void;
  onError?: (message: string) => void;
}

export default function WritingStudio({ 
  project, 
  plotNodes, 
  presence, 
  updateProject, 
  updateChapters, 
  setView,
  upsertChapter, 
  onDeleteChapter, 
  onUpsertSource, 
  onDeleteSource,
  onError
}: Props) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [showCritique, setShowCritique] = useState(false);
  const [critiqueText, setCritiqueText] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [viewingSourceId, setViewingSourceId] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<'All' | 'Manuscript' | 'Research' | 'AI Compilation'>('All');

  const chapters = (project as any).chapters || [];
  
  // Auto-select first chapter if none selected and chapters load
  useEffect(() => {
    if (!selectedChapterId && chapters.length > 0) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  const selectedChapter = chapters.find((c: Chapter) => c.id === selectedChapterId);
  
  // Support both sourceMaterials and researchNotes in the viewer
  const allSources = useMemo(() => {
    const raw = [
      ...(project.sourceMaterials || []).map(s => ({
        ...s,
        displayType: s.name.startsWith('[MANUSCRIPT]') ? 'Manuscript' : (s.name.startsWith('[RESEARCH]') ? 'Research' : 'Research')
      })),
      ...(project.research || []).map((r: any) => ({
        id: r.id,
        name: `[RESEARCH] ${r.title}`,
        content: r.content,
        type: 'AI Compilation',
        displayType: 'AI Compilation'
      }))
    ];

    let filtered = raw;
    if (archiveFilter !== 'All') {
      filtered = filtered.filter(s => s.displayType === archiveFilter);
    }

    if (archiveSearchTerm.trim()) {
      const fuse = new Fuse(filtered, {
        keys: ['name', 'content'],
        threshold: 0.4
      });
      return fuse.search(archiveSearchTerm).map(result => result.item);
    }

    return filtered;
  }, [project.sourceMaterials, project.research, archiveSearchTerm, archiveFilter]);
  const viewingSource = allSources.find(s => s.id === viewingSourceId);
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
    if (upsertChapter) upsertChapter(newChapter);
    setSelectedChapterId(newChapter.id);
  };

  const [localTitle, setLocalTitle] = useState(selectedChapter?.title || '');
  const [localSummary, setLocalSummary] = useState(selectedChapter?.summary || '');
  const [localContent, setLocalContent] = useState(selectedChapter?.content || '');

  // Synchronize local state when chapter content OR selection changes from external sources (like AI Spark)
  useEffect(() => {
    if (selectedChapter) {
      setLocalTitle(selectedChapter.title);
      setLocalSummary(selectedChapter.summary);
      setLocalContent(selectedChapter.content);
    }
  }, [selectedChapterId, selectedChapter?.content, selectedChapter?.title, selectedChapter?.summary]);

  // Debug source materials loading
  useEffect(() => {
    if (project.sourceMaterials && project.sourceMaterials.length > 0) {
      console.log(`Writing Studio loaded ${project.sourceMaterials.length} source materials.`);
    }
  }, [project.sourceMaterials]);

  const updateChapter = (id: string, updates: Partial<Chapter>) => {
    const existing = chapters.find((c: Chapter) => c.id === id);
    if (!existing) return;
    const newChapter = { ...existing, ...updates };
    updateChapters(chapters.map((c: Chapter) => c.id === id ? newChapter : c));
    if (upsertChapter) upsertChapter(newChapter);
  };

  const updateChapterRef = useRef(updateChapter);
  useEffect(() => {
    updateChapterRef.current = updateChapter;
  }, [updateChapter]);

  // Debounce updates to parent
  useEffect(() => {
    if (!selectedChapterId) return;
    const timer = setTimeout(() => {
       // We only update if something actually changed from what is currently saved
       updateChapterRef.current(selectedChapterId, { 
         title: localTitle, 
         summary: localSummary, 
         content: localContent 
       });
    }, 800);
    return () => clearTimeout(timer);
  }, [localTitle, localSummary, localContent, selectedChapterId]);

  const deleteChapter = (id: string) => {
    updateChapters(chapters.filter((c: Chapter) => c.id !== id));
    if (onDeleteChapter) onDeleteChapter(id);
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

  const handleRefine = async () => {
    if (!selectedChapter || !selectedChapter.content.trim()) return;
    setIsRefining(true);
    try {
      const earlierContent = (chapters || [])
        .filter((c: Chapter) => c.order < selectedChapter.order)
        .map((c: Chapter) => c.content)
        .join('\n\n')
        .slice(-3000);

      const activeNodes = plotNodes.filter(n => selectedChapter.plotNodeIds?.includes(n.id));

      const refined = await AIService.deepSimmer(
        selectedChapter,
        earlierContent,
        project.type,
        activeNodes,
        project.maturity,
        project.sourceMaterials || []
      );
      updateChapter(selectedChapter.id, { content: refined });
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Deep Simmer failed.');
    } finally {
      setIsRefining(false);
    }
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
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Composition Core failed to initialize.');
    } finally {
      setIsWriting(false);
    }
  };

  const handleCritique = async () => {
    if (!selectedChapter?.content) return;
    setIsCritiquing(true);
    setShowCritique(true);
    try {
      const earlierChapters = chapters.filter((c: Chapter) => c.order < selectedChapter.order);
      const earlierContent = earlierChapters.map((c: Chapter) => `[CHAPTER ${c.order + 1}: ${c.title}]\n${c.content.slice(0, 500)}`).join('\n\n');
      
      const prompt = `You are an elite narrative consultant. Analyze the following chapter draft. Determine if it aligns with the character and plot structure. Provide a concise critique and then a clear list of actionable suggestions for improvement.
      
      [CHAPTER: ${selectedChapter.title}]
      [SUMMARY: ${selectedChapter.summary}]
      
      [EARLIER CONTEXT]: 
      ${earlierContent}
      
      [CURRENT DRAFT]:
      ${selectedChapter.content}
      
      Return your analysis as a JSON object with:
      "content": "A paragraph of deep analysis",
      "suggestions": ["suggestion 1", "suggestion 2", ...]
      `;
      
      const responseText = await AIService.callAI({ prompt, json: true });
      const data = JSON.parse(responseText || "{}");
      
      setCritiqueText(data.content || "No major issues identified.");

      // Persist to project state
      const newCritique: Critique = {
        id: crypto.randomUUID(),
        agentName: 'Narrative Sync',
        role: 'structural',
        content: data.content || "Analysis complete.",
        severity: 'medium',
        suggestions: (data.suggestions || []).map((s: string) => ({ text: s }))
      };
      
      const currentMap = project.critiques || {};
      const chapterCritiques = currentMap[selectedChapter.id] || [];
      
      updateProject({
        critiques: {
          ...currentMap,
          [selectedChapter.id]: [newCritique, ...chapterCritiques].slice(0, 10)
        }
      });
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Narrative Sync Analysis failed.');
    } finally {
      setIsCritiquing(false);
    }
  };

  const applySuggestionsToChapter = () => {
    if (!selectedChapter) return;
    const currentCritiques = (project.critiques || {})[selectedChapter.id] || [];
    const latestCritique = currentCritiques[0];
    if (!latestCritique) return;

    const acceptedSuggestions = latestCritique.suggestions
      .filter(s => s.accepted !== false) // Default to accepted if not explicitly rejected for this simple "apply all"
      .map(s => s.text);
    
    if (acceptedSuggestions.length === 0) return;

    const updatedChapters = chapters.map(chap => {
      if (chap.id === selectedChapter.id) {
        const currentDirectives = chap.directives || [];
        const newDirectives = [...currentDirectives];
        acceptedSuggestions.forEach(s => {
          if (!newDirectives.includes(s)) newDirectives.push(s);
        });
        return { ...chap, directives: newDirectives };
      }
      return chap;
    });
    
    updateChapters(updatedChapters);
    setView('architect'); // Redirect to auto-draft
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      if (file.size > 1024 * 1024) {
        onError?.(`File ${file.name} is too large (max 1MB). Firestore limit reached.`);
        return;
      }
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

  const wordCount = useMemo(() => {
    return localContent.trim() ? localContent.trim().split(/\s+/).length : 0;
  }, [localContent]);

  const readingTime = useMemo(() => {
    return Math.ceil(wordCount / 200);
  }, [wordCount]);

  return (
    <div className={`h-full flex flex-col lg:flex-row gap-0 relative overflow-hidden ${isFocusMode ? 'bg-white' : 'bg-slate-50'}`}>
      {/* Sidebar: Combined Rail */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarVisible && !isFocusMode ? (isMobile ? '100%' : 320) : 0,
          x: isSidebarVisible && !isFocusMode ? 0 : (isMobile ? '-100%' : -320)
        }}
        className={`border-r border-slate-200 bg-white flex flex-col shadow-sm z-20 h-full overflow-hidden ${isMobile ? 'absolute inset-y-0 left-0 shadow-2xl' : 'relative'}`}
      >
        {/* Manuscript Section */}
        <div className="flex-none p-6 border-b border-slate-100 relative">
          {isMobile && (
            <button 
              onClick={() => setIsSidebarVisible(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full transition-all md:hidden"
            >
              <X size={16} />
            </button>
          )}
          <div className="flex items-center justify-between mb-4 pr-10">
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
                  accept=".txt,.md,.json,.yaml,.yml" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1024 * 1024) {
                      onError?.(`File ${file.name} is too large (max 1MB).`);
                      return;
                    }
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
                      if (upsertChapter) upsertChapter(newChapter);
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
          <div className="space-y-1 max-h-[30%] overflow-y-auto custom-scrollbar pr-1">
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
              Archives
            </h3>
            <label className="p-1.5 hover:bg-slate-50 text-blue-600 rounded-lg transition-all cursor-pointer" title="Upload Source">
              <Plus size={18} />
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.json,.yaml,.yml" multiple />
            </label>
          </div>

          {/* Search and Filter UI */}
          <div className="space-y-3">
            <div className="relative group">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Fuzzy search archives..." 
                value={archiveSearchTerm}
                onChange={(e) => setArchiveSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-8 pr-4 text-[10px] font-medium text-slate-600 focus:ring-1 focus:ring-blue-100 outline-none placeholder:text-slate-200 transition-all shadow-sm"
              />
            </div>
            
            <div className="flex flex-wrap gap-1">
              {(['All', 'Manuscript', 'Research', 'AI Compilation'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setArchiveFilter(type)}
                  className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${
                    archiveFilter === type 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
            {allSources.length > 0 ? (
              <div className="space-y-2">
                {allSources.map(source => (
                  <div 
                    key={source.id} 
                    onClick={() => {
                      setViewingSourceId(source.id);
                      if (isMobile) setIsSidebarVisible(false);
                    }}
                    className="p-3 bg-white rounded-xl border border-slate-100 group relative cursor-pointer hover:border-blue-200 transition-colors shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {(source as any).displayType === 'AI Compilation' ? (
                          <Zap className="text-blue-600 fill-blue-600 shrink-0" size={14} />
                        ) : (
                          <FileText className="text-blue-500 shrink-0" size={14} />
                        )}
                        <span className="text-[10px] font-black text-slate-900 uppercase truncate pr-4">{source.name}</span>
                      </div>
                      <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0 ${
                        (source as any).displayType === 'Manuscript' ? 'bg-orange-50 text-orange-600' :
                        (source as any).displayType === 'AI Compilation' ? 'bg-blue-50 text-blue-600' :
                        'bg-slate-50 text-slate-500'
                      }`}>
                        {(source as any).displayType}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium line-clamp-1 italic font-serif">
                      {source.content.slice(0, 60)}...
                    </p>
                    {(source as any).displayType !== 'AI Compilation' && (source as any).displayType !== 'Research' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSource(source.id);
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all bg-white"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-200">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-dashed border-slate-200">
                  {archiveSearchTerm ? <Search size={20} className="text-slate-200" /> : <Upload size={20} className="text-slate-300" />}
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest leading-loose">
                  {archiveSearchTerm ? 'No matches found' : 'Upload Research\nor Manuscripts'}
                </p>
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
              <div className={`h-14 border-b border-slate-200 flex items-center justify-between px-4 md:px-8 bg-white/80 backdrop-blur-sm shadow-sm flex-none transition-all ${isFocusMode ? 'opacity-20 hover:opacity-100' : ''}`}>
                <div className="flex items-center gap-4">
                  {!isFocusMode && (
                    <button 
                      onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                      className="p-1.5 hover:bg-slate-50 text-slate-400 rounded-lg hidden lg:block"
                    >
                      <ChevronRight size={18} className={isSidebarVisible ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                  )}
                  <input 
                    value={localTitle}
                    onChange={(e) => setLocalTitle(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 font-bold text-slate-900 text-sm italic font-serif"
                  />
                  <div className="hidden sm:flex items-center gap-4 ml-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-300 uppercase leading-none tracking-tighter">Words</span>
                      <span className="text-[10px] font-black text-blue-600">{wordCount}</span>
                    </div>
                    <div className="flex flex-col border-l border-slate-100 pl-4">
                      <span className="text-[10px] font-black text-slate-300 uppercase leading-none tracking-tighter">Read</span>
                      <span className="text-[10px] font-black text-slate-500">{readingTime}m</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar md:overflow-visible pb-1 md:pb-0">
                  <button 
                    onClick={() => setIsFocusMode(!isFocusMode)}
                    className={`p-2 rounded-lg transition-all shrink-0 ${isFocusMode ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-900'}`}
                    title="Toggle Focus Mode"
                  >
                    {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>

                  <div className="h-4 w-px bg-slate-200 shrink-0 hidden md:block" />

                  {/* Plot Node Tags */}
                  <div className="relative shrink-0">
                    <button 
                      onClick={() => setShowNodePicker(!showNodePicker)}
                      className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-[0.15em] px-2"
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
                          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4">Meta-Tag Scene</h4>
                          <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                            {plotNodes.map(node => (
                              <button
                                key={node.id}
                                onClick={() => toggleNode(node.id)}
                                className={`w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between group transition-colors ${
                                  selectedChapter.plotNodeIds?.includes(node.id) 
                                    ? 'bg-slate-900 text-white' 
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

                  <div className="h-4 w-px bg-slate-200 shrink-0" />

                  <button 
                    onClick={handleSmartWrite}
                    disabled={isWriting}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 border rounded-full text-[10px] font-bold transition-all uppercase tracking-[0.15em] shrink-0 ${
                      isWriting ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    {isWriting ? (
                      <>
                        <Activity size={12} className="animate-pulse" />
                        Synthesizing...
                      </>
                    ) : (
                      <>
                        <Zap size={12} className="fill-slate-900" />
                        Compose
                      </>
                    )}
                  </button>

                  <button 
                    onClick={handleRefine}
                    disabled={isRefining || !selectedChapter.content.trim()}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-[10px] font-bold transition-all shadow-md uppercase tracking-[0.15em] shrink-0 ${
                      isRefining ? 'bg-orange-600 text-white' : 'bg-slate-900 hover:bg-black text-white'
                    }`}
                    title="Deep Quality Refinement"
                  >
                    {isRefining ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                        Simmering...
                      </>
                    ) : (
                      <>
                        <Activity size={12} />
                        Refine
                      </>
                    )}
                  </button>

                  <button 
                    onClick={handleCritique}
                    disabled={isCritiquing}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 border rounded-full text-[10px] font-bold transition-all uppercase tracking-[0.15em] shrink-0 ${
                      isCritiquing ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                     {isCritiquing ? (
                       <>
                        <div className="w-3 h-3 border-2 border-indigo-600/30 border-t-indigo-600 animate-spin rounded-full" />
                        Critiquing...
                       </>
                     ) : (
                       <>
                        <MessageSquare size={12} />
                        Critique
                       </>
                     )}
                  </button>
                </div>
              </div>

              {/* Editor Split */}
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col p-8 md:p-20 lg:p-32 overflow-y-auto w-full custom-scrollbar relative bg-surface-bg items-center">
                   {/* Summary Box */}
                  <div className="max-w-[75ch] w-full mb-16 opacity-50 focus-within:opacity-100 transition-opacity duration-500">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-[0.2em] pl-1 font-sans">
                      <FileText size={12} className="text-slate-400" />
                      Chapter Architecture
                    </div>
                    <textarea 
                      value={localSummary}
                      onChange={(e) => setLocalSummary(e.target.value)}
                      placeholder="Define the chapter objectives and emotional beats..."
                      className="w-full bg-transparent border-t border-b border-slate-200/50 py-4 text-slate-600 text-sm md:text-base resize-none focus:ring-0 outline-none placeholder:text-slate-300 leading-relaxed font-serif italic"
                      rows={2}
                    />
                  </div>
 
                  {/* Writing Area */}
                  <textarea 
                    value={localContent}
                    onChange={(e) => setLocalContent(e.target.value)}
                    placeholder="Begin the chapter..."
                    className="max-w-[75ch] w-full flex-1 bg-transparent border-none focus:ring-0 text-xl md:text-2xl text-slate-800 leading-[1.8] resize-none outline-none font-serif placeholder:text-slate-300 min-h-[500px]"
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
                      className="border-l border-slate-200 bg-white flex flex-col overflow-hidden shadow-2xl h-full"
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
                          <div className="space-y-8">
                            <div className="prose prose-slate prose-sm max-w-none text-slate-600 prose-strong:text-slate-900 prose-headings:text-slate-900 prose-headings:font-bold prose-p:leading-relaxed border-b border-slate-100 pb-8">
                              <Markdown>{critiqueText}</Markdown>
                            </div>

                            {/* Suggestions directly in the view */}
                            {(project.critiques || {})[selectedChapter.id]?.[0]?.suggestions.length > 0 && (
                              <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actionable Improvements</h4>
                                <div className="space-y-3">
                                  {(project.critiques || {})[selectedChapter.id][0].suggestions.map((s: any, idx: number) => (
                                    <div key={idx} className="flex gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                      <span className="font-black text-blue-600">{idx + 1}</span>
                                      <p>{s.text}</p>
                                    </div>
                                  ))}
                                </div>
                                <button 
                                  onClick={applySuggestionsToChapter}
                                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 mt-6 flex items-center justify-center gap-2"
                                >
                                  <Flame size={14} className="text-orange-500" />
                                  Apply & Auto-Redraft
                                </button>
                              </div>
                            )}
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
