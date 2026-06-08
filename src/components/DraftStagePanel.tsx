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

  const passColors = ['', 'text-text-tertiary', 'text-blue-400', 'text-violet-400', 'text-amber-400'];
  const passBars = ['', 'bg-text-tertiary', 'bg-blue-400', 'bg-violet-400', 'bg-amber-400'];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border-subtle bg-surface-card overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center">
          <Layers size={13} className="text-brand-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-primary">{cfg.label}</p>
          <p className="text-[10px] text-text-tertiary">{cfg.description}</p>
        </div>
        <span className="badge-teal">Pass {currentPass}/4</span>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-text-tertiary">Pass target progress</span>
          <span className={`text-[10px] font-semibold font-mono ${passColors[currentPass]}`}>
            {totalWords.toLocaleString()} / {totalTarget.toLocaleString()}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${passBars[currentPass]}`}
            style={currentPass === 1 ? { background: '#14b8a6' } : {}}
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[9px] text-text-tertiary">
          <span className="flex items-center gap-1"><Target size={9} />{perChapterTarget.toLocaleString()} words/chapter</span>
          <span>{Math.round(progress * 100)}% complete</span>
          <span className="flex items-center gap-1"><BookOpen size={9} />{(project.targetWordCount ?? 80000).toLocaleString()} total</span>
        </div>
      </div>

      {/* Pass history */}
      {(project.draftPassHistory ?? []).length > 0 && (
        <div className="px-4 py-2 border-b border-border-subtle">
          <p className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1.5">Completed</p>
          <div className="flex flex-wrap gap-1.5">
            {(project.draftPassHistory ?? []).map(h => (
              <span key={h.pass} className="inline-flex items-center gap-1 text-[10px] bg-status-success/10 border border-status-success/20 text-status-success rounded-lg px-2 py-0.5">
                <CheckCircle2 size={9} />Pass {h.pass} — {h.wordCountAtCompletion.toLocaleString()}w
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="px-4 py-3 space-y-2">
        {/* Cut mode toggle */}
        <button 
          onClick={() => updateProject({ cutMode: !project.cutMode })}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
            project.cutMode 
              ? 'bg-status-error/10 border-status-error/30 text-status-error' 
              : 'bg-surface-raised border-border-subtle text-text-tertiary hover:border-border-medium hover:text-text-secondary'
          }`}
        >
          <div className="flex items-center gap-2 text-left">
            <Scissors size={12} />
            <div>
              <p className="text-[10px] font-semibold leading-tight">Cut & Compress Mode</p>
              <p className="text-[9px] opacity-70">{project.cutMode ? 'Active — AI will cut and compress' : 'Off — standard expansion'}</p>
            </div>
          </div>
          <div className={`w-7 h-3.5 rounded-full relative transition-colors shrink-0 ${
            project.cutMode ? 'bg-status-error' : 'bg-border-medium'
          }`}>
            <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${
              project.cutMode ? 'right-0.5' : 'left-0.5'
            }`} />
          </div>
        </button>

        {/* Advance pass */}
        {currentPass < 4 && (
          !confirming ? (
            <button onClick={() => setConfirming(true)}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-xl border border-border-medium text-text-secondary hover:text-brand-primary hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-all"
            >
              <ChevronRight size={13} />Advance to Pass {currentPass + 1} ({Math.round(PASS_CONFIG[currentPass].pct * 100)}% target)
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleAdvance}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl bg-brand-primary/15 border border-brand-primary/40 text-brand-primary hover:bg-brand-primary/25 transition-all"
              >
                <RefreshCw size={12} />Confirm Advance
              </button>
              <button onClick={() => setConfirming(false)} className="px-3 text-xs text-text-tertiary hover:text-text-secondary transition-colors">Cancel</button>
            </div>
          )
        )}
        {currentPass === 4 && (
          <div className="flex items-center gap-2 text-[10px] text-status-warning bg-status-warning/10 border border-status-warning/20 rounded-xl px-3 py-2">
            <CheckCircle2 size={12} />Final pass — manuscript complete when target is reached.
          </div>
        )}
      </div>
    </motion.div>
  );
}
