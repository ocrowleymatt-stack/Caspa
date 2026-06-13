import React, { useState } from 'react';
import { Project, Character, Chapter } from '../types';
import { motion } from 'motion/react';
import { Brain, Sparkles, Smile, ShieldAlert, Zap, Compass, RefreshCw, AlertTriangle } from 'lucide-react';

interface MemoryViewProps {
  project: Project;
  characters: Character[];
  chapters: Chapter[];
  updateProject: (p: Partial<Project>) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function MemoryView({
  project,
  characters,
  chapters,
  updateProject,
  onNotify
}: MemoryViewProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(characters[0]?.id || '');

  const activeChar = characters.find(c => c.id === selectedCharacterId);

  React.useEffect(() => {
    if (!selectedCharacterId && characters.length > 0) {
      setSelectedCharacterId(characters[0].id);
    }
  }, [characters, selectedCharacterId]);

  return (
    <div id="memory-view-container" className="flex-1 flex flex-col min-h-0 bg-neutral-900 border border-neutral-800/80 rounded-xl overflow-hidden text-neutral-100">
      {/* Title Header Bar */}
      <div className="bg-neutral-950 px-6 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-950/40 border border-indigo-800/50 rounded text-indigo-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold uppercase tracking-wider text-white">PSYCHIC RELATIONSHIP CORE</h1>
            <p className="text-[10px] text-neutral-400 mt-0.5">Map subconscious character wounds, relationship tension markers, and active trauma memories.</p>
          </div>
        </div>

        {characters.length > 0 && (
          <select
            id="memory-character-select"
            value={selectedCharacterId}
            onChange={(e) => setSelectedCharacterId(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs rounded px-3 py-1.5 focus:border-indigo-500 font-mono outline-none"
          >
            <option value="">Select Mind...</option>
            {characters.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar bg-neutral-900">
        {activeChar ? (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Persona identity card */}
            <div className="p-5 bg-neutral-950 border border-neutral-850 rounded-xl flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-400 text-lg font-mono font-bold flex items-center justify-center shrink-0">
                {activeChar.name?.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-mono font-bold text-white tracking-wide">{activeChar.name}</h2>
                <div className="text-[10px] font-mono uppercase bg-neutral-900 border border-neutral-850 px-1.5 py-0.5 rounded text-neutral-400 inline-block">
                  ROSTER STRATEGIC ROLE: {activeChar.role || 'Secondary Agent'}
                </div>
                {activeChar.backstory && (
                  <p className="text-xs text-neutral-400 font-mono leading-relaxed mt-2 italic">
                    "{activeChar.backstory}"
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Core motivations and fears */}
              <div className="p-5 bg-neutral-950/40 border border-neutral-800 rounded-xl space-y-3">
                <span className="text-[10px] font-mono uppercase text-indigo-400 tracking-wider font-bold">SUBCONSCIOUS DRIVING MOTIF</span>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-neutral-500 block">PRIMARY DRAMATIC GOAL:</span>
                    <ul className="list-disc pl-4 text-xs text-neutral-300 font-sans space-y-0.5">
                      {activeChar.goals?.map((g, i) => <li key={i}>{g}</li>) || <li>None recorded.</li>}
                    </ul>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-neutral-850">
                    <span className="text-[9px] font-mono text-neutral-500 block">CORE SHAME / INNER FEAR:</span>
                    <ul className="list-disc pl-4 text-xs text-neutral-300 font-sans space-y-0.5">
                      {activeChar.fears?.map((f, i) => <li key={i}>{f}</li>) || <li>Fear of narrative failure.</li>}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Traits and Quirks */}
              <div className="p-5 bg-neutral-950/40 border border-neutral-800 rounded-xl space-y-3">
                <span className="text-[10px] font-mono uppercase text-indigo-400 tracking-wider font-bold">PSYCHOLOGICAL BEHAVIOR GRAINS</span>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-neutral-500 block">MAPPED CHARACTER TRAITS:</span>
                    <div className="flex flex-wrap gap-1">
                      {activeChar.traits?.map((t, i) => (
                        <span key={i} className="text-[9px] font-mono uppercase px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-neutral-300">{t}</span>
                      )) || <span className="text-xs italic text-neutral-500">None mapped.</span>}
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-neutral-850">
                    <span className="text-[9px] font-mono text-neutral-500 block">SENSORY BEHAVIORAL QUIRKS:</span>
                    <div className="flex flex-wrap gap-1">
                      {activeChar.quirks?.map((q, i) => (
                        <span key={i} className="text-[9px] font-mono uppercase px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-neutral-300">{q}</span>
                      )) || <span className="text-xs italic text-neutral-500">No idiosyncrasies added.</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-600 py-16">
            <Brain className="w-12 h-12 text-neutral-800 mb-2" />
            <span className="text-xs uppercase font-mono tracking-widest">COGNITIVE INDEX EMPTY</span>
            <p className="text-[10px] max-w-xs mt-1 text-neutral-650 font-mono">
              Please recruit a dramatic agent in the 'NARRATIVE DESIGN MATRIX' views to mobilize this psychological monitoring unit.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
