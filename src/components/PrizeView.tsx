import React, { useState, useEffect } from 'react';
import { Trophy, Target, Award, TrendingUp, ChevronRight, CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { Project, Chapter, PrizeAssessment } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  project: Project;
  chapters: Chapter[];
  updateProject: (updates: Partial<Project>) => void;
}

export default function PrizeView({ project, chapters, updateProject }: Props) {
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState<PrizeAssessment[]>(project.prizeAssessments || []);

  const runAssessment = async () => {
    setLoading(true);
    try {
      const results = await AIService.assessPrizeWorthiness(project, chapters);
      setAssessments(results);
      updateProject({ prizeAssessments: results });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setTarget = (prizeName: string) => {
    updateProject({ targetPrize: prizeName });
  };

  const targetPrizeData = assessments.find(a => a.prizeName === project.targetPrize);

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full mb-4">
            <Trophy size={14} className="text-amber-600" />
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Prestige Analysis</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic font-serif">Prize Worthiness</h1>
          <p className="text-slate-500 max-w-xl font-medium mt-2">
            Real-time assessment of your manuscript's eligibility for major literary and cinematic honors. Aim high.
          </p>
        </div>
        
        <button 
          onClick={runAssessment}
          disabled={loading}
          className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl flex items-center gap-3 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="text-amber-400" />}
          Run Real-time Audit
        </button>
      </header>

      {project.targetPrize && targetPrizeData && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2rem] p-1 shadow-2xl"
        >
          <div className="bg-white rounded-[1.8rem] p-8 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Target size={200} />
            </div>
            
            <div className="flex flex-col md:flex-row gap-12 items-start relative">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Target className="text-amber-600" size={20} />
                   </div>
                   <div>
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Target Honor</h2>
                    <h3 className="text-2xl font-black text-slate-900 italic font-serif">{project.targetPrize}</h3>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <CheckCircle2 size={12} /> Strategic Advantage
                    </h4>
                    <ul className="space-y-3">
                      {targetPrizeData.pros.map((p, i) => (
                        <li key={i} className="text-xs font-medium text-slate-600 flex gap-2">
                          <span className="text-emerald-500">•</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <AlertCircle size={12} /> Narrative Gaps
                    </h4>
                    <ul className="space-y-3">
                      {targetPrizeData.cons.map((c, i) => (
                        <li key={i} className="text-xs font-medium text-slate-600 flex gap-2">
                          <span className="text-red-400">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-64 flex flex-col items-center bg-slate-50 rounded-3xl p-8 border border-slate-100">
                <div className="relative w-32 h-32 mb-4">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-slate-200"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={364.4}
                      strokeDashoffset={364.4 - (364.4 * targetPrizeData.eligibilityScore) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                      className="text-amber-500 transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-900">{targetPrizeData.eligibilityScore}%</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Match</span>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-widest leading-relaxed">
                  Calculated worthiness based on current manuscript density
                </p>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100 bg-amber-50 -mx-8 -mb-8 px-8 py-8">
               <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Sparkles size={14} /> Judge's Recommendation
               </h4>
               <p className="text-sm font-medium text-slate-700 leading-relaxed italic font-serif">
                "{targetPrizeData.recommendation}"
               </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assessments.map((a, i) => (
          <motion.div 
            key={a.prizeName}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`group p-6 rounded-3xl border transition-all ${
              project.targetPrize === a.prizeName 
              ? 'bg-slate-900 border-slate-900 shadow-xl' 
              : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                project.targetPrize === a.prizeName ? 'bg-amber-500' : 'bg-slate-50'
              }`}>
                <Award size={20} className={project.targetPrize === a.prizeName ? 'text-white' : 'text-slate-400'} />
              </div>
              <div className="text-right">
                <div className={`text-xl font-black italic font-serif ${
                  project.targetPrize === a.prizeName ? 'text-white' : 'text-slate-900'
                }`}>{a.eligibilityScore}%</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Worthiness</div>
              </div>
            </div>

            <h3 className={`text-sm font-black uppercase tracking-tight mb-4 ${
              project.targetPrize === a.prizeName ? 'text-white' : 'text-slate-900'
            }`}>
              {a.prizeName}
            </h3>

            <div className="space-y-2 mb-8">
              {a.pros.slice(0, 2).map((p, idx) => (
                <div key={idx} className="flex gap-2 text-[10px] font-medium text-slate-500">
                  <TrendingUp size={12} className="text-emerald-500 flex-shrink-0" />
                  <span className={project.targetPrize === a.prizeName ? 'text-slate-400' : ''}>{p}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setTarget(a.prizeName)}
              className={`w-full py-3 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                project.targetPrize === a.prizeName
                ? 'bg-white/10 text-white cursor-default'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {project.targetPrize === a.prizeName ? (
                <>Target Locked <CheckCircle2 size={12} /></>
              ) : (
                <>Aim for this Prize <ChevronRight size={12} /></>
              )}
            </button>
          </motion.div>
        ))}
        
        {assessments.length === 0 && !loading && (
          <div className="col-span-full py-24 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <Trophy size={48} className="mx-auto text-slate-200 mb-4" />
            <h3 className="text-lg font-black text-slate-400 italic font-serif">No Assessments Active</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-2">
              Run a real-time audit to see how your manuscript stacks up against the world's most prestigious awards.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
