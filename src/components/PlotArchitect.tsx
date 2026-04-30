import { useState, useEffect } from 'react';
import { GitBranch, Plus, Zap, Trash2, Map, MoveVertical, AlertCircle, Clock } from 'lucide-react';
import { Project, PlotNode } from '../types';
import { AIService } from '../services/ai';
import { Reorder, AnimatePresence, motion } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  project: Project;
  plotNodes: PlotNode[];
  updateProject: (updates: Partial<Project>) => void;
  updatePlotNodes: (nodes: PlotNode[]) => void;
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

  useEffect(() => {
    setLocalTitle(node.title);
    setLocalDesc(node.description);
  }, [node.id]); // Reset only if ID changes (to handle reordering)

  // Debounced update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localTitle !== node.title || localDesc !== node.description) {
        onUpdate(node.id, { title: localTitle, description: localDesc });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localTitle, localDesc, node.id, onUpdate]);

  return (
    <Reorder.Item 
      value={node}
      className="relative group"
    >
      <div className="flex gap-4 md:gap-8 items-start">
        {/* Visual Connector */}
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 md:w-10 md:h-10 rounded flex items-center justify-center font-bold text-xs md:text-sm select-none transition-all shadow-inner ${
            node.status === 'resolved' ? 'bg-emerald-500 text-white' : 
            node.status === 'ended' ? 'bg-slate-300 text-slate-600' :
            index % 2 === 0 ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'
          }`}>
            {index + 1}
          </div>
          {index < totalLength - 1 && (
            <div className="w-px h-full min-h-[60px] bg-slate-200 mt-2" />
          )}
        </div>

        {/* Content Card */}
        <div className="flex-1 p-4 md:p-6 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-all flex flex-col gap-4 shadow-sm relative group-hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex-1 flex flex-col gap-1">
              <input 
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-base md:text-lg font-bold text-slate-900 w-full placeholder:text-slate-200 italic font-serif"
                placeholder="Node Title..."
              />
              <div className="flex items-center gap-3">
                <select 
                  value={node.type}
                  onChange={(e) => onUpdate(node.id, { type: e.target.value as any })}
                  className="bg-transparent border-none focus:ring-0 text-[9px] md:text-[10px] font-black uppercase text-slate-400 p-0 cursor-pointer hover:text-blue-600"
                >
                   <option value="main">Main Line</option>
                   <option value="sub">Subplot</option>
                   <option value="theme">Thematic Beat</option>
                </select>
                <div className="w-1 h-1 rounded-full bg-slate-200" />
                <select 
                  value={node.status}
                  onChange={(e) => onUpdate(node.id, { status: e.target.value as any })}
                  className={`bg-transparent border-none focus:ring-0 text-[9px] md:text-[10px] font-black uppercase p-0 cursor-pointer ${
                    node.status === 'resolved' ? 'text-emerald-600' :
                    node.status === 'ended' ? 'text-slate-400' : 'text-blue-600'
                  }`}
                >
                   <option value="active">Active</option>
                   <option value="resolved">Resolved</option>
                   <option value="ended">Ended (Unresolved)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-1">
               <button className="p-2 text-slate-300 hover:text-slate-500 transition-colors cursor-grab active:cursor-grabbing">
                <MoveVertical size={16} />
              </button>
              <button 
                onClick={() => onDelete(node.id)}
                className="p-2 text-slate-200 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <textarea 
            value={localDesc}
            onChange={(e) => setLocalDesc(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-lg p-4 text-slate-600 min-h-[100px] resize-none focus:ring-2 focus:ring-blue-100 focus:bg-white outline-none leading-relaxed text-sm font-medium"
            placeholder="Document the narrative logic and emotional pivot..."
          />
        </div>
      </div>
    </Reorder.Item>
  );
}

export default function PlotArchitect({ project, plotNodes, updateProject, updatePlotNodes }: Props) {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [continuityReport, setContinuityReport] = useState<string | null>(null);

  const handleGenerateNodes = async () => {
    setLoading(true);
    try {
      const nodes = await AIService.outlinePlotNodes(project);
      updatePlotNodes(nodes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const report = await AIService.analyzeContinuity(plotNodes, (project as any).chapters || []);
      setContinuityReport(report);
    } catch (err) {
      console.error(err);
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
    <div className="h-full flex flex-col gap-8">
      <header className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">Plot Architect</h2>
          <p className="text-xs text-slate-500 font-medium italic">Mapping the structural skeleton of the narrative.</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-4 justify-center">
          <button 
            onClick={handleAnalyze}
            disabled={analyzing || plotNodes.length === 0}
            className="px-4 md:px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-xs transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 uppercase tracking-widest"
          >
            {analyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <GitBranch size={14} />}
            Continuity Sync
          </button>
          <button 
            onClick={handleGenerateNodes}
            disabled={loading}
            className="px-4 md:px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-xs transition-all shadow-lg shadow-blue-100 flex items-center gap-2 disabled:opacity-50 uppercase tracking-widest"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap size={14} className="fill-white" />}
            Auto-Architect
          </button>
          <button 
            onClick={addNode}
            className="px-4 md:px-6 py-2 bg-white hover:bg-slate-50 text-slate-600 font-bold border border-slate-200 rounded text-xs transition-all flex items-center gap-2 shadow-sm uppercase tracking-widest"
          >
            <Plus size={14} />
            Append Node
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
        <div className="lg:col-span-2 overflow-y-auto px-4 -mx-4 custom-scrollbar">
          <Reorder.Group 
            axis="y" 
            values={plotNodes} 
            onReorder={(newOrder) => updatePlotNodes(newOrder.map((p, i) => ({ ...p, order: i })))}
            className="space-y-6 max-w-4xl mx-auto pb-12"
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
              <div className="h-80 flex flex-col items-center justify-center text-center space-y-4 text-slate-300 bg-white border border-dashed border-slate-200 rounded-[32px] shadow-inner">
                <Map size={48} strokeWidth={1} className="opacity-10 text-slate-900" />
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-400">Architectural Grid Offline</p>
                  <p className="text-xs text-slate-300 font-medium italic">Initialize the Auto-Architect to populate the narrative skeleton.</p>
                </div>
              </div>
            )}
          </Reorder.Group>
        </div>

        {/* Continuity Sidebar */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-inner font-serif">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white bg-opacity-50 backdrop-blur-sm">
            <h3 className="text-[10px] font-black text-slate-900 flex items-center gap-2 uppercase tracking-[0.2em] font-sans">
              <AlertCircle size={14} className="text-blue-600" />
              Continuity Analysis
            </h3>
            <button 
              onClick={() => setContinuityReport(null)}
              className="text-[10px] font-bold text-slate-300 hover:text-slate-900 font-sans"
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {continuityReport ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="prose prose-slate prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-headings:text-slate-900 italic text-slate-600"
                >
                  <Markdown>{continuityReport}</Markdown>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-slate-300">
                  {analyzing ? (
                     <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 border-2 border-blue-100 border-t-blue-600 animate-spin rounded-lg" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 font-sans">Syncing Beats...</p>
                     </div>
                  ) : (
                    <>
                      <Clock size={48} strokeWidth={1} className="opacity-20" />
                      <p className="text-xs font-medium italic font-sans text-slate-400">Awaiting structural analysis request.</p>
                    </>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
