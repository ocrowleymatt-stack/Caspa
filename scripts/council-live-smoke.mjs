const endpoint = 'https://caspa.ocrowley.com/api/ai/call';
const cloudProviders = new Set(['grok', 'gemini', 'claude', 'openai', 'venice']);

async function call(payload, timeoutMs = 90000) {
  const started = Date.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw: raw.slice(0, 500) }; }
  return { response, data, durationMs: Date.now() - started };
}

// This deliberately asks for Ollama as a non-strict override. Council routing
// must remove local/unified recovery and move directly to a healthy cloud model.
const degraded = await call({
  prompt: 'Reply with exactly READY and nothing else.',
  json: false,
  maxTokens: 24,
  providerOverride: 'ollama',
  strictProvider: false,
  primaryProvider: 'grok',
  taskHint: 'council',
  intelligenceMode: 'speed',
});

const degradedResult = {
  ok: degraded.response.ok,
  status: degraded.response.status,
  provider: degraded.data.provider || null,
  task: degraded.data.task || null,
  durationMs: degraded.durationMs,
  sample: String(degraded.data.result || degraded.data.message || degraded.data.error || '').slice(0, 180),
};
console.log('COUNCIL_DEGRADED_RECOVERY_SMOKE=' + JSON.stringify(degradedResult));

if (!degraded.response.ok) {
  throw new Error(`Council degraded recovery failed HTTP ${degraded.response.status}: ${JSON.stringify(degraded.data).slice(0, 500)}`);
}
if (degraded.data.task !== 'council') {
  throw new Error(`Council task classification lost: ${degraded.data.task}`);
}
if (!cloudProviders.has(degraded.data.provider)) {
  throw new Error(`Council degraded retry incorrectly used ${degraded.data.provider || 'no provider'} instead of cloud recovery`);
}

// Also exercise the normal non-strict Council route with no explicit escape flag;
// taskHint=council alone must be sufficient to keep local inference out.
const normal = await call({
  prompt: 'Reply with exactly ALIVE and nothing else.',
  json: false,
  maxTokens: 24,
  strictProvider: false,
  primaryProvider: 'grok',
  taskHint: 'council',
  intelligenceMode: 'speed',
});

const normalResult = {
  ok: normal.response.ok,
  status: normal.response.status,
  provider: normal.data.provider || null,
  task: normal.data.task || null,
  durationMs: normal.durationMs,
  sample: String(normal.data.result || normal.data.message || normal.data.error || '').slice(0, 180),
};
console.log('COUNCIL_NORMAL_SMOKE=' + JSON.stringify(normalResult));

if (!normal.response.ok || !cloudProviders.has(normal.data.provider)) {
  throw new Error(`Normal Council route did not complete via cloud: ${JSON.stringify(normalResult)}`);
}
