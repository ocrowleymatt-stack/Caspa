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
    <div className="h-full flex flex-col gap-8" style={{ minHeight: 0 }}>
      <header className="flex items-center justify-between bg-surface-card p-6 rounded-[2.5rem] border border-border-subtle shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-[0.02] transition-opacity duration-1000" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-14 h-14 bg-brand-dark rounded-2xl flex items-center justify-center text-brand-primary shadow-2xl border border-border-subtle group-hover:scale-110 transition-transform">
            <Zap size={28} className="fill-brand-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-text-primary mb-1 italic font-serif">Critic Swarm</h2>
            <p className="text-[10px] text-text-secondary font-black uppercase tracking-[0.4em] opacity-40 flex items-center gap-2">
              Multi-agent specialist peer review.
              {localCritiques.length > 0 && <span className="text-brand-primary font-black ml-2 animate-pulse">• {localCritiques.length} PERSISTED REPORTS</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-4 relative z-10">
          <select 
            value={selectedChapId || ''}
            onChange={(e) => setSelectedChapId(e.target.value)}
            className="bg-brand-dark border border-border-subtle rounded-xl px-5 py-3 text-[10px] font-black text-brand-primary uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-inner min-w-[240px] cursor-pointer"
          >
            <option value="all">WHOLE MANUSCRIPT (Overview)</option>
            {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button 
            onClick={runSwarm}
            disabled={loading}
            className="px-8 py-3 bg-brand-primary hover:bg-brand-accent text-white font-black text-[10px] rounded-xl transition-all shadow-2xl shadow-brand-primary/20 flex items-center gap-3 uppercase tracking-widest disabled:opacity-50 active:scale-95 group/btn"
          >
            {loading ? (
               <Activity size={16} className="animate-spin" />
            ) : <Zap size={16} className="fill-white group-hover/btn:animate-pulse" />}
            {loading ? 'Analyzing...' : 'Trigger Swarm'}
          </button>
        </div>
      </header>

      <div 
        className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden"
        style={{ minHeight: 0 }}
      >
        {/* Critique Cards */}
        <div className="lg:col-span-2 overflow-y-auto overscroll-contain space-y-6 pr-2 custom-scrollbar pb-32">
          <AnimatePresence mode="popLayout">
            {sortedCritiques.length > 0 ? sortedCritiques.map((c, i) => (
              <motion.div 
                key={c.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                layout
                className={`bg-surface-card border rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl transition-all relative overflow-hidden group ${
                  c.severity === 'critical' ? 'border-red-500/30 bg-brand-dark/30' : 'border-border-subtle hover:border-brand-primary/30'
                }`}
              >
                {c.severity === 'critical' && (
                  <div className="absolute top-0 right-0 w-48 h-48 -mr-24 -mt-24 bg-red-500/5 rotate-45 pointer-events-none group-hover:opacity-10 transition-opacity" />
                )}
                
                <div className="flex items-start justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-[1.25rem] shadow-2xl transition-all group-hover:scale-110 ${
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
                      {c.role === 'structural' && <BookOpen size={24} />}
                      {c.role === 'factual' && <CheckCircle size={24} />}
                      {c.role === 'legal' && <ShieldAlert size={24} />}
                      {c.role === 'sentence' && <PenTool size={24} />}
                      {c.role === 'thematic' && <Flame size={24} />}
                      {c.role === 'vocal' && <Zap size={24} />}
                      {c.role === 'agent' && <Briefcase size={24} />}
                      {c.role === 'publisher' && <Building2 size={24} />}
                      {c.role === 'market' && <Target size={24} />}
                      {c.role === 'buyer' && <ShoppingBag size={24} />}
                      {c.role === 'reader' && <Users size={24} />}
                      {c.role === 'medical' && <HeartPulse size={24} />}
                      {c.role === 'historical' && <History size={24} />}
                      {c.role === 'sensitivity' && <Globe size={24} />}
                      {c.role === 'writer' && <Wand2 size={24} />}
                      {c.role === 'comedy' && <Activity size={24} />}
                      {c.role === 'academic' && <MessageSquare size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="font-black text-text-primary text-sm uppercase tracking-widest">{c.agentName}</h4>
                        {c.timestamp && (
                          <span className="text-[10px] font-black text-text-secondary opacity-30 italic">
                            {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm ${
                          c.severity === 'critical' ? 'bg-red-600 text-white shadow-red-600/20' :
                          c.severity === 'high' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                          c.severity === 'medium' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                          'bg-surface-muted text-text-secondary border border-border-subtle'
                        }`}>
                          {c.severity} impact
                        </span>
                        <span className="text-[9px] font-black text-text-secondary uppercase tracking-[0.2em] opacity-40">{c.role} layer</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-text-primary text-lg leading-relaxed mb-8 font-serif italic border-l-4 border-brand-primary/20 pl-8 py-2 relative z-10">
                  "{c.content}"
                </p>

                <div className="space-y-4 bg-brand-dark/40 p-6 rounded-3xl border border-border-subtle relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-50 flex items-center gap-2">
                      <Target size={14} className="text-brand-primary" />
                      Corrective Directives
                    </p>
                    <div className="text-[8px] font-black text-brand-primary/40 uppercase tracking-widest">Protocol Sync: Enabled</div>
                  </div>
                  {c.suggestions.map((s, idx) => (
                    <div key={idx} className="flex gap-4 items-start p-4 rounded-2xl bg-surface-card border border-transparent hover:border-border-subtle group/item transition-all">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black transition-all shadow-lg ${
                        s.accepted ? 'bg-emerald-500 text-white scale-110 rotate-12 shadow-emerald-500/20' : 
                        s.rejected ? 'bg-red-500 text-white scale-110 -rotate-12 shadow-red-500/20' :
                        'bg-surface-muted text-text-secondary border border-border-subtle group-hover/item:border-brand-primary/30 group-hover/item:text-brand-primary'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium leading-relaxed transition-all italic font-serif ${
                          s.accepted ? 'text-text-primary font-bold' : 
                          s.rejected ? 'text-text-secondary/30 line-through opacity-30 shadow-none' :
                          'text-text-primary/70 group-hover/item:text-text-primary'
                        }`}>
                          {s.text}
                        </p>
                        <div className="flex gap-6 mt-4 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <button 
                            onClick={() => toggleSuggestion(c.id, idx, 'accepted')}
                            className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${
                              s.accepted ? 'text-emerald-500' : 'text-text-secondary hover:text-emerald-500'
                            }`}
                          >
                            <CheckCircle size={12} />
                            {s.accepted ? 'Accepted ✓' : 'Approve Fix'}
                          </button>
                          <button 
                            onClick={() => toggleSuggestion(c.id, idx, 'rejected')}
                            className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${
                              s.rejected ? 'text-red-500' : 'text-text-secondary hover:text-red-500'
                            }`}
                          >
                            <AlertTriangle size={12} />
                            {s.rejected ? 'Rejected' : 'Dismiss'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-20 border-2 border-dashed border-border-subtle rounded-[4rem] text-text-secondary bg-surface-card shadow-inner relative group overflow-hidden">
                <div className="absolute inset-0 bg-brand-primary rounded-full blur-[150px] opacity-0 group-hover:opacity-5 transition-opacity duration-1000" />
                <Bug size={100} strokeWidth={0.5} className="text-text-secondary opacity-10 mb-8 relative z-10" />
                <div className="relative z-10 max-w-xs space-y-4">
                  <p className="text-2xl font-black text-text-primary italic font-serif tracking-tight">Swarm Idle</p>
                  <p className="text-[10px] text-text-secondary font-black uppercase tracking-[0.3em] opacity-40 leading-relaxed italic mx-auto">Initialize specialist agents to pressure-test your draft architecture across all logical layers.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* System Summary Sidebar */}
        <div className="bg-brand-dark text-text-primary rounded-[3rem] p-10 flex flex-col gap-10 shadow-[0_50px_100px_rgba(0,0,0,0.5)] border border-border-subtle relative overflow-y-auto overscroll-contain custom-scrollbar group">
           <div className="absolute -top-10 -right-10 p-12 opacity-[0.02] pointer-events-none text-brand-primary group-hover:opacity-5 transition-opacity duration-1000">
              <Zap size={300} />
           </div>
           
           <header className="relative">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-2 h-2 rounded-full bg-brand-primary shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" />
                <h3 className="text-xl font-black italic font-serif tracking-tight">Critical Intelligence</h3>
              </div>
              <p className="text-[10px] text-text-secondary font-black uppercase tracking-[0.4em] opacity-40">Active Multi-Agent Sync</p>
           </header>

           <div className="space-y-8 relative flex-1">
              {chapters.some(c => (c.directives || []).length > 0) && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-8 bg-brand-primary text-white rounded-[2.5rem] shadow-2xl shadow-brand-primary/20 relative overflow-hidden group/alert"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover/alert:scale-110 transition-transform">
                    <CheckCircle size={60} />
                  </div>
                  <p className="text-[10px] text-white/60 font-black uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                    <CheckCircle size={14} className="fill-white/20" />
                    Logic Patch Buffered
                  </p>
                  <p className="text-sm font-bold leading-relaxed mb-8 italic font-serif">
                    Suggestions integrated into manuscript metadata. Run redrafting engine to apply changes.
                  </p>
                  <button 
                    onClick={() => setView('architect')}
                    className="w-full py-5 bg-white text-brand-primary rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                  >
                    <Flame size={16} className="fill-current" />
                    Deploy Scaffolding Fix
                  </button>
                </motion.div>
              )}

              <div className="p-8 bg-surface-card border border-border-subtle rounded-[2rem] hover:border-brand-primary/20 transition-colors shadow-lg group/box">
                <p className="text-[9px] font-black text-text-secondary uppercase tracking-[0.4em] opacity-30 mb-4 group-hover/box:opacity-60 transition-opacity">Swarm Consensus</p>
                <p className="text-base font-medium text-text-primary leading-[1.8] italic font-serif border-l-2 border-brand-primary/10 pl-6 group-hover/box:border-brand-primary transition-all">
                  {localCritiques.length > 0 
                    ? `Consensus reached by ${localCritiques.length} specialized agents across ${new Set(localCritiques.map(c => c.role)).size} domains.` 
                    : "Awating agent activation. Swarm is currently in passive observational state."
                  }
                </p>
              </div>

              <div className="space-y-6">
                <p className="text-[9px] font-black text-text-secondary uppercase tracking-[0.4em] opacity-30 flex items-center gap-3 border-b border-border-subtle pb-4">
                  <Activity size={14} />
                  Specialist Protocols
                </p>
                {['Dramaturgical', 'Stylistic', 'Thematic', 'World Logic', 'Marketable'].map(p => (
                   <div key={p} className="flex items-center justify-between group/p cursor-default">
                      <span className="text-[11px] font-black text-text-secondary opacity-50 group-hover/p:text-brand-primary group-hover/p:opacity-100 transition-all uppercase tracking-widest">{p}</span>
                      <div className="h-1.5 w-32 bg-surface-muted rounded-full overflow-hidden border border-border-subtle shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: loading ? '100%' : '65%' }}
                          className={`h-full transition-all duration-1000 ${loading ? 'bg-brand-primary shadow-[0_0_10px_rgba(59,130,246,0.6)]' : 'bg-text-secondary opacity-20'}`} 
                        />
                      </div>
                   </div>
                ))}
              </div>
           </div>

           <footer className="pt-8 border-t border-border-subtle relative">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-20">Protocol</p>
                  <p className="text-[10px] font-black text-text-secondary opacity-50 font-serif italic italic">Iterative Disagreement v5.0</p>
                </div>
                <div className="text-[9px] font-black text-brand-primary bg-brand-primary/5 px-3 py-1.5 rounded-xl border border-brand-primary/20 shadow-sm">AGENT_SYNC_OK</div>
              </div>
           </footer>
        </div>
      </div>
    </div>
  );
}
