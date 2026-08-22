/**
 * Caspa Gold Pipeline — multi-pass refinement with SSE progress
 */

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { GOLD_PASSES, runGoldPipeline } from '../services/goldPipelineService';
import { createJob, getJob, getJobAudit, listRecentJobs, reapStaleJobs, updateJob } from '../services/jobQueueService';
import { queueServerCommission, resumePersistedCommissionJobs, runServerCommission } from '../services/serverCommissionJobService';
import { ensureOneShotRecoveredBookRepair, queueRepairFromCompletedJob } from '../services/commissionRepairService';
import type { GoldPipelineProgressEvent } from '../types/gold';

const router = express.Router();

// Clear legacy zombie jobs which have neither resumable input nor a checkpoint,
// then recover genuine persisted Commission work.
setTimeout(() => reapStaleJobs(), 100);
setTimeout(() => resumePersistedCommissionJobs(), 250);
// One-shot recovery for the retained completed manuscript. Guarded by a durable
// marker in CASPA_DATA_DIR, so repeated deploys cannot create duplicate repairs.
setTimeout(() => ensureOneShotRecoveredBookRepair(), 1250);

function writeSse(res: express.Response, payload: GoldPipelineProgressEvent): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

router.get('/passes', (_req, res) => {
  res.json({ success: true, data: { passes: GOLD_PASSES } });
});

router.get('/jobs', (_req, res) => {
  res.json({ success: true, data: { jobs: listRecentJobs() } });
});

router.get('/jobs/audit', (_req, res) => {
  res.json({ success: true, data: getJobAudit() });
});

/**
 * Central long-form progress feed for the front end. Specialist engines remain
 * internal; users see one Publication Studio lifecycle.
 */
router.get('/publication-studio/status', (_req, res) => {
  const dataDir = process.env.CASPA_DATA_DIR || path.join(process.cwd(), 'data');
  const candidates = [
    process.env.CASPA_PUBLICATION_STATE,
    path.join(dataDir, 'publication-studio-state.json'),
    path.join(dataDir, 'everyman-humanise-state.json'),
  ].filter(Boolean) as string[];

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const state = JSON.parse(fs.readFileSync(file, 'utf8'));
      const chapters = Array.isArray(state.chapters) ? state.chapters : [];
      const completedChapters = chapters.filter((c: any) => c && c.content).length;
      const currentWords = Number(state.finalWords || chapters.reduce((n: number, c: any) => n + Number(c?.wordCount || 0), 0));
      const totalChapters = Number(state.totalChapters || state.sourceChapterCount || Math.max(completedChapters, 0));
      const targetWords = Number(state.targetWords || 0);
      const updatedAt = state.updatedAt || state.completedAt || state.createdAt || null;
      const stage = String(state.stage || 'idle');
      const complete = stage === 'exported' || Boolean(state.completedAt);
      const failed = Array.isArray(state.failures) ? state.failures.length : 0;

      return res.json({
        success: true,
        data: {
          kind: 'publication',
          title: state.title || 'Long-Form Adaptation',
          status: complete ? 'complete' : failed && completedChapters === 0 ? 'attention' : 'running',
          stage,
          completedChapters,
          totalChapters,
          currentWords,
          targetWords,
          updatedAt,
          failures: failed,
          output: state.output || null,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Could not read Publication Studio state.' });
    }
  }

  return res.json({ success: true, data: { kind: 'publication', title: 'Publication Studio', status: 'idle', stage: 'idle', completedChapters: 0, totalChapters: 0, currentWords: 0, targetWords: 0, updatedAt: null, failures: 0, output: null } });
});

router.get('/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  res.json({ success: true, data: job });
});

router.post('/jobs/:jobId/retry', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  if (job.type !== 'commission' || !job.input) {
    return res.status(400).json({ success: false, message: 'Only persisted Commission jobs can be resumed here.' });
  }
  if (job.status === 'complete') {
    return res.json({ success: true, data: job });
  }
  updateJob(job.id, { status: 'queued', error: undefined, stage: 'retry-queued' });
  setTimeout(() => void runServerCommission(job.id), 0);
  return res.status(202).json({ success: true, data: { jobId: job.id, status: 'queued' } });
});

router.post('/jobs/:jobId/repair', (req, res) => {
  try {
    const jobId = queueRepairFromCompletedJob(req.params.jobId, {
      title: req.body?.title,
      idea: req.body?.idea,
      tone: req.body?.tone,
      audience: req.body?.audience,
      targetWordCount: req.body?.targetWordCount,
    });
    return res.status(202).json({
      success: true,
      data: {
        jobId,
        status: 'queued',
        sourceJobId: req.params.jobId,
        message: 'Repair-only Commission accepted. The original completed manuscript remains untouched.',
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Could not start manuscript repair.' });
  }
});

router.post('/commission', (req, res) => {
  const { brief, chapters, diagnosis, selectedRecommendationIds, scope } = req.body || {};
  if (!brief || !Array.isArray(chapters) || !chapters.length || !diagnosis || !Array.isArray(selectedRecommendationIds) || !scope) {
    return res.status(400).json({ success: false, message: 'brief, chapters, diagnosis, selectedRecommendationIds array and scope are required' });
  }

  const jobId = queueServerCommission({
    brief,
    chapters,
    diagnosis,
    selectedRecommendationIds,
    scope,
    autoResearch: req.body?.autoResearch !== false,
    promises: Array.isArray(req.body?.promises) ? req.body.promises : [],
  });

  return res.status(202).json({
    success: true,
    data: {
      jobId,
      status: 'queued',
      message: 'Commission accepted by Atlas. The job continues if the browser disconnects.',
    },
  });
});

router.post('/pipeline', async (req, res) => {
  const {
    content,
    title = 'Untitled',
    tone = '',
    stream = false,
    plotHold = null,
    mode = 'novel',
    targetWordCount = null,
  } = req.body as {
    content?: string;
    title?: string;
    tone?: string;
    stream?: boolean;
    plotHold?: Record<string, unknown> | null;
    mode?: string;
    targetWordCount?: number | null;
  };

  if (!content?.trim()) {
    return res.status(400).json({ success: false, message: 'content is required' });
  }

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const result = await runGoldPipeline(content, { title, tone, mode, targetWordCount, plotHold }, (passId, status, passResult) => {
        writeSse(res, { type: 'stage', jobId: 'gold-pipeline', passId, status, notes: passResult?.notes, revisedText: passResult?.revisedText });
      });
      writeSse(res, { type: 'complete', jobId: result.jobId, finalText: result.finalText });
    } catch (error) {
      writeSse(res, { type: 'error', jobId: 'gold-pipeline', message: error instanceof Error ? error.message : 'Pipeline failed' });
    } finally {
      res.end();
    }
    return;
  }

  try {
    const result = await runGoldPipeline(content, { title, tone, mode, targetWordCount, plotHold });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Pipeline failed' });
  }
});

export default router;
