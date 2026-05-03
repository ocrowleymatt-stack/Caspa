import React, { useState } from 'react';
import { Bug, AlertTriangle, CheckCircle, Zap, ShieldAlert, BookOpen, MessageSquare, Flame, Briefcase, Building2, ShoppingBag, Users, Target, PenTool, Activity, HeartPulse, History, Globe, Wand2, Scale } from 'lucide-react';
import { Chapter, Critique, ProjectType, MaturityLevel, SourceMaterial, ViewType, Project } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  projectType: ProjectType;
  maturity: MaturityLevel;
  chapters: Chapter[];
  sourceMaterials: SourceMaterial[];
  existingCritiques?: Record<string, Critique[]>;
  updateProject: (updates: Partial<Project>) => void;
  updateChapters: (chaps: Chapter[]) => void; // New prop to persist suggestions
  setView: (view: ViewType) => void;
  onError?: (msg: string) => void;
}

export default function CriticSwarm({ projectType, maturity, chapters, sourceMaterials, existingCritiques = {}, updateProject, updateChapters, setView, onError }: Props) {
  const [selectedChapId, setSelectedChapId] = useState<string | null>(chapters[0]?.id || 'all');
  const [loading, setLoading] = useState(false);
  
  // Use local state but initialize from existingCritiques for the selected chapter or 'all'
  const [localCritiques, setLocalCritiques] = useState<Critique[]>([]);

  // Sync local critiques when selected chapter changes
  React.useEffect(() => {
    const cid = selectedChapId || 'all';
    const initial = existingCritiques[cid] || [];
    setLocalCritiques(initial);
  }, [selectedChapId, existingCritiques]);

  const toggleSuggestion = (critiqueId: string, suggestionIndex: number, type: 'accepted' | 'rejected') => {
    const updatedCritiques = localCritiques.map(c => {
      if (c.id === critiqueId) {
        const updatedSuggestions = [...c.suggestions];
        const s = updatedSuggestions[suggestionIndex];
        if (type === 'accepted') {
          s.accepted = !s.accepted;
          if (s.accepted) s.rejected = false;
        } else {
          s.rejected = !s.rejected;
          if (s.rejected) s.accepted = false;
        }
        return { ...c, suggestions: updatedSuggestions };
      }
      return c;
    });
    
    setLocalCritiques(updatedCritiques);
    
    // Persist to project
    const cid = selectedChapId || 'all';
    updateProject({
      critiques: {
        ...existingCritiques,
        [cid]: updatedCritiques
      }
    } as any);

    // If accepted, add to chapter directives
    const targetChapId = selectedChapId === 'all' ? null : selectedChapId;
    if (targetChapId) {
      const critique = localCritiques.find(c => c.id === critiqueId);
      const suggestionText = critique?.suggestions[suggestionIndex].text;
      if (suggestionText) {
        const updatedChapters = chapters.map(chap => {
          if (chap.id === targetChapId) {
            const currentDirectives = chap.directives || [];
            const isAccepted = updatedCritiques.find(cx => cx.id === critiqueId)?.suggestions[suggestionIndex].accepted;
            
            let newDirectives = [...currentDirectives];
            if (isAccepted) {
              if (!newDirectives.includes(suggestionText)) newDirectives.push(suggestionText);
            } else {
              newDirectives = newDirectives.filter(d => d !== suggestionText);
            }
            return { ...chap, directives: newDirectives };
          }
          return chap;
        });
        updateChapters(updatedChapters);
      }
    }
  };

  const runSwarm = async () => {
    setLoading(true);
    try {
      let textToAnalyze = "";
      if (selectedChapId === 'all') {
        textToAnalyze = chapters.map(c => `[${c.title}]\n${c.content.slice(0, 3000)}`).join('\n\n');
      } else {
        const chap = chapters.find(c => c.id === selectedChapId);
        if (!chap || !chap.content) {
          setLoading(false);
          return;
        }
        textToAnalyze = chap.content;
      }
      
      const roles: any[] = ['vocal', 'structural', 'factual', 'agent', 'sentence', 'thematic', 'writer', 'medical', 'historical', 'sensitivity'];
      if (selectedChapId === 'all') {
        roles.push('publisher', 'market', 'buyer', 'reader');
      }
      if (projectType === 'legal') roles.push('legal');
      if (projectType === 'academic') roles.push('academic');
      if (projectType === 'experimental' || projectType === 'screenplay') roles.push('comedy');
      
      const results = await AIService.getSwarmCritique(textToAnalyze, projectType, maturity, sourceMaterials, roles);
      
      // Accumulate!
      const cid = selectedChapId || 'all';
      const updated = [...results, ...localCritiques].slice(0, 30);
      setLocalCritiques(updated);
      
      updateProject({
        critiques: {
          ...existingCritiques,
          [cid]: updated
        }
      } as any);
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Critic Swarm failed to analyze.');
    } finally {
      setLoading(false);
    }
  };

  const sortedCritiques = [...localCritiques].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return (
    <div className="h-full flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-blue-500 shadow-xl shadow-blue-500/10">
            <Zap className="fill-current" size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-1 italic font-serif">Critic Swarm</h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.2em] flex items-center gap-2">
              Multi-agent specialist peer review.
              {localCritiques.length > 0 && <span className="text-blue-600 font-black">• {localCritiques.length} PERSISTED REPORTS</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <select 
            value={selectedChapId || ''}
            onChange={(e) => setSelectedChapId(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
          >
            <option value="all">WHOLE MANUSCRIPT (Overview)</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button 
            onClick={runSwarm}
            disabled={loading}
            className="px-8 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-all shadow-xl flex items-center gap-2 uppercase tracking-widest disabled:opacity-50 active:scale-95"
          >
            {loading ? (
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full font-sans" 
              />
            ) : <Zap size={14} className="fill-white" />}
            {loading ? 'Analyzing...' : 'Trigger Swarm'}
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto lg:overflow-hidden">
        {/* Critique Cards */}
        <div className="lg:col-span-2 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {sortedCritiques.length > 0 ? sortedCritiques.map((c, i) => (
              <motion.div 
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden ${
                  c.severity === 'critical' ? 'border-red-200 bg-red-50/10' : 'border-slate-200'
                }`}
              >
                {c.severity === 'critical' && (
                  <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 bg-red-500/10 rotate-45 pointer-events-none" />
                )}
                
                <div className="flex items-start justify-between mb-6 relative">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shadow-sm ${
                      c.role === 'structural' ? 'bg-blue-600 text-white' :
                      c.role === 'factual' ? 'bg-emerald-500 text-white' :
                      c.role === 'sentence' ? 'bg-orange-500 text-white' :
                      c.role === 'thematic' ? 'bg-purple-600 text-white' :
                      c.role === 'agent' ? 'bg-rose-500 text-white' :
                      c.role === 'vocal' ? 'bg-sky-400 text-white' :
                      c.role === 'legal' ? 'bg-red-600 text-white' :
                      c.role === 'academic' ? 'bg-indigo-600 text-white' :
                      c.role === 'comedy' ? 'bg-yellow-500 text-white' :
                      c.role === 'medical' ? 'bg-rose-600 text-white' :
                      c.role === 'historical' ? 'bg-amber-700 text-white' :
                      c.role === 'sensitivity' ? 'bg-cyan-600 text-white' :
                      c.role === 'writer' ? 'bg-indigo-500 text-white' :
                      'bg-slate-900 text-white'
                    }`}>
                      {c.role === 'structural' && <BookOpen size={20} />}
                      {c.role === 'factual' && <CheckCircle size={20} />}
                      {c.role === 'legal' && <ShieldAlert size={20} />}
                      {c.role === 'sentence' && <PenTool size={20} />}
                      {c.role === 'thematic' && <Flame size={20} />}
                      {c.role === 'vocal' && <Zap size={20} />}
                      {c.role === 'agent' && <Briefcase size={20} />}
                      {c.role === 'publisher' && <Building2 size={20} />}
                      {c.role === 'market' && <Target size={20} />}
                      {c.role === 'buyer' && <ShoppingBag size={20} />}
                      {c.role === 'reader' && <Users size={20} />}
                      {c.role === 'medical' && <HeartPulse size={20} />}
                      {c.role === 'historical' && <History size={20} />}
                      {c.role === 'sensitivity' && <Globe size={20} />}
                      {c.role === 'writer' && <Wand2 size={20} />}
                      {c.role === 'comedy' && <Activity size={20} />}
                      {c.role === 'academic' && <MessageSquare size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">{c.agentName}</h4>
                        {c.timestamp && (
                          <span className="text-[8px] font-bold text-slate-300">
                            {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                          c.severity === 'critical' ? 'bg-red-600 text-white shadow-lg shadow-red-200' :
                          c.severity === 'high' ? 'bg-red-50 text-red-600' :
                          c.severity === 'medium' ? 'bg-amber-50 text-amber-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {c.severity} impact
                        </span>
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{c.role} layer</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-slate-700 text-sm leading-relaxed mb-6 font-serif italic border-l-4 border-slate-100 pl-6 py-1">
                  "{c.content}"
                </p>

                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Target size={12} className="text-blue-500" />
                    Corrective Directives
                  </p>
                  {c.suggestions.map((s, idx) => (
                    <div key={idx} className="flex gap-3 items-start p-2 rounded-lg group/item">
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-black transition-all ${
                        s.accepted ? 'bg-emerald-600 text-white rotate-12' : 
                        s.rejected ? 'bg-red-600 text-white -rotate-12' :
                        'bg-slate-200 text-slate-500 border border-slate-300 group-hover/item:border-blue-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs font-medium transition-all ${
                          s.accepted ? 'text-slate-900 font-bold' : 
                          s.rejected ? 'text-slate-300 line-through opacity-50' :
                          'text-slate-600'
                        }`}>
                          {s.text}
                        </p>
                        <div className="flex gap-3 mt-2">
                          <button 
                            onClick={() => toggleSuggestion(c.id, idx, 'accepted')}
                            className={`text-[9px] font-black uppercase tracking-widest transition-all ${
                              s.accepted ? 'text-emerald-700 underline underline-offset-4' : 'text-slate-400 hover:text-emerald-600'
                            }`}
                          >
                            {s.accepted ? 'Accepted ✓' : 'Approve Fix'}
                          </button>
                          <button 
                            onClick={() => toggleSuggestion(c.id, idx, 'rejected')}
                            className={`text-[9px] font-black uppercase tracking-widest transition-all ${
                              s.rejected ? 'text-red-700' : 'text-slate-400 hover:text-red-500'
                            }`}
                          >
                            {s.rejected ? 'Rejected' : 'Dismiss'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-20 border-2 border-dashed border-slate-200 rounded-3xl text-slate-300 bg-white">
                <Bug size={64} strokeWidth={1} className="opacity-10 mb-4" />
                <div>
                  <p className="text-lg font-bold text-slate-400 font-serif italic">Swarm Idle</p>
                  <p className="text-xs text-slate-300 font-medium uppercase tracking-widest mt-1">Initialize specialist agents to pressure-test your draft.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* System Summary Sidebar */}
        <div className="bg-slate-950 text-white rounded-3xl p-8 flex flex-col gap-8 shadow-2xl relative overflow-hidden">
           <div className="absolute -top-10 -right-10 p-12 opacity-5 pointer-events-none text-blue-500">
              <Zap size={300} />
           </div>
           
           <header className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <h3 className="text-lg font-black italic font-serif">Critical Intelligence</h3>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Multi-Agent Sync</p>
           </header>

           <div className="space-y-6 relative flex-1">
              {chapters.some(c => (c.directives || []).length > 0) && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg border border-blue-400/20"
                >
                  <p className="text-[10px] text-blue-100 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                    <CheckCircle size={10} />
                    Logic Patch Buffered
                  </p>
                  <p className="text-xs font-medium text-white leading-relaxed mb-4">
                    Suggestions integrated into manuscript metadata. Run redrafting engine to apply changes.
                  </p>
                  <button 
                    onClick={() => setView('architect')}
                    className="w-full py-4 bg-white hover:bg-blue-50 text-blue-700 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Flame size={14} className="fill-current" />
                    Deploy Scaffolding Fix
                  </button>
                </motion.div>
              )}

              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Swarm Consensus</p>
                <p className="text-sm font-medium text-slate-300 leading-relaxed italic">
                  {localCritiques.length > 0 
                    ? `Consensus reached by ${localCritiques.length} specialized agents across ${new Set(localCritiques.map(c => c.role)).size} domains.` 
                    : "Awating agent activation. Swarm is currently in passive observational state."
                  }
                </p>
              </div>

              <div className="space-y-5">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2">
                  <Activity size={10} />
                  Specialist Protocols
                </p>
                {['Dramaturgical', 'Stylistic', 'Thematic', 'World Logic', 'Marketable'].map(p => (
                   <div key={p} className="flex items-center justify-between group">
                      <span className="text-[11px] font-bold text-slate-400 group-hover:text-blue-400 transition-colors">{p}</span>
                      <div className="h-1 w-24 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: loading ? '100%' : '65%' }}
                          className={`h-full ${loading ? 'bg-blue-500 shadow-sm shadow-blue-500/50' : 'bg-slate-600'}`} 
                        />
                      </div>
                   </div>
                ))}
              </div>
           </div>

           <footer className="pt-6 border-t border-white/5 relative bg-slate-950/80">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol</p>
                  <p className="text-[10px] font-bold text-slate-400 font-serif italic">Iterative Disagreement v5.0</p>
                </div>
                <div className="text-[10px] font-black text-blue-600 bg-blue-600/10 px-2 py-0.5 rounded border border-blue-600/20">AGENT_SYNC_OK</div>
              </div>
           </footer>
        </div>
      </div>
    </div>
  );
}
