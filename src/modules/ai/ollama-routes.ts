import { Router, type Request, type Response } from 'express';
import { config } from '../../shared';
import { ollamaClient } from './OllamaClient';

function sendSuccess(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, error: message });
}

export const ollamaRouter = Router();

ollamaRouter.get('/api/ollama/health', async (_req: Request, res: Response) => {
  try {
    const reachable = await ollamaClient.isAvailable();
    sendSuccess(res, {
      reachable,
      configured: Boolean(config.ollamaUrl),
      defaultModel: config.ollamaModel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, 503, message.includes('reach') ? message : 'Ollama is not reachable');
  }
});

ollamaRouter.get('/api/ollama/models', async (_req: Request, res: Response) => {
  try {
    const reachable = await ollamaClient.isAvailable();
    if (!reachable) {
      sendError(res, 503, 'Ollama is not reachable');
      return;
    }
    const models = await ollamaClient.listModels();
    sendSuccess(res, { models });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, 503, message);
  }
});

ollamaRouter.post('/api/ollama/generate-test', async (req: Request, res: Response) => {
  const prompt =
    typeof req.body?.prompt === 'string' && req.body.prompt.trim()
      ? req.body.prompt.trim()
      : 'Write one vivid sentence about a haunted theatre.';

  try {
    const reachable = await ollamaClient.isAvailable();
    if (!reachable) {
      sendError(res, 503, 'Ollama is not reachable');
      return;
    }

    const start = Date.now();
    const model = await ollamaClient.resolveModel();
    const response = await ollamaClient.generate({
      prompt,
      model,
      maxTokens: 120,
      temperature: 0.7,
    });

    sendSuccess(res, {
      provider: 'ollama',
      model: response.model,
      output: response.text.trim(),
      durationMs: Date.now() - start,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendError(res, 503, message);
  }
});
