import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, UploadCloud } from 'lucide-react';
import {
  analyseManuscriptImport,
  applyManuscriptImport,
  type ImportAnalysisResult,
  type RecommendedImportMode,
} from '../api/manuscriptImport';
import { listAwardLenses, updateProjectAwardsShelf } from '../api/awards';
import { createProject } from '../api/projects';
import { ImportReviewPanel } from './ImportReviewPanel';
import { workModelFromPrimaryType } from '../lib/casperWorkModel';
import { isSupportedManuscriptFile, readManuscriptFile } from '../lib/manuscriptUpload';
import {
  CREATION_WORK_TYPES,
  defaultCreationDraft,
  defaultFictionalityForWorkType,
  FICTIONALITY_OPTIONS,
  LENGTH_PRESETS,
  mergeCreationIntoProjectInput,
  postCreateRoute,
  resolveTargetWordCount,
  SHELF_CHOICES,
  STARTING_POINTS,
  TARGET_FORM_OPTIONS,
  TARGET_MARKET_OPTIONS,
  type ProjectCreationDraft,
} from '../lib/projectCreationFlow';
import { useToast } from './Toast';

const STEP_LABELS = [
  'What are you making?',
  'Fiction or nonfiction?',
  'Target form',
  'Target length',
  'Audience / market',
  'Target shelf',
  'Starting point',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string, route: string) => void;
}

