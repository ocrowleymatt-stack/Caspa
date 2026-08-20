/**
 * Caspa Design API — cover + picture-book / illustrated page layout.
 */

import express from 'express';
import { callServerAi } from '../services/serverAiHelper';
import { createJob, updateJob } from '../services/jobQueueService';
import {
  AGE_BANDS,
  ART_STYLES,
  TRIM_SPECS,
  planPictureBook,
  composeSpreadHtml,
  buildCharacterLock,
  type AgeBand,
  type ArtStyle,
  type TrimId,
  type PictureBookPlan,
} from '../services/illustratedBook/pictureBookEngine';
import {
  buildCoverDesign,
  buildCoverPreviewHtml,
  type CoverFormat,
} from '../services/illustratedBook/coverDesignEngine';

const router = express.Router();

async function generateImage(prompt: string): Promise<string | null> {
  const providers: Array<() => Promise<string | null>> = [
    async () => {
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
          signal: AbortSignal.timeout(90000),
        }
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
    },
    async () => {
      const key = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
      if (!key) return null;
      const res = await fetch('https://api.x.ai/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'grok-2-image',
          prompt,
          n: 1,
          response_format: 'b64_json',
        }),
        signal: AbortSignal.timeout(90000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      return b64 ? `data:image/png;base64,${b64}` : data?.data?.[0]?.url || null;
    },
  ];

  for (const fn of providers) {
    try {
      const url = await fn();
      if (url) return url;
    } catch (err) {
      console.warn('[design/image]', err instanceof Error ? err.message : err);
    }
  }
  return null;
}

router.get('/catalog', (_req, res) => {
  res.json({
    success: true,
    data: {
      ageBands: AGE_BANDS,
      artStyles: ART_STYLES,
      trims: TRIM_SPECS,
      coverFormats: ['front-only', 'wraparound', 'board-book', 'dust-jacket'],
    },
  });
});

router.post('/cover/spec', (req, res) => {
  const spec = buildCoverDesign(req.body || {});
  res.json({ success: true, data: spec });
});

