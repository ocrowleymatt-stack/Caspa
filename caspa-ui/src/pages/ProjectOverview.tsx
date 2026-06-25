import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FileText,
  GripVertical,
  Loader2,
  PenLine,
  Plus,
  Theater,
  Upload,
} from 'lucide-react';
import { getProject, getProjectStats } from '../api/projects';
import {
  createChapter,
  listChapters,
  reorderChapters,
} from '../api/chapters';
import { useAppStore } from '../store';
import { formatRelative } from '../lib/utils';
import { useToast } from '../components/Toast';

function SortableChapter({
  chapter,
  projectId,
}: {
  chapter: { id: string; title: string; wordCount: number; status: string; updatedAt: string };
  projectId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: chapter.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 rounded-[1.6rem] border border-[#eadfca] bg-white px-4 py-3 shadow-paper transition-all hover:-translate-y-0.5 hover:border-accent"
    >
      <button type="button" className="cursor-grab rounded-xl p-2 text-muted hover:bg-[#fff8e8] hover:text-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <Link to={`/projects/${projectId}/chapters/${chapter.id}`} className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-serif text-xl font-semibold text-[#171a22]">{chapter.title}</span>
          <span className="badge shrink-0 capitalize">{chapter.status}</span>
        </div>
        <p className="mt-1 text-xs text-muted">
          {chapter.wordCount.toLocaleString()} words · {formatRelative(chapter.updatedAt)}
        </p>
      </Link>
    </div>
  );
}

export default function ProjectOverview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);

  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ['project-stats', id],
    queryFn: () => getProjectStats(id!),
    enabled: !!id,
  });

  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ['chapters', id],
    queryFn: () => listChapters(id!),
    enabled: !!id,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createChapter(id!, {
        title: `Chapter ${chapters.length + 1}`,
        order: chapters.length,
      }),
    onSuccess: (chapter) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', id] });
      toast.success('Chapter created');
      navigate(`/projects/${id}/chapters/${chapter.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderChapters(id!, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', id] });
      toast.success('Chapters reordered');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = chapters.findIndex((c) => c.id === active.id);
    const newIndex = chapters.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(chapters, oldIndex, newIndex);
    queryClient.setQueryData(['chapters', id], reordered);
    reorderMutation.mutate(reordered.map((c) => c.id));
  };

  if (projectLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  if (!project) {
    return <p className="py-20 text-center text-muted">Project not found</p>;
  }

  const progress = Math.min(
    100,
    Math.round((project.currentWordCount / (project.targetWordCount || 1)) * 100),
  );

  const firstDraftChapter = chapters.find((c) => c.status !== 'final') ?? chapters[0];

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <section className="overflow-hidden rounded-[2.4rem] border border-[#eadfca] bg-white shadow-room">
        <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
          <div className="p-7 md:p-10">
            <span className="badge mb-4">{project.genre}</span>
            <h1 className="font-serif text-5xl font-semibold leading-none tracking-[-0.045em] text-[#171a22] md:text-6xl">
              {project.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              {project.description || 'No description yet. This room is waiting for its first proper sentence.'}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {firstDraftChapter && (
                <Link to={`/projects/${id}/chapters/${firstDraftChapter.id}`} className="btn-primary">
                  <PenLine className="h-4 w-4" /> Continue Writing
                </Link>
              )}
              <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-secondary">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                New Chapter
              </button>
              <Link to="/show-factory" className="btn-secondary">
                <Theater className="h-4 w-4" /> Show Pack
              </Link>
              <Link to="/publish" className="btn-secondary">
                <Upload className="h-4 w-4" /> Export
              </Link>
            </div>
          </div>

          <div className="border-t border-[#eadfca] bg-[#f7f1e6] p-7 lg:border-l lg:border-t-0">
            <div className="rounded-[1.8rem] border border-[#eadfca] bg-[#fffdf8] p-5 shadow-paper">
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Progress</div>
              <div className="text-5xl font-semibold text-[#171a22]">{progress}%</div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#f1e6d2]">
                <div className="h-full rounded-full bg-[#171a22]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { label: 'Words', value: stats?.wordCount ?? project.currentWordCount },
                  { label: 'Chapters', value: stats?.chapterCount ?? chapters.length },
                  { label: 'Characters', value: stats?.characterCount ?? 0 },
                  { label: 'Notes', value: stats?.noteCount ?? 0 },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#98711d]">{stat.label}</p>
                    <p className="mt-1 text-xl font-semibold text-[#171a22]">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">Manuscript</div>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">Chapters</h2>
          </div>
          <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Chapter
          </button>
        </div>

        {chaptersLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#98711d]" />
          </div>
        ) : chapters.length === 0 ? (
          <div className="rounded-[2rem] border border-[#eadfca] bg-white/85 py-14 text-center shadow-paper">
            <FileText className="mx-auto mb-4 h-12 w-12 text-[#98711d] opacity-60" />
            <p className="mb-5 text-muted">No chapters yet. Start with the first page.</p>
            <button type="button" onClick={() => createMutation.mutate()} className="btn-primary">
              <Plus className="h-4 w-4" /> Create First Chapter
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {chapters.map((chapter) => (
                  <SortableChapter key={chapter.id} chapter={chapter} projectId={id!} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  );
}
