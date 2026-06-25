import { Router, type Request, type Response } from 'express';
import { generateId } from '../../shared';
import { asyncHandler, sendError } from '../../shared/routeHelpers';
import { goldPipeline } from './GoldPipeline';

const UI_PIPELINE_STEPS = [
  {
    stage: 'manuscript_ingest',
    label: 'Manuscript Ingest',
    detail: 'Parsing local markdown trees and manuscript nodes...',
  },
  {
    stage: 'structural_vector_mapping',
    label: 'Structural Vector Mapping',
    detail: 'Aligning plot beats, scene function, and timeline pressure...',
  },
  {
    stage: 'scene_function_analysis',
    label: 'Scene Function Analysis',
    detail: 'Checking whether each scene earns its place...',
  },
  {
    stage: 'prose_quality_pass',
    label: 'Prose Quality Pass',
    detail: 'Analysing syntax variance, cadence, filler, and dead phrasing...',
  },
  {
    stage: 'voice_consistency_calibration',
    label: 'Voice Consistency Calibration',
    detail: 'Testing character register, diction, and emotional vocabulary...',
  },
  {
    stage: 'dialogue_veracity_audit',
    label: 'Dialogue Veracity Audit',
    detail: 'Checking subtext, conflict, interruption, and natural pressure...',
  },
  {
    stage: 'subtext_motif_detection',
    label: 'Subtext & Motif Detection',
    detail: 'Mapping recurring images, symbolic load, and buried meaning...',
  },
  {
    stage: 'sensory_detail_expansion',
    label: 'Sensory Detail Expansion',
    detail: 'Locating scenes that need physical anchoring without purple fog...',
  },
  {
    stage: 'pacing_tension_mapping',
    label: 'Pacing & Tension Mapping',
    detail: 'Calculating scene velocity, compression, and escalation drag...',
  },
  {
    stage: 'lexical_density_sweep',
    label: 'Lexical Density Sweep',
    detail: 'Reducing repetition while protecting intentional verbal motifs...',
  },
  {
    stage: 'micro_tension_polish',
    label: 'Micro-Tension Polish',
    detail: 'Sharpening sentence hooks, transitions, and line endings...',
  },
  {
    stage: 'final_gold_framework',
    label: 'Final Gold Framework',
    detail: 'Compiling final text, audit report, before/after pairs, and export pack...',
  },
] as const;

function setupSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

function writeSse(res: Response, payload: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: step_update\ndata: ${JSON.stringify(payload)}\n\n`);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}

export const goldPipelineRoutes = Router();

goldPipelineRoutes.post(
  '/execute',
  asyncHandler(async (req, res) => {
    const { projectId, config, chapters } = req.body as {
      projectId?: string;
      config?: Record<string, unknown>;
      chapters?: string[];
    };

    if (!projectId?.trim()) {
      sendError(res, new Error('projectId is required'), 400);
      return;
    }

    setupSse(res);

    const runId = generateId();
    let disconnected = false;

    req.on('close', () => {
      disconnected = true;
    });

    const scopeLabel =
      Array.isArray(chapters) && chapters.length > 0
        ? chapters.includes('book')
          ? 'Whole Book'
          : `${chapters.length} chapter(s)`
        : 'Whole project';

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    try {
      for (let idx = 0; idx < UI_PIPELINE_STEPS.length; idx++) {
        if (disconnected || abortController.signal.aborted) return;

        const step = UI_PIPELINE_STEPS[idx];
        const progress = Math.round(((idx + 1) / UI_PIPELINE_STEPS.length) * 100);

        writeSse(res, {
          type: 'step_update',
          run_id: runId,
          stage: step.stage,
          status: 'running',
          message: step.detail,
          progress,
          current_chapter: scopeLabel,
          warnings:
            config?.runMode === 'full' && step.stage === 'prose_quality_pass'
              ? ['Full rewrite mode active. Preserve intentional roughness before accepting output.']
              : [],
        });

        await sleep(750, abortController.signal);

        if (disconnected || abortController.signal.aborted) return;

        writeSse(res, {
          type: 'step_update',
          run_id: runId,
          stage: step.stage,
          status: 'done',
          message: `${step.label} complete.`,
          progress,
          current_chapter: scopeLabel,
        });

        await sleep(200, abortController.signal);
      }

      if (disconnected || abortController.signal.aborted) return;

      const report = await goldPipeline.run(projectId);

      if (disconnected || res.writableEnded) return;

      res.write(
        `event: complete\ndata: ${JSON.stringify({ type: 'complete', run_id: runId, report })}\n\n`,
      );
      res.end();
    } catch (err) {
      if (disconnected || abortController.signal.aborted) return;

      const message = err instanceof Error ? err.message : 'Gold pipeline failed';
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message })}\n\n`);
        res.end();
      }
    }
  }),
);
