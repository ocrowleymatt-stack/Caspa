import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Loader2, Map, Sparkles, Wand2 } from 'lucide-react';
import { generateBookMap, getBookMap, finishBook, suggestNextChapters } from '../../api/book';
import { getProject } from '../../api/projects';
import { FINISH_BOOK_STAGES, BOOK_MAP_STAGES } from '../../components/StagedProgress';
import { StagedProgressPanel } from '../../components/StagedProgressPanel';
import { useToast } from '../../components/Toast';

export default function ProjectBookMap() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const { data: bookMap, isLoading } = useQuery({
    queryKey: ['book-map', id],
    queryFn: () => getBookMap(id!),
    enabled: !!id,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateBookMap(id!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['book-map', id] });
      queryClient.invalidateQueries({ queryKey: ['outputs', id] });
      toast.success(`Book Map saved · ${result.outputId.slice(0, 8)}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const finishMutation = useMutation({
    mutationFn: (mode: 'diagnose' | 'plan' | 'finish-roadmap' | 'write-next-chapter') =>
      finishBook({ projectId: id!, mode }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['outputs', id] });
      queryClient.invalidateQueries({ queryKey: ['chapters', id] });
      toast.success(`Finish This Book · saved ${String(result.outputId ?? '').slice(0, 8)}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const suggestMutation = useMutation({
    mutationFn: () => suggestNextChapters({ projectId: id! }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['outputs', id] });
      toast.success(`Missing chapters suggested · ${result.outputId.slice(0, 8)}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !bookMap) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-room">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">
              <Map className="h-4 w-4" /> Book Map
            </div>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-[#171a22]">{project?.title}</h1>
            <p className="mt-2 text-sm text-muted">
              {bookMap.completionPercentage}% toward {bookMap.targetWordCount.toLocaleString()} words · next: {bookMap.nextRecommendedChapter}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="btn-primary">
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Book Map
            </button>
            <button type="button" onClick={() => suggestMutation.mutate()} disabled={suggestMutation.isPending} className="btn-secondary">
              Suggest missing chapters
            </button>
            <button type="button" onClick={() => finishMutation.mutate('plan')} disabled={finishMutation.isPending} className="btn-secondary">
              <Wand2 className="h-4 w-4" /> Finish This Book
            </button>
          </div>
        </div>
      </header>

      {(generateMutation.isPending || finishMutation.isPending || suggestMutation.isPending) && (
        <StagedProgressPanel
          label={
            finishMutation.isPending
              ? 'Finish This Book'
              : suggestMutation.isPending
                ? 'Suggesting missing chapters'
                : 'Generating Book Map'
          }
          stages={finishMutation.isPending ? FINISH_BOOK_STAGES : BOOK_MAP_STAGES}
          pending={generateMutation.isPending || finishMutation.isPending || suggestMutation.isPending}
          error={
            generateMutation.isError
              ? generateMutation.error.message
              : finishMutation.isError
                ? finishMutation.error.message
                : suggestMutation.isError
                  ? suggestMutation.error.message
                  : null
          }
        />
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper">
          <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Arc summary</h2>
          <p className="mt-3 text-sm leading-7 text-[#5f5648]">{bookMap.arcSummary}</p>
          {bookMap.missingSections.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Missing sections</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#5f5648]">
                {bookMap.missingSections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
        <article className="rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper">
          <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Finish roadmap</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-[#5f5648]">
            {bookMap.finishRoadmap.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={`/casper?projectId=${id}`} className="btn-primary text-xs">Write next chapter</Link>
            <Link to={`/projects/${id}/outputs`} className="btn-secondary text-xs">Writing History</Link>
          </div>
        </article>
      </section>

      <section className="rounded-[1.8rem] border border-[#eadfca] bg-[#fffdf8] p-5 shadow-paper">
        <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Chapters & units</h2>
        <div className="mt-4 space-y-3">
          {bookMap.chapters.map((chapter) => (
            <div key={`${chapter.order}-${chapter.title}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#eadfca] bg-white px-4 py-3">
              <div>
                <div className="font-medium text-[#171a22]">{chapter.title}</div>
                <div className="text-xs text-muted">{chapter.wordCount.toLocaleString()} words · {chapter.status}</div>
              </div>
              {chapter.unitId && (
                <Link to={`/projects/${id}/chapters/${chapter.unitId}`} className="btn-ghost text-xs">
                  <BookOpen className="h-3.5 w-3.5" /> Open
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
