/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Users, Plus, Trash2, Shield, Target, ScrollText, Flame, Zap, UserCircle } from 'lucide-react';
import { Project, Character, ResearchNote, Chapter } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  project: Project;
  research: ResearchNote[];
  chapters?: Chapter[];
  updateProject: (updates: Partial<Project>) => void;
  onError?: (msg: string) => void;
}

export default function CharacterForge({ project, research, chapters = [], updateProject, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [newCharConcept, setNewCharConcept] = useState('');
  const [archetype, setArchetype] = useState('');

  const handleGenerate = async () => {
    if (!newCharConcept) return;
    setLoading(true);
    try {
      const char = await AIService.generateCharacter(newCharConcept, project.type, research, project.maturity);
      updateProject({
        characters: [...(project.characters || []), char]
      });
      setNewCharConcept('');
      setArchetype('');
      setSelectedChar(char);
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Character generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!chapters.length) return;
    setExtracting(true);
    try {
      const extracted = await AIService.extractCharacters(chapters, project);
      if (extracted.length === 0) {
        onError?.("No new characters detected in current manuscript.");
        return;
      }
      updateProject({
        characters: [...(project.characters || []), ...extracted]
      });
      if (!selectedChar && extracted.length > 0) {
        setSelectedChar(extracted[0]);
      }
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Character extraction failed.');
    } finally {
      setExtracting(false);
    }
  };

  const deleteCharacter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateProject({
      characters: (project.characters || []).filter(c => c.id !== id)
    });
    if (selectedChar?.id === id) setSelectedChar(null);
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-8 min-h-0 overflow-y-auto md:overflow-hidden">
      {/* Left List */}
      <div className="w-full md:w-80 flex flex-col gap-6 shrink-0 md:border-r border-slate-100 md:pr-6">
        <header className="text-center md:text-left">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mb-1">Character Forge</h2>
          <p className="text-xs text-slate-500 font-medium italic">Architecting the human element.</p>
        </header>

        <div className="space-y-4">
          <button 
            onClick={handleExtract}
            disabled={extracting || !chapters.some(c => c.content)}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            {extracting ? (
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full" 
              />
            ) : <Plus size={14} />}
            Absorb from Manuscript
          </button>

          <div className="space-y-2">
            <input 
              value={newCharConcept}
              onChange={(e) => setNewCharConcept(e.target.value)}
              placeholder="Core Concept: Broken war vet..."
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none shadow-sm placeholder:italic"
            />
            <input 
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              placeholder="Archetype: The Hero (optional)"
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none shadow-sm placeholder:italic"
            />
            <button 
              onClick={handleGenerate}
              disabled={loading || !newCharConcept}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 text-sm font-bold"
            >
              {loading ? (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" 
                />
              ) : <Zap size={16} />}
              Initialize Profile
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-450px)] pr-2 custom-scrollbar">
            {(project.characters || []).map((char) => (
              <motion.button
                layout
                key={char.id}
                onClick={() => setSelectedChar(char)}
                className={`w-full group p-4 rounded-lg border transition-all duration-200 flex items-center justify-between ${
                  selectedChar?.id === char.id 
                    ? 'bg-blue-50 border-blue-200 text-slate-900 shadow-sm shadow-blue-50' 
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${
                    selectedChar?.id === char.id ? 'bg-blue-600 text-white' : 'bg-slate-100 group-hover:bg-slate-200 text-slate-500'
                  }`}>
                    {char.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className={`font-bold text-sm truncate w-32 ${selectedChar?.id === char.id ? 'text-slate-900' : 'text-slate-700'}`}>{char.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{char.role}</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => deleteCharacter(char.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-red-600 transition-all text-slate-300"
                >
                  <Trash2 size={14} />
                </button>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Detail */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
        <AnimatePresence mode="wait">
          {selectedChar ? (
            <motion.div 
              key={selectedChar.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="p-4 md:p-10 space-y-10 overflow-y-auto flex-1 custom-scrollbar"
            >
              <header className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4">
                <div className="text-center md:text-left">
                  <h3 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900 mb-2 italic font-serif">{selectedChar.name}</h3>
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-center gap-2">
                       <Shield size={16} className="text-blue-600" />
                       <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 ">{selectedChar.role}</span>
                    </div>
                    {selectedChar.archetype && (
                       <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full">
                          <UserCircle size={14} className="text-slate-400" />
                          <span className="text-[10px] font-black uppercase text-slate-500">{selectedChar.archetype}</span>
                       </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 max-w-[300px] justify-end">
                  {selectedChar.traits.slice(0, 4).map(trait => (
                    <span key={trait} className="text-[10px] font-black p-2 bg-slate-50 border border-slate-200 rounded text-slate-500 uppercase tracking-widest">{trait}</span>
                  ))}
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-10">
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-300 flex items-center gap-2 uppercase tracking-[0.2em]">
                      <ScrollText size={14} className="text-blue-600" />
                      Bio-Archive
                    </h4>
                    <p className="text-slate-600 leading-relaxed text-lg font-serif">
                      {selectedChar.backstory}
                    </p>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-300 flex items-center gap-2 uppercase tracking-[0.2em]">
                      <Flame size={14} className="text-orange-500" />
                      Core Fears & Quirks
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fears</p>
                        {selectedChar.fears.map((fear, i) => (
                           <div key={i} className="text-xs text-slate-500 leading-relaxed">• {fear}</div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quirks</p>
                        {selectedChar.quirks.map((quirk, i) => (
                           <div key={i} className="text-xs text-slate-500 leading-relaxed">• {quirk}</div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-10">
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-300 flex items-center gap-2 uppercase tracking-[0.2em]">
                      <Target size={14} className="text-indigo-600" />
                      Psychological Drivers
                    </h4>
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg shadow-inner">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivations</p>
                        <ul className="space-y-2">
                          {selectedChar.motivations.map((m, i) => (
                             <li key={i} className="text-xs text-slate-600">• {m}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 bg-white border border-slate-100 rounded-lg shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Primary Goals</p>
                        <ul className="space-y-2">
                          {selectedChar.goals.map((goal, i) => (
                            <li key={i} className="text-xs text-slate-600 font-medium">
                              {goal}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 text-slate-200">
              {loading ? (
                <div className="flex flex-col items-center gap-4">
                   <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="w-12 h-12 rounded-lg border-2 border-slate-100 border-t-blue-600 shadow-xl"
                  />
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Synthesizing identity...</p>
                </div>
              ) : (
                <>
                  <Users size={64} strokeWidth={1} className="opacity-10 text-slate-300" />
                  <div className="max-w-xs space-y-2">
                    <p className="text-lg font-bold text-slate-400">Biological Registry Offline</p>
                    <p className="text-xs text-slate-300 font-medium italic">Select or initialize a core شخصیت from the forge.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
