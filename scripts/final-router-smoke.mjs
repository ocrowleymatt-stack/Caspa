const endpoint = 'https://caspa.ocrowley.com/api/ai/call';

async function invoke(name, body, timeout = 70000) {
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    const data = await response.json().catch(() => ({}));
    return {
      name,
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      provider: data.provider || null,
      model: data.model || null,
      mode: data.mode || null,
      task: data.task || null,
      sample: String(data.result || data.error || data.message || '').slice(0, 220),
    };
  } catch (error) {
    return { name, ok: false, status: 0, ms: Date.now() - started, error: error?.message || String(error) };
  }
}

for (const [name, body] of [
  ['SPEED_FINAL', { prompt: 'Reply exactly SPEED_FINAL_OK', intelligenceMode: 'speed', maxTokens: 24, primaryProvider: 'grok' }],
  ['BALANCED_FINAL', { prompt: 'Reply exactly BALANCED_FINAL_OK', intelligenceMode: 'balanced', maxTokens: 24, primaryProvider: 'grok' }],
  ['GOD_FINAL', { prompt: 'State in one short sentence why synthesis benefits from adversarial review.', intelligenceMode: 'god', taskHint: 'reasoning', maxTokens: 80, primaryProvider: 'grok' }],
]) {
  console.log(JSON.stringify(await invoke(name, body, name === 'GOD_FINAL' ? 70000 : 30000)));
}

const webRequired = await invoke('WEB_REQUIRED', {
  prompt: 'Use web search and state the current UTC date in one short sentence.',
  intelligenceMode: 'balanced',
  taskHint: 'factual',
  maxTokens: 120,
  primaryProvider: 'venice',
  useWebSearch: true,
}, 45000);
console.log(JSON.stringify(webRequired));
if (!webRequired.ok || !['venice', 'gemini', 'grok'].includes(webRequired.provider)) {
  console.error('WEB_REQUIRED invariant failed: search request escaped the wired search-capable provider pool.');
  process.exitCode = 1;
}

const strictNonSearch = await invoke('WEB_STRICT_NON_SEARCH_BLOCKED', {
  prompt: 'Use web search and reply with one sentence.',
  intelligenceMode: 'balanced',
  taskHint: 'factual',
  maxTokens: 80,
  providerOverride: 'claude',
  strictProvider: true,
  useWebSearch: true,
}, 15000);
console.log(JSON.stringify(strictNonSearch));
if (strictNonSearch.ok || strictNonSearch.status !== 502 || !String(strictNonSearch.sample || '').includes('Atlas web retrieval unavailable')) {
  console.error('WEB_STRICT_NON_SEARCH_BLOCKED invariant failed: unsupported strict provider was not rejected clearly.');
  process.exitCode = 1;
}

const councilStarted = Date.now();
const council = await Promise.all([
  invoke('COUNCIL_GROK', {
    prompt: 'Return ONLY JSON: {"content":"seat ok","severity":"low","suggestions":["ok"]}',
    json: true, maxTokens: 100, providerOverride: 'grok', strictProvider: true, taskHint: 'council', intelligenceMode: 'god'
  }),
  invoke('COUNCIL_GEMINI', {
    prompt: 'Return ONLY JSON: {"content":"seat ok","severity":"low","suggestions":["ok"]}',
    json: true, maxTokens: 100, providerOverride: 'gemini', strictProvider: true, taskHint: 'council', intelligenceMode: 'god'
  }),
  invoke('COUNCIL_VENICE', {
    prompt: 'Return ONLY JSON: {"content":"seat ok","severity":"low","suggestions":["ok"]}',
    json: true, maxTokens: 100, providerOverride: 'venice', strictProvider: true, taskHint: 'council', intelligenceMode: 'god'
  }),
]);
console.log('COUNCIL_FINAL=' + JSON.stringify({ totalMs: Date.now() - councilStarted, seats: council }));
