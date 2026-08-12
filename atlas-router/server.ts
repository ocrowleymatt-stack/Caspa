import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { routeAtlasPrompt, classifyTask, normaliseMode } from './src/router';
import { prefetchResearchEvidence, parallelRetrievalConfig } from './src/researchPrefetch';

const HOST = process.env.ATLAS_ROUTER_HOST || '172.19.0.1';
const PORT = Number(process.env.ATLAS_ROUTER_PORT || 3014);
const MAX_BODY_BYTES = Number(process.env.ATLAS_ROUTER_MAX_BODY_BYTES || 2_000_000);
const MAX_INFLIGHT = Math.max(1, Number(process.env.ATLAS_ROUTER_MAX_INFLIGHT || 16));
const VERSION = '1.1.0';
const startedAt = new Date().toISOString();
let inflight = 0;
let completedRequests = 0;

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function clampMaxTokens(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(12_000, Math.max(32, Math.floor(parsed)));
}

function synthesisLooksUsable(text: string): boolean {
  const value = String(text || '').trim();
  if (value.length < 160) return false;
  return !/\b(?:cannot access the internet|can't access the internet|unable to access the internet|cannot browse the web|no internet access|i should search|i should use tools)\b/i.test(value);
}

function doctor() {
  return {
    status: 'ok',
    service: 'AtlasRouter',
    version: VERSION,
    startedAt,
    uptimeSeconds: Math.round(process.uptime()),
    bind: `${HOST}:${PORT}`,
    inflight,
    maxInflight: MAX_INFLIGHT,
    completedRequests,
    localFallbackOwner: 'atlas-openwebui',
    caspaDependency: false,
    parallelRetrieval: { version: 'v1', ...parallelRetrievalConfig() },
    providers: {
      venice: Boolean(process.env.VENICE_API_KEY || process.env.VITE_VENICE_API_KEY),
      grok: Boolean(process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.VITE_GROK_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY),
      claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY),
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://atlas-router.internal');

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/doctor')) {
    return sendJson(res, 200, doctor());
  }

  if (req.method !== 'POST' || url.pathname !== '/api/ai/call') {
    return sendJson(res, 404, { error: 'Not found', service: 'AtlasRouter' });
  }

  const requestId = randomUUID();
  const requestStartedAt = Date.now();

  if (inflight >= MAX_INFLIGHT) {
    return sendJson(res, 503, {
      error: 'AtlasRouter is at its in-flight request limit. Retry shortly.',
      service: 'AtlasRouter',
      requestId,
      inflight,
      maxInflight: MAX_INFLIGHT,
    });
  }

  inflight += 1;
  try {
    const body = await readJson(req);
    const {
      prompt,
      model,
      json = false,
      maxTokens,
      providerOverride,
      strictProvider = false,
      useSearch = false,
      useWebSearch = false,
      useXSearch = false,
      primaryProvider = 'venice',
      intelligenceMode = 'balanced',
      taskHint,
    } = body || {};

    if (!prompt || typeof prompt !== 'string') {
      return sendJson(res, 400, { error: 'Prompt is required.', service: 'AtlasRouter', requestId });
    }
    if (prompt.length > 250_000) {
      return sendJson(res, 413, { error: 'Prompt exceeds AtlasRouter input limit.', service: 'AtlasRouter', requestId });
    }

    const webRequired = Boolean(useSearch || useWebSearch);
    const mode = normaliseMode(intelligenceMode);
    const routedMaxTokens = clampMaxTokens(maxTokens);
    const task = taskHint || classifyTask(prompt, { json: Boolean(json), maxTokens: routedMaxTokens, useSearch: webRequired });
    const primary = providerOverride || primaryProvider;
    const prefetchConfig = parallelRetrievalConfig();

    let routedPrompt = prompt;
    let routedUseSearch = webRequired;
    let retrieval: Record<string, any> = { mode: webRequired ? 'native-provider-web' : 'none' };
    let prefetched = false;

    // Ordinary factual web research uses a two-stage fast path:
    // small Grok query planner -> parallel Tavily retrieval -> one Grok synthesis.
    // Deep/God, X-search and JSON calls retain provider-native search semantics.
    if (webRequired && prefetchConfig.enabled && mode === 'speed' && task === 'factual' && !Boolean(useXSearch) && !Boolean(json)) {
      const prefetch = await prefetchResearchEvidence(prompt);
      retrieval = {
        mode: prefetch.usable ? 'parallel-tavily-prefetch' : 'native-provider-web-fallback',
        queries: prefetch.queries,
        sourceCount: prefetch.sources.length,
        prefetchDurationMs: prefetch.durationMs,
        plannerDurationMs: prefetch.plannerDurationMs,
        retrievalDurationMs: prefetch.retrievalDurationMs,
        errors: prefetch.errors,
      };
      if (prefetch.usable) {
        routedPrompt = prefetch.evidencePrompt;
        routedUseSearch = false;
        prefetched = true;
      }
    }

    let routed;
    try {
      routed = await routeAtlasPrompt(routedPrompt, {
        json: Boolean(json),
        maxTokens: routedMaxTokens,
        requestedModel: model,
        primaryProvider: primary,
        strictProvider: Boolean(strictProvider && providerOverride),
        useSearch: routedUseSearch,
        useXSearch: Boolean(useXSearch),
        mode,
        task,
        // Atlas OpenWebUI owns the local fail-soft. This service is cloud routing only.
      });
      if (prefetched && !synthesisLooksUsable(routed.text)) {
        throw new Error('Parallel retrieval synthesis was unusable; retrying with provider-native web search');
      }
    } catch (prefetchError: any) {
      if (!prefetched) throw prefetchError;
      retrieval = {
        ...retrieval,
        mode: 'native-provider-web-recovery',
        synthesisFallback: String(prefetchError?.message || prefetchError || 'parallel synthesis failed').slice(0, 300),
      };
      routed = await routeAtlasPrompt(prompt, {
        json: Boolean(json),
        maxTokens: routedMaxTokens,
        requestedModel: model,
        primaryProvider: primary,
        strictProvider: Boolean(strictProvider && providerOverride),
        useSearch: true,
        useXSearch: Boolean(useXSearch),
        mode,
        task,
      });
    }

    completedRequests += 1;
    return sendJson(res, 200, {
      result: routed.text,
      provider: routed.provider,
      model: routed.model,
      attempts: routed.attempts,
      mode,
      retrieval,
      durationMs: routed.durationMs,
      providerDurationMs: routed.providerDurationMs,
      requestDurationMs: Date.now() - requestStartedAt,
      requestId,
      service: 'AtlasRouter',
    });
  } catch (error: any) {
    completedRequests += 1;
    return sendJson(res, 502, {
      error: error?.message || String(error),
      service: 'AtlasRouter',
      requestId,
      requestDurationMs: Date.now() - requestStartedAt,
    });
  } finally {
    inflight = Math.max(0, inflight - 1);
  }
});

server.headersTimeout = 10_000;
server.requestTimeout = 300_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;

server.on('clientError', (_err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(PORT, HOST, () => {
  console.log(`AtlasRouter ${VERSION} listening on http://${HOST}:${PORT}`);
});

function shutdown(signal: string) {
  console.log(`AtlasRouter received ${signal}; shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
