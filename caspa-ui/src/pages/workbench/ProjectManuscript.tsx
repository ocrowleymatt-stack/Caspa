import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  FileText,
  Loader2,
  PenLine,
  Plus,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { listChapters, createChapter } from '../../api/chapters';
import { analyseStructure, applyStructure } from '../../api/book';
import { getProductionBrief } from '../../api/studio';
import { getBookMap } from '../../api/book';
import { listOutputs } from '../../api/outputs';
import { currentWorkDescription, currentWorkLabel } from '../../lib/currentWork';
import { sourceRoleLabel, structureUnitLabel } from '../../lib/structureUnit';
import { formatRelative } from '../../lib/utils';
import { useToast } from '../../components/Toast';
import type { ProjectWorkbenchContext } from '../../components/workbench/ProjectWorkbenchShell';

export default function ProjectManuscript() {
  const { projectId, project } = useOutletContext<ProjectWorkbenchContext>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [structureReport, setStructureReport] = useState<{
    units: Array<{ title: string; wordCount: number; type: string }>;
    detectedType: string;
    confidence: string;
  } | null>(null);
  const [showStructureSuggestion, setShowStructureSuggestion] = useState(false);

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId),
  });

  const { data: brief } = useQuery({
    queryKey: ['production-brief', projectId],
    queryFn: () => getProductionBrief(projectId),
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
  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters],
  );
  const totalWords = sorted.reduce((sum, c) => sum + (c.wordCount ?? 0), 0);
  const targetWords = brief?.targetLength ?? project.targetWordCount ?? 0;
  const progress = targetWords > 0 ? Math.min(100, Math.round((totalWords / targetWords) * 100)) : 0;

  const analyseMutation = useMutation({
    mutationFn: () => analyseStructure(projectId),
    onSuccess: (result) => {
      const report = 'report' in result ? result.report : result;
      setStructureReport({
        units: report.units ?? [],
        detectedType: report.detectedType ?? 'unknown',
        confidence: report.confidence ?? 'medium',
      });
      setShowStructureSuggestion(false);
      toast.success(`CASPA found ${report.units?.length ?? 0} possible sections`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (structureReport || analyseMutation.isPending) return;
    if (sorted.length <= 1 && totalWords > 1500) {
      setShowStructureSuggestion(true);
    }
  }, [sorted.length, totalWords, structureReport, analyseMutation.isPending]);

  const applyMutation = useMutation({
    mutationFn: () => applyStructure(projectId, { importMode: 'split-into-units' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', projectId] });
      queryClient.invalidateQueries({ queryKey: ['guide-state', projectId] });
      setStructureReport(null);
      toast.success(`Created ${result.chaptersCreated} section(s) — snapshot saved`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createChapter(projectId, {
        title: `Section ${sorted.length + 1}`,
        order: sorted.length,
      }),
    onSuccess: (chapter) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', projectId] });
      navigate(`/projects/${projectId}/chapters/${chapter.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  return (
    <div className="page-content space-y-6">
      <header className="page-panel p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">{label}</div>
            <h2 className="mt-1 break-words font-serif text-2xl font-semibold text-[#171a22] sm:text-3xl">
              Where you read the actual work
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
              {currentWorkDescription(label)} Writing History holds alternatives — this is the live assembly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sorted.length > 0 && (
              <Link to={`/projects/${projectId}/read`} className="btn-primary text-sm">
                <BookOpen className="h-4 w-4" /> Read full draft
              </Link>
            )}
            <Link to={`/start?projectId=${projectId}`} className="btn-secondary text-sm">
              Creative Target
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#98711d]">Current words</div>
            <div className="mt-1 text-2xl font-semibold text-[#171a22]">{totalWords.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#98711d]">Target</div>
            <div className="mt-1 text-2xl font-semibold text-[#171a22]">
              {targetWords > 0 ? targetWords.toLocaleString() : 'Not set'}
            </div>
          </div>
          <div className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#98711d]">Sections</div>
            <div className="mt-1 text-2xl font-semibold text-[#171a22]">{sorted.length}</div>
          </div>
          <div className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[#98711d]">Progress</div>
            <div className="mt-1 text-2xl font-semibold text-[#171a22]">{targetWords > 0 ? `${progress}%` : '—'}</div>
          </div>
        </div>

        {targetWords > 0 && (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#f1e6d2]">
            <div className="h-full rounded-full bg-[#98711d]" style={{ width: `${progress}%` }} />
          </div>
        )}

        {brief?.creativeTarget?.readerEffects?.length ? (
          <p className="mt-4 text-xs leading-6 text-muted">
            Reader effect: {brief.creativeTarget.readerEffects.join(', ')}
            {brief.creativeTarget.intensity ? ` · intensity ${brief.creativeTarget.intensity}/7` : ''}
          </p>
        ) : null}

        {bookMap && bookMap.missingSections.length > 0 && (
          <p className="mt-2 text-xs text-[#98711d]">
            Missing: {bookMap.missingSections.slice(0, 4).join(' · ')}
            {bookMap.missingSections.length > 4 ? '…' : ''}
          </p>
        )}
      </header>

      {showStructureSuggestion && !structureReport && sorted.length > 0 && (
        <section className="rounded-2xl border border-[#caa044] bg-[#fff8e8] p-4 sm:p-5">
          <div className="font-serif text-lg font-semibold text-[#171a22]">
            This looks like one long block ({totalWords.toLocaleString()} words)
          </div>
          <p className="mt-1 text-sm text-muted">
            CASPA can detect chapters or scenes and split them into Current Work sections — nothing changes until you apply.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={analyseMutation.isPending}
              onClick={() => analyseMutation.mutate()}
            >
              {analyseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Analyse structure
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowStructureSuggestion(false)}>
              Not now
            </button>
          </div>
        </section>
      )}

      {structureReport && structureReport.units.length > 0 && (
        <section className="rounded-2xl border border-[#caa044] bg-[#fff8e8] p-4 sm:p-5">
          <div className="font-serif text-lg font-semibold text-[#171a22]">
            CASPA found {structureReport.units.length} possible {structureReport.detectedType} sections
          </div>
          <p className="mt-1 text-sm text-muted">Confidence: {structureReport.confidence}. Review before applying — snapshot created on apply.</p>
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
            {structureReport.units.slice(0, 12).map((u, i) => (
              <li key={i} className="truncate">
                {u.title} · {u.wordCount.toLocaleString()} words
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={applyMutation.isPending}
              onClick={() => applyMutation.mutate()}
            >
              {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create chapters/scenes
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setStructureReport(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {sorted.length === 0 ? (
        <section className="page-panel py-12 text-center sm:py-14">
          <FileText className="mx-auto mb-4 h-12 w-12 text-[#98711d] opacity-60" />
          <p className="font-serif text-xl font-semibold text-[#171a22]">No current work assembled yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Add source material, set your creative target, then analyse structure or auto-write the first section.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to={`/projects/${projectId}/sources`} className="btn-primary">
              <Upload className="h-4 w-4" /> Add material
            </Link>
            <button
              type="button"
              className="btn-secondary"
              disabled={analyseMutation.isPending}
              onClick={() => analyseMutation.mutate()}
            >
              {analyseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Analyse structure
            </button>
            <Link to={`/casper?projectId=${projectId}`} className="btn-secondary">
              <Sparkles className="h-4 w-4" /> Auto-write first section
            </Link>
            <button type="button" className="btn-secondary" onClick={() => createMutation.mutate()}>
              <Plus className="h-4 w-4" /> Start blank section
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted">{sorted.length} section{sorted.length === 1 ? '' : 's'} in current work</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={analyseMutation.isPending}
                onClick={() => analyseMutation.mutate()}
              >
                Analyse structure
              </button>
              <Link to={`/projects/${projectId}/book-map`} className="btn-secondary text-xs">
                Finish roadmap
              </Link>
              <Link to={`/projects/${projectId}/gold`} className="btn-secondary text-xs">
                Make better
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {sorted.map((chapter) => {
              const relatedOutput = outputs.find(
                (o) =>
                  o.metadata?.chapterId === chapter.id
                  && !(o.metadata as Record<string, unknown> | undefined)?.applied,
              );
              return (
                <article
                  key={chapter.id}
                  className="rounded-2xl border border-[#eadfca] bg-white p-4 shadow-paper sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/projects/${projectId}/chapters/${chapter.id}`}
                        className="font-serif text-xl font-semibold text-[#171a22] hover:text-[#98711d]"
                      >
                        {chapter.title}
                      </Link>
                      <p className="mt-1 text-xs text-muted">
                        {chapter.wordCount.toLocaleString()} words · {formatRelative(chapter.updatedAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {chapter.unitType && (
                          <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#98711d]">
                            {structureUnitLabel(chapter.unitType)}
                          </span>
                        )}
                        {sourceRoleLabel(chapter.sourceRole) && (
                          <span className="rounded-full border border-[#eadfca] px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                            {sourceRoleLabel(chapter.sourceRole)}
                          </span>
                        )}
                        <span className="badge capitalize">{chapter.status}</span>
                      </div>
                      {relatedOutput && (
                        <p className="mt-2 text-xs text-[#98711d]">
                          Draft waiting: {relatedOutput.title}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/projects/${projectId}/chapters/${chapter.id}`} className="btn-primary text-xs">
                        <PenLine className="h-3.5 w-3.5" /> Edit
                      </Link>
                      <Link
                        to={`/casper?projectId=${projectId}&chapterId=${chapter.id}`}
                        className="btn-secondary text-xs"
                      >
                        Expand
                      </Link>
                      {relatedOutput && (
                        <Link to={`/outputs/${relatedOutput.id}`} className="btn-secondary text-xs">
                          Apply draft
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <p className="text-center text-xs text-muted">
        Alternatives and old versions live in{' '}
        <Link to={`/projects/${projectId}/outputs`} className="font-semibold text-[#98711d] hover:underline">
          Writing History
        </Link>
        {' '}— not here.
      </p>
    </div>
  );
}