function TileOption({
  selected,
  label,
  hint,
  onClick,
}: {
  selected: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.4rem] border p-4 text-left transition ${
        selected
          ? 'border-[#98711d] bg-[#fffaf0] shadow-paper'
          : 'border-[#eadfca] bg-[#fffdf8] hover:border-[#caa044]'
      }`}
    >
      <div className="font-semibold text-[#171a22]">{label}</div>
      {hint && <p className="mt-1 text-xs leading-5 text-[#5f5648]">{hint}</p>}
    </button>
  );
}

export function NewProjectWizard({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProjectCreationDraft>(() => defaultCreationDraft());
  const [importAnalysis, setImportAnalysis] = useState<ImportAnalysisResult | null>(null);
  const [importMode, setImportMode] = useState<RecommendedImportMode>('whole-manuscript-source');
  const [analysingImport, setAnalysingImport] = useState(false);

  const { data: awardCatalog = [] } = useQuery({
    queryKey: ['awards-catalog'],
    queryFn: listAwardLenses,
    enabled: open && step === 5,
  });

  useEffect(() => {
    if (!open) {
      setStep(0);
      setDraft(defaultCreationDraft());
      setImportAnalysis(null);
      setImportMode('whole-manuscript-source');
    }
  }, [open]);

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      fictionality: defaultFictionalityForWorkType(current.workType),
    }));
  }, [draft.workType]);

  const suggestedWordCount = useMemo(
    () => resolveTargetWordCount(draft.workType, draft.lengthPreset, draft.customWordCount),
    [draft.customWordCount, draft.lengthPreset, draft.workType],
  );

  const genreLensIds = useMemo(() => {
    const categoryMap: Record<string, string[]> = {
      literary: ['literary'],
      commercial: ['commercial', 'genre'],
      theatre: ['theatre'],
      film: ['screen'],
      academic: ['nonfiction'],
      children: ['children'],
      niche: ['commercial', 'custom'],
      other: ['literary', 'custom'],
    };
    const categories = categoryMap[draft.targetMarket] ?? ['literary'];
    return awardCatalog.filter((lens) => categories.includes(lens.category)).map((lens) => lens.id);
  }, [awardCatalog, draft.targetMarket]);

  useEffect(() => {
    if (draft.shelfChoice === 'genre-lens' && genreLensIds.length > 0 && draft.targetPrizeIds.length === 0) {
      setDraft((current) => ({ ...current, targetPrizeIds: [genreLensIds[0]!] }));
    }
    if (draft.shelfChoice === 'none') {
      setDraft((current) => ({ ...current, targetPrizeIds: [] }));
    }
  }, [draft.shelfChoice, draft.targetPrizeIds.length, genreLensIds]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const base = workModelFromPrimaryType(draft.workType, {
        hasImportedManuscript: Boolean(draft.manuscriptText.trim()),
      });
      const payload = mergeCreationIntoProjectInput(draft, base);
      const project = await createProject(payload);

      if (draft.manuscriptText.trim()) {
        await applyManuscriptImport({
          projectId: project.id,
          rawText: draft.manuscriptText,
          filename: draft.uploadedName ?? undefined,
          importMode,
          detectedUnits: importAnalysis?.detectedUnits,
          workType: draft.workType,
        });
      }

      if (draft.targetPrizeIds.length > 0) {
        await updateProjectAwardsShelf(project.id, draft.targetPrizeIds);
      }

      return project;
    },
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['chapters', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['project-awards', project.id] });
      toast.success(`Created "${project.title}"`);
      onCreated(project.id, postCreateRoute(project.id, draft.startingPoint));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleManuscriptUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isSupportedManuscriptFile(file)) {
      toast.error('Upload supports .txt, .md, .rtf and .html.');
      event.target.value = '';
      return;
    }

    const { title, text } = await readManuscriptFile(file);
    setDraft((current) => ({
      ...current,
      uploadedName: file.name,
      manuscriptText: text,
      startingPoint: 'upload',
      title: current.title.trim() ? current.title : title,
      description: current.description.trim() ? current.description : `Uploaded manuscript: ${title}`,
    }));
    setAnalysingImport(true);
    try {
      const analysis = await analyseManuscriptImport({
        filename: file.name,
        rawText: text,
        declaredWorkType: draft.workType,
      });
      setImportAnalysis(analysis);
      setImportMode(analysis.recommendedImportMode);
      setDraft((current) => ({
        ...current,
        workType: analysis.detectedWorkType,
        customWordCount: Math.max(current.customWordCount, analysis.totalWordCount),
      }));
      toast.success(`Structure analysed · ${analysis.detectedUnits.length} unit(s) detected`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import analysis failed');
    } finally {
      setAnalysingImport(false);
    }
    event.target.value = '';
  }

  if (!open) return null;

  const isLastStep = step === STEP_LABELS.length - 1;
  const needsManuscript =
    (draft.startingPoint === 'upload' || draft.startingPoint === 'paste') &&
    !draft.manuscriptText.trim() &&
    isLastStep;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171a22]/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-[#eadfca] bg-white shadow-room">
        <div className="border-b border-[#eadfca] px-6 py-5">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">
            Step {step + 1} of {STEP_LABELS.length}
          </div>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">{STEP_LABELS[step]}</h2>
          <div className="mt-4 flex gap-1">
            {STEP_LABELS.map((_, index) => (
              <div
                key={STEP_LABELS[index]}
                className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-[#171a22]' : 'bg-[#f1e6d2]'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {CREATION_WORK_TYPES.map((option) => (
                  <TileOption
                    key={option.value}
                    selected={draft.workType === option.value}
                    label={option.label}
                    onClick={() => setDraft((current) => ({ ...current, workType: option.value }))}
                  />
                ))}
              </div>
              <label className="block text-sm">
                <span className="label">Working title (optional)</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  className="input"
                  placeholder="Untitled Room is fine"
                />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {FICTIONALITY_OPTIONS.map((option) => (
                <TileOption
                  key={option.value}
                  selected={draft.fictionality === option.value}
                  label={option.label}
                  onClick={() => setDraft((current) => ({ ...current, fictionality: option.value }))}
                />
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {TARGET_FORM_OPTIONS.map((option) => (
                <TileOption
                  key={option.value}
                  selected={draft.targetForm === option.value}
                  label={option.label}
                  hint={option.hint}
                  onClick={() => setDraft((current) => ({ ...current, targetForm: option.value }))}
                />
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {LENGTH_PRESETS.map((option) => (
                  <TileOption
                    key={option.value}
                    selected={draft.lengthPreset === option.value}
                    label={option.label}
                    hint={option.hint}
                    onClick={() => setDraft((current) => ({ ...current, lengthPreset: option.value }))}
                  />
                ))}
              </div>
              {draft.lengthPreset === 'custom' ? (
                <label className="block text-sm">
                  <span className="label">Custom word count</span>
                  <input
                    type="number"
                    value={draft.customWordCount}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        customWordCount: Number(event.target.value),
                      }))
                    }
                    className="input"
                  />
                </label>
              ) : (
                <p className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3 text-sm text-[#5f5648]">
                  Target for this room:{' '}
                  <strong className="text-[#171a22]">{suggestedWordCount.toLocaleString()} words</strong>
                </p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {TARGET_MARKET_OPTIONS.map((option) => (
                  <TileOption
                    key={option.value}
                    selected={
                      option.value === 'custom'
                        ? draft.targetMarket === 'other'
                        : draft.targetMarket === option.value
                    }
                    label={option.label}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        targetMarket: option.value === 'custom' ? 'other' : option.value,
                      }))
                    }
                  />
                ))}
              </div>
              <label className="block text-sm">
                <span className="label">Target audience (optional)</span>
                <input
                  value={draft.targetAudience}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, targetAudience: event.target.value }))
                  }
                  className="input"
                  placeholder="e.g. literary book clubs, YA crossover, festival programmers"
                />
              </label>
              {draft.targetMarket === 'other' && (
                <label className="block text-sm">
                  <span className="label">Custom market label</span>
                  <input
                    value={draft.customMarketLabel}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, customMarketLabel: event.target.value }))
                    }
                    className="input"
                    placeholder="Describe your market or community"
                  />
                </label>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {SHELF_CHOICES.map((option) => (
                  <TileOption
                    key={option.value}
                    selected={draft.shelfChoice === option.value}
                    label={option.label}
                    hint={option.hint}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        shelfChoice: option.value,
                        targetPrizeIds: option.value === 'none' ? [] : current.targetPrizeIds,
                      }))
                    }
                  />
                ))}
              </div>
              {draft.shelfChoice === 'choose-awards' && (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-3">
                  {awardCatalog.map((lens) => {
                    const selected = draft.targetPrizeIds.includes(lens.id);
                    return (
                      <label key={lens.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setDraft((current) => ({
                              ...current,
                              targetPrizeIds: selected
                                ? current.targetPrizeIds.filter((id) => id !== lens.id)
                                : [...current.targetPrizeIds, lens.id],
                            }))
                          }
                          className="mt-1"
                        />
                        <span>
                          <strong>{lens.name}</strong>
                          <span className="block text-xs text-muted">{lens.inspiredBy}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {draft.shelfChoice === 'genre-lens' && genreLensIds.length > 0 && (
                <p className="text-sm text-muted">
                  Matched lens:{' '}
                  {awardCatalog.find((lens) => lens.id === draft.targetPrizeIds[0])?.name ?? 'Selecting…'}
                </p>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {STARTING_POINTS.map((option) => (
                  <TileOption
                    key={option.value}
                    selected={draft.startingPoint === option.value}
                    label={option.label}
                    hint={option.hint}
                    onClick={() => setDraft((current) => ({ ...current, startingPoint: option.value }))}
                  />
                ))}
              </div>

              {draft.startingPoint === 'upload' && (
                <div className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4">
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    className="btn-secondary"
                  >
                    <UploadCloud className="h-4 w-4" />
                    {analysingImport ? 'Analysing…' : 'Choose manuscript file'}
                  </button>
                  {draft.uploadedName && (
                    <p className="mt-2 text-xs text-muted">Loaded: {draft.uploadedName}</p>
                  )}
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept=".txt,.md,.markdown,.rtf,.html,.htm,text/*"
                    className="hidden"
                    onChange={handleManuscriptUpload}
                  />
                </div>
              )}

              {draft.startingPoint === 'paste' && (
                <label className="block text-sm">
                  <span className="label">Paste manuscript text</span>
                  <textarea
                    value={draft.manuscriptText}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, manuscriptText: event.target.value }))
                    }
                    rows={6}
                    className="input min-h-[140px] resize-y font-serif"
                    placeholder="Paste prose here — it stays as source until you split or apply outputs."
                  />
                </label>
              )}

              <label className="block text-sm">
                <span className="label">Room notes (optional)</span>
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={3}
                  className="input min-h-[90px] resize-y"
                  placeholder="Premise, voice, constraints, or why this room exists…"
                />
              </label>

              {importAnalysis && draft.manuscriptText.trim() && (
                <ImportReviewPanel
                  analysis={importAnalysis}
                  filename={draft.uploadedName}
                  selectedWorkType={draft.workType}
                  selectedImportMode={importMode}
                  onWorkTypeChange={(workType) => setDraft((current) => ({ ...current, workType }))}
                  onImportModeChange={setImportMode}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#eadfca] px-6 py-4">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep((current) => current - 1))}
            className="btn-secondary"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {!isLastStep ? (
            <button type="button" onClick={() => setStep((current) => current + 1)} className="btn-primary">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={createMutation.isPending || needsManuscript}
              onClick={() => createMutation.mutate()}
              className="btn-primary"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Create and open'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
