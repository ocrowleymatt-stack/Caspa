import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Download, Loader2, PenLine } from 'lucide-react';
import { listChapters } from '../api/chapters';
import { getProject } from '../api/projects';
import { getProductionBrief } from '../api/studio';
import { currentWorkLabel } from '../lib/currentWork';
import { useAppStore } from '../store';

export default function ProjectRead() {
  const { id: projectId } = useParams<{ id: string }>();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: brief } = useQuery({
    queryKey: ['production-brief', projectId],
    queryFn: () => getProductionBrief(projectId!),
    enabled: !!projectId,
  });

  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId!),
    enabled: !!projectId,
  });


  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const totalWords = sorted.reduce((sum, c) => sum + (c.wordCount ?? 0), 0);
  const targetWords = brief?.targetLength ?? project?.targetWordCount ?? 0;
  const label = currentWorkLabel(project, brief);

  if (projectLoading || chaptersLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  if (!project || !projectId) {
    return <p className="py-20 text-center text-muted">Project not found</p>;
  }

  return (
    <div className="page-content mx-auto max-w-3xl space-y-6 pb-24">
      <header className="sticky top-0 z-10 border-b border-[#eadfca] bg-[#fffaf0]/95 px-1 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link to={`/projects/${projectId}/manuscript`} className="btn-ghost text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to {label}
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link to={`/projects/${projectId}/export`} className="btn-secondary text-xs">
              <Download className="h-3.5 w-3.5" /> Export
            </Link>
            {sorted[0] && (
              <Link to={`/projects/${projectId}/chapters/${sorted[0].id}`} className="btn-primary text-xs">
                <PenLine className="h-3.5 w-3.5" /> Edit
              </Link>
            )}
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Read mode</div>
          <h1 className="font-serif text-2xl font-semibold text-[#171a22] sm:text-3xl">{project.title}</h1>
          <p className="mt-1 text-xs text-muted">
            {totalWords.toLocaleString()} words
            {targetWords > 0 ? ` · target ${targetWords.toLocaleString()}` : ''}
            · {sorted.length} section{sorted.length === 1 ? '' : 's'}
          </p>
        </div>
        {sorted.length > 1 && (
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {sorted.map((ch) => (
              <a
                key={ch.id}
                href={`#section-${ch.id}`}
                className="shrink-0 rounded-full border border-[#eadfca] bg-white px-3 py-1 text-xs font-semibold text-[#5f5648]"
              >
                {ch.title}
              </a>
            ))}
          </nav>
        )}
      </header>

      {sorted.length === 0 ? (
        <div className="page-panel py-16 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-[#98711d] opacity-60" />
          <p className="text-muted">Nothing to read yet.</p>
          <Link to={`/projects/${projectId}/manuscript`} className="btn-primary mt-4 inline-flex">
            Open {label}
          </Link>
        </div>
      ) : (
        <article className="space-y-10">
          {sorted.map((chapter) => (
            <section key={chapter.id} id={`section-${chapter.id}`} className="scroll-mt-32">
              <h2 className="font-serif text-2xl font-semibold text-[#171a22] sm:text-3xl">{chapter.title}</h2>
              <p className="mb-4 text-xs text-muted">{chapter.wordCount.toLocaleString()} words</p>
              <div className="whitespace-pre-wrap font-serif text-lg leading-9 text-[#20202a] sm:text-xl sm:leading-10">
                {chapter.content?.trim() || (
                  <span className="text-muted italic">This section is empty.</span>
                )}
              </div>
              <div className="mt-4">
                <Link to={`/projects/${projectId}/chapters/${chapter.id}`} className="text-xs font-semibold text-[#98711d] hover:underline">
                  Edit this section →
                </Link>
              </div>
            </section>
          ))}
        </article>
      )}
    </div>
  );
}
