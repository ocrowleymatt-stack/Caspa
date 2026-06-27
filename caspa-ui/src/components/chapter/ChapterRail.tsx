import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PenLine, Sparkles, Wand2 } from 'lucide-react';
import { listChapters } from '../../api/chapters';
import { getBookMap } from '../../api/book';
import type { Chapter } from '../../types';

export type ChapterRailStatus = 'original' | 'draft' | 'revised' | 'missing' | 'weak' | 'needs-continuity' | 'ready';

function statusLabel(status: ChapterRailStatus): string {
  const labels: Record<ChapterRailStatus, string> = {
    original: 'Original',
    draft: 'Draft',
    revised: 'Revised',
    missing: 'Missing',
    weak: 'Weak',
    'needs-continuity': 'Continuity',
    ready: 'Ready',
  };
  return labels[status];
}

function inferStatus(chapter: Chapter): ChapterRailStatus {
  if (chapter.title.toLowerCase().includes('source')) return 'original';
  if (chapter.status === 'outline') return 'draft';
  if (chapter.status === 'revised') return 'revised';
  if ((chapter.wordCount ?? 0) < 120) return 'weak';
  return 'ready';
}

interface ChapterRailProps {
  projectId: string;
  currentChapterId: string;
  onContinue?: () => void;
  onImprove?: () => void;
  onWriteNextMissing?: (title: string) => void;
  continuePending?: boolean;
  className?: string;
}

export function ChapterRail({
  projectId,
  currentChapterId,
  onContinue,
  onImprove,
  onWriteNextMissing,
  continuePending,
  className,
}: ChapterRailProps) {
  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId),
  });

  const { data: bookMap } = useQuery({
    queryKey: ['book-map', projectId],
    queryFn: () => getBookMap(projectId),
  });

  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const currentIndex = sorted.findIndex((c) => c.id === currentChapterId);
  const prev = currentIndex > 0 ? sorted[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;
  const missingSections = bookMap?.missingSections ?? [];

  return (
    <aside className={`custom-scrollbar flex w-full max-w-[18rem] shrink-0 flex-col border-r border-[#eadfca] bg-[#fffaf0] sm:w-72 ${className ?? ''}`}>
      <div className="border-b border-[#eadfca] p-4">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Chapters</div>
        <div className="mt-3 flex gap-2">
          {prev && (
            <Link to={`/projects/${projectId}/chapters/${prev.id}`} className="btn-secondary flex-1 text-xs py-2">
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Link>
          )}
          {next && (
            <Link to={`/projects/${projectId}/chapters/${next.id}`} className="btn-secondary flex-1 text-xs py-2">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {sorted.map((chapter) => {
          const active = chapter.id === currentChapterId;
          const status = inferStatus(chapter);
          return (
            <Link
              key={chapter.id}
              to={`/projects/${projectId}/chapters/${chapter.id}`}
              className={`block rounded-xl border px-3 py-2.5 text-left transition ${
                active ? 'border-[#caa044] bg-[#fff8e8]' : 'border-transparent hover:border-[#eadfca] hover:bg-white'
              }`}
            >
              <div className="truncate text-sm font-semibold text-[#171a22]">{chapter.title}</div>
              <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-[#766b58]">
                <span>{(chapter.wordCount ?? 0).toLocaleString()} w</span>
                <span className="rounded-full bg-[#fff1c9] px-1.5 py-0.5">{statusLabel(status)}</span>
              </div>
            </Link>
          );
        })}

        {missingSections.map((title: string) => (
          <div
            key={title}
            className="rounded-xl border border-dashed border-[#caa044] bg-[#fffdf8] px-3 py-2.5"
          >
            <div className="truncate text-sm font-semibold text-[#98711d]">{title}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-[#766b58]">Missing · Book Map</div>
            {onWriteNextMissing && (
              <button
                type="button"
                onClick={() => onWriteNextMissing(title)}
                className="mt-2 text-xs font-bold text-[#98711d] hover:underline"
              >
                Draft this missing chapter
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-[#eadfca] p-3 space-y-2">
        {onContinue && (
          <button type="button" onClick={onContinue} disabled={continuePending} className="btn-primary w-full text-xs">
            <PenLine className="h-3.5 w-3.5" /> Continue this chapter
          </button>
        )}
        {onImprove && (
          <button type="button" onClick={onImprove} className="btn-secondary w-full text-xs">
            <Wand2 className="h-3.5 w-3.5" /> Improve chapter
          </button>
        )}
        {bookMap?.nextRecommendedChapter && onWriteNextMissing && (
          <button
            type="button"
            onClick={() => onWriteNextMissing(String(bookMap.nextRecommendedChapter))}
            className="btn-secondary w-full text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" /> Write next missing
          </button>
        )}
      </div>
    </aside>
  );
}
