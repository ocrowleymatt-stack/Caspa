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
    <div className="h-full overflow-y-auto overscroll-contain custom-scrollbar pb-32" style={{ minHeight: 0 }}>
      <div className="max-w-6xl mx-auto py-1 px-2.5">
      <header className="mb-1.5 flex flex-col md:flex-row md:items-end justify-between gap-1.5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full mb-1.5">
            <Trophy size={14} className="text-brand-primary" />
            <span className="text-xs font-semibold text-brand-primary uppercase tracking-widest">Mandatory Prestige Vectors</span>
          </div>
          <h1 className="text-[11px] font-semibold font-semibold text-text-primary tracking-tight italic font-serif">Acclaim & Recognition</h1>
          <p className="text-text-secondary max-w-xl font-medium mt-2">
            I do not labor in obscurity. If I am to synthesize a masterpiece, we must target specific acclaim, honors, or supreme academic distinctions. Select our objective.
          </p>
        </div>
        
        <button 
          onClick={runAssessment}
          disabled={loading}
          className="px-2 py-3 btn-nexus-primary rounded-md font-semibold text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-brand-primary/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {loading ? (
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 size={16} />
            </motion.div>
          ) : <Sparkles size={16} className="text-white" />}
          Demand Appraisal
        </button>
      </header>

      {project.targetPrize && targetPrizeData && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-1.5 bg-brand-primary/30 rounded-md p-1 shadow-2xl"
        >
          <div className="bg-brand-dark rounded-[1.8rem] p-2 md:p-3 relative overflow-hidden border border-border-subtle">
            <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
              <Target size={200} />
            </div>
            
            <div className="flex flex-col md:flex-row gap-1.5 items-start relative">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-2">
                   <div className="w-10 h-10 bg-amber-100 rounded-md flex items-center justify-center">
                    <Target className="text-amber-600" size={20} />
                   </div>
                   <div>
                    <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em]">Target Honor</h2>
                    <h3 className="text-[11px] font-semibold font-semibold text-text-primary italic font-serif">{project.targetPrize}</h3>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                      <CheckCircle2 size={12} /> Strategic Advantage
                    </h4>
                    <ul className="space-y-3">
                      {targetPrizeData.pros.map((p, i) => (
                        <li key={i} className="text-xs font-medium text-text-secondary flex gap-2">
                          <span className="text-emerald-500">•</span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-red-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                      <AlertCircle size={12} /> Narrative Gaps
                    </h4>
                    <ul className="space-y-3">
                      {targetPrizeData.cons.map((c, i) => (
                        <li key={i} className="text-xs font-medium text-text-secondary flex gap-2">
                          <span className="text-red-400">•</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-64 flex flex-col items-center bg-surface-muted rounded-md p-2 border border-border-subtle">
                <div className="relative w-32 h-32 mb-1.5">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-white/5"
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
                    <span className="text-[11px] font-semibold font-semibold text-text-primary">{targetPrizeData.eligibilityScore}%</span>
                    <span className="text-[10px] font-medium text-text-secondary uppercase">Match</span>
                  </div>
                </div>
                <p className="text-xs font-medium text-text-secondary text-center uppercase tracking-widest leading-relaxed">
                  Calculated worthiness based on current manuscript density
                </p>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border-subtle bg-amber-500/10 -mx-8 -mb-3 px-2 py-3">
               <h4 className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Sparkles size={14} /> Judge's Recommendation
               </h4>
               <p className="text-[11px] font-medium text-text-primary leading-relaxed italic font-serif">
                "{targetPrizeData.recommendation}"
               </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {assessments.map((a, i) => (
          <motion.div 
            key={a.prizeName}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`group p-3 rounded-md border transition-all ${
              project.targetPrize === a.prizeName 
              ? 'bg-brand-primary border-brand-primary shadow-xl shadow-brand-primary/20' 
              : 'bg-surface-card border-border-subtle hover:border-brand-primary shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className={`w-10 h-10 rounded-md flex items-center justify-center ${
                project.targetPrize === a.prizeName ? 'bg-white/20' : 'bg-surface-muted'
              }`}>
                <Award size={20} className={project.targetPrize === a.prizeName ? 'text-white' : 'text-text-secondary'} />
              </div>
              <div className="text-right">
                <div className={`text-xs font-semibold font-semibold italic font-serif ${
                  project.targetPrize === a.prizeName ? 'text-white' : 'text-text-primary'
                }`}>{a.eligibilityScore}%</div>
                <div className="text-[10px] font-medium text-text-secondary uppercase tracking-widest">Worthiness</div>
              </div>
            </div>

            <h3 className={`text-[11px] font-semibold uppercase tracking-tight mb-1.5 ${
              project.targetPrize === a.prizeName ? 'text-white' : 'text-text-primary'
            }`}>
              {a.prizeName}
            </h3>

            <div className="space-y-2 mb-3">
              {a.pros.slice(0, 2).map((p, idx) => (
                <div key={idx} className="flex gap-2 text-xs font-medium text-text-secondary">
                  <TrendingUp size={12} className="text-emerald-500 flex-shrink-0" />
                  <span className={project.targetPrize === a.prizeName ? 'text-white/80' : ''}>{p}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setTarget(a.prizeName)}
              className={`w-full py-3 rounded-md font-semibold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                project.targetPrize === a.prizeName
                ? 'bg-white/10 text-white cursor-default'
                : 'bg-surface-muted text-text-secondary hover:bg-brand-primary hover:text-white'
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
          <div className="col-span-full py-24 text-center bg-surface-muted rounded-md border-2 border-dashed border-border-subtle">
            <Trophy size={48} className="mx-auto text-text-secondary/20 mb-1.5" />
            <h3 className="text-lg font-semibold text-text-secondary italic font-serif">No Assessments Active</h3>
            <p className="text-xs text-text-secondary/60 max-w-xs mx-auto mt-2">
              Run a real-time audit to see how your manuscript stacks up against the world's most prestigious awards.
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
