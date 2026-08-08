/**
 * Server-side AI helper for Caspa routes (provider fallback chain).
 * Shares the routing policy + circuit breaker with /api/ai/call so an unhealthy
 * provider is skipped everywhere, not just in one router.
 */

import {
  isProviderConfigured,
  selectAttemptOrder,
  sharedCircuitBreaker as breaker,
} from './aiRouterPolicy';
import { callUnifiedRouterChat } from './unifiedRouter';

export async function callServerAi(
  prompt: string,
  json = false,
  opts?: { maxTokens?: number; timeoutMs?: number }
): Promise<string> {
  const maxTokens = opts?.maxTokens ?? (json ? 4096 : 8192);
  const timeoutMs = opts?.timeoutMs ?? (maxTokens > 12000 ? 240000 : 120000);

  // Prefer host Unified Router, then grok → gemini → openai.
  const callers: Record<string, () => Promise<string | null>> = {
    unified: () =>
      callUnifiedRouterChat(prompt, { json, maxTokens, timeoutMs }).catch(() => null),
    grok: () => callGrok(prompt, json, maxTokens, timeoutMs),
    gemini: () => callGemini(prompt, json, maxTokens, timeoutMs),
    openai: () => callOpenai(prompt, json, maxTokens, timeoutMs),
  };

  const { attempt, anyConfigured } = selectAttemptOrder(
    ['unified', 'grok', 'gemini', 'openai'],
    (p) => isProviderConfigured(p),
    (p) => breaker.isOpen(p),
  );

  if (!anyConfigured) {
    throw new Error(
      'No AI provider configured (set UNIFIED_ROUTER_URL, or a GROK/GEMINI/OPENAI API key, or run Ollama).'
    );
  }

  let lastError: Error | null = null;
  for (const name of attempt) {
    try {
      const result = await callers[name]();
      if (result?.trim()) {
        breaker.recordSuccess(name);
        return result;
      }
      // Null/empty (missing key handled upstream, or HTTP/quota error) = soft failure.
      breaker.recordFailure(name);
    } catch (err) {
      breaker.recordFailure(name);
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[ServerAI] ${name} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('All configured AI providers failed');
}

async function callGrok(
  prompt: string,
  json: boolean,
  maxTokens: number,
  timeoutMs: number
): Promise<string | null> {
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.VITE_GROK_API_KEY;
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
            'You are a prize-calibre literary editor. Be direct, specific, and ruthless about craft. When a word count contract is given, meet it.',
        },
        { role: 'user', content: json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt },
      ],
      temperature: 0.65,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

async function callGemini(
  prompt: string,
  json: boolean,
  maxTokens: number,
  timeoutMs: number
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt }] }],
        generationConfig: { temperature: 0.65, maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    }
  );

  if (!response.ok) return null;
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callOpenai(
  prompt: string,
  json: boolean,
  maxTokens: number,
  timeoutMs: number
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a prize-calibre literary editor. When a word count contract is given, meet it.',
        },
        { role: 'user', content: json ? `${prompt}\n\nReturn ONLY valid JSON.` : prompt },
      ],
      temperature: 0.65,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}
