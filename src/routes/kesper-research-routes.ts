/**
 * Kesper Research API — deep web-grounded research notes
 */

import express from 'express';
import { randomUUID } from 'crypto';

const router = express.Router();

async function grokWebSearch(prompt: string): Promise<string | null> {
  const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!grokKey) return null;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${grokKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content:
              'You are a research assistant for prize-calibre fiction. Search the web and return accurate, source-grounded facts. Never invent street names, dates, or places.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        search_parameters: { mode: 'on', return_citations: true },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[Kesper Research] Grok search failed:', err);
    return null;
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

router.post('/deep', async (req, res) => {
  try {
    const { topic, context = '', projectType = 'novel', genre = '', title = 'Untitled' } = req.body;

    if (!topic?.trim()) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    const searchPrompt = `Research this topic for a ${projectType} called "${title}" (${genre || 'general'}):

TOPIC: ${topic}

PROJECT CONTEXT: ${context.slice(0, 4000)}

Requirements:
- Use live web search for verifiable facts
- For places: real street names, landmarks, geography, period-appropriate detail
- Include sensory atmosphere: sounds, smells, textures, visual markers
- Flag anything uncertain — do not invent facts
- Never mix locations (e.g. do not use road names from the wrong city)

Return ONLY valid JSON:
{
  "title": "short research note title",
  "content": "detailed markdown research note for the author",
  "category": "geography|history|culture|science|worldbuilding|other",
  "tags": ["tag1", "tag2"],
  "sources": ["citation or URL", "..."],
  "sensoryDetails": {
    "sounds": ["..."],
    "smells": ["..."],
    "textures": ["..."],
    "visuals": ["..."]
  },
  "verificationStatus": "verified|unverified",
  "verificationNotes": "what was confirmed vs needs author check"
}`;

    let raw = await grokWebSearch(searchPrompt);

    if (!raw) {
      return res.status(502).json({
        success: false,
        message: 'web_search_unavailable',
        data: {
          status: 'web_search_unavailable',
          note: 'Live web search is not configured. Set GROK_API_KEY or XAI_API_KEY on the server.',
        },
      });
    }

    let parsed;
    try {
      parsed = parseResearchJson(raw);
    } catch {
      parsed = {
        title: topic,
        content: raw,
        category: 'other',
        tags: [genre, projectType].filter(Boolean),
        sources: ['Grok Web Search'],
        verificationStatus: 'unverified',
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
        sources: Array.isArray(parsed.sources) ? parsed.sources : ['Grok Web Search'],
        source: 'Grok Web Search',
        sensoryDetails: parsed.sensoryDetails,
        isDeepResearch: true,
        verificationStatus: parsed.verificationStatus || 'verified',
        verificationNotes: parsed.verificationNotes || '',
        topicQuery: topic,
        updatedAt: Date.now(),
      },
    });
  } catch (err: any) {
    console.error('[Kesper Research] deep error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Research failed' });
  }
});

router.post('/suggest-topics', async (req, res) => {
  try {
    const { text = '', projectType = 'novel', title = '', premise = '' } = req.body;

    const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    const prompt = `For "${title}" (${projectType}): ${premise}

Analyse this text and list 5-8 specific research topics needed for factual accuracy and sensory immersion (street names, period detail, smells, technical facts):

${text.slice(0, 12000)}

Return JSON: { "topics": ["topic 1", "..."] }`;

    if (grokKey) {
      const raw = await grokWebSearch(prompt);
      if (raw) {
        try {
          const parsed = parseResearchJson(raw);
          return res.json({ success: true, data: { topics: parsed.topics || [] } });
        } catch {
          /* fall through */
        }
      }
    }

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
