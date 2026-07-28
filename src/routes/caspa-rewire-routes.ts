/**
 * Caspa rewire API — artefact-first intent routing and write orchestration.
 * Adapted from caspa-rewire-working to use callServerAi.
 */

import { Router, Request, Response } from 'express';
import { runCaspaOrchestrator, buildResearchPrompt, buildResearchUnavailableResult } from '../services/caspa-orchestrator';
import { buildImprovementBrief, analyseReviews } from '../services/review-ingest';
import { routeCaspaIntent } from '../services/intent-router';
import { callServerAi } from '../services/serverAiHelper';

const router = Router();

async function callProvider(
  prompt: string,
  options?: { json?: boolean; maxTokens?: number; useSearch?: boolean }
): Promise<string | null> {
  try {
    return await callServerAi(prompt, Boolean(options?.json));
  } catch {
    return null;
  }
}

router.post('/intent/route', (req: Request, res: Response) => {
  const { content = '', command = '' } = req.body || {};
  res.json(routeCaspaIntent(content, command));
});

router.post('/reviews/analyse', (req: Request, res: Response) => {
  const { externalReviews = '' } = req.body || {};
  res.json(analyseReviews(externalReviews));
});

router.post('/improvement-brief', (req: Request, res: Response) => {
  res.json(buildImprovementBrief(req.body || {}));
});

router.post('/write', async (req: Request, res: Response) => {
  try {
    const result = await runCaspaOrchestrator(req.body || {}, callProvider);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Caspa write route failed' });
  }
});

router.post('/research/run', async (req: Request, res: Response) => {
  const {
    projectBrief = '',
    researchQuestion = '',
    mode = 'Deep Web Research',
    existingContext = '',
  } = req.body || {};

  try {
    const prompt = buildResearchPrompt(projectBrief, researchQuestion, mode, existingContext);
    const raw = await callProvider(prompt, { json: true, maxTokens: 5000, useSearch: mode === 'Deep Web Research' });
    if (!raw) return res.json(buildResearchUnavailableResult(researchQuestion));
    try {
      res.json(JSON.parse(raw));
    } catch {
      res.json({
        status: 'complete',
        summary: raw,
        findings: [],
        suggestedNextSearches: [],
        contradictions: [],
        gaps: [],
      });
    }
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      summary: error.message || 'Research route failed',
      findings: [],
      suggestedNextSearches: [researchQuestion].filter(Boolean),
      contradictions: [],
      gaps: ['Research failed before findings could be verified.'],
    });
  }
});

router.post('/research/convert-to-writing', async (req: Request, res: Response) => {
  try {
    const {
      findings = [],
      command = 'Turn these findings into usable scene/chapter material.',
      projectBrief = '',
    } = req.body || {};
    const content = JSON.stringify(findings, null, 2);
    const result = await runCaspaOrchestrator({ command, content, projectBrief }, callProvider);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Research conversion failed' });
  }
});

export default router;
