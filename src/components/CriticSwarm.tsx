import React, { useState } from 'react';
import { Bug, AlertTriangle, CheckCircle, Zap, ShieldAlert, BookOpen, MessageSquare, Flame } from 'lucide-react';
import { Chapter, Critique, ProjectType, MaturityLevel, SourceMaterial } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  projectType: ProjectType;
  maturity: MaturityLevel;
  chapters: Chapter[];
  sourceMaterials: SourceMaterial[];
}

export default function CriticSwarm({ projectType, maturity, chapters, sourceMaterials }: Props) {
  const [selectedChapId, setSelectedChapId] = useState<string | null>(chapters[0]?.id || null);
  const [loading, setLoading] = useState(false);
  const [critiques, setCritiques] = useState<Critique[]>([]);

  const runSwarm = async () => {
    const chap = chapters.find(c => c.id === selectedChapId);
    if (!chap || !chap.content) return;
    
    setLoading(true);
    try {
      const results = await AIService.getSwarmCritique(chap.content, projectType, maturity, sourceMaterials);
      setCritiques(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-1 italic font-serif">Critic Swarm</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.2em]">Multi-agent specialist peer review.</p>
        </div>
        <div className="flex gap-4">
          <select 
            value={selectedChapId || ''}
            onChange={(e) => setSelectedChapId(e.target.value)}
            className="bg-white border border-slate-200 rounded px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-100"
          >
            {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button 
            onClick={runSwarm}
            disabled={loading || !selectedChapId}
            className="px-8 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded transition-all shadow-xl flex items-center gap-2 uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap size={14} className="fill-white" />}
            Trigger Swarm
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Critique Cards */}
        <div className="lg:col-span-2 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {critiques.length > 0 ? critiques.map((c, i) => (
              <motion.div 
                key={c.agentName}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      c.role === 'structural' ? 'bg-blue-50 text-blue-600' :
                      c.role === 'factual' ? 'bg-emerald-50 text-emerald-600' :
                      c.role === 'legal' ? 'bg-slate-900 text-white' :
                      c.role === 'academic' ? 'bg-indigo-50 text-indigo-600' :
                      c.role === 'comedy' ? 'bg-amber-50 text-amber-600' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {c.role === 'structural' && <BookOpen size={20} />}
                      {c.role === 'factual' && <CheckCircle size={20} />}
                      {c.role === 'legal' && <ShieldAlert size={20} />}
                      {c.role === 'academic' && <MessageSquare size={20} />}
                      {c.role === 'comedy' && <Flame size={20} />}
                      {c.role === 'vocal' && <Zap size={20} />}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">{c.agentName}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.severity === 'high' ? 'bg-red-50 text-red-600' :
                          c.severity === 'medium' ? 'bg-amber-50 text-amber-600' :
                          'bg-slate-50 text-slate-500'
                        }`}>
                          {c.severity.toUpperCase()} IMPACT
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-slate-600 text-sm leading-relaxed mb-6 font-serif italic border-l-2 border-slate-100 pl-4">
                  "{c.content}"
                </p>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Reconstruction Path</p>
                  {c.suggestions.map((s, idx) => (
                    <div key={idx} className="flex gap-3 items-start group">
                      <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-slate-500 font-medium group-hover:text-slate-900 transition-colors pt-0.5">{s}</p>
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
        <div className="bg-slate-950 text-white rounded-2xl p-8 flex flex-col gap-8 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Zap size={200} />
           </div>
           
           <header className="relative">
              <h3 className="text-lg font-black italic font-serif flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={18} />
                Logic Integrity
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Convergent AI Analysis</p>
           </header>

           <div className="space-y-6 relative flex-1">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Swarm Consensus</p>
                <p className="text-sm font-medium text-slate-300 leading-relaxed italic">
                  {critiques.length > 0 
                    ? `Consensus reached by ${critiques.length} agents. Primary bottleneck identified in ${critiques.sort((a,b) => b.severity === 'high' ? 1 : -1)[0].role} layer.` 
                    : "Awating agent activation..."
                  }
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Specialist Protocols</p>
                {['Structural', 'Dialogue', 'World Logic', 'Psychology'].map(p => (
                   <div key={p} className="flex items-center justify-between group">
                      <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{p}</span>
                      <div className="h-1 w-20 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${loading ? 'w-full animate-pulse bg-blue-500' : 'w-2/3 bg-slate-700'}`} 
                        />
                      </div>
                   </div>
                ))}
              </div>
           </div>

           <footer className="pt-6 border-t border-white/5 relative">
              <p className="text-[10px] font-bold text-slate-600 leading-relaxed italic">
                Synthetic writer's room protocol v4.2. Stability guaranteed through iterative disagreement.
              </p>
           </footer>
        </div>
      </div>
    </div>
  );
}
