import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { runCaspaOrchestrator, buildResearchPrompt, buildResearchUnavailableResult } from '../services/caspa-orchestrator';
import { buildImprovementBrief, analyseReviews } from '../services/review-ingest';
import { routeCaspaIntent } from '../services/intent-router';

const router = Router();
const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

async function callGemini(prompt: string, options?: { json?: boolean; maxTokens?: number; useSearch?: boolean }) {
  if (!ai) return null;
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      temperature: 0.65,
      maxOutputTokens: options?.maxTokens || 5000,
      ...(options?.json ? { responseMimeType: 'application/json' } : {}),
      ...(options?.useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });
  return response.text || null;
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
    const result = await runCaspaOrchestrator(req.body || {}, callGemini);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Caspa write route failed' });
  }
});

router.post('/research/run', async (req: Request, res: Response) => {
  const { projectBrief = '', researchQuestion = '', mode = 'Deep Web Research', existingContext = '' } = req.body || {};

  if (!ai) {
    return res.json(buildResearchUnavailableResult(researchQuestion));
  }

  try {
    const prompt = buildResearchPrompt(projectBrief, researchQuestion, mode, existingContext);
    const raw = await callGemini(prompt, { json: true, maxTokens: 5000, useSearch: mode === 'Deep Web Research' });
    if (!raw) return res.json(buildResearchUnavailableResult(researchQuestion));
    res.json(JSON.parse(raw));
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
    const { findings = [], command = 'Turn these findings into usable scene/chapter material.', projectBrief = '' } = req.body || {};
    const content = JSON.stringify(findings, null, 2);
    const result = await runCaspaOrchestrator({ command, content, projectBrief }, callGemini);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Research conversion failed' });
  }
});

export default router;
