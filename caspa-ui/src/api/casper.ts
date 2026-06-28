import { apiCall, apiPostStream } from './client';
import { startJobBackedRequest, type JobProgress, type JobStartResponse } from './caspaJobs';

export function casperFreestyle(body: { input?: string; sessionId?: string; projectId?: string }) {
  return apiCall<unknown>('/api/casper/freestyle', { method: 'POST', body: JSON.stringify(body) });
}

export function casperStream(
  body: { input: string; sessionId?: string; projectId?: string },
  onEvent: (data: unknown) => void,
  signal?: AbortSignal,
) {
  return apiPostStream('/api/casper/freestyle/stream', body, onEvent, signal);
}

export function listCasperSessions() {
  return apiCall<unknown[]>('/api/casper/sessions');
}

export function getCasperSession(id: string) {
  return apiCall<unknown>(`/api/casper/session/${id}`);
}

export function continueCasperSession(id: string, input: string) {
  return apiCall<unknown>(`/api/casper/session/${id}/continue`, {
    method: 'POST',
    body: JSON.stringify({ input }),
  });
}

export function getCasperStatus() {
  return apiCall<{ available: boolean; version: string; message: string }>('/api/casper/status');
}

export interface NovelWriteProResult {
  outputId: string;
  projectId?: string;
  title: string;
  kind: 'novel-write-pro' | 'manuscript-improvement';
  text: string;
  provider: string;
  model: string;
  createdAt: string;
  sourceChapterId?: string;
  sourceChapterTitle?: string;
  structured?: {
    premise: string;
    formatDecision: string;
    characterWoundMap: string;
    scenePlan: string[];
    firstDraft: string;
    criticReport: string;
    improvedRewrite: string;
  };
}

export function runNovelQualityPass(body: {
  projectId?: string;
  chapterId?: string;
  content?: string;
  mode?: string;
}) {
  return apiCall<{
    overallScore: number;
    status: string;
    findings: Array<{ gate: string; status: string; score: number; issues: string[] }>;
    recommendedRewritePrompt: string;
    wordCount: number;
    mode: string;
  }>('/api/casper/quality-pass', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function runNovelWritePro(
  body: {
    projectId?: string;
    chapterId?: string;
    sourceChapterTitle?: string;
    improveExisting?: boolean;
    mode?: string;
    output?: string;
    spark?: string;
    source?: string;
    tone?: string;
    uploadedName?: string | null;
    modeTitle?: string;
    genre?: string;
  },
  options?: { onProgress?: (progress: JobProgress) => void; onJobStarted?: (jobId: string) => void },
) {
  return startJobBackedRequest<NovelWriteProResult>(
    () =>
      apiCall<JobStartResponse | NovelWriteProResult>('/api/casper/novel-write-pro', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    {
      onProgress: options?.onProgress,
      onJobStarted: options?.onJobStarted,
      extractResult: (job) => ({
        ...(job.result as unknown as NovelWriteProResult),
        outputId: String(job.result?.outputId ?? ''),
        title: String(job.result?.title ?? 'Draft'),
        kind: (job.result?.kind as NovelWriteProResult['kind']) ?? 'novel-write-pro',
        text: String((job.result as { text?: string })?.text ?? ''),
        provider: String((job.result as { provider?: string })?.provider ?? 'local'),
        model: String((job.result as { model?: string })?.model ?? ''),
        createdAt: job.completedAt ?? job.updatedAt,
      }),
    },
  );
}

export interface ContinueWritingResult {
  outputId: string;
  projectId: string;
  title: string;
  kind: 'continue-writing';
  text: string;
  provider: string;
  model: string;
  mode: string;
  createdAt: string;
}

export function continueWriting(body: {
  projectId: string;
  chapterId?: string;
  currentText: string;
  instruction?: string;
  mode?: 'continue' | 'rewrite' | 'expand' | 'polish' | 'punch-up' | 'darker' | 'funnier' | 'stage-adapt';
  parentOutputId?: string;
}) {
  return apiCall<ContinueWritingResult>('/api/casper/continue', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
