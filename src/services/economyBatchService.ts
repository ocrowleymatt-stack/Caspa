import { randomUUID } from 'crypto';

export type EconomyProvider = 'groq' | 'gemini';
export type EconomyState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';

export interface EconomyBatchRequest {
  prompt: string;
  model?: string;
  provider?: EconomyProvider;
  maxTokens?: number;
  json?: boolean;
  displayName?: string;
  conversationId?: string;
  requestId?: string;
}

export interface EconomyBatchJob {
  id: string;
  provider: EconomyProvider;
  providerJobId: string;
  state: EconomyState;
  model: string;
  createdAt: string;
  updatedAt: string;
  result?: string;
  error?: string;
  estimatedDiscountPct: number;
  conversationId?: string;
  requestId?: string;
  deliveredAt?: string;
}

const jobs = new Map<string, EconomyBatchJob>();

function groqKey() {
  return process.env.GROQ_API_KEY || process.env.XAI_API_KEY || '';
}
function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
}

export function economyCapabilities() {
  return {
    groq: Boolean(groqKey()),
    gemini: Boolean(geminiKey()),
    discountPct: 50,
    groqModels: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'],
    geminiDefault: 'gemini-3.6-flash',
  };
}

function chooseProvider(requested?: EconomyProvider): EconomyProvider {
  if (requested === 'groq' && groqKey()) return 'groq';
  if (requested === 'gemini' && geminiKey()) return 'gemini';
  if (groqKey()) return 'groq';
  if (geminiKey()) return 'gemini';
  throw new Error('No economy batch provider configured');
}

async function createGroqBatch(req: EconomyBatchRequest): Promise<EconomyBatchJob> {
  const key = groqKey();
  if (!key) throw new Error('Groq API key unavailable');
  const id = randomUUID();
  const model = req.model || 'openai/gpt-oss-120b';
  const row = {
    custom_id: id,
    method: 'POST',
    url: '/v1/chat/completions',
    body: {
      model,
      messages: [{ role: 'user', content: req.json ? `${req.prompt}\n\nReturn ONLY valid JSON.` : req.prompt }],
      max_tokens: req.maxTokens || 8192,
    },
  };
  const form = new FormData();
  form.append('purpose', 'batch');
  form.append('file', new Blob([`${JSON.stringify(row)}\n`], { type: 'application/jsonl' }), `atlas-${id}.jsonl`);
  const upload = await fetch('https://api.groq.com/openai/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!upload.ok) throw new Error(`Groq batch upload ${upload.status}: ${(await upload.text()).slice(0, 500)}`);
  const file = await upload.json() as any;
  const create = await fetch('https://api.groq.com/openai/v1/batches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_file_id: file.id, endpoint: '/v1/chat/completions', completion_window: '24h' }),
  });
  if (!create.ok) throw new Error(`Groq batch create ${create.status}: ${(await create.text()).slice(0, 500)}`);
  const batch = await create.json() as any;
  const now = new Date().toISOString();
  const job: EconomyBatchJob = { id, provider: 'groq', providerJobId: batch.id, state: 'queued', model, createdAt: now, updatedAt: now, estimatedDiscountPct: 50, conversationId: req.conversationId, requestId: req.requestId };
  jobs.set(id, job);
  return job;
}

