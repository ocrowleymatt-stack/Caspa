/**
 * Caspa Canvas API — vision extraction from drawn storyboards
 */

import express from 'express';
import { randomUUID } from 'crypto';

const router = express.Router();

router.post('/extract', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/png', notes = '', title = 'Untitled', premise = '', tone = '' } = req.body;

    if (!imageBase64 && !notes?.trim()) {
      return res.status(400).json({ success: false, message: 'Canvas image or notes required' });
    }

    const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    const structurePrompt = `You are Caspa's storyboard interpreter. Extract a usable creative structure from this jam session.

PROJECT: "${title}"
PREMISE: ${premise}
TONE: ${tone}

NOTES FROM AUTHOR:
${notes.slice(0, 6000)}

${imageBase64 ? 'A storyboard image is attached — read drawn plot lines, character circles, act breaks, arrows, and scribbled labels.' : ''}

Return JSON only:
{
  "summary": "what this jam session is trying to become",
  "spine": ["beat 1", "beat 2", "..."],
  "characters": [{ "name": "...", "role": "...", "want": "...", "wound": "..." }],
  "subplots": ["..."],
  "emotionalIntent": "what the author wants the reader to feel",
  "recommendedNextStep": "plan|draft_chapter_1|workshop_diagnosis|research",
  "manuscriptSeed": "optional opening prose or plan text to drop into Workshop (markdown)"
}`;

    let raw: string | null = null;

    if (imageBase64 && apiKey) {
      try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'grok-2-vision-latest',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
                  { type: 'text', text: structurePrompt },
                ],
              },
            ],
            max_tokens: 4096,
            temperature: 0.4,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          raw = data.choices?.[0]?.message?.content || null;
        }
      } catch (err) {
        console.error('[Caspa Canvas] Vision failed:', err);
      }
    }

    if (!raw && geminiKey) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: structurePrompt },
      ];
      if (imageBase64) {
        parts.unshift({ inlineData: { mimeType, data: imageBase64 } });
      }
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json' },
      });
      raw = response.text || null;
    }

    if (!raw) {
      return res.status(502).json({
        success: false,
        message: 'vision_unavailable',
        data: { status: 'vision_unavailable' },
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { summary: raw, manuscriptSeed: notes };
    }

    return res.json({
      success: true,
      data: {
        id: randomUUID(),
        ...parsed,
        extractedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Canvas extraction failed';
    return res.status(500).json({ success: false, message });
  }
});

export default router;
