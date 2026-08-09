const base = 'https://caspa.ocrowley.com';

const catalogueResponse = await fetch(`${base}/api/ai/models`, { signal: AbortSignal.timeout(15000) });
const catalogue = await catalogueResponse.json().catch(() => ({}));
console.log('MODEL_CATALOGUE=' + JSON.stringify({
  ok: catalogueResponse.ok,
  status: catalogueResponse.status,
  count: catalogue.count ?? null,
  freeCount: catalogue.freeCount ?? null,
  models: Array.isArray(catalogue.models)
    ? catalogue.models.slice(0, 20).map((m) => ({ id: m.id, source: m.source, likelyFree: m.likelyFree, score: m.score }))
    : [],
}));

for (const provider of ['ollama', 'unified']) {
  const started = Date.now();
  try {
    const response = await fetch(`${base}/api/ai/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Return ONLY valid JSON: {"ok":true,"source":"model hunter"}',
        json: true,
        maxTokens: 120,
        providerOverride: provider,
        strictProvider: true,
      }),
      signal: AbortSignal.timeout(130000),
    });
    const data = await response.json().catch(() => ({}));
    console.log(`MODEL_HUNTER_${provider.toUpperCase()}=` + JSON.stringify({
      ok: response.ok,
      status: response.status,
      provider: data.provider || null,
      durationMs: Date.now() - started,
      sample: String(data.result || data.error || data.message || '').slice(0, 260),
    }));
  } catch (error) {
    console.log(`MODEL_HUNTER_${provider.toUpperCase()}=` + JSON.stringify({
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      error: error?.message || String(error),
    }));
  }
}
