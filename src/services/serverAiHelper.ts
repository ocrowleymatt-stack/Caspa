/**
 * Server-side AI helper for Caspa routes (provider fallback chain)
 */

export async function callServerAi(prompt: string, json = false): Promise<string> {
  const providers: Array<{ name: string; fn: () => Promise<string | null> }> = [
    { name: 'grok', fn: () => callGrok(prompt, json) },
    { name: 'gemini', fn: () => callGemini(prompt, json) },
    { name: 'openai', fn: () => callOpenai(prompt, json) },
  ];

  let lastError: Error | null = null;
  for (const provider of providers) {
    try {
      const result = await provider.fn();
      if (result?.trim()) return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[ServerAI] ${provider.name} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('No AI provider available');
}

async function callGrok(prompt: string, json: boolean): Promise<string | null> {
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content:
            'You are a prize-calibre literary editor. Be direct, specific, and ruthless about craft.',
        },
        { role: 'user', content: json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt },
      ],
      temperature: 0.65,
      max_tokens: 4096,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

async function callGemini(prompt: string, json: boolean): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt }] }],
        generationConfig: { temperature: 0.65, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(45000),
    }
  );

  if (!response.ok) return null;
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callOpenai(prompt: string, json: boolean): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a prize-calibre literary editor.' },
        { role: 'user', content: json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt },
      ],
      temperature: 0.65,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}
