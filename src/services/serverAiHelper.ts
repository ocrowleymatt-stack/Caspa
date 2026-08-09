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
import { buildOrganicStimulusBlock } from './literary/organicStimulusService';

const FICTION_HUMANITY_CONTRACT = `
CASPA FICTION HUMANITY CONTRACT — APPLY UNLESS THE USER EXPLICITLY REQUESTS AN ESSAY-COLLECTION, FRAGMENTARY, ANTHOLOGY OR LINKED-STORIES FORM
- WRITE ONE ACTUAL NOVEL. Chapters are successive movements of the same causal, emotional and temporal organism — not self-contained essays sharing a theme.
- Every chapter inherits live state from the previous one: who knows what, what has changed, what remains physically present, what has been promised, who is avoiding whom, and what consequence is already in motion.
- Do not restart the premise, reintroduce the cast, re-explain the theme, or manufacture a fresh thesis at each chapter boundary. A chapter boundary is a cut in the flow, not amnesia.
- Let scenes continue across chapter boundaries when that is the strongest form. Chapters need not have mini-introductions or mini-conclusions.
- Trust the reader. Omit explanations that the reader can infer from action, juxtaposition, image, silence or prior knowledge. Do not translate every gesture into its emotional meaning.
- Silence is content. Characters may not answer, may answer sideways, may leave a thought unfinished, may misunderstand, may avoid the obvious subject. Do not fill every gap with explanatory dialogue or narration.
- Human memory is reconstructive, selective and state-dependent. Unless the story establishes otherwise, recollection may lose detail, shift emphasis, fuse adjacent moments, preserve a sensory shard while losing sequence, or become more certain than it deserves. Never use memory degradation as a continuity excuse: distinguish character uncertainty from authorial contradiction.
- Psychological response has latency and displacement. Shock may produce practical behaviour before feeling; grief may arrive through irritation or routine; fear may narrow attention; shame may create concealment; attachment can produce contradictory action. Do not make every character react on cue in the same emotional register.
- Preserve private interiority. The narrator does not have to explain what a character cannot yet formulate.
- Vary duration honestly: a consequential minute may occupy pages; six uneventful months may pass in a sentence. Do not give every beat equal textual weight.
- Permit negative space: withheld scene, off-stage consequence, ellipsis, jump cut, object residue, changed routine, absence. Use these only where causality remains legible.
- Recurring images must transform with context. Never deploy motifs at regular intervals like scheduled decorations.
- Literary influence means craft abstraction, never imitation: focal distance, omission, compression, syntactic pressure, duration, scene architecture, comic timing, restraint, image logic. Do not copy or closely mimic an author's recognisable prose.
- Surprise must emerge from character, world and consequence. Never pick a stock 'random twist', phrase, metaphor or emotional beat from a hidden list.
`.trim();

function looksLikeCaspaWriting(prompt: string) {
  return /\bCaspa\b/i.test(prompt) && /(draft|write|rewrite|novel|fiction|chapter|scene|story|spine|prose|literary|poetry|script|musical|seed|planning)/i.test(prompt);
}

function looksNonfiction(prompt: string) {
  return /(NON-FICTION|nonfiction|Essay \/ article|MODE\s*\n(?:nonfiction|essay)|PROJECT TYPE[^\n]*(?:Non-fiction|Essay))/i.test(prompt);
}

async function enrichCreativePrompt(prompt: string) {
  if (!looksLikeCaspaWriting(prompt) || looksNonfiction(prompt)) return prompt;
  let stimulus = '';
  try { stimulus = await buildOrganicStimulusBlock(); } catch { /* optional anti-pattern stimulus must never block writing */ }
  return `${prompt}\n\n${FICTION_HUMANITY_CONTRACT}${stimulus ? `\n\n${stimulus}` : ''}`;
}

export async function callServerAi(
  prompt: string,
  json = false,
  opts?: { maxTokens?: number; timeoutMs?: number }
): Promise<string> {
  const maxTokens = opts?.maxTokens ?? (json ? 4096 : 8192);
  const timeoutMs = opts?.timeoutMs ?? (maxTokens > 12000 ? 240000 : 120000);
  const routedPrompt = await enrichCreativePrompt(prompt);

  // Prefer host Unified Router, then grok → gemini → openai.
  const callers: Record<string, () => Promise<string | null>> = {
    unified: () =>
      callUnifiedRouterChat(routedPrompt, { json, maxTokens, timeoutMs }).catch(() => null),
    grok: () => callGrok(routedPrompt, json, maxTokens, timeoutMs),
    gemini: () => callGemini(routedPrompt, json, maxTokens, timeoutMs),
    openai: () => callOpenai(routedPrompt, json, maxTokens, timeoutMs),
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