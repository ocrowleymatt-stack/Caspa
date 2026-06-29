/**
 * Caspa Gold Pipeline — multi-pass refinement with SSE progress
 */

import express from 'express';
import { GOLD_PASSES, runGoldPipeline } from '../services/goldPipelineService';
import { createJob, getJob, getJobAudit, updateJob } from '../services/jobQueueService';
import type { GoldPipelineProgressEvent } from '../types/gold';

const router = express.Router();

function writeSse(res: express.Response, payload: GoldPipelineProgressEvent): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

router.get('/passes', (_req, res) => {
  res.json({ success: true, data: { passes: GOLD_PASSES } });
});

router.get('/jobs/audit', (_req, res) => {
  res.json({ success: true, data: getJobAudit() });
});

router.get('/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  res.json({ success: true, data: job });
});

router.post('/pipeline', async (req, res) => {
  const { content, title = 'Untitled', tone = '', stream = false } = req.body as {
    content?: string;
    title?: string;
    tone?: string;
    stream?: boolean;
  };

  if (!content?.trim()) {
    return res.status(400).json({ success: false, message: 'content is required' });
  }

  const job = createJob('gold-pipeline', 'starting');
  updateJob(job.id, { status: 'running', progress: 0, stage: 'structure' });

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const total = GOLD_PASSES.length;
      let completed = 0;

      const { finalText, passes } = await runGoldPipeline(
        content,
        { title, tone },
        (passId, status, result) => {
          if (status === 'running') {
            updateJob(job.id, { stage: passId, progress: Math.round((completed / total) * 100) });
            writeSse(res, {
              type: 'stage',
              jobId: job.id,
              passId,
              passName: GOLD_PASSES.find((p) => p.id === passId)?.name,
              status: 'running',
              percent: Math.round((completed / total) * 100),
            });
          } else {
            completed += 1;
            updateJob(job.id, { stage: passId, progress: Math.round((completed / total) * 100) });
            writeSse(res, {
              type: 'stage',
              jobId: job.id,
              passId,
              passName: result?.name,
              status: 'done',
              percent: Math.round((completed / total) * 100),
              notes: result?.notes,
              revisedText: result?.revisedText,
            });
          }
        }
      );

      updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
      writeSse(res, {
        type: 'complete',
        jobId: job.id,
        percent: 100,
        finalText,
        message: `${passes.length} passes complete`,
      });
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gold pipeline failed';
      updateJob(job.id, { status: 'failed', error: message });
      writeSse(res, { type: 'error', jobId: job.id, message, status: 'failed' });
      res.write('data: [DONE]\n\n');
      res.end();
    }
    return;
  }

  // Non-streaming: run async, return job id immediately
  res.status(202).json({ success: true, data: { jobId: job.id, status: 'running' } });

  runGoldPipeline(content, { title, tone }, (passId, status) => {
    if (status === 'done') {
      const idx = GOLD_PASSES.findIndex((p) => p.id === passId);
      updateJob(job.id, {
        stage: passId,
        progress: Math.round(((idx + 1) / GOLD_PASSES.length) * 100),
      });
    }
  })
    .then(() => updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' }))
    .catch((err) =>
      updateJob(job.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Gold pipeline failed',
      })
    );
});

export default router;
