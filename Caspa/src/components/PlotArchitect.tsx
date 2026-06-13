import { useState, useEffect, useRef } from 'react';
import { GitBranch, Plus, Zap, Trash2, Map, MoveVertical, AlertCircle, Clock, Activity } from 'lucide-react';
import { Project, Character, PlotNode, ResearchNote, Chapter, Critique, ProjectType } from '../types';
import { AIService } from '../services/ai';
import { Reorder, AnimatePresence, motion, useDragControls } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  project: Project;
  plotNodes: PlotNode[];
  chapters: Chapter[];
  research: ResearchNote[];
  updateProject: (updates: Partial<Project>) => void;
  updatePlotNodes: (nodes: PlotNode[]) => void;
  updateChapters: (chapters: Chapter[]) => void;
  setView: (view: any) => void;
  onNotify?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onError?: (message: string) => void;
}

interface NodeItemProps {
  node: PlotNode;
  index: number;
  totalLength: number;
  onUpdate: (id: string, updates: Partial<PlotNode>) => void;
  onDelete: (id: string) => void;
}

function PlotNodeItem({ node, index, totalLength, onUpdate, onDelete }: NodeItemProps) {
  const [localTitle, setLocalTitle] = useState(node.title);
  const [localDesc, setLocalDesc] = useState(node.description);
  const dragControls = useDragControls();

  useEffect(() => {
    setLocalTitle(node.title);
    setLocalDesc(node.description);
  }, [node.id]);

  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localTitle !== node.title || localDesc !== node.description) {
        onUpdateRef.current(node.id, { title: localTitle, description: localDesc });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localTitle, localDesc, node.title, node.description, node.id]);

  return (
    <Reorder.Item 
      value={node}
      className="relative group"
      dragListener={false}
      dragControls={dragControls}
    >
      <div className="flex gap-1.5 md:gap-1.5 items-start">
        {/* Visual Connector */}
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 md:w-12 md:h-12 rounded flex items-center justify-center text-xs md:text-[11px] font-semibold transition-all shadow-2xl border ${
            node.status === 'resolved' ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 
            node.status === 'ended' ? 'bg-surface-muted border-border-subtle text-text-secondary opacity-40' :
            index % 2 === 0 ? 'bg-brand-dark border-border-subtle text-text-primary' : 'btn-nexus-primary border-brand-primary shadow-brand-primary/30'
          }`}>
            {(index + 1).toString().padStart(2, '0')}
          </div>
          {index < totalLength - 1 && (
            <div className="w-px h-full min-h-[100px] bg-gradient-to-b from-brand-primary/30 to-transparent my-4 opacity-30" />
          )}
        </div>

        {/* Content Card */}
        <div className="flex-1 p-3 md:p-3 ethereal-panel border border-border-subtle rounded-md hover:border-brand-primary/50 transition-all flex flex-col gap-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative group-hover:shadow-[0_30px_70px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex flex-col gap-2">
              <input 
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-lg md:text-xs font-semibold font-semibold text-text-primary w-full placeholder:text-text-secondary/40 italic font-serif leading-tight"
                placeholder="Plot Event..."
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-brand-dark px-3 py-1.5 rounded-md border border-border-subtle" title="The functional role of this beat in your story">
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest opacity-40">Class</span>
                  <select 
                    value={node.type}
                    onChange={(e) => onUpdate(node.id, { type: e.target.value as any })}
                    className="bg-transparent border-none focus:ring-0 text-[10px] font-semibold uppercase text-brand-primary p-0 cursor-pointer hover:text-brand-accent transition-colors"
                  >
                    <option value="main">Major Turning Point</option>
                    <option value="sub">Sub-Plot Event</option>
                    <option value="theme">Thematic Reinforcement</option>
                  </select>
                </div>
                <div className="w-1 h-1 rounded-full bg-border-subtle" />
                <div className="flex items-center gap-2 bg-brand-dark px-3 py-1.5 rounded-md border border-border-subtle" title="Current execution status of this beat">
                  <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest opacity-40">Status</span>
                  <select 
                    value={node.status}
                    onChange={(e) => onUpdate(node.id, { status: e.target.value as any })}
                    className={`bg-transparent border-none focus:ring-0 text-[10px] font-semibold uppercase p-0 cursor-pointer ${
                      node.status === 'resolved' ? 'text-brand-primary' :
                      node.status === 'ended' ? 'text-text-secondary' : 'text-amber-500 animate-pulse'
                    }`}
                  >
                    <option value="active">In Progress</option>
                    <option value="resolved">Drafted & Synchronized</option>
                    <option value="ended">Discarded/Obsolete</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <button 
                 title="Drag to re-order the narrative sequence"
                 onPointerDown={(e) => dragControls.start(e)}
                 className="p-3 text-text-secondary hover:text-text-primary transition-colors cursor-grab active:cursor-grabbing bg-white/5 rounded-md border border-border-subtle"
               >
                <MoveVertical size={18} />
              </button>
              <button 
                title="Permanently remove this plot beat"
                onClick={() => {
                  if (node.title === 'New Narrative Beat' || confirm('Permanently destroy this architectural node?')) {
                    onDelete(node.id);
                  }
                }}
                className="p-3 text-text-secondary hover:text-red-500 transition-colors bg-white/5 rounded-md border border-border-subtle group/del"
              >
                <Trash2 size={18} className="group-hover/del:scale-110 transition-transform" />
              </button>
            </div>
          </div>
          <div className="relative group/text">
            <textarea 
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              className="w-full bg-brand-dark border border-border-subtle rounded-md p-3 text-text-secondary/80 min-h-[120px] resize-none focus:ring-1 focus:ring-brand-primary/30 focus:border-brand-primary/30 outline-none leading-[1.8] text-[11px] font-medium transition-all"
              placeholder="Document the narrative logic and strategic pivot points for this operation..."
            />
            <div className="absolute right-4 bottom-4 opacity-0 group-focus-within/text:opacity-100 transition-opacity">
              <Activity size={14} className="text-brand-primary animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
}

export default function PlotArchitect({ project, plotNodes, chapters, research, updateProject, updatePlotNodes, updateChapters, setView, onNotify, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [continuityReport, setContinuityReport] = useState<string | null>(null);

  const handleGenerateNodes = async () => {
    setLoading(true);
    try {
      console.log("System: Initializing Plot Architect with Neural Engine 3.1...");
      const nodes = await AIService.outlinePlotNodes(project, chapters, research);
      
      if (!nodes || nodes.length === 0) {
        throw new Error("Neural Engine returned an empty structure. Try refining your source materials.");
      }

      await updatePlotNodes(nodes);
      console.log(`Success: Synthesized ${nodes.length} major narrative beats.`);
      onNotify?.("Plot architecture successfully generated!", "success");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Plot Architect failed to respond.";
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePropagate = async () => {
    if (plotNodes.length === 0) return;
    setPropagating(true);
    try {
      const reconciled = await AIService.reconcileChapters(project, plotNodes, chapters);
      
      // Determine existing chapters to preserve vs new ones from AI
      const mergedChapters: Chapter[] = reconciled.map((item, index) => {
        // Try to find if an existing chapter matches this title
        const existing = chapters.find(c => c.title === item.title);
        return {
          id: existing?.id || crypto.randomUUID(),
          title: item.title,
          summary: item.summary,
          content: existing?.content || "", // Preserve content!
          order: index,
          plotNodeIds: item.plotNodeIds,
          tags: existing?.tags || ['reconciled'],
          updatedAt: Date.now()
        };
      });

      // Find any chapters that exist but were NOT in the AIDesign (Orphans)
      // We'll append them at the end to ensure NO DATA LOSS
      const orphans = chapters.filter(old => !mergedChapters.find(m => m.id === old.id));
      
      const finalChapters = [...mergedChapters];
      if (orphans.length > 0) {
        orphans.forEach((orp, idx) => {
           finalChapters.push({
             ...orp,
             order: mergedChapters.length + idx,
             tags: [...(orp.tags || []), 'orphaned-architecture']
           });
        });
      }

      updateChapters(finalChapters);
      setContinuityReport(`## Synchronization Success
The narrative architecture has been merged with your manuscript. 

**Changes Made:**
- Aligned **${mergedChapters.length} chapters** with the current plot nodes.
- Preserved **${orphans.length} unexpected segments** at the end of the manuscript to prevent data loss.
- Re-ordered chapters to match the logical flow of the architecture.
- Preserved all existing draft content.`);
    } catch (err) {
      console.error(err);
      onError?.("Failed to apply the architectural changes.");
    } finally {
      setPropagating(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const report = await AIService.analyzeContinuity(plotNodes, chapters, research, project.externalReviews || []);
      setContinuityReport(report + "\n\n---\n**Action Required:** If you wish to apply these structural recommendations to your manuscript, click the **Apply to Manuscript** button above.");
    } catch (err) {
      console.error(err);
      onError?.("Continuity analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const addNode = () => {
    const newNode: PlotNode = {
      id: crypto.randomUUID(),
      title: 'New Narrative Beat',
      description: '',
      status: 'active',
      type: 'main',
      order: plotNodes.length,
      updatedAt: Date.now()
    };
    updatePlotNodes([...plotNodes, newNode]);
  };

  const deleteNode = (id: string) => {
    updatePlotNodes(plotNodes.filter(p => p.id !== id));
  };

  const updateNode = (id: string, updates: Partial<PlotNode>) => {
    updatePlotNodes(plotNodes.map(p => p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p));
  };

  return (
    <div 
      className="h-full overflow-y-auto custom-scrollbar px-2 pb-32"
      style={{ minHeight: 0 }}
    >
      <div className="max-w-7xl mx-auto py-3 md:py-1 md:px-2 flex flex-col gap-1.5">
      <header className="flex flex-col md:flex-row items-center justify-between gap-1.5 md:gap-2 ethereal-panel p-3 md:p-3 rounded-md md:rounded-md border border-border-subtle shadow-[0_50px_100px_rgba(0,0,0,0.4)] relative overflow-hidden group">
        <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-[0.02] transition-opacity duration-1000" />
        <div className="text-center md:text-left relative z-10">
          <div className="flex items-center gap-1.5 mb-2 justify-center md:justify-start">
             <div className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_10px_rgba(168,85,247,0.6)] animate-pulse" />
             <h2 className="text-xs font-semibold md:text-[11px] font-semibold font-semibold tracking-tight text-text-primary italic font-serif">Strategic Operations Map</h2>
          </div>
          <p className="text-[10px] md:text-xs text-text-secondary font-semibold uppercase tracking-widest opacity-40">Mapping structural narrative vectors for synchronized deployment</p>
        </div>
        <div className="flex flex-wrap gap-1.5 md:gap-1.5 justify-center w-full md:w-auto relative z-10">
          <button 
            onClick={handlePropagate}
            disabled={propagating || plotNodes.length === 0}
            title="Automatically update your manuscript chapters to align with these plot nodes"
            className="px-2 py-1 btn-nexus-primary font-semibold rounded text-xs transition-all shadow-2xl shadow-brand-primary/20 flex items-center justify-center gap-1.5 disabled:opacity-30 uppercase tracking-widest active:scale-95 group/btn"
          >
            {propagating ? (
              <Activity size={14} className="animate-spin" />
            ) : <Map size={14} className="group-hover/btn:rotate-12 transition-transform" />}
            Sync to Chapters
          </button>
          <button 
            onClick={handleAnalyze}
            disabled={analyzing || plotNodes.length === 0}
            title="AI analysis of your story's continuity and logic"
            className="px-2 py-1 bg-brand-dark text-text-primary font-semibold rounded text-xs transition-all border border-border-subtle hover:border-brand-primary/50 flex items-center justify-center gap-1.5 disabled:opacity-30 uppercase tracking-widest active:scale-95 group/btn shadow-xl"
          >
            {analyzing ? (
              <Activity size={14} className="animate-spin" />
            ) : <GitBranch size={14} className="group-hover/btn:scale-110 transition-transform" />}
            Consistency Audit
          </button>
          <button 
            onClick={handleGenerateNodes}
            disabled={loading}
            title="Let AI brainstorm a sequence of plot beats based on your premise"
            className="px-2 py-1 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary font-semibold rounded text-xs transition-all hover:bg-brand-primary/20 flex items-center justify-center gap-1.5 disabled:opacity-30 uppercase tracking-widest active:scale-95 group/btn"
          >
            {loading ? (
              <Activity size={14} className="animate-spin" />
            ) : <Zap size={14} className="fill-current group-hover/btn:animate-pulse" />}
            AI Brainstorm
          </button>
          <button 
            onClick={addNode}
            title="Add a manual narrative beat to the end"
            className="px-2 py-1 bg-surface-muted text-text-secondary font-semibold border border-border-subtle rounded text-xs transition-all hover:text-text-primary hover:border-text-secondary/30 flex items-center justify-center gap-1.5 uppercase tracking-widest active:scale-95"
          >
            <Plus size={14} />
            Add Beat
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5 pb-12">
        <div className="lg:col-span-2 px-2.5 -mx-6">
          <Reorder.Group 
            axis="y" 
            values={plotNodes} 
            onReorder={(newOrder) => updatePlotNodes(newOrder.map((p, i) => ({ ...p, order: i })))}
            className="space-y-1.5 max-w-4xl mx-auto pb-24"
          >
            {plotNodes.map((node, index) => (
              <PlotNodeItem 
                key={node.id} 
                node={node} 
                index={index} 
                totalLength={plotNodes.length}
                onUpdate={updateNode}
                onDelete={deleteNode}
              />
            ))}

            {plotNodes.length === 0 && (
              <div className="h-[500px] flex flex-col items-center justify-center text-center p-20 ethereal-panel border border-dashed border-border-subtle rounded-[5rem] shadow-inner relative group overflow-hidden">
                <div className="absolute inset-0 bg-brand-primary rounded-full blur-[150px] opacity-5 group-hover:opacity-10 transition-opacity duration-1000" />
                <Map size={100} strokeWidth={0.5} className="text-text-secondary opacity-10 mb-3 relative z-10" />
                <div className="space-y-1.5 relative z-10 max-w-sm">
                  <p className="text-[11px] font-semibold font-semibold text-text-primary italic font-serif tracking-tight">Structural Grid Offline</p>
                  <p className="text-xs text-text-secondary font-semibold uppercase tracking-widest opacity-40 leading-relaxed mx-auto max-w-[240px]">Initialize neural synthesis to populate the primary narrative skeletal architecture.</p>
                </div>
              </div>
            )}
          </Reorder.Group>
        </div>

        {/* Continuity Sidebar */}
        <div className="bg-brand-dark border border-border-subtle rounded flex flex-col overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative group">
          <div className="absolute top-0 right-0 p-2 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity duration-1000">
             <AlertCircle size={200} />
          </div>
          <div className="p-3 border-b border-border-subtle flex items-center justify-between ethereal-panel relative z-10">
            <div className="flex flex-col">
              <h3 className="text-xs font-semibold text-brand-primary flex items-center gap-1.5 uppercase tracking-widest mb-1 font-sans">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                Dissonance Audit
              </h3>
              <span className="text-[10px] font-semibold text-text-secondary opacity-40 uppercase tracking-[0.2em]">Cross-Vector Continuity Report</span>
            </div>
            <button 
              onClick={() => setContinuityReport(null)}
              className="p-3 text-text-secondary hover:text-brand-primary transition-colors bg-surface-muted rounded-md border border-border-subtle active:scale-95 shadow-lg"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="flex-1 p-3 relative z-10">
            <AnimatePresence mode="wait">
              {continuityReport ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-1.5"
                >
                  <div className="prose prose-invert prose-brand prose-sm max-w-none prose-p:leading-relaxed prose-headings:text-brand-primary prose-headings:font-semibold italic text-text-secondary/80 font-serif">
                    <Markdown>{continuityReport}</Markdown>
                  </div>
                  
                  {continuityReport.includes('Synchronization Success') && (
                    <button 
                      onClick={() => setView('autodraft')}
                      className="w-full py-3 btn-nexus-primary font-semibold rounded-md text-xs transition-all shadow-2xl shadow-brand-primary/20 flex items-center justify-center gap-2 uppercase tracking-wider active:scale-95 group/btn"
                    >
                      <Zap size={18} className="fill-current group-hover/btn:rotate-12 transition-transform" />
                      Initialize Neural Drafting Hub
                    </button>
                  )}
                  {!continuityReport.includes('Synchronization Success') && (
                    <button 
                      onClick={handlePropagate}
                      disabled={propagating}
                      className="w-full py-3 btn-nexus-primary font-semibold rounded-md text-xs transition-all shadow-2xl shadow-brand-primary/20 flex items-center justify-center gap-2 uppercase tracking-wider active:scale-95 group/btn"
                    >
                      {propagating ? (
                        <Activity size={18} className="animate-spin" />
                      ) : <Zap size={18} className="fill-current group-hover/btn:rotate-12 transition-transform" />}
                      Authorize Grid Shift
                    </button>
                  )}
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center gap-1.5">
                  {analyzing ? (
                     <div className="flex flex-col items-center gap-1.5">
                        <div className="relative">
                          <motion.div 
                            animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
                            transition={{ repeat: Infinity, duration: 2.5 }}
                            className="absolute inset-0 bg-brand-primary rounded-full blur-3xl" 
                          />
                          <div className="relative z-10 p-3 bg-brand-primary/10 rounded-full border border-brand-primary/20 shadow-inner">
                            <Activity size={48} className="text-brand-primary animate-pulse" />
                          </div>
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary animate-shimmer italic">Synchronizing Narrative Vectors...</p>
                     </div>
                  ) : (
                    <div className="opacity-20 flex flex-col items-center gap-2 group-hover:opacity-30 transition-opacity duration-1000">
                      <Clock size={80} strokeWidth={0.5} className="text-text-secondary" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary max-w-[200px] leading-relaxed mx-auto">Awaiting High-Vector Operational Signal</p>
                    </div>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
