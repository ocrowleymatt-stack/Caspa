import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { routeAtlasPrompt, classifyTask, normaliseMode } from './src/router';

const HOST = process.env.ATLAS_ROUTER_HOST || '172.19.0.1';
const PORT = Number(process.env.ATLAS_ROUTER_PORT || 3014);
const MAX_BODY_BYTES = Number(process.env.ATLAS_ROUTER_MAX_BODY_BYTES || 2_000_000);
const VERSION = '1.0.0';
const startedAt = new Date().toISOString();

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
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

function doctor() {
  return {
    status: 'ok',
    service: 'AtlasRouter',
    version: VERSION,
    startedAt,
    bind: `${HOST}:${PORT}`,
    localFallbackOwner: 'atlas-openwebui',
    caspaDependency: false,
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
      primaryProvider = 'venice',
      intelligenceMode = 'balanced',
      taskHint,
    } = body || {};

    if (!prompt || typeof prompt !== 'string') {
      return sendJson(res, 400, { error: 'Prompt is required.', service: 'AtlasRouter' });
    }

    const webRequired = Boolean(useSearch || useWebSearch);
    const mode = normaliseMode(intelligenceMode);
    const routed = await routeAtlasPrompt(prompt, {
      json: Boolean(json),
      maxTokens,
      requestedModel: model,
      primaryProvider: providerOverride || primaryProvider,
      strictProvider: Boolean(strictProvider && providerOverride),
      useSearch: webRequired,
      mode,
      task: taskHint || classifyTask(prompt, { json: Boolean(json), maxTokens, useSearch: webRequired }),
      // Atlas OpenWebUI owns the local fail-soft. This service is cloud routing only.
    });

    return sendJson(res, 200, {
      result: routed.text,
      provider: routed.provider,
      model: routed.model,
      attempts: routed.attempts,
      mode,
      service: 'AtlasRouter',
    });
  } catch (error: any) {
    return sendJson(res, 502, {
      error: error?.message || String(error),
      service: 'AtlasRouter',
    });
  }
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
