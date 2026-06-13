import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Book, Globe, Sparkles, BrainCircuit, ListTree, 
  ChevronRight, ArrowRight, Microchip, Database, Info, 
  Eye, Headphones, Wind, Hand, Layers, RefreshCcw,
  Library, Trash2, Zap, AlertCircle, Upload, Plus, Check, Play, Square, FileText
} from 'lucide-react';
import { Project, ResearchNote, Chapter, SourceMaterial } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Props {
  project: Project;
  research: ResearchNote[];
  chapters: Chapter[];
  sourceMaterials: SourceMaterial[];
  onAddResearch: (note: ResearchNote) => void | Promise<void>;
  onDeleteResearch: (id: string) => void | Promise<void>;
  onAddChapter: (chapter: Chapter) => void | Promise<void>;
  onAddSource: (source: SourceMaterial) => void | Promise<void>;
  onDeleteSource: (id: string) => void | Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface TopicItem {
  topic: string;
  source: 'Seeded' | 'Scan' | 'Map' | 'Custom';
  priority: 'High' | 'Medium' | 'Low';
  selected: boolean;
  status: 'ready' | 'loading' | 'completed' | 'failed';
}

const getDefaultTopics = (project: Project): string[] => {
  const genre = (project.genre || '').toLowerCase();
  const title = project.title || 'the setting';

  const base = [
    `Sensory atmosphere and historical context of "${title}"`,
    `Atmospheric details: acoustics, olfactory marks, and light dynamics of this setting`
  ];

  if (genre.includes('sci') || genre.includes('future') || genre.includes('space') || genre.includes('speculative')) {
    base.push("Authentic physics, structural mechanics, and technical infrastructure of the era");
    base.push("Scientific terminology, future vernacular, and sensory life in enclosed environments");
  } else if (genre.includes('thrill') || genre.includes('detective') || genre.includes('mystery') || genre.includes('noir')) {
    base.push("Tactical gear, investigative nuances, forensic science, and state wiretap protocol");
    base.push("Underworld subcultures, psychological pressure points, and slang of modern syndicates");
  } else if (genre.includes('hist') || genre.includes('period') || genre.includes('past')) {
    base.push("Habits, linguistic registers, socio-economic classes, and period slang of the epoch");
    base.push("Domestic details: culinary habits, lighting apparatuses, and clothing fabrics of the century");
  } else if (genre.includes('fantas') || genre.includes('myth') || genre.includes('magic')) {
    base.push("Thermodynamic limits, rules, and physical consequences of the magical/mythic framework");
    base.push("Faction architectures, local folklore, cultural taboos, and currency structures");
  } else {
    base.push("Socio-environmental context: architectural markers, visual landmarks, and public dialogue patterns");
    base.push("Psychological subtext: clinical behaviors and internal blockages of driving personnel profiles");
  }

  return base;
};

export default function IntelligenceLab({ 
  project, 
  research, 
  chapters, 
  sourceMaterials,
  onAddResearch, 
  onDeleteResearch,
  onAddChapter, 
  onAddSource,
  onDeleteSource,
  onNotify 
}: Props) {
  const [activeStep, setActiveStep] = useState<'hub' | 'archive'>('hub');
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [customTopicInput, setCustomTopicInput] = useState('');
  
  // Console logs & telemetry state
  const [agentLogs, setAgentLogs] = useState<Array<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warning' }>>([]);
  const [isRunningResearch, setIsRunningResearch] = useState(false);
  
  // Drag and drop uploading state
  const [isDragging, setIsDragging] = useState(false);

  // Archive filtering & visualization state
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<'All' | 'Research' | 'Source'>('All');
  const [selectedArchiveItem, setSelectedArchiveItem] = useState<any | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setAgentLogs(prev => [
      { id: crypto.randomUUID(), time, text, type },
      ...prev
    ].slice(0, 100)); // cap logs at 100
  };

  // Seed default items on load
  useEffect(() => {
    if (project) {
      const seeded = getDefaultTopics(project).map(t => ({
        topic: t,
        source: 'Seeded' as const,
        priority: 'High' as const,
        selected: true,
        status: 'ready' as const
      }));
      setTopics(seeded);
      
      setAgentLogs([
        { 
          id: crypto.randomUUID(), 
          time: new Date().toLocaleTimeString(), 
          text: `Narrative core online: loaded Seeded Focus Modules for "${project.title}". Standing by to commission research.`, 
          type: 'info' 
        }
      ]);
    }
  }, [project.id]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agentLogs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>, filesToInjest?: File[]) => {
    const files = filesToInjest || Array.from((e.target as HTMLInputElement).files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) { 
        onNotify(`File ${file.name} is too large (max 15MB).`, 'error');
        continue;
      }

      onNotify(`Ingesting ${file.name}...`, 'info');
      try {
        let content = '';
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => (item as any).str).join(' ');
            fullText += pageText + '\n\n';
          }
          content = fullText;
        } else {
          content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
        }

        const CHUNK_SIZE = 400000;
        if (content.length > CHUNK_SIZE) {
          for (let i = 0; i < content.length; i += CHUNK_SIZE) {
            const chunk = content.substring(i, i + CHUNK_SIZE);
            const partNum = Math.floor(i / CHUNK_SIZE) + 1;
            const totalParts = Math.ceil(content.length / CHUNK_SIZE);
            const newSource: SourceMaterial = {
              id: crypto.randomUUID(),
              name: `${file.name} (Part ${partNum}/${totalParts})`,
              content: chunk,
              type: file.type || 'text/plain',
              updatedAt: Date.now()
            };
            await onAddSource(newSource);
          }
        } else {
          const newSource: SourceMaterial = {
            id: crypto.randomUUID(),
            name: file.name,
            content: content,
            type: file.type || 'text/plain',
            updatedAt: Date.now()
          };
          await onAddSource(newSource);
        }
        onNotify(`Successfully ingested ${file.name}`, 'success');
        addLog(`Source Document ingested directly: "${file.name}"`, 'success');
      } catch (err) {
        console.error("Error processing file:", file.name, err);
        onNotify(`Failed to process ${file.name}.`, 'error');
      }
    }
    
    if (e.target && 'value' in e.target) {
      (e.target as any).value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFileUpload(e, files);
    }
  };

  const runManuscriptScan = async () => {
    setLoading(true);
    addLog('Analyzing active manuscript chapters for narrative knowledge gaps...', 'info');
    try {
      const fullText = chapters.map(c => c.content).join('\n\n');
      if (!fullText.trim()) {
        addLog('Manuscript analysis stopped: Write or add drafts first.', 'warning');
        onNotify('Your manuscript lacks drafts. Populate some content first so the agent can discover gaps!', 'info');
        return;
      }
      const needs = await AIService.extractResearchNeeds(fullText, project.type);
      
      if (needs.length > 0) {
        setTopics(prev => {
          const existingTopics = prev.map(p => p.topic.toLowerCase());
          const uniqueNew = needs
            .filter(n => !existingTopics.includes(n.toLowerCase()))
            .map(n => ({
              topic: n,
              source: 'Scan' as const,
              priority: 'High' as const,
              selected: true,
              status: 'ready' as const
            }));
          return [...prev, ...uniqueNew];
        });
        addLog(`Manuscript Scan finished: Appended ${needs.length} knowledge gaps to target screen.`, 'success');
        onNotify(`Identified & added ${needs.length} knowledge gaps from draft.`, 'success');
      } else {
        addLog('Thematic scan complete: Current manuscript contains comprehensive scope coverage.', 'success');
        onNotify('No critical information gaps identified in standard review.', 'success');
      }
    } catch (e) {
      addLog('Thematic manuscript scan failed.', 'warning');
      onNotify('Scanning failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const runThematicMap = async () => {
    setLoading(true);
    addLog('Generating complete narrative graph representation & suggestions mapped to core metadata...', 'info');
    try {
      const data = await AIService.generateNarrativeGraph(project.title, project.genre, project.premise, project.type, research, sourceMaterials);
      const extractedTracks = data.researchTracks || [];
      if (extractedTracks.length > 0) {
        setTopics(prev => {
          const existingTopics = prev.map(p => p.topic.toLowerCase());
          const uniqueNew = extractedTracks
            .filter((t: any) => !existingTopics.includes(t.topic.toLowerCase()))
            .map((t: any) => ({
              topic: t.topic,
              source: 'Map' as const,
              priority: (t.priority || 'Medium') as 'High' | 'Medium' | 'Low',
              selected: true,
              status: 'ready' as const
            }));
          return [...prev, ...uniqueNew];
        });
        addLog(`Concept map unlocked: Discovered ${extractedTracks.length} high-fidelity elements to examine.`, 'success');
        onNotify(`Thematic roadmap mapped: Suggested ${extractedTracks.length} tracks.`, 'success');
      } else {
        addLog('Socio-thematic process completed. Roadmap satisfies outline.', 'info');
      }
    } catch (e) {
      addLog('Thematic Mapping failed.', 'warning');
      onNotify('Failed to query conceptual roadmaps.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addCustomTopic = () => {
    if (!customTopicInput.trim()) return;
    const clean = customTopicInput.trim();
    if (topics.some(t => t.topic.toLowerCase() === clean.toLowerCase())) {
      onNotify('Topic already in workspace.', 'info');
      return;
    }
    setTopics(prev => [
      ...prev,
      {
        topic: clean,
        source: 'Custom' as const,
        priority: 'High' as const,
        selected: true,
        status: 'ready' as const
      }
    ]);
    addLog(`Custom track registered: "${clean}"`, 'info');
    setCustomTopicInput('');
  };

  const toggleSelectAll = () => {
    const allSelected = topics.every(t => t.selected);
    setTopics(prev => prev.map(t => ({ ...t, selected: !allSelected })));
  };

  const toggleTopicSelection = (topicStr: string) => {
    setTopics(prev => prev.map(t => t.topic === topicStr ? { ...t, selected: !t.selected } : t));
  };

  const removeTopic = (topicStr: string) => {
    setTopics(prev => prev.filter(t => t.topic !== topicStr));
    addLog(`Thematic track purged: "${topicStr}"`);
  };

  const executeResearchSession = async () => {
    const selected = topics.filter(t => t.selected && t.status === 'ready');
    if (selected.length === 0) {
      onNotify('Select at least one idle topic to research.', 'info');
      return;
    }

    setIsRunningResearch(true);
    addLog(`COMMISSION ACTIVE: Launching search-grounded deep research agents for ${selected.length} topics...`, 'info');
    onNotify(`Deep agents deployed for ${selected.length} research projects.`, 'info');

    for (let i = 0; i < selected.length; i++) {
      if (!isRunningResearch && i > 0) break; // emergency halt if stopped externally
      const targetItem = selected[i];
      addLog(`[Agent Active ${i + 1}/${selected.length}] Running deep research on: "${targetItem.topic}"...`, 'info');
      
      setTopics(prev => prev.map(t => t.topic === targetItem.topic ? { ...t, status: 'loading' } : t));

      try {
        const context = `Genre focus: ${project.genre}. Title: ${project.title}. Premise: ${project.premise}. Type: ${project.type}`;
        // Query Gemini search agent
        const note = await AIService.compileResearch(targetItem.topic, context, project.type, true);
        
        await onAddResearch(note);
        
        addLog(`Synthesis complete: archived "${targetItem.topic}" (${note.content.split(/\s+/).length} words). Saved sensory cues.`, 'success');
        
        setTopics(prev => prev.map(t => t.topic === targetItem.topic ? { ...t, status: 'completed' } : t));
      } catch (err: any) {
        console.error(err);
        addLog(`Agent failure researching "${targetItem.topic}": ${err.message || 'System fault'}`, 'warning');
        setTopics(prev => prev.map(t => t.topic === targetItem.topic ? { ...t, status: 'failed' } : t));
      }

      if (i < selected.length - 1) {
        // Comfort margin between sequential completions
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setIsRunningResearch(false);
    addLog('Research Campaign Finalized. All retrieved evidence is locked directly in the Archive.', 'success');
    onNotify('Narrative elements archived successfully.', 'success');
    
    // Smooth navigation straight to Archive so user can look at results
    setTimeout(() => {
      setActiveStep('archive');
    }, 1500);
  };

  const allArchiveItems = [
    ...research.map(r => ({ ...r, displayType: 'Research' })),
    ...sourceMaterials.map(s => ({ ...s, displayType: 'Source' }))
  ].sort((a, b) => b.updatedAt - a.updatedAt);

  const filteredArchive = allArchiveItems.filter(item => {
    if (archiveFilter !== 'All' && item.displayType !== archiveFilter) return false;
    if (!archiveSearchTerm) return true;
    const term = archiveSearchTerm.toLowerCase();
    const searchable = `${('title' in item ? item.title : item.name)} ${item.content} ${('category' in item ? item.category : '')}`;
    return searchable.toLowerCase().includes(term);
  });

  return (
    <div className="h-full overflow-y-auto overscroll-contain custom-scrollbar px-2 pb-32" style={{ minHeight: 0 }}>
      <div className="max-w-6xl mx-auto py-3 md:py-1 md:px-2">
        <header className="mb-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full w-fit mb-1.5 border border-brand-primary/20">
            <BrainCircuit size={14} />
            <span className="text-xs font-semibold uppercase tracking-widest">Research Workspace</span>
          </div>
          <h1 className="text-[11px] font-semibold md:text-xs font-semibold font-semibold text-text-primary tracking-tighter italic font-serif">Intelligence Lab</h1>
          <p className="text-text-secondary max-w-2xl mt-2 font-medium text-[11px] md:text-md">
            Dictate custom themes, scan your drafts for missing details, or map conceptual structures. 
            Deployed search-grounded agents will synthesize answers and drop them straight into your persistent Archive.
          </p>
        </header>

        {/* Dynamic Navigation */}
        <div className="flex gap-2 mb-3 p-1 bg-surface-muted border border-border-subtle/50 rounded w-full md:w-fit overflow-x-auto">
          <button
            onClick={() => setActiveStep('hub')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-widest transition-all whitespace-nowrap flex-1 md:flex-none ${
              activeStep === 'hub' 
                ? 'btn-nexus-primary shadow-lg shadow-brand-primary/20' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            1. Research Hub
          </button>
          <button
            onClick={() => setActiveStep('archive')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-widest transition-all whitespace-nowrap flex-1 md:flex-none relative ${
              activeStep === 'archive' 
                ? 'btn-nexus-primary shadow-lg shadow-brand-primary/20' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            2. Evidence Archive
            {allArchiveItems.length > 0 && (
              <span className="absolute -top-1.5 -right-1 px-1.5 py-0.5 bg-brand-primary text-white font-mono text-[10px] rounded-full">
                {allArchiveItems.length}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5">
          {/* LEFT SIDE: Workspace or Archive based on Step */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {activeStep === 'hub' && (
                <motion.div 
                  key="hub-panel"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-2"
                >
                  {/* Research Entry Points */}
                  <div className="ethereal-panel p-3 rounded border border-border-subtle space-y-1.5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-text-primary flex items-center gap-2">
                        <ListTree size={16} className="text-brand-primary" /> Target Exploration List
                      </h3>
                      
                      <div className="flex gap-1.5">
                        <button 
                          onClick={toggleSelectAll}
                          className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest hover:text-brand-primary transition-all bg-surface-muted px-3 py-1.5 rounded border border-border-subtle hover:border-brand-primary/30"
                        >
                          {topics.every(t => t.selected) ? 'Deselect All' : 'Select All'}
                        </button>
                        <button 
                          onClick={() => setTopics([])}
                          className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest hover:text-red-500 transition-all bg-surface-muted px-3 py-1.5 rounded border border-border-subtle hover:border-red-500/25"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Input custom topic */}
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={customTopicInput}
                        onChange={(e) => setCustomTopicInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCustomTopic()}
                        placeholder="Add arbitrary theme (e.g., French café slang in 1920, diesel engines acoustics)..."
                        className="flex-grow bg-surface-muted border border-border-subtle rounded-md px-2 py-3 text-[11px] text-text-primary outline-none focus:border-brand-primary/60 transition-colors"
                      />
                      <button 
                        onClick={addCustomTopic}
                        className="px-2 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/20 transition-all rounded-md flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                      >
                        <Plus size={16} /> Add 
                      </button>
                    </div>

                    {/* Display of Topics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1 pt-1">
                      {topics.map((t, idx) => (
                        <div 
                          key={idx}
                          onClick={() => toggleTopicSelection(t.topic)}
                          className={`p-4 rounded-md border text-left cursor-pointer transition-all flex items-start gap-1.5 select-none relative group ${
                            t.selected 
                              ? 'border-brand-primary/50 bg-brand-primary/5 shadow-md shadow-brand-primary/5' 
                              : 'border-border-subtle bg-surface-muted hover:border-text-secondary/40'
                          }`}
                        >
                          <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            t.selected ? 'bg-brand-primary border-brand-primary text-white' : 'border-border-subtle bg-background'
                          }`}>
                            {t.selected && <Check size={10} strokeWidth={4} />}
                          </div>

                          <div className="flex-grow min-w-0 pr-6">
                            <p className={`text-xs font-medium leading-snug truncate ${t.selected ? 'text-text-primary' : 'text-text-secondary'}`}>
                              {t.topic}
                            </p>
                            <div className="flex gap-2 mt-1.5 items-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                t.source === 'Custom' ? 'bg-blue-500/15 text-blue-500' :
                                t.source === 'Scan' ? 'bg-yellow-500/15 text-yellow-500' :
                                t.source === 'Map' ? 'bg-indigo-500/15 text-indigo-500' : 'bg-brand-primary/15 text-brand-primary'
                              }`}>
                                {t.source}
                              </span>
                              
                              {t.status !== 'ready' && (
                                <span className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ${
                                  t.status === 'loading' ? 'text-brand-primary animate-pulse' :
                                  t.status === 'completed' ? 'text-emerald-500' : 'text-red-500'
                                }`}>
                                  ● {t.status}
                                </span>
                              )}
                            </div>
                          </div>

                          <button 
                            onClick={(e) => { e.stopPropagation(); removeTopic(t.topic); }}
                            className="absolute top-3 right-3 text-text-secondary/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}

                      {topics.length === 0 && (
                        <div className="col-span-2 text-center py-1 border border-dashed border-border-subtle rounded-md flex flex-col items-center justify-center text-text-secondary">
                          <Database size={32} className="opacity-35 mb-2" />
                          <p className="text-xs font-semibold uppercase tracking-wider">Workspace is empty</p>
                          <p className="text-xs mt-1 max-w-xs leading-normal">Seeding focus points, write some custom themes, or use the generator buttons down below to inflate the workspace.</p>
                        </div>
                      )}
                    </div>

                    {/* Automatic generator nodes */}
                    <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row gap-1.5">
                      <button 
                        onClick={runManuscriptScan}
                        disabled={loading}
                        className="flex-1 py-3 bg-surface-muted hover:bg-surface-neutral text-text-primary border border-border-subtle rounded-md font-semibold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:border-brand-primary/30 disabled:opacity-50"
                      >
                        <Search size={14} className="text-brand-primary" />
                        Scan Drafts for Missing Gaps
                      </button>
                      <button 
                        onClick={runThematicMap}
                        disabled={loading}
                        className="flex-1 py-3 bg-surface-muted hover:bg-surface-neutral text-text-primary border border-border-subtle rounded-md font-semibold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:border-brand-primary/30 disabled:opacity-50"
                      >
                        <Sparkles size={14} className="text-brand-primary" />
                        Map Genre Concepts & Roadmap
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeStep === 'archive' && (
                <motion.div 
                  key="archive-panel"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-2"
                >
                  {/* File Upload Zone */}
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 border rounded text-center cursor-pointer transition-all relative overflow-hidden ${
                      isDragging 
                        ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/20 scale-[0.99]' 
                        : 'border-dashed border-border-subtle bg-surface-muted hover:border-brand-primary/30'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileUpload} 
                      accept=".txt,.md,.json,.yaml,.yml,.pdf" 
                      multiple 
                    />
                    <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                        <Upload size={18} />
                      </div>
                      <h4 className="text-xs font-semibold uppercase tracking-widest text-text-primary">Ingest Reference Literature</h4>
                      <p className="text-xs text-text-secondary leading-relaxed font-medium">
                        Drag and drop your project briefs, historical documents, character profiles, or raw PDF/TXT materials up to 15MB. They will process directly to your Archive.
                      </p>
                    </div>
                  </div>

                  {/* Archive Directory Container */}
                  <div className="ethereal-panel p-3 rounded border border-border-subtle space-y-1.5">
                    {/* Filter and search */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 bg-surface-muted p-1 rounded-md w-fit border border-border-subtle/50">
                        {['All', 'Research', 'Source'].map(type => (
                          <button
                            key={type}
                            onClick={() => setArchiveFilter(type as any)}
                            className={`px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-widest transition-all ${
                              archiveFilter === type ? 'bg-brand-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>

                      <div className="relative flex-grow sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/60" size={14} />
                        <input 
                          value={archiveSearchTerm}
                          onChange={(e) => setArchiveSearchTerm(e.target.value)}
                          placeholder="Search evidence database..."
                          className="w-full bg-surface-muted border border-border-subtle rounded-md pl-9 pr-4 py-2 text-xs text-text-primary font-medium outline-none focus:border-brand-primary/50 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Master-Detail Partition Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      {/* Left: list items */}
                      <div className="md:col-span-5 space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                        {filteredArchive.map(item => {
                          const isSelected = selectedArchiveItem?.id === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setSelectedArchiveItem(item)}
                              className={`p-3.5 rounded-md border text-left cursor-pointer transition-all relative flex flex-col gap-1.5 ${
                                isSelected 
                                  ? 'bg-brand-primary/5 border-brand-primary shadow-sm' 
                                  : 'bg-surface-muted border-border-subtle hover:border-text-secondary/25'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="text-xs font-semibold text-text-primary truncate">{(item as any).title || (item as any).name}</h4>
                                <span className={`px-1 rounded text-[7px] font-semibold uppercase tracking-widest shrink-0 ${
                                  item.displayType === 'Source' ? 'bg-blue-500/10 text-blue-500' : 'bg-brand-primary/10 text-brand-primary'
                                }`}>
                                  {item.displayType}
                                </span>
                              </div>
                              <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed font-medium">
                                {item.content}
                              </p>
                              <span className="text-[10px] font-mono text-text-secondary opacity-40">
                                {new Date(item.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          );
                        })}

                        {filteredArchive.length === 0 && (
                          <div className="text-center py-1 flex flex-col items-center">
                            <img src="/casper_logo.png" alt="Ghost" className="h-16 w-auto mb-1.5 opacity-20 filter grayscale" referrerPolicy="no-referrer" />
                            <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">No matched evidence</p>
                            <p className="text-[10px] mt-1 max-w-[180px] mx-auto leading-normal text-text-secondary opacity-60">Commission agent units on the left workspace or ingest your own files.</p>
                          </div>
                        )}
                      </div>

                      {/* Right: details pane */}
                      <div className="md:col-span-7 bg-surface-muted/50 border border-border-subtle rounded-md p-2 min-h-[300px] max-h-[480px] overflow-y-auto custom-scrollbar flex flex-col">
                        {selectedArchiveItem ? (
                          <div className="space-y-1.5 flex-grow">
                            <div className="flex justify-between items-start gap-2 pb-4 border-b border-border-subtle">
                              <div>
                                <h3 className="text-md font-semibold text-text-primary max-w-sm font-serif italic">{selectedArchiveItem.title || selectedArchiveItem.name}</h3>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="px-1.5 py-0.5 bg-background border border-border-subtle text-[10px] font-semibold uppercase tracking-widest text-text-secondary rounded">
                                    {selectedArchiveItem.category || selectedArchiveItem.type || 'General'}
                                  </span>
                                  {selectedArchiveItem.isDeepResearch && (
                                    <span className="px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/10 text-[10px] font-semibold uppercase tracking-widest rounded flex items-center gap-1">
                                      <Globe size={8} /> Web-Vetted
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (selectedArchiveItem.displayType === 'Research') {
                                    await onDeleteResearch(selectedArchiveItem.id);
                                  } else {
                                    await onDeleteSource(selectedArchiveItem.id);
                                  }
                                  setSelectedArchiveItem(null);
                                  onNotify('Item deleted.', 'success');
                                }}
                                className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {/* Sensory Profile breakdown for generated research notes */}
                            {selectedArchiveItem.sensoryDetails && (Object.values(selectedArchiveItem.sensoryDetails).some((arr: any) => arr && arr.length > 0)) && (
                              <div className="grid grid-cols-2 gap-2 bg-background/55 border border-border-subtle/80 p-3 rounded-md">
                                {selectedArchiveItem.sensoryDetails.sounds?.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-brand-primary flex items-center gap-1">
                                      <Headphones size={10} /> Auditory
                                    </div>
                                    <div className="text-[10px] text-text-secondary leading-snug">
                                      {selectedArchiveItem.sensoryDetails.sounds.slice(0, 2).join(', ')}
                                    </div>
                                  </div>
                                )}
                                {selectedArchiveItem.sensoryDetails.smells?.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-brand-primary flex items-center gap-1">
                                      <Wind size={10} /> Olfactory
                                    </div>
                                    <div className="text-[10px] text-text-secondary leading-snug">
                                      {selectedArchiveItem.sensoryDetails.smells.slice(0, 2).join(', ')}
                                    </div>
                                  </div>
                                )}
                                {selectedArchiveItem.sensoryDetails.textures?.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-brand-primary flex items-center gap-1">
                                      <Hand size={10} /> Tactile
                                    </div>
                                    <div className="text-[10px] text-text-secondary leading-snug">
                                      {selectedArchiveItem.sensoryDetails.textures.slice(0, 2).join(', ')}
                                    </div>
                                  </div>
                                )}
                                {selectedArchiveItem.sensoryDetails.visuals?.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-brand-primary flex items-center gap-1">
                                      <Eye size={10} /> Visual
                                    </div>
                                    <div className="text-[10px] text-text-secondary leading-snug">
                                      {selectedArchiveItem.sensoryDetails.visuals.slice(0, 2).join(', ')}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Markdown render of main content */}
                            <div className="prose prose-xs max-w-none prose-p:text-text-secondary text-text-primary text-xs leading-relaxed space-y-3 font-medium">
                              <Markdown>{selectedArchiveItem.content}</Markdown>
                            </div>

                            {/* Sources cited */}
                            {selectedArchiveItem.sources?.length > 0 && (
                              <div className="pt-4 border-t border-border-subtle mt-4">
                                <h5 className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary mb-1 flex items-center gap-1">
                                  <Globe size={10} /> Retrieval Citations
                                </h5>
                                <ul className="space-y-0.5">
                                  {selectedArchiveItem.sources.map((src: string, sIdx: number) => (
                                    <li key={sIdx} className="text-[9.5px] text-brand-primary/95 truncate font-mono">
                                      {src}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-full flex-grow flex flex-col items-center justify-center text-text-secondary/40 space-y-3 py-20 select-none">
                            <Library size={44} strokeWidth={1} />
                            <p className="text-xs font-semibold uppercase tracking-widest">Select an entity to explore</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT SIDE: Dispatch Command Center */}
          <div className="lg:col-span-4 space-y-2">
            {/* COMMISSION COMMAND CENTER */}
            <div className="btn-nexus-primary p-3 rounded shadow-xl flex flex-col relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                <Microchip size={100} />
              </div>
              
              <h4 className="text-xs font-semibold text-white/80 uppercase tracking-widest flex items-center gap-2 mb-2">
                <BrainCircuit size={14} /> Intelligence Core
              </h4>
              <p className="text-[11.5px] font-medium text-white/90 leading-relaxed mb-2">
                Ready to synthesize target components. Deep agents will perform research, cross-reference resources, and lock results directly in your Archive.
              </p>

              {/* Commission Button */}
              <button
                onClick={executeResearchSession}
                disabled={isRunningResearch || topics.filter(t => t.selected && t.status === 'ready').length === 0}
                className="w-full py-1 bg-white text-brand-primary hover:bg-white/95 transition-all shadow-xl rounded-md flex items-center justify-center gap-1.5 font-semibold text-xs uppercase tracking-[0.2em] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none group/action"
              >
                {isRunningResearch ? (
                  <RefreshCcw size={16} className="animate-spin text-brand-primary" />
                ) : (
                  <Zap size={16} className="text-brand-primary animate-pulse group-hover/action:scale-110" />
                )}
                {isRunningResearch 
                  ? 'Sequence In Progress...' 
                  : `Commission Core (${topics.filter(t => t.selected && t.status === 'ready').length})`
                }
              </button>
            </div>

            {/* Quick Tips or Brief Status instead of Console */}
            <div className="ethereal-panel border border-border-subtle p-3 rounded space-y-1.5">
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary flex items-center gap-2">
                <Info size={12} className="text-brand-primary" />
                Deployment Guide
              </h4>
              <ul className="space-y-3">
                {[
                  { icon: Search, text: 'Scan drafts to detect unexplored logical threads.' },
                  { icon: Sparkles, text: 'Use Map to envision complete genre frameworks.' },
                  { icon: Globe, text: 'Deep Agents cross-reference high-fidelity web data.' }
                ].map((tip, i) => (
                  <li key={i} className="flex gap-1.5 items-start">
                    <tip.icon size={12} className="text-brand-primary mt-0.5 shrink-0" />
                    <span className="text-xs text-text-secondary leading-normal font-medium">{tip.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
