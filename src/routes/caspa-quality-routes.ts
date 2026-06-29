/**
 * Novel Write Pro — server-side quality pass
 */

import express from 'express';
import { callServerAi } from '../services/serverAiHelper';
import { aggregateQuality, modeHint, runQualityGates } from '../services/qualityGateService';
import { createJob, updateJob } from '../services/jobQueueService';
import type { NovelQualityPassResult, NovelWriteProMode } from '../types/gold';

const router = express.Router();

const VALID_MODES: NovelWriteProMode[] = [
  'novel',
  'script',
  'musical',
  'adaptation',
  'polish',
  'chaos',
];

router.post('/quality-pass', async (req, res) => {
  const { content, mode = 'novel', title = 'Untitled' } = req.body as {
    content?: string;
    mode?: NovelWriteProMode;
    title?: string;
  };

  if (!content?.trim()) {
    return res.status(400).json({ success: false, message: 'content is required' });
  }

  const safeMode = VALID_MODES.includes(mode) ? mode : 'novel';
  const job = createJob('quality-pass', 'assessing');
  updateJob(job.id, { status: 'running' });

  try {
    const findings = runQualityGates(content, safeMode);
    const { overallScore, status } = aggregateQuality(findings);

    let recommendedRewritePrompt = '';
    try {
      recommendedRewritePrompt = (
        await callServerAi(
          [
            'You are a senior literary editor for Novel Write Pro.',
            `Mode: ${safeMode}. ${modeHint(safeMode)}`,
            `Project: "${title}"`,
            'Return ONE paragraph rewrite prompt the author can paste into their editor.',
            'Focus on the top 3 concrete fixes. No markdown. No bullet list.',
            '',
            'MANUSCRIPT EXCERPT:',
            content.slice(0, 8000),
          ].join('\n')
        )
      ).trim();
    } catch {
      recommendedRewritePrompt =
        'Revise for specificity, rhythm, and earned emotion. Cut generic filler and preserve the existing story beats.';
    }

    const result: NovelQualityPassResult = {
      overallScore,
      status,
      findings,
      recommendedRewritePrompt,
      wordCount: content.trim().split(/\s+/).filter(Boolean).length,
      mode: safeMode,
    };

    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete', result: { overallScore: result.overallScore } });
    res.json({ success: true, data: result, jobId: job.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Quality pass failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

export default router;
