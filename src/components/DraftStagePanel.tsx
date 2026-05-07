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
  {
    pass: 1,
    label: 'First Pass',
    pct: 0.10,
    color: 'from-slate-600 to-slate-500',
    accent: 'text-slate-300',
    bar: 'bg-slate-400',
    description: 'Skeletal prose — scene beats and structure only.',
    instruction: 'Write a skeletal first pass: establish the scene, key beats, and narrative momentum. Aim for approximately {target} words. Do not over-write — this is scaffolding.',
  },
  {
    pass: 2,
    label: 'Second Pass',
    pct: 0.25,
    color: 'from-indigo-700 to-indigo-600',
    accent: 'text-indigo-300',
    bar: 'bg-indigo-400',
    description: 'Expanded scenes + chapter & architecture reassessment.',
    instruction: 'Expand the skeletal draft into fuller scenes. Aim for approximately {target} words. Reassess chapter order and narrative architecture — suggest any structural improvements needed.',
  },
  {
    pass: 3,
    label: 'Third Pass',
    pct: 0.75,
    color: 'from-violet-700 to-violet-600',
    accent: 'text-violet-300',
    bar: 'bg-violet-400',
    description: 'Near-final prose + deep architecture reassessment.',
    instruction: 'Write near-final prose for this chapter. Aim for approximately {target} words. Reassess the chapter\'s role in the overall arc — flag any pacing, tension, or thematic issues.',
  },
  {
    pass: 4,
    label: 'Final Pass',
    pct: 1.0,
    color: 'from-amber-700 to-amber-600',
    accent: 'text-amber-300',
    bar: 'bg-amber-400',
    description: 'Final polish — full target word count.',
    instruction: 'Write the final, polished version of this chapter. Aim for exactly {target} words. This is the definitive draft — prioritise voice, rhythm, and emotional resonance.',
  },
];

export function getDraftPassConfig(pass: number) {
  return PASS_CONFIG.find(p => p.pass === pass) ?? PASS_CONFIG[0];
}

export function getDraftPassWordTarget(pass: number, targetWordCount: number, chapterCount: number): number {
  const cfg = getDraftPassConfig(pass);
  const perChapter = Math.max(1, chapterCount);
  return Math.round((targetWordCount * cfg.pct) / perChapter);
}

export default function DraftStagePanel({ project, chapters, updateProject }: Props) {
  const [confirming, setConfirming] = useState(false);
  const currentPass = project.draftStage ?? 1;
  const cfg = getDraftPassConfig(currentPass);
  const chapterCount = Math.max(1, chapters.length);
  const perChapterTarget = getDraftPassWordTarget(currentPass, project.targetWordCount ?? 80000, chapterCount);
  const totalTarget = Math.round((project.targetWordCount ?? 80000) * cfg.pct);

  // Calculate actual word count across all chapters
  const totalWords = chapters.reduce((sum, c) => {
    const words = c.content?.trim() ? c.content.trim().split(/\s+/).filter(t => t.length > 0).length : 0;
    return sum + words;
  }, 0);
  const progress = totalTarget > 0 ? Math.min(1, totalWords / totalTarget) : 0;

  const handleAdvance = () => {
    if (currentPass >= 4) return;
    const nextPass = (currentPass + 1) as 1 | 2 | 3 | 4;
    const history = [...(project.draftPassHistory ?? []), {
      pass: currentPass,
      completedAt: Date.now(),
      wordCountAtCompletion: totalWords,
    }];
    updateProject({ draftStage: nextPass, draftPassHistory: history });
    setConfirming(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${cfg.color} px-4 py-3 flex items-center gap-3`}>
        <Layers size={16} className="text-white/80 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">Draft Stage</p>
          <p className="text-sm font-bold text-white truncate">{cfg.label} — {Math.round(cfg.pct * 100)}% Target</p>
        </div>
        <span className="text-xs font-mono text-white/60 shrink-0">Pass {currentPass}/4</span>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/50">Progress toward pass target</span>
          <span className={`text-xs font-mono font-semibold ${cfg.accent}`}>
            {totalWords.toLocaleString()} / {totalTarget.toLocaleString()} words
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${cfg.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-white/40 mt-1">{Math.round(progress * 100)}% complete</p>
      </div>

      {/* Description */}
      <div className="px-4 py-2">
        <p className="text-xs text-white/50 leading-relaxed">{cfg.description}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-white/40">
          <Target size={11} />
          <span>~{perChapterTarget.toLocaleString()} words per chapter this pass</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
          <BookOpen size={11} />
          <span>Full manuscript target: {(project.targetWordCount ?? 80000).toLocaleString()} words</span>
        </div>
      </div>

      {/* Pass history */}
      {(project.draftPassHistory ?? []).length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Completed Passes</p>
          <div className="flex flex-wrap gap-1">
            {(project.draftPassHistory ?? []).map(h => (
              <span key={h.pass} className="inline-flex items-center gap-1 text-xs bg-white/5 border border-white/10 rounded px-2 py-0.5">
                <CheckCircle2 size={10} className="text-green-400" />
                Pass {h.pass} — {h.wordCountAtCompletion.toLocaleString()} words
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Advance button */}
      {currentPass < 4 && (
        <div className="px-4 pb-4">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-lg border border-white/15 text-white/60 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
            >
              <ChevronRight size={13} />
              Advance to Pass {currentPass + 1} ({Math.round(PASS_CONFIG[currentPass].pct * 100)}% target)
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleAdvance}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all"
              >
                <RefreshCw size={12} />
                Confirm Advance
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="px-3 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      {currentPass === 4 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 text-xs text-amber-300/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 size={13} />
            Final pass — manuscript complete when target is reached.
          </div>
        </div>
      )}

      {/* Cut & Compress toggle */}
      <div className="px-4 pb-4 border-t border-white/5 pt-3">
        <button
          onClick={() => updateProject({ cutMode: !project.cutMode })}
          className={`w-full flex items-center justify-between gap-2 text-xs font-semibold py-2 px-3 rounded-lg border transition-all ${
            project.cutMode
              ? 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/20'
              : 'border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 hover:bg-white/5'
          }`}
        >
          <span className="flex items-center gap-2">
            <Scissors size={12} />
            Cut & Compress Mode
          </span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            project.cutMode ? 'bg-red-500/30 text-red-200' : 'bg-white/5 text-white/30'
          }`}>
            {project.cutMode ? 'ON' : 'OFF'}
          </span>
        </button>
        {project.cutMode && (
          <p className="text-[10px] text-red-300/60 mt-1.5 leading-relaxed">
            All AI redraft operations will actively cut, compress, and delete bloat. Output will be shorter than input.
          </p>
        )}
      </div>
    </motion.div>
  );
}
