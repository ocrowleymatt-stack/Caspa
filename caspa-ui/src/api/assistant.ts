import { apiCall, apiPostStream } from './client';
import type { AIProvider, PlotPoint } from '../types';

export async function getProviders(): Promise<AIProvider[]> {
  return apiCall<AIProvider[]>('/providers');
}

export async function getModels(): Promise<string[]> {
  return apiCall<string[]>('/models');
}

export async function continueChapter(chapterId: string, instruction?: string): Promise<string> {
  return apiCall<string>('/continue', {
    method: 'POST',
    body: JSON.stringify({ chapterId, instruction }),
  });
}

export async function rewriteSelection(
  text: string,
  instruction: string,
  projectId: string,
): Promise<string> {
  return apiCall<string>('/rewrite', {
    method: 'POST',
    body: JSON.stringify({ text, instruction, projectId }),
  });
}

export async function critiqueChapter(chapterId: string): Promise<{
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}> {
  return apiCall('/critique', {
    method: 'POST',
    body: JSON.stringify({ chapterId }),
  });
}

export async function checkConsistency(projectId: string): Promise<{
  issues: string[];
  warnings: string[];
}> {
  return apiCall('/consistency', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function generateSummary(chapterId: string): Promise<string> {
  return apiCall<string>('/summary', {
    method: 'POST',
    body: JSON.stringify({ chapterId }),
  });
}

export async function suggestPlotPoints(projectId: string): Promise<PlotPoint[]> {
  return apiCall<PlotPoint[]>('/plot-suggest', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function generateDialogue(characterId: string, situation: string): Promise<string> {
  return apiCall<string>('/dialogue', {
    method: 'POST',
    body: JSON.stringify({ characterId, situation }),
  });
}

export async function generateTitles(projectId: string): Promise<string[]> {
  return apiCall<string[]>('/title', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  });
}

export async function styleLock(sampleText: string, newPrompt: string): Promise<string> {
  return apiCall<string>('/style-lock', {
    method: 'POST',
    body: JSON.stringify({ sampleText, newPrompt }),
  });
}

export interface StreamChunk {
  chunk?: string;
  done?: boolean;
  model?: string;
  tokensUsed?: number;
  error?: string;
}

export async function streamGenerate(
  body: {
    prompt: string;
    context?: string;
    model?: string;
    projectId?: string;
    chapterId?: string;
    temperature?: number;
    maxTokens?: number;
  },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<{ model: string; tokensUsed?: number }> {
  let model = '';
  let tokensUsed: number | undefined;

  await apiPostStream<StreamChunk>(
    '/generate/stream',
    body,
    (data) => {
      if (data.error) {
        throw new Error(data.error);
      }
      if (data.chunk) {
        onChunk(data.chunk);
      }
      if (data.done) {
        model = data.model ?? '';
        tokensUsed = data.tokensUsed;
      }
    },
    signal,
  );

  return { model, tokensUsed };
}

export async function generate(body: {
  prompt: string;
  context?: string;
  model?: string;
  projectId?: string;
  chapterId?: string;
}): Promise<{ text: string; model: string }> {
  return apiCall('/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
