/**
 * Caspa Assistant Routes
 * Handles all interactive writing assistant endpoints
 */

import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const router = Router();

interface AssistantRequest {
  action: 'draft-scene' | 'improve-scene' | 'repair-chapter' | 'summarize' | 'analyze-tone' | 'continuity-check';
  chapterTitle?: string;
  content?: string;
  context?: string;
  stream?: boolean;
}

interface AssistantResponse {
  status: 'success' | 'error';
  action: string;
  result?: string;
  error?: string;
  timestamp: string;
}

// Initialize Gemini
const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

async function callGeminiAssistant(prompt: string, context: string = ''): Promise<string> {
  if (!ai) throw new Error('GEMINI_API_KEY not configured');

  const fullPrompt = context 
    ? `You are a prize-calibre literary assistant. Literary context:\n${context}\n\nTask:\n${prompt}`
    : `You are a prize-calibre literary assistant.\n\nTask:\n${prompt}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-advanced',
      contents: fullPrompt,
      config: {
        systemInstruction: 'You are a snobbish, excellence-obsessed literary editor. Provide raw, high-fidelity suggestions that elevate prose.',
        temperature: 0.8,
        maxOutputTokens: 1500,
      },
    });

    return response.text || 'No response generated';
  } catch (err: any) {
    throw new Error(`Gemini error: ${err.message}`);
  }
}

// Main assistant endpoint
router.post('/assist', async (req: Request, res: Response) => {
  try {
    const { action, chapterTitle, content, context, stream } = req.body as AssistantRequest;

    if (!action) {
      return res.status(400).json({ 
        status: 'error', 
        error: 'Action required',
        timestamp: new Date().toISOString() 
      });
    }

    let prompt = '';

    switch (action) {
      case 'draft-scene':
        prompt = `Continue this scene from here:\n\n${content || '[Scene context here]'}\n\nWrite 150-300 words that escalate tension and develop character. Prize-winning calibre.`;
        break;

      case 'improve-scene':
        prompt = `Enhance this scene for clarity, tension and emotional impact:\n\n${content || '[Scene text here]'}\n\nProvide specific revisions and explain the reasoning.`;
        break;

      case 'repair-chapter':
        prompt = `Review this chapter for structure, pacing and coherence:\n\n${content || '[Chapter excerpt here]'}\n\nIdentify 3-5 key improvements and suggest repairs.`;
        break;

      case 'summarize':
        prompt = `Provide a concise, literary summary of this chapter:\n\n${content || '[Chapter text here]'}\n\nKeep to 2-3 sentences that capture the essence and emotional arc.`;
        break;

      case 'analyze-tone':
        prompt = `Analyze the tone and voice in this passage:\n\n${content || '[Text here]'}\n\nComment on consistency, effectiveness, and how it serves the narrative.`;
        break;

      case 'continuity-check':
        prompt = `Check for continuity issues in this chapter:\n\n${content || '[Chapter text here]'}\n\nFlag character inconsistencies, timeline problems, or plot holes.`;
        break;

      default:
        return res.status(400).json({ 
          status: 'error', 
          error: `Unknown action: ${action}`,
          timestamp: new Date().toISOString() 
        });
    }

    const result = await callGeminiAssistant(prompt, context || '');

    if (stream) {
      // For real-time streaming (SSE), send headers and chunked response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send result in chunks
      const words = result.split(' ');
      let chunk = '';
      for (const word of words) {
        chunk += word + ' ';
        if (chunk.length > 50) {
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          chunk = '';
        }
      }
      if (chunk) res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Standard JSON response
      res.json({
        status: 'success',
        action,
        result,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      action: req.body.action,
      error: err.message || 'Assistant error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Bulk analysis
router.post('/analyze-manuscript', async (req: Request, res: Response) => {
  try {
    const { chapters, characters } = req.body;

    const prompt = `Analyze this manuscript structure:
Chapters: ${chapters?.length || 0}
Characters: ${characters?.length || 0}

Provide a brief assessment of:
1. Overall narrative structure quality
2. Character depth and development
3. Pacing concerns
4. Top 3 editorial recommendations`;

    const result = await callGeminiAssistant(prompt);

    res.json({
      status: 'success',
      action: 'analyze-manuscript',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Quick suggestions endpoint (for UI hints)
router.get('/suggestions', (req: Request, res: Response) => {
  const suggestions = [
    {
      type: 'Scene suggestion',
      text: 'Deepen the tension before the next reveal. Let the room know something before the character does.',
      action: 'View suggestion',
    },
    {
      type: 'Continuity note',
      text: 'A named injury appears once, then vanishes. Either carry it forward or remove the seed.',
      action: 'Review note',
    },
    {
      type: 'Writing insight',
      text: 'The middle sequence is slower than the surrounding chapters. Raise stakes or cut connective tissue.',
      action: 'View insight',
    },
  ];

  res.json({
    status: 'success',
    suggestions,
    timestamp: new Date().toISOString(),
  });
});

export default router;
