import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, RefreshCw, Target, BookOpen, Layers, CheckCircle2, Scissors } from 'lucide-react';
import { Project, Chapter } from '../types';

interface Props {
  project: Project;
  chapters: Chapter[];
  updateProject: (updates: Partial<Project>) => void;
}

const PASS_CONFIG = [
  { pass: 1, label: 'First Pass', pct: 0.10, color: 'from-slate-600 to-slate-500', accent: 'text-slate-300', bar: 'bg-slate-400', description: 'Skeletal prose — scene beats and structure only.' },
  { pass: 2, label: 'Second Pass', pct: 0.25, color: 'from-indigo-700 to-indigo-600', accent: 'text-indigo-300', bar: 'bg-indigo-400', description: 'Expanded scenes + chapter & architecture reassessment.' },
  { pass: 3, label: 'Third Pass', pct: 0.75, color: 'from-violet-700 to-violet-600', accent: 'text-violet-300', bar: 'bg-violet-400', description: 'Near-final prose + deep architecture reassessment.' },
  { pass: 4, label: 'Final Pass', pct: 1.0, color: 'from-amber-700 to-amber-600', accent: 'text-amber-300', bar: 'bg-amber-400', description: 'Final polish — full target word count.' },
];

export function getDraftPassConfig(pass: number) { return PASS_CONFIG.find(p => p.pass === pass) ?? PASS_CONFIG[0]; }
export function getDraftPassWordTarget(pass: number, targetWordCount: number, chapterCount: number): number {
  const cfg = getDraftPassConfig(pass);
  return Math.round((targetWordCount * cfg.pct) / Math.max(1, chapterCount));
}

export default function DraftStagePanel({ project, chapters, updateProject }: Props) {
  const [confirming, setConfirming] = useState(false);
  const currentPass = project.draftStage ?? 1;
  const cfg = getDraftPassConfig(currentPass);
  const chapterCount = Math.max(1, chapters.length);
  const perChapterTarget = getDraftPassWordTarget(currentPass, project.targetWordCount ?? 80000, chapterCount);
  const totalTarget = Math.round((project.targetWordCount ?? 80000) * cfg.pct);
  const totalWords = chapters.reduce((sum, c) => {
    const words = c.content?.trim() ? c.content.trim().split(/\s+/).filter(t => t.length > 0).length : 0;
    return sum + words;
  }, 0);
  const progress = totalTarget > 0 ? Math.min(1, totalWords / totalTarget) : 0;

  const handleAdvance = () => {
    if (currentPass >= 4) return;
    const nextPass = (currentPass + 1) as 1 | 2 | 3 | 4;
    const history = [...(project.draftPassHistory ?? []), { pass: currentPass, completedAt: Date.now(), wordCountAtCompletion: totalWords }];
    updateProject({ draftStage: nextPass, draftPassHistory: history });
    setConfirming(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-md border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
      <div className={`bg-gradient-to-r ${cfg.color} px-2 py-3 flex items-center gap-1.5`}>
        <Layers size={16} className="text-white/80 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">Draft Stage</p>
          <p className="text-[11px] font-medium text-white truncate">{cfg.label} — {Math.round(cfg.pct * 100)}% Target</p>
        </div>
        <span className="text-xs font-mono text-white/60 shrink-0">Pass {currentPass}/4</span>
      </div>
      <div className="px-2 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/50">Progress toward pass target</span>
          <span className={`text-xs font-mono font-semibold ${cfg.accent}`}>{totalWords.toLocaleString()} / {totalTarget.toLocaleString()} words</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div className={`h-full rounded-full ${cfg.bar}`} initial={{ width: 0 }} animate={{ width: `${Math.round(progress * 100)}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
        </div>
        <p className="text-xs text-white/40 mt-1">{Math.round(progress * 100)}% complete</p>
      </div>
      <div className="px-2 py-2">
        <p className="text-xs text-white/50 leading-relaxed">{cfg.description}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-white/40"><Target size={11} /><span>~{perChapterTarget.toLocaleString()} words per chapter this pass</span></div>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/40"><BookOpen size={11} /><span>Full manuscript target: {(project.targetWordCount ?? 80000).toLocaleString()} words</span></div>
      </div>
      {(project.draftPassHistory ?? []).length > 0 && (
        <div className="px-2 pb-2">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Completed Passes</p>
          <div className="flex flex-wrap gap-1">
            {(project.draftPassHistory ?? []).map(h => (
              <span key={h.pass} className="inline-flex items-center gap-1 text-xs bg-white/5 border border-white/10 rounded px-2 py-0.5">
                <CheckCircle2 size={10} className="text-green-400" />Pass {h.pass} — {h.wordCountAtCompletion.toLocaleString()} words
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="px-2 pb-4 space-y-3">
        <button 
          onClick={() => updateProject({ cutMode: !project.cutMode })}
          className={`w-full flex items-center justify-between p-3 rounded-md border transition-all ${
            project.cutMode 
              ? 'bg-red-500/10 border-red-500/30 text-red-500' 
              : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
          }`}
        >
          <div className="flex items-center gap-1.5 text-left">
            <div className={`p-1.5 rounded ${project.cutMode ? 'bg-red-500/20' : 'bg-white/5'}`}>
              <Scissors size={14} className={project.cutMode ? 'text-red-500' : 'text-white/40'} />
            </div>
            <div>
              <p className="text-xs font-medium leading-tight">Cut & Compress Mode</p>
              <p className="text-xs opacity-70 leading-tight">
                {project.cutMode ? 'All AI redraft operations will actively cut and compress.' : 'Standard AI expansion enabled.'}
              </p>
            </div>
          </div>
          <div className={`w-8 h-4 rounded-full relative transition-colors ${project.cutMode ? 'bg-red-500' : 'bg-white/20'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${project.cutMode ? 'right-0.5' : 'left-0.5'}`} />
          </div>
        </button>

        {currentPass < 4 && (
          <div>
            {!confirming ? (
              <button onClick={() => setConfirming(true)} className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded border border-white/15 text-white/60 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all">
                <ChevronRight size={13} />Advance to Pass {currentPass + 1} ({Math.round(PASS_CONFIG[currentPass].pct * 100)}% target)
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleAdvance} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all"><RefreshCw size={12} />Confirm Advance</button>
                <button onClick={() => setConfirming(false)} className="px-3 text-xs text-white/40 hover:text-white/70 transition-colors">Cancel</button>
              </div>
            )}
          </div>
        )}
        {currentPass === 4 && (
          <div className="flex items-center gap-2 text-xs text-amber-300/70 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
            <CheckCircle2 size={13} />Final pass — manuscript complete when target is reached.
          </div>
        )}
      </div>
    </motion.div>
  );
}
