import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Compass, Loader2, Package, Sparkles, Target } from 'lucide-react';
import { listChapters } from '../../api/chapters';
import { getBookMap } from '../../api/book';
import { getGuideState } from '../../api/studio';
import { getProductionBrief } from '../../api/studio';
import { listOutputs } from '../../api/outputs';
import { extractOutputText, normalizeOutputKind, OUTPUT_KIND_LABELS } from '../../lib/outputSemantics';
import { currentWorkLabel } from '../../lib/currentWork';
import { getProject } from '../../api/projects';

interface Props {
  projectId: string;
  currentChapterId?: string;
  className?: string;
}

export function ManuscriptGuidePanel({ projectId, currentChapterId, className }: Props) {
  const { data: guide, isLoading: guideLoading } = useQuery({
    queryKey: ['guide-state', projectId],
    queryFn: () => getGuideState(projectId),
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });

  const { data: brief } = useQuery({
    queryKey: ['production-brief', projectId],
    queryFn: () => getProductionBrief(projectId),
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId),
  });

  const { data: bookMap } = useQuery({
    queryKey: ['book-map', projectId],
    queryFn: () => getBookMap(projectId),
  });

  const { data: outputs = [] } = useQuery({
    queryKey: ['outputs', projectId],
    queryFn: () => listOutputs(projectId),
  });

  const label = currentWorkLabel(project, brief);
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const totalWords = sorted.reduce((sum, chapter) => sum + (chapter.wordCount ?? 0), 0);
  const targetWords = brief?.targetLength ?? project?.targetWordCount ?? 0;
  const progress = targetWords > 0 ? Math.min(100, Math.round((totalWords / targetWords) * 100)) : 0;

  const pendingOutputs = outputs
    .filter((output) => {
      const meta = output.metadata ?? {};
      if ((meta as Record<string, unknown>).applied) return false;
      if (!extractOutputText(meta)) return false;
      const kind = normalizeOutputKind(output.type, meta);
      if (kind === 'book-map' || kind === 'export-package' || kind === 'project-bible') return false;
      if (currentChapterId) {
        const unitId = meta.sourceChapterId ?? meta.chapterId ?? meta.unitId;
        return !unitId || unitId === currentChapterId;
      }
      return true;
    })
    .slice(0, 4);

  return (
    <aside
      className={`custom-scrollbar flex w-full max-w-sm shrink-0 flex-col border-l border-[#eadfca] bg-[#fffaf0] lg:w-80 ${className ?? ''}`}
    >
      <div className="border-b border-[#eadfca] p-4">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-[#98711d]" />
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Guide</div>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          {label} progress and next steps — Writing History stays separate until you apply.
        </p>
      </div>

      <div className="space-y-4 p-4">
        <section className="rounded-2xl border border-[#eadfca] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">
            <Target className="h-3.5 w-3.5" /> Progress
          </div>
          <div className="mt-2 text-2xl font-semibold text-[#171a22]">{totalWords.toLocaleString()} words</div>
          <p className="text-xs text-muted">
            {targetWords > 0 ? `Target ${targetWords.toLocaleString()} · ${progress}%` : 'Set creative target in Plan'}
          </p>
          {targetWords > 0 && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f1e6d2]">
              <div className="h-full rounded-full bg-[#98711d]" style={{ width: `${progress}%` }} />
            </div>
          )}
          {brief?.creativeTarget?.readerEffects?.length ? (
            <p className="mt-3 text-xs leading-5 text-[#5f5648]">
              Reader effect: {brief.creativeTarget.readerEffects.join(', ')}
            </p>
          ) : null}
        </section>

        {guideLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-[#98711d]" />
          </div>
        ) : guide ? (
          <section className="rounded-2xl border border-[#caa044] bg-[#fff8e8] p-4">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">Recommended next</div>
            <p className="mt-2 font-serif text-lg font-semibold text-[#171a22]">{guide.recommendedNextAction.label}</p>
            <p className="mt-1 text-xs leading-5 text-[#5f5648]">{guide.recommendedNextAction.reason}</p>
            <Link to={guide.recommendedNextAction.path} className="btn-primary mt-3 inline-flex w-full justify-center text-xs">
              Go <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            {guide.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-[#98711d]">
                {guide.warnings.slice(0, 2).map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {bookMap && bookMap.missingSections.length > 0 && (
          <section className="rounded-2xl border border-[#eadfca] bg-white p-4">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">Missing sections</div>
            <ul className="mt-2 space-y-1 text-xs text-[#5f5648]">
              {bookMap.missingSections.slice(0, 4).map((section) => (
                <li key={section}>• {section}</li>
              ))}
            </ul>
            <Link to={`/projects/${projectId}/book-map`} className="btn-secondary mt-3 inline-flex w-full justify-center text-xs">
              Open Book Map
            </Link>
          </section>
        )}

        {pendingOutputs.length > 0 && (
          <section className="rounded-2xl border border-[#eadfca] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">
              <Package className="h-3.5 w-3.5" /> Drafts waiting
            </div>
            <ul className="mt-3 space-y-2">
              {pendingOutputs.map((output) => {
                const kind = normalizeOutputKind(output.type, output.metadata);
                return (
                  <li key={output.id}>
                    <Link
                      to={`/outputs/${output.id}`}
                      className="block rounded-xl border border-[#eadfca] bg-[#fffdf8] px-3 py-2 transition hover:border-[#caa044]"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wide text-[#98711d]">
                        {OUTPUT_KIND_LABELS[kind]}
                      </div>
                      <div className="truncate text-sm font-semibold text-[#171a22]">{output.title}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link to={`/projects/${projectId}/outputs`} className="btn-secondary mt-3 inline-flex w-full justify-center text-xs">
              All Writing History
            </Link>
          </section>
        )}

        <section className="rounded-2xl border border-[#eadfca] bg-white p-4">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#98711d]">Quick actions</div>
          <div className="mt-3 flex flex-col gap-2">
            <Link to={`/projects/${projectId}/read`} className="btn-secondary w-full justify-center text-xs">
              <BookOpen className="h-3.5 w-3.5" /> Read full draft
            </Link>
            <Link to={`/projects/${projectId}/gold`} className="btn-secondary w-full justify-center text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Improve (Gold)
            </Link>
            <Link to={`/projects/${projectId}/manuscript`} className="btn-secondary w-full justify-center text-xs">
              {label} overview
            </Link>
          </div>
        </section>
      </div>
    </aside>
  );
}