router.post('/cover/generate', async (req, res) => {
  const {
    title = 'Untitled',
    subtitle = '',
    author = '',
    ageBand = '3-5',
    trimId = '8x8',
    artStyle = 'watercolor-picture-book',
    format = 'wraparound',
    pageCount = 32,
    palette,
    blurb = '',
    characters = [],
    mood,
    mode = 'front',
  } = req.body || {};

  const locks = (characters || []).map((c: any) =>
    buildCharacterLock({
      name: c.name,
      ageLook: c.ageLook,
      speciesOrType: c.speciesOrType,
      signatureFeatures: c.features,
      outfit: c.outfit,
      palette,
    })
  );

  const spec = buildCoverDesign({
    title,
    subtitle,
    author,
    ageBand: ageBand as AgeBand,
    trimId: trimId as TrimId,
    artStyle: artStyle as ArtStyle,
    format: format as CoverFormat,
    pageCount: Number(pageCount) || 32,
    palette,
    blurb,
    characterLocks: locks,
    mood,
  });

  const job = createJob('cover-generate', 'imaging');
  updateJob(job.id, { status: 'running', progress: 10 });

  try {
    const prompt = mode === 'wraparound' ? spec.wraparoundPrompt : spec.frontPrompt;
    const imageUrl = await generateImage(prompt);
    if (!imageUrl) {
      updateJob(job.id, { status: 'failed', error: 'No image provider available' });
      return res.status(503).json({
        success: false,
        message: 'Image generation unavailable. Check GEMINI_API_KEY or GROK_API_KEY.',
        data: { spec, prompt },
      });
    }

    const html = buildCoverPreviewHtml({
      title,
      subtitle,
      author,
      blurb,
      trim: spec.trim,
      spineWidthIn: spec.spineWidthIn,
      format: spec.format,
      typography: spec.typography,
      palette: spec.palette,
      imageUrl,
      wrapImageUrl: mode === 'wraparound' ? imageUrl : undefined,
    });

    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
    res.json({
      success: true,
      jobId: job.id,
      data: { imageUrl, prompt, spec, htmlPreview: html },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cover generation failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

router.post('/picture-book/plan', async (req, res) => {
  const {
    title = 'Untitled',
    manuscript = '',
    ageBand = '3-5',
    trimId = '8x8',
    artStyle = 'watercolor-picture-book',
    pageCount,
    palette,
    characters = [],
  } = req.body || {};

  let plan = planPictureBook({
    title,
    manuscript,
    ageBand: ageBand as AgeBand,
    trimId: trimId as TrimId,
    artStyle: artStyle as ArtStyle,
    pageCount: pageCount ? Number(pageCount) : undefined,
    palette,
    characters,
  });

  // Optional AI enrichment of illustration briefs
  if (manuscript.trim() && req.body?.enrich !== false) {
    try {
      const raw = await callServerAi(
        [
          'You are a picture-book art director. For each page, return tighter illustration briefs.',
          `Title: ${title}. Age: ${ageBand}. Style: ${artStyle}.`,
          'Return JSON: {"pages":[{"pageNumber":1,"illustrationBrief":"...","text":"optional tightened text"}]}',
          'Keep text age-appropriate. Briefs must be concrete visual beats, not abstract themes.',
          '',
          JSON.stringify(
            plan.pages.map((p) => ({
              pageNumber: p.pageNumber,
              text: p.text.slice(0, 400),
              layout: p.layout,
            }))
          ),
        ].join('\n'),
        true
      );
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.pages)) {
        plan = {
          ...plan,
          pages: plan.pages.map((p) => {
            const hit = parsed.pages.find((x: any) => Number(x.pageNumber) === p.pageNumber);
            if (!hit) return p;
            const next = {
              ...p,
              text: typeof hit.text === 'string' && hit.text.trim() ? hit.text : p.text,
              illustrationBrief: String(hit.illustrationBrief || p.illustrationBrief),
            };
            return next;
          }),
        };
      }
    } catch {
      /* keep deterministic plan */
    }
  }

  res.json({ success: true, data: plan });
});

router.post('/picture-book/illustrate', async (req, res) => {
  const plan = req.body?.plan as PictureBookPlan | undefined;
  const maxPages = Math.min(Number(req.body?.maxPages) || 8, plan?.pages?.length || 0);
  if (!plan?.pages?.length) {
    return res.status(400).json({ success: false, message: 'plan with pages is required' });
  }

  const job = createJob('picture-illustrate', 'imaging');
  updateJob(job.id, { status: 'running', progress: 0 });

  const pages = [...plan.pages];
  const failures: string[] = [];

  for (let i = 0; i < maxPages; i++) {
    updateJob(job.id, {
      progress: Math.round((i / maxPages) * 100),
      stage: `page-${pages[i].pageNumber}`,
    });
    try {
      const url = await generateImage(pages[i].illustrationPrompt);
      if (url) pages[i] = { ...pages[i], imageUrl: url };
      else failures.push(`page ${pages[i].pageNumber}`);
    } catch {
      failures.push(`page ${pages[i].pageNumber}`);
    }
  }

  const nextPlan = { ...plan, pages };
  updateJob(job.id, {
    status: failures.length === maxPages ? 'failed' : 'complete',
    progress: 100,
    stage: 'complete',
  });

  res.json({
    success: true,
    jobId: job.id,
    data: {
      plan: nextPlan,
      illustrated: maxPages - failures.length,
      failures,
      html: composeSpreadHtml({
        pages: nextPlan.pages,
        trim: nextPlan.trim,
        age: AGE_BANDS.find((a) => a.id === nextPlan.ageBand) || AGE_BANDS[1],
        title: nextPlan.title,
        facing: true,
      }),
    },
  });
});

router.post('/picture-book/preview-html', (req, res) => {
  const plan = req.body?.plan as PictureBookPlan | undefined;
  if (!plan?.pages?.length) {
    return res.status(400).json({ success: false, message: 'plan required' });
  }
  const html = composeSpreadHtml({
    pages: plan.pages,
    trim: plan.trim,
    age: AGE_BANDS.find((a) => a.id === plan.ageBand) || AGE_BANDS[1],
    title: plan.title,
    facing: req.body?.facing !== false,
  });
  res.json({ success: true, data: { html } });
});

router.post('/picture-book/pdf', async (req, res) => {
  const plan = req.body?.plan as PictureBookPlan | undefined;
  if (!plan?.pages?.length) {
    return res.status(400).json({ success: false, message: 'plan required' });
  }

  const facing = req.body?.facing !== false;
  const html = composeSpreadHtml({
    pages: plan.pages,
    trim: plan.trim,
    age: AGE_BANDS.find((a) => a.id === plan.ageBand) || AGE_BANDS[1],
    title: plan.title,
    facing,
  });

  const job = createJob('picture-book-pipeline', 'pdf');
  updateJob(job.id, { status: 'running', progress: 20 });

  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      headless: true,
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
      const width = facing ? plan.trim.widthIn * 2 : plan.trim.widthIn;
      const height = plan.trim.heightIn;
      const pdf = await page.pdf({
        width: `${width}in`,
        height: `${height}in`,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${(plan.title || 'picture-book').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}-spreads.pdf"`
      );
      res.send(Buffer.from(pdf));
    } finally {
      await browser.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Picture book PDF failed';
    updateJob(job.id, { status: 'failed', error: message });
    // Fallback: return HTML so client can print / html2pdf
    res.status(200).json({
      success: false,
      message,
      data: { html, fallback: true },
    });
  }
});

router.post('/picture-book/from-manuscript', async (req, res) => {
  const {
    title = 'Untitled',
    manuscript = '',
    ageBand = '3-5',
    trimId,
    artStyle,
    author = '',
    characters = [],
  } = req.body || {};

  if (!manuscript.trim()) {
    return res.status(400).json({ success: false, message: 'manuscript is required' });
  }

  const job = createJob('picture-book-pipeline', 'planning');
  updateJob(job.id, { status: 'running', progress: 5 });

  try {
    // Detect if manuscript needs age-appropriate compression
    let workingText = manuscript;
    const words = manuscript.trim().split(/\s+/).filter(Boolean).length;
    const band = AGE_BANDS.find((a) => a.id === ageBand) || AGE_BANDS[1];
    if (words > band.maxWordsTotal * 1.2) {
      updateJob(job.id, { progress: 15, stage: 'adapt-text' });
      workingText = await callServerAi(
        [
          `Adapt this manuscript into a ${band.label} picture-book text.`,
          `Target ≤${band.maxWordsTotal} words total, ~${band.wordsPerPage[0]}–${band.wordsPerPage[1]} words per page.`,
          'Keep the wound, desire, and turn. Concrete images. No moral sermons.',
          'Return plain text only, paragraph per page-beat, blank line between.',
          '',
          manuscript.slice(0, 12000),
        ].join('\n')
      );
    }

    updateJob(job.id, { progress: 35, stage: 'plan' });
    const plan = planPictureBook({
      title,
      manuscript: workingText,
      ageBand: ageBand as AgeBand,
      trimId: trimId as TrimId | undefined,
      artStyle: artStyle as ArtStyle | undefined,
      characters,
    });

    updateJob(job.id, { progress: 55, stage: 'cover-spec' });
    const cover = buildCoverDesign({
      title,
      author,
      ageBand: ageBand as AgeBand,
      trimId: plan.trim.id,
      artStyle: plan.artStyle,
      format: ageBand === '0-3' ? 'board-book' : 'wraparound',
      pageCount: plan.pageCount,
      palette: plan.palette,
      characterLocks: plan.characterLocks,
      blurb: workingText.split(/\n\n+/)[0]?.slice(0, 280) || '',
    });

    updateJob(job.id, { status: 'complete', progress: 100, stage: 'complete' });
    res.json({
      success: true,
      jobId: job.id,
      data: {
        adaptedText: workingText,
        plan,
        cover,
        html: composeSpreadHtml({
          pages: plan.pages,
          trim: plan.trim,
          age: band,
          title: plan.title,
          facing: true,
        }),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Picture book pipeline failed';
    updateJob(job.id, { status: 'failed', error: message });
    res.status(500).json({ success: false, message });
  }
});

export default router;
