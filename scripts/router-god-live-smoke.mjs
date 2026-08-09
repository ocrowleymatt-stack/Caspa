const base = 'https://caspa.ocrowley.com';

async function call(name, body, timeout = 90000) {
  const started = Date.now();
  try {
    const response = await fetch(`${base}/api/ai/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    const data = await response.json().catch(() => ({}));
    console.log(name + '=' + JSON.stringify({
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      provider: data.provider || null,
      model: data.model || null,
      mode: data.mode || null,
      task: data.task || null,
      sample: String(data.result || data.error || data.message || '').slice(0, 220),
    }));
  } catch (error) {
    console.log(name + '=' + JSON.stringify({ ok: false, status: 0, ms: Date.now() - started, error: error?.message || String(error) }));
  }
}

const router = await fetch(`${base}/api/ai/router`, { signal: AbortSignal.timeout(20000) }).then(r => r.json()).catch(e => ({ error: e.message }));
console.log('ROUTER_SNAPSHOT=' + JSON.stringify({
  status: router.status,
  modes: router.modes,
  cloud: Object.fromEntries(Object.entries(router.cloud || {}).map(([k,v]) => [k, { configured: v.configured, modelCount: v.modelCount, models: (v.models || []).slice(0, 6) }])),
  local: (router.local || []).slice(0, 12),
}));

await call('SPEED', {
  prompt: 'Reply with exactly SPEED_OK',
  intelligenceMode: 'speed',
  maxTokens: 32,
  primaryProvider: 'grok',
});

await call('BALANCED', {
  prompt: 'In one precise sentence, explain why every scene in a novel must change something.',
  intelligenceMode: 'balanced',
  maxTokens: 80,
  primaryProvider: 'grok',
});

await call('GOD', {
  prompt: 'In two incisive sentences, identify the strongest structural risk in a novel where every chapter ends in exactly the same emotional register.',
  intelligenceMode: 'god',
  taskHint: 'reasoning',
  maxTokens: 140,
  primaryProvider: 'grok',
});

await call('VENICE_SPEED', {
  prompt: 'Reply with exactly VENICE_OK',
  intelligenceMode: 'speed',
  maxTokens: 32,
  providerOverride: 'venice',
  strictProvider: true,
});

await call('GOD_MULTI_AGENT', {
  prompt: 'Briefly identify two distinct editorial risks of relying on only one critic for a manuscript review. Return two short bullets.',
  intelligenceMode: 'god',
  taskHint: 'factual',
  useWebSearch: true,
  maxTokens: 180,
  providerOverride: 'grok',
  strictProvider: true,
}, 120000);

// Two calls with dead-credit OpenAI primary: the first should detect billing and fall through;
// the second should benefit from the six-hour process-level billing cooldown.
await call('BILLING_FAILOVER_1', {
  prompt: 'Reply with exactly FAILOVER_OK',
  intelligenceMode: 'speed',
  maxTokens: 32,
  primaryProvider: 'openai',
});
await call('BILLING_FAILOVER_2', {
  prompt: 'Reply with exactly FAILOVER_OK',
  intelligenceMode: 'speed',
  maxTokens: 32,
  primaryProvider: 'openai',
});

await call('LOCAL_SPEED', {
  prompt: 'Reply with exactly LOCAL_OK',
  intelligenceMode: 'speed',
  maxTokens: 32,
  providerOverride: 'ollama',
  strictProvider: true,
}, 45000);
