import { Router, type Request, type Response } from 'express';
import type { AIRequest } from '../../shared';
import { aiOrchestrator } from './AIOrchestrator';
import { ollamaClient } from './OllamaClient';
import { writingAssistant } from './WritingAssistant';

interface ApiSuccess<T> {
  success: true;
  data: T;
  error?: undefined;
}

interface ApiFailure {
  success: false;
  data?: undefined;
  error: string;
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

function sendSuccess<T>(res: Response, data: T): void {
  const payload: ApiSuccess<T> = { success: true, data };
  res.json(payload);
}

function sendError(res: Response, status: number, message: string): void {
  const payload: ApiFailure = { success: false, error: message };
  res.status(status).json(payload);
}

function setupSse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

function sendSseChunk(res: Response, chunk: string): void {
  res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
}

function sendSseDone(
  res: Response,
  model: string,
  tokensUsed?: number,
): void {
  res.write(`data: ${JSON.stringify({ done: true, model, tokensUsed })}\n\n`);
  res.end();
}

function sendSseError(res: Response, message: string): void {
  res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  res.end();
}

async function handleRoute<T>(
  res: Response,
  handler: () => Promise<T>,
): Promise<void> {
  try {
    const data = await handler();
    sendSuccess(res, data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, 500, message);
  }
}

export const aiRouter = Router();

aiRouter.post('/generate', async (req: Request, res: Response) => {
  const body = req.body as AIRequest;
  if (!body?.prompt) {
    sendError(res, 400, 'prompt is required');
    return;
  }

  await handleRoute(res, () => aiOrchestrator.generate(body));
});

aiRouter.post('/generate/stream', async (req: Request, res: Response) => {
  const body = req.body as AIRequest;
  if (!body?.prompt) {
    sendError(res, 400, 'prompt is required');
    return;
  }

  setupSse(res);

  try {
    const response = await aiOrchestrator.streamGenerate(body, (chunk) => {
      sendSseChunk(res, chunk);
    });
    sendSseDone(res, response.model, response.tokensUsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendSseError(res, message);
  }
});

aiRouter.get('/providers', async (_req: Request, res: Response) => {
  await handleRoute(res, () => aiOrchestrator.getAvailableProviders());
});

aiRouter.get('/models', async (_req: Request, res: Response) => {
  await handleRoute(res, async () => {
    const available = await ollamaClient.isAvailable();
    if (!available) {
      return [];
    }
    return ollamaClient.listModels();
  });
});

aiRouter.post('/continue', async (req: Request, res: Response) => {
  const { chapterId, instruction } = req.body as {
    chapterId?: string;
    instruction?: string;
  };

  if (!chapterId) {
    sendError(res, 400, 'chapterId is required');
    return;
  }

  await handleRoute(res, () => writingAssistant.continueChapter(chapterId, instruction));
});

aiRouter.post('/rewrite', async (req: Request, res: Response) => {
  const { text, instruction, projectId } = req.body as {
    text?: string;
    instruction?: string;
    projectId?: string;
  };

  if (!text || !instruction || !projectId) {
    sendError(res, 400, 'text, instruction, and projectId are required');
    return;
  }

  await handleRoute(res, () => writingAssistant.rewriteSelection(text, instruction, projectId));
});

aiRouter.post('/plot-suggest', async (req: Request, res: Response) => {
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) {
    sendError(res, 400, 'projectId is required');
    return;
  }

  await handleRoute(res, () => writingAssistant.suggestPlotPoints(projectId));
});

aiRouter.post('/dialogue', async (req: Request, res: Response) => {
  const { characterId, situation } = req.body as {
    characterId?: string;
    situation?: string;
  };

  if (!characterId || !situation) {
    sendError(res, 400, 'characterId and situation are required');
    return;
  }

  await handleRoute(res, () => writingAssistant.generateCharacterDialogue(characterId, situation));
});

aiRouter.post('/critique', async (req: Request, res: Response) => {
  const { chapterId } = req.body as { chapterId?: string };
  if (!chapterId) {
    sendError(res, 400, 'chapterId is required');
    return;
  }

  await handleRoute(res, () => writingAssistant.critiqueChapter(chapterId));
});

aiRouter.post('/summary', async (req: Request, res: Response) => {
  const { chapterId } = req.body as { chapterId?: string };
  if (!chapterId) {
    sendError(res, 400, 'chapterId is required');
    return;
  }

  await handleRoute(res, () => writingAssistant.generateChapterSummary(chapterId));
});

aiRouter.post('/consistency', async (req: Request, res: Response) => {
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) {
    sendError(res, 400, 'projectId is required');
    return;
  }

  await handleRoute(res, () => writingAssistant.checkConsistency(projectId));
});

aiRouter.post('/title', async (req: Request, res: Response) => {
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) {
    sendError(res, 400, 'projectId is required');
    return;
  }

  await handleRoute(res, () => writingAssistant.generateTitle(projectId));
});

aiRouter.post('/style-lock', async (req: Request, res: Response) => {
  const { sampleText, newPrompt } = req.body as {
    sampleText?: string;
    newPrompt?: string;
  };

  if (!sampleText || !newPrompt) {
    sendError(res, 400, 'sampleText and newPrompt are required');
    return;
  }

  await handleRoute(res, () => writingAssistant.matchWritingStyle(sampleText, newPrompt));
});

export type { ApiResponse };
