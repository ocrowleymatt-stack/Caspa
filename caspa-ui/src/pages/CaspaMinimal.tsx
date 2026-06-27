import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Hammer,
  Loader2,
  PenLine,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  createMinimalProject,
  downloadMinimalDocx,
  getMinimalState,
  minimalAutoBuild,
  minimalAutoWrite,
  minimalExport,
  minimalImprove,
  type MinimalWorkflowState,
} from '../api/minimal';
import { createProjectAsset } from '../api/studio';
import { MinimalShell } from '../components/minimal/MinimalShell';
import { useToast } from '../components/Toast';
import { isSupportedManuscriptFile, readManuscriptFile } from '../lib/manuscriptUpload';
import { cn } from '../lib/utils';

const PROJECT_KEY = 'caspa-minimal-project-id';

type ActionId = 'build' | 'write' | 'improve' | 'export';

const ACTIONS: Array<{
  id: ActionId;
  label: string;
  icon: typeof Hammer;
}> = [
  { id: 'build', label: 'Auto Build', icon: Hammer },
  { id: 'write', label: 'Auto Write', icon: PenLine },
  { id: 'improve', label: 'Improve', icon: Sparkles },
  { id: 'export', label: 'Export', icon: Download },
];

function phaseRank(phase: MinimalWorkflowState['phase']): number {
  const order = ['empty', 'material', 'built', 'drafted', 'improved', 'exported'];
  return order.indexOf(phase);
}

function canRunAction(state: MinimalWorkflowState | undefined, action: ActionId): boolean {
  if (!state) return false;
  if (action === 'build') {
    return state.materialCount > 0 || state.wordCount > 0;
  }
  if (action === 'write') {
    return phaseRank(state.phase) >= phaseRank('built');
  }
  if (action === 'improve') {
    return phaseRank(state.phase) >= phaseRank('built');
  }
  if (action === 'export') {
    return state.wordCount > 0;
  }
  return false;
}