async function createGeminiBatch(req: EconomyBatchRequest): Promise<EconomyBatchJob> {
  const key = geminiKey();
  if (!key) throw new Error('Gemini API key unavailable');
  const id = randomUUID();
  const model = req.model || 'gemini-3.6-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:batchGenerateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batch: {
        display_name: req.displayName || `atlas-${id}`,
        input_config: {
          requests: {
            requests: [{
              request: {
                contents: [{ role: 'user', parts: [{ text: req.json ? `${req.prompt}\n\nReturn ONLY valid JSON.` : req.prompt }] }],
                generationConfig: { maxOutputTokens: req.maxTokens || 8192 },
              },
              metadata: { key: id },
            }],
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini batch create ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const batch = await response.json() as any;
  const providerJobId = batch.name || batch?.batch?.name;
  if (!providerJobId) throw new Error('Gemini batch response did not include a job name');
  const now = new Date().toISOString();
  const job: EconomyBatchJob = { id, provider: 'gemini', providerJobId, state: 'queued', model, createdAt: now, updatedAt: now, estimatedDiscountPct: 50, conversationId: req.conversationId, requestId: req.requestId };
  jobs.set(id, job);
  return job;
}

export async function submitEconomyBatch(req: EconomyBatchRequest): Promise<EconomyBatchJob> {
  if (!req.prompt?.trim()) throw new Error('Prompt is required');
  const provider = chooseProvider(req.provider);
  return provider === 'groq' ? createGroqBatch(req) : createGeminiBatch(req);
}

function normaliseGroqState(state: string): EconomyState {
  if (state === 'completed') return 'succeeded';
  if (state === 'failed') return 'failed';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'expired') return 'expired';
  if (state === 'in_progress' || state === 'finalizing') return 'running';
  return 'queued';
}
function normaliseGeminiState(state: string): EconomyState {
  if (state === 'JOB_STATE_SUCCEEDED') return 'succeeded';
  if (state === 'JOB_STATE_FAILED') return 'failed';
  if (state === 'JOB_STATE_CANCELLED') return 'cancelled';
  if (state === 'JOB_STATE_EXPIRED') return 'expired';
  if (state === 'JOB_STATE_RUNNING') return 'running';
  return 'queued';
}

async function refreshGroq(job: EconomyBatchJob): Promise<EconomyBatchJob> {
  const key = groqKey();
  if (!key) throw new Error('Groq API key unavailable');
  const response = await fetch(`https://api.groq.com/openai/v1/batches/${encodeURIComponent(job.providerJobId)}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Groq batch status ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const batch = await response.json() as any;
  job.state = normaliseGroqState(batch.status);
  job.updatedAt = new Date().toISOString();
  if (job.state === 'succeeded' && batch.output_file_id && !job.result) {
    const out = await fetch(`https://api.groq.com/openai/v1/files/${encodeURIComponent(batch.output_file_id)}/content`, { headers: { Authorization: `Bearer ${key}` } });
    if (out.ok) {
      const line = (await out.text()).trim().split('\n').find(Boolean);
      if (line) {
        const parsed = JSON.parse(line);
        job.result = parsed?.response?.body?.choices?.[0]?.message?.content || '';
      }
    }
  }
  if (job.state === 'failed') job.error = JSON.stringify(batch.errors || batch);
  jobs.set(job.id, job);
  return job;
}

async function refreshGemini(job: EconomyBatchJob): Promise<EconomyBatchJob> {
  const key = geminiKey();
  if (!key) throw new Error('Gemini API key unavailable');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${job.providerJobId}`, { headers: { 'x-goog-api-key': key } });
  if (!response.ok) throw new Error(`Gemini batch status ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const batch = await response.json() as any;
  job.state = normaliseGeminiState(batch.state || batch?.batch?.state || '');
  job.updatedAt = new Date().toISOString();
  const inline = batch?.dest?.inlinedResponses || batch?.dest?.inlineResponses || batch?.inlinedResponses;
  if (job.state === 'succeeded' && Array.isArray(inline) && inline.length) {
    const responseObj = inline[0]?.response || inline[0];
    job.result = responseObj?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  }
  if (job.state === 'failed') job.error = JSON.stringify(batch.error || batch);
  jobs.set(job.id, job);
  return job;
}

export async function getEconomyBatch(id: string): Promise<EconomyBatchJob | null> {
  const job = jobs.get(id);
  if (!job) return null;
  return job.provider === 'groq' ? refreshGroq(job) : refreshGemini(job);
}

export function listEconomyBatches(): EconomyBatchJob[] {
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listUndeliveredEconomyResults(conversationId: string): EconomyBatchJob[] {
  return [...jobs.values()]
    .filter((job) => job.conversationId === conversationId && job.state === 'succeeded' && Boolean(job.result) && !job.deliveredAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function markEconomyBatchDelivered(id: string): EconomyBatchJob | null {
  const job = jobs.get(id);
  if (!job) return null;
  job.deliveredAt = new Date().toISOString();
  jobs.set(id, job);
  return job;
}
