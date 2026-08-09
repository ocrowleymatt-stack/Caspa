const endpoint = 'https://caspa.ocrowley.com/api/ai/call';
const providers = ['grok', 'gemini', 'claude', 'openai', 'venice'];

const results = [];
for (const provider of providers) {
  const started = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Return ONLY valid JSON: {"ok":true,"message":"council seat alive"}',
        json: true,
        maxTokens: 100,
        providerOverride: provider,
        strictProvider: true,
        primaryProvider: provider,
      }),
      signal: AbortSignal.timeout(70000),
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { raw: raw.slice(0, 400) }; }
    results.push({
      provider,
      ok: response.ok,
      status: response.status,
      routedProvider: data.provider || null,
      durationMs: Date.now() - started,
      error: response.ok ? null : (data.message || data.raw || 'unknown error'),
      errorDetail: response.ok ? null : (data.error || null),
      sample: response.ok ? String(data.result || '').slice(0, 160) : null,
    });
  } catch (error) {
    results.push({
      provider,
      ok: false,
      status: 0,
      routedProvider: null,
      durationMs: Date.now() - started,
      error: error?.message || String(error),
      errorDetail: null,
      sample: null,
    });
  }
}

console.log('COUNCIL_PROVIDER_SMOKE=' + JSON.stringify(results));

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Reply with the single word ALIVE',
      json: false,
      maxTokens: 30,
      primaryProvider: 'grok',
    }),
    signal: AbortSignal.timeout(70000),
  });
  const data = await response.json().catch(() => ({}));
  console.log('COUNCIL_FALLBACK_SMOKE=' + JSON.stringify({
    ok: response.ok,
    status: response.status,
    provider: data.provider || null,
    sample: String(data.result || data.message || '').slice(0, 120),
  }));
} catch (error) {
  console.log('COUNCIL_FALLBACK_SMOKE=' + JSON.stringify({ ok: false, status: 0, error: error?.message || String(error) }));
}
