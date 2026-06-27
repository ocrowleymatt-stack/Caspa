import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { listChapters } from '../../api/chapters';
import { listProjects } from '../../api/projects';
import { getGoldReport, runGoldPass, runGoldPipeline, type GoldRunOptions } from '../../api/gold';
import {
  executeGoldPipelineStream,
  isGoldPipelineStreamEvent,
  type GoldPipelineStreamEvent,
} from '../../api/goldPipeline';
import { useToast } from '../Toast';
import { useAppStore } from '../../store';
import { useWorkbenchSourceText } from '../../hooks/useWorkbenchSourceText';
import type { GoldReport } from '../../types';
import StatusStream from './StatusStream';
import { StagedProgressPanel } from '../StagedProgressPanel';
import { GOLD_PASS_STAGES } from '../StagedProgress';
import {
  applyReportToSteps,
  applyStepUpdate,
  biasOptions,
  buildOutputFromReport,
  createInitialSteps,
  passDepthOptions,
  routeOptions,
  runModeOptions,
  type OutputTab,
  type ModelRoute,
  type PassDepth,
  type PipelineOutput,
  type PipelineRunEvent,
  type PipelineStep,
  type RunMode,
  type ScopeOption,
} from './types';

export default function GoldPipelinePanel({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const { id: routeProjectId } = useParams<{ id?: string }>();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const workbenchSource = useAppStore((s) => s.workbenchSource);
  const projectId = routeProjectId ?? activeProjectId;
  const { text: workbenchText } = useWorkbenchSourceText(projectId ?? undefined, workbenchSource);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const [selectedDepth, setSelectedDepth] = useState<NonNullable<PassDepth>>('structural');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [selectedBiases, setSelectedBiases] = useState<string[]>(['literary', 'rawer']);
  const [selectedRoute, setSelectedRoute] = useState<NonNullable<ModelRoute>>('hybrid');
  const [selectedRunMode, setSelectedRunMode] = useState<NonNullable<RunMode>>('controlled');

  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineOutput, setPipelineOutput] = useState<PipelineOutput | null>(null);
  const [activeTab, setActiveTab] = useState<OutputTab>('final');
  const [lastEvent, setLastEvent] = useState<PipelineRunEvent | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>(createInitialSteps);
  const [runId, setRunId] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const streamCompleteRef = useRef(false);

  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ['gold-chapters', projectId],
    queryFn: () => listChapters(projectId!),
    enabled: !!projectId,
  });

  const { data: existingReport, isLoading: reportLoading } = useQuery({
    queryKey: ['gold-report', projectId],
    queryFn: () => getGoldReport(projectId!),
    enabled: !!projectId,
  });

  const scopeOptions: ScopeOption[] = useMemo(() => {
    const sorted = [...chapters].sort((a, b) => a.order - b.order);
    return [
      ...sorted.map((ch) => ({
        id: ch.id,
        label: `Chapter ${ch.order}: ${ch.title}`,
      })),
      { id: 'book', label: 'Whole Book' },
    ];
  }, [chapters]);

  useEffect(() => {
    if (scopeOptions.length > 0 && selectedChapters.length === 0) {
      const first = scopeOptions[0];
      if (first) setSelectedChapters([first.id]);
    }
  }, [scopeOptions, selectedChapters.length]);

  useEffect(() => {
    if (existingReport && !isProcessing && !pipelineOutput) {
      const scopeLabel =
        scopeOptions
          .filter((c) => selectedChapters.includes(c.id))
          .map((c) => c.label)
          .join(', ') || 'Whole project';
      setPipelineOutput(
        buildOutputFromReport(existingReport, scopeLabel, {
          depth: selectedDepth,
          route: selectedRoute,
          runMode: selectedRunMode,
          biases: selectedBiases,
        }),
      );
      setSteps(applyReportToSteps(createInitialSteps(), existingReport));
      setRunId(existingReport.id);
    }
  }, [
    existingReport,
    isProcessing,
    pipelineOutput,
    scopeOptions,
    selectedChapters,
    selectedDepth,
    selectedRoute,
    selectedRunMode,
    selectedBiases,
  ]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const selectedScopeLabel = useMemo(() => {
    return scopeOptions
      .filter((chapter) => selectedChapters.includes(chapter.id))
      .map((chapter) => chapter.label)
      .join(', ');
  }, [scopeOptions, selectedChapters]);

  const toggleChapter = (id: string) => {
    if (isProcessing) return;

    if (id === 'book') {
      setSelectedChapters((prev) =>
        prev.includes('book') ? (scopeOptions[0] ? [scopeOptions[0].id] : []) : ['book'],
      );
      return;
    }

    setSelectedChapters((prev) => {
      const withoutBook = prev.filter((item) => item !== 'book');
      return withoutBook.includes(id)
        ? withoutBook.filter((item) => item !== id)
        : [...withoutBook, id];
    });
  };

  const toggleBias = (id: string) => {
    if (isProcessing) return;
    setSelectedBiases((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const finishPipeline = useCallback(
    (report: GoldReport, scopeLabel: string, options: GoldRunOptions) => {
      setSteps(applyReportToSteps(createInitialSteps(), report));
      setLastEvent({
        run_id: report.id,
        stage: 'final_gold_framework',
        status: 'done',
        message: 'Final Gold Framework compiled successfully.',
        progress: 100,
        current_chapter: scopeLabel,
        warnings:
          report.overallStatus === 'BLOCK' || report.overallStatus === 'REVISE'
            ? report.blockers.length > 0
              ? report.blockers
              : ['Review flagged steps before accepting output.']
            : selectedRunMode === 'full'
              ? ['Full Gold Pass can over-polish distinctive authorial strangeness. Manual review advised.']
              : [],
      });
      setPipelineOutput(buildOutputFromReport(report, scopeLabel, options));
      setRunId(report.id);
      setIsProcessing(false);
      toast.success(`Gold pipeline complete — score ${report.overallScore}`);
    },
    [selectedRunMode, toast],
  );

  const failPipeline = useCallback(
    (message: string) => {
      abortRef.current?.abort();
      abortRef.current = null;
      setPipelineError(message);
      setIsProcessing(false);
      setSteps((prev) => {
        const runningIdx = prev.findIndex((s) => s.status === 'running');
        if (runningIdx === -1) return prev;
        return prev.map((s, i) => (i === runningIdx ? { ...s, status: 'error' } : s));
      });
      toast.error(message);
    },
    [toast],
  );

  const handleStreamEvent = useCallback(
    (event: GoldPipelineStreamEvent, scopeLabel: string, options: GoldRunOptions) => {
      if (event.type === 'step_update') {
        const stepEvent: PipelineRunEvent = {
          run_id: event.run_id,
          stage: event.stage,
          status: event.status,
          message: event.message,
          progress: event.progress,
          current_chapter: event.current_chapter,
          warnings: event.warnings,
        };
        setLastEvent(stepEvent);
        setSteps((prev) => applyStepUpdate(prev, stepEvent));
        return;
      }

      if (event.type === 'complete' && event.report) {
        streamCompleteRef.current = true;
        finishPipeline(event.report, scopeLabel, options);
        return;
      }

      if (event.type === 'error') {
        failPipeline(event.message);
      }
    },
    [finishPipeline, failPipeline],
  );

  const runSyncFallback = async (
    projectId: string,
    scopeLabel: string,
    options: GoldRunOptions,
  ) => {
    const report = await runGoldPipeline(projectId, options);
    finishPipeline(report, scopeLabel, options);
  };

  const runQuickGoldPass = async () => {
    if (!projectId) {
      toast.error('Select active project in sidebar');
      return;
    }
    const scopeChapter = chapters.find((ch) => selectedChapters.includes(ch.id));
    const fallbackSource =
      scopeChapter?.content ?? chapters.map((ch) => ch.content).join('\n\n').slice(0, 12000);
    const source = workbenchText.trim() || fallbackSource;
    setIsProcessing(true);
    setPipelineError(null);
    try {
      const result = await runGoldPass(projectId, source, {
        improveText: selectedDepth === 'deep',
        stage: 'revision',
      });
      const synthesis = result.synthesis;
      setPipelineOutput({
        finalText: result.improved,
        changeLog: result.critique,
        beforeAfter: result.improved,
        riskNotes: synthesis
          ? [
              synthesis.judgeAssessment,
              `Structure: ${synthesis.structuralAssessment.summary}`,
              `Research: ${synthesis.researchAssessment.summary}`,
              synthesis.antiFillerReport.warnings.length
                ? `Filler warnings: ${synthesis.antiFillerReport.warnings.join('; ')}`
                : synthesis.antiFillerReport.summary,
              `Sources: ${Object.entries(synthesis.sourcesUsed).filter(([, v]) => v).map(([k]) => k).join(', ') || 'manuscript only'}`,
            ].join('\n\n')
          : result.report
            ? `Elevation score: ${result.report.overallScore} · ${result.report.overallStatus}`
            : 'Gold synthesis complete',
        exportPack: result.improved,
        exportAvailable: false,
        exportReason: `Synthesis saved to Outputs (${result.outputId.slice(0, 8)})`,
      });
      setRunId(result.jobId);
      toast.success(`Gold synthesis saved · ${result.outputId.slice(0, 8)}`);
    } catch (err) {
      failPipeline(err instanceof Error ? err.message : 'Gold Pass failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const executeGoldPipeline = async () => {
    if (!projectId) {
      const msg = 'Select active project in sidebar';
      setPipelineError(msg);
      toast.error(msg);
      return;
    }

    if (selectedChapters.length === 0) {
      setPipelineError('Select at least one chapter or whole-book scope before execution.');
      return;
    }

    const freshSteps = createInitialSteps();
    const scopeLabel = selectedScopeLabel;
    const currentRunId = `gold_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_${Date.now()}`;
    const options: GoldRunOptions = {
      depth: selectedDepth,
      biases: selectedBiases,
      route: selectedRoute,
      runMode: selectedRunMode,
      chapterIds: selectedChapters.includes('book') ? ['book'] : selectedChapters,
    };

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsProcessing(true);
    setPipelineError(null);
    setPipelineOutput(null);
    setActiveTab('final');
    setLastEvent(null);
    setSteps(freshSteps);
    setRunId(currentRunId);
    streamCompleteRef.current = false;

    const streamBody = {
      projectId: projectId,
      config: options,
      chapters: options.chapterIds ?? [],
    };

    try {
      await executeGoldPipelineStream(
        streamBody,
        (raw) => {
          if (isGoldPipelineStreamEvent(raw)) {
            handleStreamEvent(raw, scopeLabel, options);
          }
        },
        controller.signal,
      );

      if (!streamCompleteRef.current && !controller.signal.aborted) {
        const report = await getGoldReport(projectId);
        if (report) {
          streamCompleteRef.current = true;
          finishPipeline(report, scopeLabel, options);
        } else {
          await runSyncFallback(projectId, scopeLabel, options);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      try {
        toast.info('SSE unavailable — falling back to sync pipeline');
        await runSyncFallback(projectId, scopeLabel, options);
      } catch (fallbackErr) {
        failPipeline(
          fallbackErr instanceof Error ? fallbackErr.message : 'Gold pipeline failed',
        );
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const getCurrentTabText = () => {
    if (!pipelineOutput) return '';
    switch (activeTab) {
      case 'final':
        return pipelineOutput.finalText;
      case 'changeLog':
        return pipelineOutput.changeLog;
      case 'beforeAfter':
        return pipelineOutput.beforeAfter;
      case 'risk':
        return pipelineOutput.riskNotes;
      case 'export':
        return pipelineOutput.exportAvailable
          ? pipelineOutput.exportPack
          : pipelineOutput.exportReason ?? 'Export pack not available';
      default:
        return '';
    }
  };

  const copyCurrentTab = async () => {
    const text = getCurrentTabText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      setPipelineError('Clipboard copy failed. Browser permissions are being awkward.');
    }
  };

  const handleExportPack = () => {
    if (!pipelineOutput?.exportAvailable) {
      toast.info(pipelineOutput?.exportReason ?? 'Export pack not available from backend');
    }
  };

  if (!projectId && !embedded) {
    return (
      <div className="max-w-6xl mx-auto animate-fadeIn">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
            <span className="text-amber-500">✨</span> Gold Pipeline
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Local High-Fidelity Prose Deep Optimisation Suite
          </p>
        </div>
        <div className="bg-[#161B22] border border-slate-800/60 rounded-xl p-12 text-center space-y-6">
          <p className="text-sm text-slate-400 font-serif tracking-wide">
            Choose a project to calibrate and run the Gold pipeline.
          </p>
          <div className="mx-auto max-w-md text-left">
            <label className="text-xs font-medium text-slate-400">Project</label>
            <select
              value=""
              onChange={(event) => setActiveProjectId(event.target.value || null)}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-[#0B0F19] px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-500/60"
            >
              <option value="">Select project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/projects" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-[#0B0F19] transition hover:bg-amber-400">
              New project
            </Link>
            <Link to="/casper" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-500/60">
              Open Casper
            </Link>
          </div>
          <p className="text-xs text-slate-600 font-mono">No project bound · pipeline idle</p>
        </div>
      </div>
    );
  }

  if (chaptersLoading || reportLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fadeIn">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
            <span className="text-amber-500">✨</span> Gold Pipeline
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Local High-Fidelity Prose Deep Optimisation Suite
          </p>
        </div>

        <div className="bg-[#161B22] border border-slate-800/60 rounded-xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Pipeline Calibration
            </h2>
            <span className="text-[10px] font-mono text-slate-600 border border-slate-800 rounded px-2 py-1 bg-[#0B0F19]">
              {selectedRoute.toUpperCase()} ROUTE
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Pass Depth Matrix</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {passDepthOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => !isProcessing && setSelectedDepth(opt.id)}
                  className={`p-3 rounded-lg border text-left transition-all duration-150 ${
                    selectedDepth === opt.id
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(217,119,6,0.15)]'
                      : 'bg-[#0B0F19] border-slate-800/60 text-slate-400 hover:border-slate-700/60'
                  }`}
                  disabled={isProcessing}
                >
                  <p className="text-xs font-semibold font-sans">{opt.label}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Target Manuscript Scope</label>
            {scopeOptions.length <= 1 ? (
              <p className="text-xs text-slate-500 font-mono py-2">
                No chapters in this project yet. Whole-book scope only.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {scopeOptions.map((chapter) => {
                const checked = selectedChapters.includes(chapter.id);
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => toggleChapter(chapter.id)}
                    className={`px-3 py-1.5 rounded border text-xs font-mono transition-all ${
                      checked
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#0B0F19]/60 border-slate-800/80 text-slate-500 hover:text-slate-400'
                    }`}
                    disabled={isProcessing}
                  >
                    {checked ? '✓ ' : '+ '}
                    {chapter.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Optimisation Bias</label>
            <div className="flex flex-wrap gap-2">
              {biasOptions.map((bias) => {
                const checked = selectedBiases.includes(bias.id);
                return (
                  <button
                    key={bias.id}
                    type="button"
                    onClick={() => toggleBias(bias.id)}
                    className={`px-3 py-1.5 rounded border text-xs font-mono transition-all ${
                      checked
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                        : 'bg-[#0B0F19]/60 border-slate-800/80 text-slate-500 hover:text-slate-400'
                    }`}
                    disabled={isProcessing}
                  >
                    {checked ? '✓ ' : '+ '}
                    {bias.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Model Route</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {routeOptions.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => !isProcessing && setSelectedRoute(route.id)}
                  className={`p-3 rounded-lg border text-left transition-all duration-150 ${
                    selectedRoute === route.id
                      ? 'bg-slate-800 border-slate-500 text-slate-100'
                      : 'bg-[#0B0F19] border-slate-800/60 text-slate-500 hover:text-slate-400'
                  }`}
                  disabled={isProcessing}
                >
                  <p className="text-xs font-semibold">{route.label}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{route.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Rewrite Control</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {runModeOptions.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => !isProcessing && setSelectedRunMode(mode.id)}
                  className={`p-3 rounded-lg border text-left transition-all duration-150 ${
                    selectedRunMode === mode.id
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#0B0F19] border-slate-800/60 text-slate-500 hover:text-slate-400'
                  }`}
                  disabled={isProcessing}
                >
                  <p className="text-xs font-semibold">{mode.label}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={executeGoldPipeline}
              disabled={isProcessing || selectedChapters.length === 0}
              className="w-full py-3 bg-slate-100 hover:bg-white disabled:bg-slate-800 text-slate-900 disabled:text-slate-600 rounded-lg text-xs font-semibold font-sans tracking-wide transition-colors shadow-md flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  <span className="font-mono text-amber-500 text-[11px]">
                    RUNNING GOLD PIPELINE CHANNELS...
                  </span>
                </>
              ) : (
                'Execute Gold Pipeline Pass'
              )}
            </button>
            <button
              type="button"
              onClick={runQuickGoldPass}
              disabled={isProcessing || !projectId}
              className="mt-2 w-full py-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              Run Gold Pass (save output)
            </button>
          </div>
          {isProcessing && (
            <div className="mt-4">
              <StagedProgressPanel
                label="Gold Pass"
                stages={GOLD_PASS_STAGES}
                pending={isProcessing}
                error={pipelineError}
              />
            </div>
          )}
        </div>

        {lastEvent && (
          <div className="bg-[#0E1117] border border-slate-800/80 rounded-xl p-4 space-y-2 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">SSE Event Payload</span>
              <span className="text-[10px] font-mono text-amber-500">{lastEvent.progress}%</span>
            </div>
            <pre className="text-[11px] font-mono text-slate-400 leading-relaxed overflow-x-auto whitespace-pre-wrap bg-[#0B0F19]/50 p-3 rounded-lg border border-slate-900 max-h-40 custom-scrollbar">
              {JSON.stringify(lastEvent, null, 2)}
            </pre>
          </div>
        )}

        {pipelineError && (
          <div className="bg-rose-950/20 border border-rose-900/50 rounded-lg p-4 text-xs font-mono text-rose-400 flex gap-2">
            <span>✕ SYSTEM FAILURE:</span>
            <span>{pipelineError}</span>
          </div>
        )}

        {pipelineOutput && (
          <div className="bg-[#0E1117] border border-slate-800/80 rounded-xl p-5 space-y-4 shadow-inner animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/60 pb-3 gap-3">
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                Pipeline Generation Complete
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyCurrentTab}
                  className="px-2.5 py-1 text-[10px] font-mono bg-[#161B22] border border-slate-800 hover:border-slate-700 text-slate-300 rounded transition-colors"
                >
                  Copy Current Tab
                </button>
                <button
                  type="button"
                  onClick={handleExportPack}
                  disabled={!pipelineOutput.exportAvailable}
                  title={pipelineOutput.exportReason}
                  className="px-2.5 py-1 text-[10px] font-mono rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#161B22] border border-slate-800 text-slate-500 disabled:hover:border-slate-800 hover:border-slate-700 text-slate-300 disabled:text-slate-600"
                >
                  {pipelineOutput.exportAvailable ? 'Export Pack' : 'Export Unavailable'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'final', label: 'Final Text' },
                  { id: 'changeLog', label: 'Change Log' },
                  { id: 'beforeAfter', label: 'Before / After' },
                  { id: 'risk', label: 'Risk Notes' },
                  { id: 'export', label: 'Export Pack' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded border text-[10px] font-mono transition-all ${
                    activeTab === tab.id
                      ? 'bg-slate-200 border-slate-200 text-slate-950'
                      : 'bg-[#161B22] border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-80 custom-scrollbar bg-[#0B0F19]/50 p-4 rounded-lg border border-slate-900">
              {getCurrentTabText()}
            </pre>
          </div>
        )}
      </div>

      <StatusStream
        steps={steps}
        isProcessing={isProcessing}
        runId={runId}
        selectedDepth={selectedDepth}
        selectedRunMode={selectedRunMode}
        selectedScopeLabel={selectedScopeLabel}
      />
    </div>
  );
}
