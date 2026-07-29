/**
 * Caspa Research API — deep web-grounded research notes
 */

import express from 'express';
import { randomUUID } from 'crypto';
import { callServerAi } from '../services/serverAiHelper';

const router = express.Router();

const WEB_SEARCH_TIMEOUT_MS = 55_000;

function grokKey(): string | undefined {
  return process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.VITE_GROK_API_KEY || undefined;
}

function extractMessageText(data: any): string | null {
  const messageItem = data?.output?.find((o: any) => o?.type === 'message');
  if (!messageItem) return null;
  if (typeof messageItem.text === 'string' && messageItem.text.trim()) return messageItem.text;
  const parts = Array.isArray(messageItem.content) ? messageItem.content : [];
  const joined = parts
    .filter((p: any) => typeof p?.text === 'string')
    .map((p: any) => p.text)
    .join('');
  return joined.trim() || null;
}

type WebSearchResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'not_configured' | 'timeout' | 'http_error' | 'empty' | 'network'; detail?: string };

async function grokWebSearch(prompt: string): Promise<WebSearchResult> {
  const key = grokKey();
  if (!key) return { ok: false, reason: 'not_configured' };

  try {
    const response = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'grok-4.5',
        input: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search' }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(WEB_SEARCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return {
        ok: false,
        reason: 'http_error',
        detail: `${response.status} ${errBody.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    const text = extractMessageText(data);
    if (!text) return { ok: false, reason: 'empty' };
    return { ok: true, text };
  } catch (err: any) {
    const name = err?.name || '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    console.error('[Caspa Research] Grok search failed:', err);
    return { ok: false, reason: 'network', detail: err?.message || String(err) };
  }
}

function parseResearchJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) return JSON.parse(match[1]);
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Invalid research JSON');
  }
}

function buildCompactResearchPrompt(opts: {
  topic: string;
  context: string;
  projectType: string;
  genre: string;
  title: string;
}): string {
  return `Research for "${opts.title}" (${opts.projectType} / ${opts.genre || 'general'}).

TOPIC: ${opts.topic}
CONTEXT: ${opts.context.slice(0, 1500)}

Use live web search. Be concise and factual. Do not invent street names or dates.

Return ONLY valid JSON:
{"title":"short note title","content":"markdown research note (max ~600 words)","category":"geography|history|culture|science|worldbuilding|other","tags":["tag1","tag2"],"sources":["url or citation"],"sensoryDetails":{"sounds":[],"smells":[],"textures":[],"visuals":[]},"verificationStatus":"verified|unverified","verificationNotes":"what was confirmed"}`;
}

async function knowledgeFallbackResearch(opts: {
  topic: string;
  context: string;
  projectType: string;
  genre: string;
  title: string;
  reason: string;
}): Promise<string> {
  return callServerAi(
    `You are Caspa Research Desk. Live web search was unavailable (${opts.reason}).
Produce a careful research note from model knowledge only. Flag uncertainty.

TOPIC: ${opts.topic}
PROJECT: ${opts.title} (${opts.projectType} / ${opts.genre || 'general'})
CONTEXT: ${opts.context.slice(0, 1500)}

Return ONLY valid JSON:
{"title":"short note title","content":"markdown research note","category":"geography|history|culture|science|worldbuilding|other","tags":["tag1"],"sources":["Model knowledge — verify before publishing"],"sensoryDetails":{"sounds":[],"smells":[],"textures":[],"visuals":[]},"verificationStatus":"unverified","verificationNotes":"Generated without live web search (${opts.reason}). Verify place names and facts."}`,
    true
  );
}

router.post('/deep', async (req, res) => {
  try {
    const { topic, context = '', projectType = 'novel', genre = '', title = 'Untitled' } = req.body;

    if (!topic?.trim()) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    const searchPrompt = buildCompactResearchPrompt({ topic, context, projectType, genre, title });
    const searched = await grokWebSearch(searchPrompt);

    let raw: string | null = null;
    let live = false;
    let fallbackReason = '';

    if (searched.ok) {
      raw = searched.text;
      live = true;
    } else {
      fallbackReason = searched.reason + (searched.detail ? `: ${searched.detail}` : '');
      console.warn('[Caspa Research] live search unavailable, falling back:', fallbackReason);
      try {
        raw = await knowledgeFallbackResearch({
          topic,
          context,
          projectType,
          genre,
          title,
          reason: searched.reason,
        });
      } catch (err: any) {
        if (searched.reason === 'not_configured') {
          return res.status(502).json({
            success: false,
            message: 'web_search_unavailable',
            data: {
              status: 'web_search_unavailable',
              note: 'Live web search is not configured. Set GROK_API_KEY, XAI_API_KEY, or VITE_GROK_API_KEY on the server.',
            },
          });
        }
        return res.status(502).json({
          success: false,
          message: 'research_failed',
          data: {
            status: 'research_failed',
            note: `Live search failed (${searched.reason}) and knowledge fallback also failed.`,
            detail: err?.message || String(err),
          },
        });
      }
    }

    let parsed;
    try {
      parsed = parseResearchJson(raw!);
    } catch {
      parsed = {
        title: topic,
        content: raw,
        category: 'other',
        tags: [genre, projectType].filter(Boolean),
        sources: live ? ['Grok Web Search'] : ['Model knowledge — verify before publishing'],
        verificationStatus: live ? 'verified' : 'unverified',
        verificationNotes: live ? '' : `Generated without live web search (${fallbackReason}).`,
      };
    }

    return res.json({
      success: true,
      data: {
        id: randomUUID(),
        title: parsed.title || topic,
        content: parsed.content || raw,
        category: parsed.category || 'other',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        sources: Array.isArray(parsed.sources)
          ? parsed.sources
          : live
            ? ['Grok Web Search']
            : ['Model knowledge — verify before publishing'],
        source: live ? 'Grok Web Search' : 'Model knowledge fallback',
        sensoryDetails: parsed.sensoryDetails,
        isDeepResearch: live,
        verificationStatus: parsed.verificationStatus || (live ? 'verified' : 'unverified'),
        verificationNotes:
          parsed.verificationNotes ||
          (live ? '' : `Generated without live web search (${fallbackReason}).`),
        topicQuery: topic,
        updatedAt: Date.now(),
      },
    });
  } catch (err: any) {
    console.error('[Caspa Research] deep error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Research failed' });
  }
});

router.post('/suggest-topics', async (req, res) => {
  try {
    const { text = '', projectType = 'novel', title = '', premise = '' } = req.body;

    const prompt = `For "${title}" (${projectType}): ${premise}

Analyse this text and list 5-8 specific research topics needed for factual accuracy and sensory immersion (street names, period detail, smells, technical facts):

${String(text).slice(0, 12000)}

Return JSON: { "topics": ["topic 1", "..."] }`;

    try {
      const raw = await callServerAi(prompt, true);
      const parsed = parseResearchJson(raw);
      return res.json({ success: true, data: { topics: parsed.topics || [] } });
    } catch {
      /* fall through to Gemini if available */
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (geminiKey) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const parsed = JSON.parse(response.text || '{"topics":[]}');
      return res.json({ success: true, data: { topics: parsed.topics || [] } });
    }

    return res.status(502).json({ success: false, message: 'No AI provider available for topic suggestion' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
