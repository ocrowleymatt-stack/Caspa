import { useMemo } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { FileText, GripVertical, Loader2, Plus } from 'lucide-react';
import {
  createChapter,
  listChapters,
  reorderChapters,
} from '../../api/chapters';
import { formatRelative } from '../../lib/utils';
import { sourceRoleLabel, structureUnitLabel } from '../../lib/structureUnit';
import { useToast } from '../../components/Toast';
import type { Chapter } from '../../types';
import type { ProjectWorkbenchContext } from '../../components/workbench/ProjectWorkbenchShell';

function SortableChapter({ chapter, projectId }: { chapter: Chapter; projectId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: chapter.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 rounded-[1.6rem] border border-[#eadfca] bg-white px-4 py-3 shadow-paper transition-all hover:-translate-y-0.5 hover:border-accent"
    >
      <button
        type="button"
        className="cursor-grab rounded-xl p-2 text-muted hover:bg-[#fff8e8] hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Link to={`/projects/${projectId}/chapters/${chapter.id}`} className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-serif text-xl font-semibold text-[#171a22]">{chapter.title}</span>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {chapter.unitType && (
              <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#98711d]">
                {structureUnitLabel(chapter.unitType)}
              </span>
            )}
            {sourceRoleLabel(chapter.sourceRole) && (
              <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f5648]">
                {sourceRoleLabel(chapter.sourceRole)}
              </span>
            )}
            <span className="badge capitalize">{chapter.status}</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted">
          {chapter.wordCount.toLocaleString()} words · {formatRelative(chapter.updatedAt)}
        </p>
      </Link>
    </div>
  );
}

export default function ProjectManuscript() {
  const { projectId } = useOutletContext<ProjectWorkbenchContext>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => listChapters(projectId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createChapter(projectId, {
        title: `Chapter ${chapters.length + 1}`,
        order: chapters.length,
      }),
    onSuccess: (chapter) => {
      queryClient.invalidateQueries({ queryKey: ['chapters', projectId] });
      toast.success('Unit created');
      navigate(`/projects/${projectId}/chapters/${chapter.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderChapters(projectId, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', projectId] });
      toast.success('Units reordered');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((c) => c.id === active.id);
    const newIndex = sorted.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    queryClient.setQueryData(['chapters', projectId], reordered);
    reorderMutation.mutate(reordered.map((c) => c.id));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-[#98711d]">Manuscript</div>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">Structure units</h2>
          <p className="mt-2 text-sm text-muted">Drag to reorder. Open a unit to edit in the chapter canvas.</p>
        </div>
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="btn-primary"
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add unit
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#98711d]" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-[2rem] border border-[#eadfca] bg-white/85 py-14 text-center shadow-paper">
          <FileText className="mx-auto mb-4 h-12 w-12 text-[#98711d] opacity-60" />
          <p className="mb-5 text-muted">No units yet. Import via Casper or create the first page.</p>
          <button type="button" onClick={() => createMutation.mutate()} className="btn-primary">
            <Plus className="h-4 w-4" /> Create first unit
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sorted.map((chapter) => (
                <SortableChapter key={chapter.id} chapter={chapter} projectId={projectId} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
