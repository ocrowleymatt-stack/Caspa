export const IMAGINE_ASPECTS = ['1:1', '3:4', '2:3', '4:3', '3:2', '16:9', '9:16', '2:1'] as const;
export const IMAGINE_RESOLUTIONS = ['1k', '2k'] as const;
export const IMAGINE_MODELS = ['grok-imagine-image-2.0', 'grok-imagine-image-quality', 'grok-2-image'] as const;

export type ImagineAspect = (typeof IMAGINE_ASPECTS)[number];
export type ImagineResolution = (typeof IMAGINE_RESOLUTIONS)[number];
export type ImagineQuality = 'low' | 'medium';

export type ImagineRequest = {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  quality?: ImagineQuality;
};

const MAX_PROMPT = 4000;

export function normaliseImagineRequest(input: ImagineRequest):
  | { ok: true; prompt: string; aspectRatio: ImagineAspect; resolution: ImagineResolution; quality: ImagineQuality }
  | { ok: false; message: string } {
  const prompt = String(input.prompt || '').trim();
  if (!prompt) return { ok: false, message: 'A prompt is required.' };
  if (prompt.length > MAX_PROMPT) return { ok: false, message: 'Prompt is too long.' };
  const aspectRatio = (IMAGINE_ASPECTS as readonly string[]).includes(String(input.aspectRatio || ''))
    ? (input.aspectRatio as ImagineAspect)
    : '3:4';
  const resolution = (IMAGINE_RESOLUTIONS as readonly string[]).includes(String(input.resolution || ''))
    ? (input.resolution as ImagineResolution)
    : '1k';
  const quality = input.quality === 'low' ? 'low' : 'medium';
  return { ok: true, prompt, aspectRatio, resolution, quality };
}
