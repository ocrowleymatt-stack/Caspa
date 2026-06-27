import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import {
  actionDisabledReason,
  createMinimalProject,
  downloadMinimalDocx,
  getMinimalState,
  minimalAutoBuild,
  minimalAutoWrite,
  minimalExport,
  minimalImprove,
  type MinimalStepId,
} from '../api/minimal';
import { createProjectAsset } from '../api/studio';
import { MinimalShell } from '../components/minimal/MinimalShell';
import { MinimalStepList } from '../components/minimal/MinimalStepList';
import { useToast } from '../components/Toast';
import { isSupportedManuscriptFile, readManuscriptFile } from '../lib/manuscriptUpload';
import { cn } from '../lib/utils';

const PROJECT_KEY = 'caspa-minimal-project-id';

type ActionId = Exclude<MinimalStepId, 'drop'>;

const BUSY_LABELS: Record<ActionId | 'drop', string> = {
  drop: 'Saving your material…',
  build: 'Building structure — this can take a minute…',
  write: 'Writing your next section…',
  improve: 'Polishing your draft…',
  export: 'Preparing your export…',
};

export default function CaspaMinimal() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState<string | null>(() => localStorage.getItem(PROJECT_KEY));
  const [dragOver, setDragOver] = useState(false);
  const [busyAction, setBusyAction] = useState<ActionId | 'drop' | null>(null);
  const [pasteText, setPasteText] = useState('');

  const ensureProject = useCallback(async (): Promise<string> => {
    if (projectId) return projectId;
    const project = await createMinimalProject();
    localStorage.setItem(PROJECT_KEY, project.id);
    setProjectId(project.id);
    return project.id;
  }, [projectId]);

  const { data: state, isLoading } = useQuery({
    queryKey: ['minimal-state', projectId],
    queryFn: () => getMinimalState(projectId!),
    enabled: !!projectId,
    refetchInterval: busyAction ? 2500 : false,
  });

  useEffect(() => {
    if (!projectId) {
      ensureProject().catch((err: Error) => toast.error(err.message));
    }
  }, [projectId, ensureProject, toast]);

  const syncState = useCallback(
    (next: NonNullable<typeof state>) => {
      queryClient.setQueryData(['minimal-state', next.projectId], next);
      if (next.projectId !== projectId) {
        localStorage.setItem(PROJECT_KEY, next.projectId);
        setProjectId(next.projectId);
      }
    },
    [projectId, queryClient],
  );

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
      return getMinimalState(id);
    },
    onSuccess: (next) => {
      syncState(next);
      toast.success(
        next.materialChars >= 80
          ? 'Material saved — Auto Build is ready.'
          : `Material saved — add ${Math.max(0, 80 - next.materialChars)} more characters, then Auto Build.`,
      );
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
      syncState(result.state);
      if (result.driftBlocked) {
        toast.info(result.message);
      } else {
        toast.success(result.message);
      }
      if (action === 'export') {
        await downloadMinimalDocx(result.state.projectId, result.docxFilename);
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
    const trimmed = pasteText.trim();
    if (trimmed.length < 20) {
      toast.error('Paste at least a few sentences — fragments need a little substance.');
      return;
    }
    setBusyAction('drop');
    await ingestMutation.mutateAsync([{ title: 'Pasted note', text: trimmed }]);
    setPasteText('');
  }

  async function handleStartFresh() {
    if (working) return;
    const project = await createMinimalProject();
    localStorage.setItem(PROJECT_KEY, project.id);
    setProjectId(project.id);
    setPasteText('');
    const next = await getMinimalState(project.id);
    syncState(next);
    toast.success('Fresh workspace ready.');
  }

  const working = busyAction !== null || actionMutation.isPending || ingestMutation.isPending;
  const progress = state?.writeProgress ?? 0;
  const steps = state?.steps ?? [];
  const disabledReasons = {
    build: actionDisabledReason(state, 'build'),
    write: actionDisabledReason(state, 'write'),
    improve: actionDisabledReason(state, 'improve'),
    export: actionDisabledReason(state, 'export'),
  };

  return (
    <MinimalShell
      title={state?.projectTitle ?? 'Caspa'}
      subtitle={state?.statusMessage ?? 'Drop material to begin.'}
      onStartFresh={() => void handleStartFresh()}
      startFreshDisabled={working}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden">
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-4 sm:px-6">
          {working && busyAction && (
            <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm text-amber-200">
                <Loader2 className="h-4 w-4 animate-spin" />
                {BUSY_LABELS[busyAction]}
              </p>
              {busyAction === 'write' && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-amber-200/80">
                    <span>Progress</span>
                    <span>{Math.max(progress, 8)}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-amber-950/40">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${Math.max(progress, 8)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <section
            className={cn(
              'rounded-2xl border border-dashed px-4 py-5 transition',
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
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800/60 bg-[#0B0F19]">
                {busyAction === 'drop' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                ) : (
                  <Upload className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">1 · Drop material</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Files or pasted notes. Originals stay safe — nothing is overwritten without your step.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-[#0B0F19] transition hover:bg-slate-100 disabled:opacity-50"
                    disabled={working}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose files
                  </button>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="w-full rounded-xl border border-slate-800/60 bg-[#0B0F19] px-3 py-2.5 font-serif text-sm leading-7 text-slate-200 outline-none focus:border-amber-500/40"
                    rows={4}
                    placeholder="Or paste material here…"
                    disabled={working}
                  />
                  <button
                    type="button"
                    className="w-full rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-200 transition hover:border-slate-600 disabled:opacity-50"
                    disabled={working || pasteText.trim().length < 20}
                    onClick={() => void handlePasteSubmit()}
                  >
                    Save pasted material
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
            </div>
          </section>

          {state && (
            <div className="mt-3 rounded-xl border border-slate-800/60 bg-[#161B22]/30 px-3 py-2 font-mono text-[11px] text-slate-500">
              {state.materialCount} source{state.materialCount === 1 ? '' : 's'} · {state.materialChars.toLocaleString()} chars ·{' '}
              {state.chapterCount} section{state.chapterCount === 1 ? '' : 's'} · {state.wordCount.toLocaleString()} words
            </div>
          )}

          <div className="mt-5">
            {isLoading && !state ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading workflow…</p>
            ) : (
              <MinimalStepList
                steps={steps.filter((step) => step.id !== 'drop')}
                busyStep={busyAction}
                disabled={working}
                disabledReasons={disabledReasons}
                onRun={(action) => actionMutation.mutate(action)}
              />
            )}
          </div>

          {state?.preview.trim() && (
            <section className="mt-6 rounded-2xl border border-slate-800/60 bg-[#161B22]/50 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Manuscript preview</p>
              <div className="mt-3 break-words whitespace-pre-wrap font-serif text-sm leading-7 tracking-wide text-slate-300">
                {state.preview}
                {state.preview.length >= 4000 ? '\n\n…' : ''}
              </div>
            </section>
          )}
        </div>
      </div>
    </MinimalShell>
  );
}
