/**
 * Grok Imagine — current xAI image models.
 * Prefer Imagine Image 2.0; fall back only if that model is unavailable.
 */

import {
  IMAGINE_MODELS,
  type ImagineAspect,
  type ImagineRequest,
  type ImagineResolution,
  normaliseImagineRequest,
} from './grokImagineTypes';

export type ImagineResult = {
  url: string;
  model: string;
  prompt: string;
  aspectRatio: ImagineAspect;
  resolution: ImagineResolution;
};

export { IMAGINE_ASPECTS, IMAGINE_RESOLUTIONS, IMAGINE_MODELS, normaliseImagineRequest } from './grokImagineTypes';
export type { ImagineAspect, ImagineRequest, ImagineResolution } from './grokImagineTypes';

function grokKey(): string {
  return String(process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.VITE_GROK_API_KEY || '').trim();
}

async function requestGrokModel(
  model: string,
  prompt: string,
  aspectRatio: ImagineAspect,
  resolution: ImagineResolution,
  quality: 'low' | 'medium',
): Promise<string | null> {
  const key = grokKey();
  if (!key) return null;
  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    response_format: 'b64_json',
  };
  if (model.startsWith('grok-imagine')) {
    body.aspect_ratio = aspectRatio;
    body.resolution = resolution;
    if (model === 'grok-imagine-image-2.0') body.quality = quality;
  }
  const res = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const item = data?.data?.[0];
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  return typeof item?.url === 'string' ? item.url : null;
}

async function requestGeminiFallback(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-exp-image-generation:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'image/png';
      return `data:${mime};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

export async function generateImagineImage(input: ImagineRequest): Promise<ImagineResult> {
  const parsed = normaliseImagineRequest(input);
  if (parsed.ok === false) throw new Error(parsed.message);

  for (const model of IMAGINE_MODELS) {
    try {
      const url = await requestGrokModel(model, parsed.prompt, parsed.aspectRatio, parsed.resolution, parsed.quality);
      if (url) {
        return {
          url,
          model,
          prompt: parsed.prompt,
          aspectRatio: parsed.aspectRatio,
          resolution: parsed.resolution,
        };
      }
    } catch (error) {
      console.warn('[imagine]', model, error instanceof Error ? error.message : error);
    }
  }

  const gemini = await requestGeminiFallback(parsed.prompt).catch(() => null);
  if (gemini) {
    return {
      url: gemini,
      model: 'gemini-image',
      prompt: parsed.prompt,
      aspectRatio: parsed.aspectRatio,
      resolution: parsed.resolution,
    };
  }

  throw new Error('Image generation unavailable. Check GROK_API_KEY.');
}