export default function CaspaMinimal() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState<string | null>(() => localStorage.getItem(PROJECT_KEY));
  const [dragOver, setDragOver] = useState(false);
  const [busyAction, setBusyAction] = useState<ActionId | 'drop' | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const ensureProject = useCallback(async (): Promise<string> => {
    if (projectId) return projectId;
    const project = await createMinimalProject();
    localStorage.setItem(PROJECT_KEY, project.id);
    setProjectId(project.id);
    return project.id;
  }, [projectId]);

  const { data: state, isLoading, refetch } = useQuery({
    queryKey: ['minimal-state', projectId],
    queryFn: () => getMinimalState(projectId!),
    enabled: !!projectId,
    refetchInterval: busyAction ? 2000 : false,
  });

  useEffect(() => {
    if (!projectId) {
      ensureProject().catch((err: Error) => toast.error(err.message));
    }
  }, [projectId, ensureProject, toast]);

  const ingestMutation = useMutation({
    mutationFn: async (items: Array<{ title: string; text: string; filename?: string }>) => {
      const id = await ensureProject();
      for (const item of items) {
        await createProjectAsset(id, {
          title: item.title,
          originalFilename: item.filename,
          sourceText: item.text,
        });
      }
      return id;
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ['minimal-state', id] });
      await refetch();
      toast.success('Material added.');
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setBusyAction(null),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: ActionId) => {
      const id = await ensureProject();
      setBusyAction(action);
      if (action === 'build') return minimalAutoBuild(id);
      if (action === 'write') return minimalAutoWrite(id);
      if (action === 'improve') return minimalImprove(id);
      return minimalExport(id);
    },
    onSuccess: async (result, action) => {
      if (projectId) {
        queryClient.setQueryData(['minimal-state', projectId], result.state);
      }
      toast.success(result.message);
      if (action === 'export' && projectId) {
        await downloadMinimalDocx(projectId, result.docxFilename);
      }
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setBusyAction(null),
  });

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusyAction('drop');
    const items: Array<{ title: string; text: string; filename?: string }> = [];
    for (const file of list) {
      if (!isSupportedManuscriptFile(file) && !/\.(csv|json|pdf)$/i.test(file.name)) {
        toast.error(`${file.name}: use text or markdown, or paste directly.`);
        continue;
      }
      const { title, text } = await readManuscriptFile(file);
      if (!text.trim()) {
        toast.error(`${file.name}: no readable text found.`);
        continue;
      }
      items.push({ title, text, filename: file.name });
    }
    if (items.length) {
      await ingestMutation.mutateAsync(items);
    } else {
      setBusyAction(null);
    }
  }

  async function handlePasteSubmit() {
    if (!pasteText.trim()) {
      toast.error('Paste something first.');
      return;
    }
    setBusyAction('drop');
    setPasteOpen(false);
    await ingestMutation.mutateAsync([{ title: 'Pasted note', text: pasteText.trim() }]);
    setPasteText('');
  }

  const working = busyAction !== null || actionMutation.isPending || ingestMutation.isPending;
  const progress = state?.writeProgress ?? 0;

  return (
    <MinimalShell>
      <section
        className={cn(
          'relative rounded-3xl border border-dashed px-6 py-14 text-center transition',
          dragOver
            ? 'border-amber-500/50 bg-amber-500/5'
            : 'border-slate-800/60 bg-[#161B22]/40',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
      >
        <div className="mx-auto flex max-w-md flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800/60 bg-[#0B0F19]">
            {busyAction === 'drop' ? (
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            ) : (
              <Upload className="h-6 w-6 text-slate-400" />
            )}
          </div>
          <div>
            <p className="text-lg font-medium text-white">Drop anything here</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Notes, drafts, fragments, receipts — CASPA keeps the originals safe.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#0B0F19] transition hover:bg-slate-100 disabled:opacity-50"
              disabled={working}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose files
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-700 px-5 py-2.5 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
              disabled={working}
              onClick={() => setPasteOpen((v) => !v)}
            >
              Paste text
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {pasteOpen && (
          <div className="mx-auto mt-8 max-w-lg text-left">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full rounded-2xl border border-slate-800/60 bg-[#0B0F19] px-4 py-3 font-serif text-sm leading-7 text-slate-200 outline-none focus:border-amber-500/40"
              rows={6}
              placeholder="Paste your material…"
            />
            <button
              type="button"
              className="mt-3 rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              disabled={working || !pasteText.trim()}
              onClick={() => void handlePasteSubmit()}
            >
              Add material
            </button>
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-sm text-slate-400">
        {isLoading && !state ? 'Loading…' : state?.statusMessage ?? 'Drop anything here to begin.'}
      </p>

      {state && state.materialCount > 0 && (
        <p className="mt-1 text-center font-mono text-xs text-slate-500">
          {state.materialCount} source item{state.materialCount === 1 ? '' : 's'} · {state.wordCount.toLocaleString()} words
        </p>
      )}

      {(busyAction === 'write' || progress > 0) && (
        <div className="mx-auto mt-6 max-w-md">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              {busyAction === 'write' && <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />}
              Writing
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${Math.max(progress, busyAction === 'write' ? 8 : 0)}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map(({ id, label, icon: Icon }) => {
          const enabled = canRunAction(state, id) && !working;
          const active = busyAction === id;
          return (
            <button
              key={id}
              type="button"
              disabled={!enabled}
              onClick={() => actionMutation.mutate(id)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-sm transition',
                enabled
                  ? 'border-slate-700 bg-[#161B22] text-white hover:border-amber-500/40 hover:bg-[#161B22]/90'
                  : 'cursor-not-allowed border-slate-800/40 bg-[#161B22]/30 text-slate-600',
              )}
            >
              {active ? (
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              ) : (
                <Icon className={cn('h-5 w-5', enabled ? 'text-amber-500' : 'text-slate-600')} />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {state?.preview && (
        <section className="mt-12 rounded-3xl border border-slate-800/60 bg-[#161B22]/50 p-6 md:p-8">
          <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            <Wand2 className="h-3.5 w-3.5" />
            Read preview
          </div>
          <div className="max-h-[420px] overflow-y-auto whitespace-pre-wrap font-serif text-base leading-loose tracking-wide text-slate-300">
            {state.preview}
            {state.preview.length >= 4000 ? '\n\n…' : ''}
          </div>
        </section>
      )}
    </MinimalShell>
  );
}
