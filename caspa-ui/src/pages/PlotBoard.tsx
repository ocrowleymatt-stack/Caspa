import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { GripVertical, Loader2, Map, Plus, Trash2 } from 'lucide-react';
import {
  createPlotPoint,
  deletePlotPoint,
  listPlotPoints,
  reorderPlotPoints,
  updatePlotPoint,
} from '../api/plot';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import { useToast } from '../components/Toast';
import type { PlotPoint } from '../types';

const plotTypes: PlotPoint['type'][] = [
  'inciting-incident',
  'rising-action',
  'climax',
  'falling-action',
  'resolution',
  'other',
];

const typeColors: Record<PlotPoint['type'], string> = {
  'inciting-incident': 'bg-amber-500/20 text-amber-300',
  'rising-action': 'bg-blue-500/20 text-blue-300',
  climax: 'bg-red-500/20 text-red-300',
  'falling-action': 'bg-purple-500/20 text-purple-300',
  resolution: 'bg-emerald-500/20 text-emerald-300',
  other: 'bg-slate-500/20 text-slate-300',
};

const emptyForm = {
  title: '',
  description: '',
  type: 'other' as PlotPoint['type'],
};

function SortablePlotPoint({
  point,
  onEdit,
  onDelete,
}: {
  point: PlotPoint;
  onEdit: (point: PlotPoint) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: point.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card flex items-start gap-3 py-3 hover:border-accent/30 transition-colors group"
    >
      <button
        type="button"
        className="cursor-grab text-muted hover:text-foreground mt-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted font-mono">#{point.order + 1}</span>
          <h3 className="font-medium">{point.title}</h3>
          <span className={cn('badge capitalize text-[10px]', typeColors[point.type])}>
            {point.type.replace(/-/g, ' ')}
          </span>
        </div>
        {point.description && (
          <p className="text-sm text-muted mt-1 line-clamp-2">{point.description}</p>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={() => onEdit(point)} className="btn-secondary text-xs py-1">
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(point.id)}
          className="btn-ghost p-1 text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function PlotBoard() {
  const { id: projectId } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlotPoint | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  const { data: plotPoints = [], isLoading } = useQuery({
    queryKey: ['plot', projectId],
    queryFn: () => listPlotPoints(projectId!),
    enabled: !!projectId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updatePlotPoint(editing.id, form);
      }
      return createPlotPoint(projectId!, {
        ...form,
        order: plotPoints.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plot', projectId] });
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? 'Plot point updated' : 'Plot point added');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePlotPoint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plot', projectId] });
      toast.success('Plot point deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderPlotPoints(projectId!, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plot', projectId] });
      toast.success('Plot reordered');
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
    const oldIndex = plotPoints.findIndex((p) => p.id === active.id);
    const newIndex = plotPoints.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(plotPoints, oldIndex, newIndex);
    queryClient.setQueryData(['plot', projectId], reordered);
    reorderMutation.mutate(reordered.map((p) => p.id));
  };

  const openEdit = (point: PlotPoint) => {
    setEditing(point);
    setForm({
      title: point.title,
      description: point.description,
      type: point.type,
    });
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Map className="h-7 w-7 text-accent" /> Plot Board
          </h1>
          <p className="text-muted text-sm mt-1">
            {plotPoints.length} plot points — drag to reorder story beats
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" /> Add Beat
        </button>
      </div>

      {plotPoints.length === 0 ? (
        <div className="card text-center py-16">
          <Map className="h-12 w-12 mx-auto text-muted mb-4 opacity-40" />
          <p className="text-muted mb-4">No plot points yet. Map your story structure.</p>
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Add First Beat
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={plotPoints.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {plotPoints.map((point) => (
                <SortablePlotPoint
                  key={point.id}
                  point={point}
                  onEdit={openEdit}
                  onDelete={(id) => {
                    if (confirm('Delete this plot point?')) deleteMutation.mutate(id);
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-4">
              {editing ? 'Edit Plot Point' : 'New Plot Point'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input"
                  placeholder="The inciting incident"
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as PlotPoint['type'] })}
                  className="input"
                >
                  {plotTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/-/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input min-h-[100px]"
                  placeholder="What happens at this story beat?"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={!form.title.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="btn-primary"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
