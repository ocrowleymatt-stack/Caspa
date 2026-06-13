import React, { useState } from 'react';
import { 
  Project, PlotNode, Chapter, Character, ResearchNote, ViewType 
} from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GitBranch, Plus, Trash2, Award, Zap, Lightbulb, Users, Edit3, ShieldAlert 
} from 'lucide-react';

interface DesignViewProps {
  project: Project & { characters?: Character[] };
  plotNodes: PlotNode[];
  chapters: Chapter[];
  research: ResearchNote[];
  characters: Character[];
  updateProject: (p: Partial<Project>) => Promise<void>;
  updatePlotNodes: (nodes: PlotNode[]) => Promise<void>;
  updateChapters: (chaps: Chapter[]) => Promise<void>;
  updateCharacters: (chars: Character[]) => Promise<void>;
  onDeduplicateCharacters: () => Promise<void>;
  setView: (v: ViewType) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onError: (msg: string) => void;
}

export default function DesignView({
  project,
  plotNodes,
  chapters,
  research,
  characters,
  updateProject,
  updatePlotNodes,
  updateChapters,
  updateCharacters,
  onDeduplicateCharacters,
  setView,
  onNotify,
  onError
}: DesignViewProps) {
  const [activeTab, setActiveTab] = useState<'plot' | 'cast'>('plot');
  const [newPlotTitle, setNewPlotTitle] = useState('');
  const [newPlotDesc, setNewPlotDesc] = useState('');
  const [newPlotType, setNewPlotType] = useState<'main' | 'sub' | 'theme'>('main');

  const [newCharName, setNewCharName] = useState('');
  const [newCharRole, setNewCharRole] = useState('');
  const [newCharBackstory, setNewCharBackstory] = useState('');

  const handleAddPlotNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlotTitle.trim() || !newPlotDesc.trim()) {
      onNotify?.('Plot turn title and description must be configured.', 'error');
      return;
    }
    const newNode: PlotNode = {
      id: crypto.randomUUID(),
      title: newPlotTitle,
      description: newPlotDesc,
      status: 'active',
      type: newPlotType,
      order: plotNodes.length,
      updatedAt: Date.now()
    };
    await updatePlotNodes([...plotNodes, newNode]);
    setNewPlotTitle('');
    setNewPlotDesc('');
    onNotify?.(`Plot turn "${newNode.title}" securely inserted.`, 'success');
  };

  const handleCreateCastMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharName.trim() || !newCharRole.trim()) {
      onNotify?.('Character name and dramatic role are required.', 'error');
      return;
    }
    const newChar: Character = {
      id: crypto.randomUUID(),
      name: newCharName,
      role: newCharRole,
      backstory: newCharBackstory,
      traits: ['Manual entry'],
      goals: ['Survive the narrative'],
      fears: ['Annihilation'],
      motivations: ['Justice/Survival'],
      quirks: [],
      updatedAt: Date.now()
    };
    await updateCharacters([...characters, newChar]);
    setNewCharName('');
    setNewCharRole('');
    setNewCharBackstory('');
    onNotify?.(`Character "${newChar.name}" recorded in cast roster.`, 'success');
  };

  const deletePlotNode = async (id: string) => {
    const filtered = plotNodes.filter(n => n.id !== id).map((n, idx) => ({ ...n, order: idx }));
    await updatePlotNodes(filtered);
    onNotify?.('Plot lattice node deleted.', 'success');
  };

  const deleteCharacter = async (id: string) => {
    const filtered = characters.filter(c => c.id !== id);
    await updateCharacters(filtered);
    onNotify?.('Cast roster updated.', 'success');
  };

  return (
    <div id="design-view-container" className="flex-1 flex flex-col min-h-0 bg-neutral-900 border border-neutral-800/80 rounded-xl overflow-hidden text-neutral-100">
      {/* Title Header Bar */}
      <div className="bg-neutral-950 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-950/40 border border-emerald-800/50 rounded text-emerald-400">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-white">NARRATIVE DESIGN MATRIX</h1>
            <p className="text-[10px] text-neutral-400 mt-0.5">Wire together structural plot constraints and rich psychoanalytical character profiles.</p>
          </div>
        </div>

        <div className="flex bg-neutral-900 border border-neutral-800 rounded p-0.5">
          <button
            id="tab-btn-plot"
            onClick={() => setActiveTab('plot')}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-all ${
              activeTab === 'plot' ? 'bg-neutral-850 text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Lattice turns ({plotNodes.length})
          </button>
          <button
            id="tab-btn-cast"
            onClick={() => setActiveTab('cast')}
            className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-all ${
              activeTab === 'cast' ? 'bg-neutral-850 text-white font-bold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Cast roster ({characters.length})
          </button>
        </div>
      </div>

      {/* Main Panel Pane */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar">
        {activeTab === 'plot' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Create plot node column */}
            <form id="create-plot-form" onSubmit={handleAddPlotNode} className="lg:col-span-4 p-5 bg-neutral-950/40 border border-neutral-800 rounded-xl space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" /> CREATE PLOT MILESTONE
              </h2>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono text-neutral-400">Milestone Title:</label>
                <input
                  id="plot-title-input"
                  type="text"
                  value={newPlotTitle}
                  onChange={(e) => setNewPlotTitle(e.target.value)}
                  placeholder="e.g. Uncovering the forgery..."
                  className="w-full bg-neutral-900 border border-neutral-800 text-xs rounded px-3 py-2 text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono text-neutral-400 font-mono">Milestone Category:</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['main', 'sub', 'theme'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewPlotType(t)}
                      className={`py-1 rounded text-[9px] font-mono uppercase border transition-all ${
                        newPlotType === t 
                          ? 'bg-emerald-950/50 border-emerald-500 text-emerald-400 font-bold' 
                          : 'bg-neutral-900 border-neutral-850 text-neutral-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono text-neutral-400">Narrative significance & events:</label>
                <textarea
                  id="plot-desc-input"
                  value={newPlotDesc}
                  onChange={(e) => setNewPlotDesc(e.target.value)}
                  placeholder="Describe the inciting drama, costs, and characters involved..."
                  className="w-full h-28 bg-neutral-900 border border-neutral-800 text-xs rounded p-3 text-neutral-300 outline-none focus:border-emerald-500 font-mono resize-none"
                />
              </div>

              <button
                id="submit-plot-btn"
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-mono text-xs uppercase tracking-widest font-semibold transition-all shadow shadow-emerald-950/50 flex justify-center items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> LOCK TURN
              </button>
            </form>

            {/* Plot turned items list */}
            <div className="lg:col-span-8 space-y-4">
              <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">PLOT LATTICE NODES STAGED ({plotNodes.length})</span>
              {plotNodes.length === 0 ? (
                <div className="border border-neutral-800 border-dashed rounded-xl py-12 text-center text-neutral-500 font-mono text-xs">
                  No active plot milestone vectors configured. Add above to map the dramatic landscape.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar">
                  {plotNodes.sort((a,b) => a.order - b.order).map((pt, idx) => (
                    <div key={pt.id} className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl flex items-start gap-3 transition-all hover:border-neutral-750">
                      <div className="w-6 h-6 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-mono flex items-center justify-center text-neutral-400 shrink-0 mt-0.5">
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold text-white truncate">{pt.title}</span>
                          <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 border rounded tracking-wider ${
                            pt.type === 'main' 
                              ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' 
                              : pt.type === 'sub' 
                              ? 'bg-blue-950/30 border-blue-900/50 text-blue-400' 
                              : 'bg-purple-950/30 border-purple-900/50 text-purple-400'
                          }`}>
                            {pt.type} path
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 leading-relaxed font-sans">{pt.description}</p>
                      </div>
                      <button
                        id={`delete-plot-${pt.id}`}
                        onClick={() => deletePlotNode(pt.id)}
                        className="p-1 hover:bg-red-950/30 text-neutral-600 hover:text-red-400 border border-transparent hover:border-red-900/30 rounded shrink-0 transition-all"
                        title="Decimate plot turn"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'cast' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Create character form column */}
            <form id="create-cast-form" onSubmit={handleCreateCastMember} className="lg:col-span-4 p-5 bg-neutral-950/40 border border-neutral-800 rounded-xl space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> RECRUIT DRAMATIC AGENT
              </h2>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono text-neutral-400">Agent Legal Name:</label>
                <input
                  id="char-name-input"
                  type="text"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder="e.g. Lord Charles Alisthor"
                  className="w-full bg-neutral-900 border border-neutral-800 text-xs rounded px-3 py-2 text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono text-neutral-400">Dramatic Roster Role:</label>
                <input
                  id="char-role-input"
                  type="text"
                  value={newCharRole}
                  onChange={(e) => setNewCharRole(e.target.value)}
                  placeholder="e.g. Protagonist with silent betrayal"
                  className="w-full bg-neutral-900 border border-neutral-800 text-xs rounded px-3 py-2 text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono text-neutral-400">Subconscious wound / backstory:</label>
                <textarea
                  id="char-backstory-input"
                  value={newCharBackstory}
                  onChange={(e) => setNewCharBackstory(e.target.value)}
                  placeholder="Describe historical trauma, psychological masks, and true unpardonable motivations..."
                  className="w-full h-24 bg-neutral-900 border border-neutral-800 text-xs rounded p-3 text-neutral-300 outline-none focus:border-emerald-500 font-mono resize-none"
                />
              </div>

              <button
                id="submit-cast-btn"
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-mono text-xs uppercase tracking-widest font-semibold transition-all shadow shadow-emerald-950/50 flex justify-center items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> RECORD AGENT
              </button>
            </form>

            {/* cast members list */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">ACTIVE DRAMATIC AGENTS ({characters.length})</span>
                <button
                  id="dedup-btn"
                  onClick={async () => {
                    await onDeduplicateCharacters();
                    onNotify?.('Cast list optimized and deduplicated.', 'info');
                  }}
                  className="px-2.5 py-1 hover:bg-neutral-850 text-[10px] font-mono text-emerald-400 border border-emerald-950 rounded transition-all"
                >
                  OPTIMIZE AGENTS
                </button>
              </div>

              {characters.length === 0 ? (
                <div className="border border-neutral-800 border-dashed rounded-xl py-12 text-center text-neutral-500 font-mono text-xs">
                  No active cast members recruited yet. Register an agent to begin psychic mapping.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar">
                  {characters.map(char => (
                    <div key={char.id} className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl relative hover:border-neutral-750 hover:shadow-lg transition-all flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 text-emerald-400 font-mono font-bold text-sm tracking-wide flex items-center justify-center shrink-0">
                        {char.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold text-white truncate">{char.name}</span>
                          <span className="text-[9px] font-mono uppercase bg-neutral-900 border border-neutral-850 text-neutral-400 px-1.5 py-0.5 rounded">
                            {char.role}
                          </span>
                        </div>
                        {char.backstory && (
                          <p className="text-[11px] text-neutral-400 leading-relaxed font-sans line-clamp-3 italic">"{char.backstory}"</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {char.goals?.map((g, i) => <span key={i} className="text-[8px] font-mono uppercase px-1.5 py-0.5 bg-neutral-900 rounded text-neutral-500 border border-neutral-850">goal: {g}</span>)}
                        </div>
                      </div>
                      <button
                        id={`delete-char-${char.id}`}
                        onClick={() => deleteCharacter(char.id)}
                        className="p-1 hover:bg-red-950/30 text-neutral-600 hover:text-red-400 border border-transparent hover:border-red-900/30 rounded shrink-0 transition-all"
                        title="Fictionalize out sequence"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
