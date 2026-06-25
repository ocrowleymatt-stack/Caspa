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
      className="card flex items-center gap-3 py-3 hover:border-accent/30 transition-colors"
    >
      <button type="button" className="cursor-grab text-muted hover:text-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <Link to={`/projects/${projectId}/chapters/${chapter.id}`} className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">{chapter.title}</span>
          <span className="badge bg-white/5 text-muted capitalize shrink-0">{chapter.status}</span>
        </div>
        <p className="text-xs text-muted mt-1">
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
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!project) {
    return <p className="text-muted text-center py-20">Project not found</p>;
  }

  const progress = Math.min(
    100,
    Math.round((project.currentWordCount / (project.targetWordCount || 1)) * 100),
  );

  const firstDraftChapter = chapters.find((c) => c.status !== 'final') ?? chapters[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="card bg-gradient-to-br from-surface to-accent/5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <span className="badge bg-accent/10 text-accent mb-2">{project.genre}</span>
            <h1 className="text-3xl font-bold">{project.title}</h1>
            <p className="text-muted mt-2 max-w-xl">{project.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {firstDraftChapter && (
              <Link
                to={`/projects/${id}/chapters/${firstDraftChapter.id}`}
                className="btn-primary"
              >
                <PenLine className="h-4 w-4" /> Continue Writing
              </Link>
            )}
            <Link to="/show-factory" className="btn-secondary">
              <Theater className="h-4 w-4" /> Show Pack
            </Link>
            <Link to="/publish" className="btn-secondary">
              <Upload className="h-4 w-4" /> Export
            </Link>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Words', value: stats?.wordCount ?? project.currentWordCount },
            { label: 'Chapters', value: stats?.chapterCount ?? chapters.length },
            { label: 'Characters', value: stats?.characterCount ?? 0 },
            { label: 'Progress', value: `${progress}%` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-white/5 px-4 py-3">
              <p className="text-xs text-muted uppercase tracking-wide">{stat.label}</p>
              <p className="text-xl font-semibold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-accent" /> Chapters
        </h2>
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="btn-primary"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add Chapter
        </button>
      </div>

      {chaptersLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : chapters.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="h-10 w-10 mx-auto text-muted mb-3 opacity-40" />
          <p className="text-muted mb-4">No chapters yet. Start writing your first chapter.</p>
          <button type="button" onClick={() => createMutation.mutate()} className="btn-primary">
            <Plus className="h-4 w-4" /> Create First Chapter
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {chapters.map((chapter) => (
                <SortableChapter key={chapter.id} chapter={chapter} projectId={id!} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
