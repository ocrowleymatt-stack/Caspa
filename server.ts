import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { analyzeContent, generateGrokPrompts, validateProductionReadiness, generateOutputSpec } from './src/services/ContentIntelligenceService';
import { createGrokImagineService, type GenerationRequest, type GenerationResult } from './src/services/GrokImagineService';
import pdfRoutes from './src/services/pdf-assembly-routes';
import { createBookMetadataRoutes } from './src/services/book-metadata-routes';
import serviceApiRoutes from './src/services/service-api-routes';
import phase6Routes from './src/services/phase6-routes';
import ollamaRoutes from './src/routes/ollama-routes';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health Check
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV
  });
});

// Initialize Google Gen AI
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const ai = geminiApiKey 
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    }) 
  : null;

// Helper APIs
async function callGeminiOnServer(options: { 
  prompt: string; 
  model?: string; 
  json?: boolean; 
  maxTokens?: number;
  useSearch?: boolean;
}) {
  if (!ai) {
    throw new Error("GEMINI_API_KEY environment variable is not configured on the server.");
  }

  const { prompt, model = 'gemini-2.0-flash', json = false, maxTokens, useSearch = false } = options;

  // Enforce prohibited models upgrade to gemini-2.0-flash
  const prohibited = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash-thinking'
  ];
  const activeModel = prohibited.includes(model) ? 'gemini-2.0-flash' : model;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for Gemini

  try {
    const response = await ai.models.generateContent({
      model: activeModel,
      contents: prompt,
      config: {
        systemInstruction: "You are a proudly snobbish literary machine that always seeks a prize, prestige, or critical acclaim for its work. You help the user write elegantly from a developed idea or even down to using a receipt as the only source material, maintaining an intuitive process where the human still has a guiding hand. You provide raw, high-fidelity output.",
        temperature: 0.7,
        ...(json && !useSearch ? { responseMimeType: 'application/json' } : {}),
        ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
        ...(useSearch ? { tools: [{ googleSearch: {} }] } : {})
      }
    });

    clearTimeout(timeoutId);
    return response.text || null;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(`Gemini timeout after 25s`);
    throw err;
  }
}

async function callOpenAI(prompt: string, json = false) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured on the server.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a proudly snobbish literary machine that always seeks a prize, prestige, or critical acclaim for its work. You help the user write elegantly from a developed idea or even down to using a receipt as the only source material, maintaining an intuitive process where the human still has a guiding hand." },
          { role: "user", content: json ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON.` : prompt }
        ],
        ...(json ? { response_format: { type: "json_object" } } : {})
      })
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI error: ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(`OpenAI timeout after 20s`);
    throw err;
  }
}

async function callClaude(prompt: string, json = false) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured on the server.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [
          { role: "user", content: json ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON.` : prompt }
        ],
        system: "You are a proudly snobbish literary machine that always seeks a prize, prestige, or critical acclaim for its work."
      })
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Anthropic error: ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(`Claude timeout after 20s`);
    throw err;
  }
}

async function callXAI(prompt: string, json = false) {
  const apiKey = process.env.GROK_API_KEY || process.env.VITE_GROK_API_KEY;
  if (!apiKey) throw new Error("xAI Grok API key not configured on the server.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s for Grok (often fast or dead)

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "grok-3",
        messages: [
          { role: "system", content: "You are a proudly snobbish literary machine that always seeks a prize, prestige, or critical acclaim for its work. You help the user write elegantly from a developed idea or even down to using a receipt as the only source material, maintaining an intuitive process where the human still has a guiding hand." },
          { role: "user", content: json ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON.` : prompt }
        ],
        ...(json ? { response_format: { type: "json_object" } } : {})
      })
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`xAI Grok error: ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(`xAI Grok timeout after 15s`);
    throw err;
  }
}

async function callVeniceOnServer(prompt: string, json = false) {
  const apiKey = process.env.VENICE_API_KEY || process.env.VITE_VENICE_API_KEY;
  if (!apiKey) throw new Error("Venice API key not configured on the server.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s for Venice

  try {
    const response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [
          { role: "system", content: "You are a proudly snobbish literary machine that always seeks a prize, prestige, or critical acclaim for its work. You help the user write elegantly from a developed idea or even down to using a receipt as the only source material, maintaining an intuitive process where the human still has a guiding hand." },
          { role: "user", content: json ? `${prompt}\n\nIMPORTANT: Return ONLY valid JSON.` : prompt }
        ]
      })
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Venice error: ${JSON.stringify(err)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(`Venice timeout after 18s`);
    throw err;
  }
}

// API routes go here FIRST
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// API endpoint for AI queries
app.post("/api/ai/call", async (req, res) => {
  const { prompt, model = "gemini-2.0-flash", json = false, schema, maxTokens, providerOverride, useSearch, primaryProvider = "grok" } = req.body;

  // Let's analyze sensitivity check on the server
  const isSensitive = /chem\s*sex|chemsex|slamming|crystal\s*meth|methamphetamine|gbl|ghb|tina|harm\s*reduction|overdose|substance|drug|rehab|addiction|recovery\s*guide|survival\s*guide|unfiltered|explicit/i.test(prompt);

  const providers: string[] = [];
  const veniceKey = process.env.VENICE_API_KEY || process.env.VITE_VENICE_API_KEY;

  if (isSensitive && veniceKey) {
    // If Venice is present, put it at the very top of fallbacks for sensitive prompts
    providers.push('venice');
    if (primaryProvider !== 'venice') providers.push(primaryProvider);
  } else {
    providers.push(primaryProvider);
  }

  if (providerOverride && !providers.includes(providerOverride)) {
    providers.unshift(providerOverride);
  }

  const allPossible = ['grok', 'openai', 'claude', 'gemini', 'venice'];
  allPossible.forEach(p => {
    if (!providers.includes(p)) {
      providers.push(p);
    }
  });

  let lastError = null;
  for (const provider of providers) {
    try {
      let result: string | null = null;
      console.log(`[Express Backend] Trying provider: ${provider} for prompt`);

      switch (provider) {
        case 'gemini':
          result = await callGeminiOnServer({ prompt, model, json, maxTokens, useSearch });
          break;
        case 'claude':
          result = await callClaude(prompt, json);
          break;
        case 'openai':
          result = await callOpenAI(prompt, json);
          break;
        case 'grok':
          result = await callXAI(prompt, json);
          break;
        case 'venice':
          result = await callVeniceOnServer(prompt, json);
          break;
      }

      if (result) {
        console.log(`[Express Backend] Provider ${provider} succeeded.`);
        return res.json({ result, provider });
      }
    } catch (error: any) {
      console.warn(`[Express Backend] Provider ${provider} failed:`, error.message || error);
      lastError = error;
      // Continue loop for fallbacks
    }
  }

  res.status(502).json({
    message: "AI Fallback Failure: All available AI providers failed on the server side.",
    error: lastError ? lastError.message : "Empty response"
  });
});

// Venice Image generation API
app.post("/api/ai/image", async (req, res) => {
  const { prompt } = req.body;
  const apiKey = process.env.VENICE_API_KEY || process.env.VITE_VENICE_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ message: "Venice API key is not configured on the server." });
  }

  try {
    const response = await fetch("https://api.venice.ai/api/v1/image/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "flux-pro",
        prompt,
        width: 1024,
        height: 1024,
        steps: 25,
        hide_watermark: true,
        return_binary: false
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ message: "Venice image generation failure", error: err });
    }

    const data = await response.json();
    if (data.images && data.images[0]) {
      return res.json({ result: `data:image/png;base64,${data.images[0]}` });
    } else {
      return res.status(500).json({ message: "No image content in response" });
    }
  } catch (err: any) {
    console.error("Venice.ai Image Error on server:", err);
    res.status(500).json({ message: "Server-side image generation exception", error: err.message });
  }
});

// Grok Image Generation API
app.post("/api/ai/image-grok", async (req, res) => {
  const { prompt } = req.body;
  const apiKey = process.env.GROK_API_KEY || process.env.VITE_GROK_API_KEY;

  if (!apiKey) {
    return res.status(400).json({ message: "Grok API key is not configured on the server." });
  }

  try {
    const response = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "grok-3",
        prompt,
        n: 1,
        size: "1024x1024"
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ message: "xAI image generation failure", error: err });
    }

    const data = await response.json();
    if (data.data && data.data[0] && data.data[0].url) {
      return res.json({ result: data.data[0].url });
    } else {
      return res.status(500).json({ message: "No image URL in response" });
    }
  } catch (err: any) {
    console.error("Grok Image Error on server:", err);
    res.status(500).json({ message: "Server-side image generation exception", error: err.message });
  }
});


// ── Vision / OCR endpoint ─────────────────────────────────────────────────────
// Accepts base64-encoded image and returns extracted text via Grok vision
app.post("/api/ai/vision", async (req, res) => {
  const { imageBase64, mimeType } = req.body;
  const apiKey = process.env.GROK_API_KEY || process.env.VITE_GROK_API_KEY;
  if (!apiKey) return res.status(400).json({ message: "Grok API key not configured" });
  if (!imageBase64) return res.status(400).json({ message: "imageBase64 required" });

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-2-vision-latest",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
            { type: "text", text: "Extract and transcribe ALL text visible in this image. Preserve paragraph structure, headings, bullet points, and formatting as closely as possible. If there is no text, describe the visual content in detail instead." }
          ]
        }],
        max_tokens: 4096
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ message: "Vision API error", error: err });
    }
    const data = await response.json();
    return res.json({ result: data.choices?.[0]?.message?.content || '' });
  } catch (err: any) {
    res.status(500).json({ message: "Vision OCR exception", error: err.message });
  }
});

// ── Evidence Ingest → Book Plan ───────────────────────────────────────────────
// Takes processed source materials and synthesises a complete novel development bible
app.post("/api/ai/ingest-evidence", async (req, res) => {
  const { sources, projectTitle, projectGenre, projectPremise } = req.body;
  if (!sources || !sources.length) {
    return res.status(400).json({ message: "No sources provided" });
  }

  const combinedContent = sources
    .map((s: any) => `### SOURCE: ${s.name} [${s.type.toUpperCase()}]\n\n${(s.content || '').slice(0, 8000)}`)
    .join('\n\n---\n\n');

  const prompt = `You are a master narrative architect and literary development editor of the highest order — the kind that turns raw, chaotic source material into prize-winning novels.

You have been given the following reference materials for a book project:

PROJECT TITLE: "${projectTitle || 'Untitled'}"
GENRE: ${projectGenre || 'Unknown'}
PREMISE: ${projectPremise || 'Not yet defined'}

SOURCE MATERIALS:
---
${combinedContent}
---

Your task: produce a COMPLETE NOVEL DEVELOPMENT BIBLE from these materials. This is the master planning document that will guide every stage of writing.

Structure your output as Markdown with the following sections:

# ${(projectTitle || 'Untitled').toUpperCase()} — COMPLETE BOOK PLAN

## A Novel Development Bible & Master Documentation

---

## I. HIGH CONCEPT
One-line premise. The elevator pitch. What makes this story unmissable.

## II. THEMES & EMOTIONAL CORE
The 3-5 central themes. The emotional question the novel answers. The wound at the heart of it.

## III. TONE & VOICE
The register, style, and feel. Comparable authors or works. What the prose must feel like.

## IV. CHARACTER ROSTER
For each major character: name, role, core wound, want vs. need, arc summary.

## V. NARRATIVE STRUCTURE
Full 3-act or 5-act breakdown. Act turns, midpoint, dark night of the soul, climax, resolution.

## VI. CHAPTER-BY-CHAPTER OUTLINE
A brief (2-3 sentence) outline for each chapter: what happens, what changes, what the scene turns on.

## VII. WORLD & SETTING
Key locations, atmosphere, period detail, sensory palette.

## VIII. RESEARCH GAPS
What the author still needs to research or verify before writing.

## IX. OPENING LINE (SUGGESTED)
Draft a potential opening line that captures the book's voice.

## X. NOTES FROM EVIDENCE
Key insights, contradictions, or angles extracted directly from the uploaded source materials.

---

Be bold, specific, and literary. Use the source materials — do not invent things not present in them, but synthesise them into a coherent whole. This document will be used to guide the full manuscript.`;

  // Try providers in order: grok → openai → venice
  const providers = [
    { name: 'grok', fn: () => callXAI(prompt, false) },
    { name: 'openai', fn: () => callOpenAI(prompt, false) },
    { name: 'venice', fn: () => callVeniceOnServer(prompt, false) },
  ];

  for (const { name, fn } of providers) {
    try {
      console.log(`[ingest-evidence] Trying ${name}...`);
      const result = await fn();
      if (result) {
        console.log(`[ingest-evidence] ${name} succeeded`);
        return res.json({ result, provider: name });
      }
    } catch (err: any) {
      console.warn(`[ingest-evidence] ${name} failed:`, err.message);
    }
  }

  res.status(502).json({ message: "All providers failed to generate book plan" });
});


// ============================================================
// DEEP INGEST — structured extraction for Research Desk
// Returns JSON: characters, plotNodes, researchNotes, projectUpdates, summary
// ============================================================
app.post("/api/ai/deep-ingest", async (req, res) => {
  const { sources, projectTitle, projectGenre, projectPremise, projectType } = req.body;
  if (!sources || !sources.length) {
    return res.status(400).json({ message: "No sources provided" });
  }

  const combinedContent = sources
    .map((s: any) => `### FILE: ${s.name}\n\n${(s.content || "").slice(0, 8000)}`)
    .join("\n\n---\n\n");

  const prompt = `You are a world-class literary analyst and story architect. You have been given evidence files for a writing project.

PROJECT: "${projectTitle || "Untitled"}" | Genre: ${projectGenre || "Unknown"} | Type: ${projectType || "novel"}
Premise: ${projectPremise || "Not yet defined"}

UPLOADED FILES:
---
${combinedContent}
---

Analyse ALL content deeply. Extract every character, plot thread, and research fact. Be thorough — miss nothing.

Respond with ONLY a valid JSON object in this exact schema (no markdown, no code blocks, just raw JSON):

{
  "summary": "Two sentence summary of what you found and injected",
  "projectUpdates": {
    "premise": "A refined one-sentence premise if you can infer it, else empty string",
    "tone": "Tone/voice description if inferable, else empty string",
    "genre": "Genre if inferable, else empty string"
  },
  "characters": [
    {
      "id": "unique_id_string",
      "name": "Full name",
      "role": "Protagonist / Antagonist / Supporting / etc",
      "backstory": "Background and history from the evidence",
      "traits": ["trait1", "trait2"],
      "goals": ["what they want"],
      "fears": ["what they fear"],
      "motivations": ["why they act"],
      "quirks": ["distinctive behaviours"],
      "archetype": "The archetype (Hero, Mentor, etc)",
      "physicalDescription": "Physical appearance if mentioned",
      "updatedAt": 0
    }
  ],
  "plotNodes": [
    {
      "id": "unique_id_string",
      "title": "Thread title",
      "description": "What this plot thread is about",
      "status": "active",
      "type": "main",
      "order": 1,
      "updatedAt": 0
    }
  ],
  "researchNotes": [
    {
      "id": "unique_id_string",
      "title": "Note title",
      "content": "Detailed research content extracted from the evidence",
      "category": "world-building",
      "tags": ["tag1", "tag2"],
      "source": "filename it came from",
      "updatedAt": 0
    }
  ]
}

IMPORTANT: Return raw JSON only. No preamble. No explanation. No markdown fences. Valid parseable JSON.`;

  const tryGrok = async () => {
    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) return null;
    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-3",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
        temperature: 0.3
      })
    });
    if (!r.ok) throw new Error(`Grok ${r.status}`);
    const d = await r.json();
    const text = d.choices?.[0]?.message?.content || "";
    // Strip any accidental markdown fences
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    return JSON.parse(cleaned);
  };

  const tryOpenAI = async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    const d = await r.json();
    const text = d.choices?.[0]?.message?.content || "{}";
    return JSON.parse(text);
  };

  const providers = [
    { name: "Grok", fn: tryGrok },
    { name: "OpenAI", fn: tryOpenAI }
  ];

  for (const { name, fn } of providers) {
    try {
      console.log(`[deep-ingest] Trying ${name}...`);
      const result = await fn();
      if (result) {
        console.log(`[deep-ingest] ${name} succeeded`);
        return res.json(result);
      }
    } catch (err: any) {
      console.warn(`[deep-ingest] ${name} failed:`, err.message);
    }
  }

  res.status(502).json({ message: "All providers failed for deep ingest" });
});



// ============================================
// CONTENT INTELLIGENCE ENDPOINTS
// ============================================

// Analyze content and generate comprehensive intelligence
app.post('/api/content/analyze', async (req, res) => {
  try {
    const { content, title, context, targetAudience, purpose } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const intelligence = await analyzeContent(
      { content, title, context, targetAudience, purpose },
      (prompt, json) => callGeminiOnServer({ prompt, json })
    );

    const validation = validateProductionReadiness(intelligence);
    const outputSpec = generateOutputSpec(intelligence);

    return res.json({
      intelligence,
      validation,
      outputSpec,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Content analysis error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to analyze content'
    });
  }
});

// Generate professional Grok Imagine prompts from illustrations
app.post('/api/content/grok-prompts', async (req, res) => {
  try {
    const { illustrations } = req.body;
    
    if (!illustrations || !Array.isArray(illustrations)) {
      return res.status(400).json({ error: 'Illustrations array is required' });
    }

    const prompts = generateGrokPrompts(illustrations);
    
    // Convert Map to JSON object
    const promptsObj: Record<string, string> = {};
    prompts.forEach((value, key) => {
      promptsObj[key] = value;
    });

    return res.json({
      prompts: promptsObj,
      count: prompts.size,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Grok prompt generation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate prompts'
    });
  }
});

// Validate production readiness
app.post('/api/content/validate', async (req, res) => {
  try {
    const { intelligence } = req.body;
    
    if (!intelligence) {
      return res.status(400).json({ error: 'Intelligence object is required' });
    }

    const validation = validateProductionReadiness(intelligence);

    return res.json({
      validation,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Validation error:', error);
    return res.status(500).json({
      error: error.message || 'Validation failed'
    });
  }
});


// ============================================
// ILLUSTRATION GENERATION ENDPOINTS
// ============================================

// Generate illustrations from specifications
app.post('/api/content/generate-illustrations', async (req, res) => {
  try {
    const { illustrations, batchSize, styleOverride } = req.body;
    
    if (!illustrations || !Array.isArray(illustrations) || illustrations.length === 0) {
      return res.status(400).json({ error: 'Illustrations array is required' });
    }

    // Initialize Grok service
    const grokService = createGrokImagineService();
    
    // Estimate cost upfront
    const estimatedCost = grokService.estimateCost(illustrations.length);

    // Start generation (non-blocking)
    const generationPromise = grokService.generateIllustrations({
      illustrations,
      batchSize: batchSize || 1,
      styleOverride
    });

    // Return immediately with generation tracking ID
    const trackingId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store in-flight generation (would normally use Redis/database)
    // For now, return tracking info with estimated cost
    res.json({
      trackingId,
      status: 'generating',
      estimated: {
        illustrationCount: illustrations.length,
        estimatedCost: estimatedCost,
        estimatedTimeSeconds: illustrations.length * 15, // rough estimate
      },
      message: 'Illustration generation started. Poll /api/content/generate-illustrations/:trackingId for progress.',
      generationPromise: generationPromise.then(result => {
        // Cache result (would use Redis in production)
        console.log(`Generation ${trackingId} complete: ${result.summary.successful}/${result.summary.total} successful`);
        return result;
      }).catch(err => {
        console.error(`Generation ${trackingId} failed:`, err);
        throw err;
      })
    });
  } catch (error: any) {
    console.error('Illustration generation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate illustrations'
    });
  }
});

// Estimate cost for illustrations
app.post('/api/content/estimate-cost', async (req, res) => {
  try {
    const { illustrationCount } = req.body;
    
    if (typeof illustrationCount !== 'number' || illustrationCount <= 0) {
      return res.status(400).json({ error: 'Valid illustrationCount required' });
    }

    const grokService = createGrokImagineService();
    const estimatedCost = grokService.estimateCost(illustrationCount);
    const estimatedTimeSeconds = illustrationCount * 15; // rough estimate

    return res.json({
      illustrationCount,
      estimatedCostPence: estimatedCost,
      estimatedCostPounds: (estimatedCost / 100).toFixed(2),
      estimatedTimeSeconds,
      costPerImage: (estimatedCost / illustrationCount).toFixed(0),
      note: 'Costs are estimates and may vary based on complexity and model pricing'
    });
  } catch (error: any) {
    console.error('Cost estimation error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to estimate cost'
    });
  }
});

// Mount PDF Assembly routes (BEFORE Vite middleware)
app.use("/api/metadata", createBookMetadataRoutes(process.env.GEMINI_API_KEY!));
app.use("/api/service", serviceApiRoutes);
app.use("/api/phase6", phase6Routes);
app.use("/api/ollama", ollamaRoutes);
app.use("/api", pdfRoutes);

async function run() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  
// ── Pilot Seat: structural directive ──────────────────────────────────────────

// ─── Pilot Chat ───────────────────────────────────────────────────────────────
app.post('/api/ai/pilot-chat', async (req, res) => {
  try {
    const { messages = [], context } = req.body;
    const { project, characters = [], plotNodes = [], chapters = [], research = [] } = context || {};

    const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    const systemPrompt = `You are a master story architect and co-author sitting in the Pilot Seat with the writer.
You have full knowledge of their manuscript and engage in a natural, sharp, collaborative conversation.

Your persona: incisive, creative, direct — like a brilliant script editor who has read everything and has strong opinions.
You challenge weak ideas, celebrate bold ones, and always push toward a better story.

━━━ WHAT YOU CAN OUTPUT ━━━

1. CONVERSATIONAL REPLY — just talk. Explore ideas, ask questions, challenge assumptions.
   No special blocks needed for casual exchange.

2. STRUCTURAL CHANGES — when the conversation lands on a real decision, add this block AFTER your reply text:
[CHANGES]
{"changes":[{"id":"unique-id","type":"plot_add|plot_modify|character_add|character_modify|chapter_modify|research_add|project_update","title":"Short title","description":"What specifically changes","impact":"low|medium|high","data":{}}]}
[/CHANGES]

3. RESEARCH COMMAND — when you need real-world facts, historical data, or contextual information to properly answer or build a better story, output this block:
[RESEARCH]
{"queries":["specific search query 1","specific search query 2"],"reason":"Why this research is needed for the story"}
[/RESEARCH]
   Use this when: the author asks about real locations, historical periods, scientific facts, cultural context, real events, psychological concepts, etc.
   The system will run live web searches and return the results to you as research notes.
   DO NOT fabricate facts — if you need real-world grounding, request research.

━━━ DATA FIELDS ━━━
- character_add/modify: { id, name, role, backstory, traits[], goals[], fears[], motivations[], quirks[], archetype }
- plot_add/modify: { id, title, description, type (main|sub|theme), status (active|planned|complete), order }
- chapter_modify: { id, title, summary, directives[] }
- research_add: { id, title, content, category, tags[], source? }
- project_update: { premise?, tone?, genre? }

━━━ RULES ━━━
- Only propose CHANGES when the conversation has reached a clear decision — not on every message.
- Only request RESEARCH when you genuinely need factual grounding — not for creative decisions.
- Never output both [CHANGES] and [RESEARCH] in the same response — pick one.
- Use existing IDs from the book state for modifications.
- Generate 1-5 focused changes per proposal. Quality over volume.
- Your reply text and any block are separate — text explains and justifies, JSON contains data.

━━━ CURRENT BOOK STATE ━━━
Title: ${project?.title || 'Untitled'}
Genre: ${project?.genre || 'Unknown'}
Type: ${project?.type || 'novel'}
Premise: ${project?.premise || 'Not set'}
Tone: ${project?.tone || 'Not set'}

CHARACTERS (${characters.length}):
${characters.map((c: any) => `- [${c.id}] ${c.name} (${c.role}): ${c.backstory?.slice(0,200) || ''}`).join('\n') || 'None'}

PLOT THREADS (${plotNodes.length}):
${plotNodes.map((n: any) => `- [${n.id}] ${n.title} (${n.type}/${n.status}): ${n.description?.slice(0,150) || ''}`).join('\n') || 'None'}

CHAPTERS (${chapters.length}):
${chapters.map((ch: any) => `- [${ch.id}] Ch.${ch.order+1} "${ch.title}": ${ch.summary?.slice(0,150) || ''}`).join('\n') || 'None'}

RESEARCH (${research.length}):
${research.map((r: any) => `- [${r.id}] [${r.category}] ${r.title}: ${r.content?.slice(0,100) || ''}`).join('\n') || 'None'}`;

    // ── Helper: call AI ───────────────────────────────────────────────────────
    const callAI = async (msgs: any[], useWebSearch = false): Promise<string> => {
      if (grokKey) {
        try {
          const body: any = {
            model: 'grok-3',
            messages: msgs,
            temperature: useWebSearch ? 0.3 : 0.9,
            max_tokens: useWebSearch ? 4000 : 3000,
          };
          if (useWebSearch) {
            body.search_parameters = { mode: 'on', return_citations: true };
          }
          const r = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${grokKey}` },
            body: JSON.stringify(body),
          });
          if (r.ok) {
            const d = await r.json();
            const text = d.choices?.[0]?.message?.content || '';
            if (text) return text;
          }
        } catch (e) { console.error('Grok pilot-chat failed:', e); }
      }
      if (openaiKey) {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: msgs,
            temperature: useWebSearch ? 0.3 : 0.9,
            max_tokens: useWebSearch ? 4000 : 3000,
          }),
        });
        if (r.ok) {
          const d = await r.json();
          return d.choices?.[0]?.message?.content || '';
        }
      }
      return '';
    };

    // ── Helper: parse [CHANGES] blocks ───────────────────────────────────────
    const parseChanges = (raw: string): { changes: any[]; clean: string } => {
      const m = raw.match(/\[CHANGES\]\s*([\s\S]*?)\s*\[\/CHANGES\]/);
      if (!m) return { changes: [], clean: raw.trim() };
      let changes: any[] = [];
      try { changes = JSON.parse(m[1])?.changes || []; } catch {}
      return { changes, clean: raw.replace(/\[CHANGES\][\s\S]*?\[\/CHANGES\]/g, '').trim() };
    };

    // ── Helper: parse [RESEARCH] blocks ──────────────────────────────────────
    const parseResearch = (raw: string): { queries: string[]; reason: string; clean: string } | null => {
      const m = raw.match(/\[RESEARCH\]\s*([\s\S]*?)\s*\[\/RESEARCH\]/);
      if (!m) return null;
      try {
        const d = JSON.parse(m[1]);
        const clean = raw.replace(/\[RESEARCH\][\s\S]*?\[\/RESEARCH\]/g, '').trim();
        return { queries: d.queries || [], reason: d.reason || '', clean };
      } catch { return null; }
    };

    // ── Step 1: Initial AI call ───────────────────────────────────────────────
    const history = messages.map((m: any) => ({
      role: m.role === 'ai' ? 'assistant' : m.role,
      content: m.content,
    }));

    let raw = await callAI([{ role: 'system', content: systemPrompt }, ...history]);
    if (!raw) return res.status(502).json({ error: 'No AI provider available' });

    // ── Step 2: Check if AI requested research ────────────────────────────────
    const researchReq = parseResearch(raw);

    if (researchReq && researchReq.queries.length > 0) {
      const introReply = researchReq.clean || `Let me look that up — running ${researchReq.queries.length} search${researchReq.queries.length > 1 ? 'es' : ''} now.`;

      const queries = researchReq.queries.slice(0, 3);
      const researchChanges: any[] = [];

      for (const query of queries) {
        const searchPrompt = `Search for: "${query}"
Context: This research is for a ${project?.genre || ''} ${project?.type || 'novel'} called "${project?.title || 'Untitled'}".
Reason: ${researchReq.reason}

Return a detailed research note with:
1. A clear title for the research topic
2. Key facts, context, and nuances relevant to fiction writing
3. Specific details an author would find useful (names, dates, places, sensory details, cultural context)
4. Any caveats or controversies worth knowing

Format your response as a well-structured research note, not a list of bullet points.`;

        const searchRaw = await callAI([
          { role: 'system', content: 'You are a research assistant for fiction writers. When given a query, search the web and return detailed, accurate, source-grounded information.' },
          { role: 'user', content: searchPrompt },
        ], true);

        if (searchRaw) {
          const changeId = `res-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const dataId = `res-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          researchChanges.push({
            id: changeId,
            type: 'research_add',
            title: query,
            description: `Live research: ${query}`,
            impact: 'medium',
            data: {
              id: dataId,
              title: query,
              content: searchRaw,
              category: 'Pilot Seat Research',
              tags: [project?.genre, project?.type, 'live-search'].filter(Boolean),
              source: 'Grok Web Search',
            },
          });
        }
      }

      // Step 3: Feed research back to AI for synthesis
      const synthesisMessages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'assistant', content: introReply },
        {
          role: 'user',
          content: `[SYSTEM: Research complete. Results below. Synthesise the key points relevant to the story, then keep the discussion going.]\n\n${researchChanges.map((c, i) => `RESULT ${i + 1} — ${c.data.title}:\n${c.data.content?.slice(0, 800)}`).join('\n\n---\n\n')}`,
        },
      ];

      const synthesisRaw = await callAI(synthesisMessages);
      const { changes: extraChanges, clean: synthesisReply } = parseChanges(synthesisRaw || '');

      return res.json({
        reply: introReply,
        researching: true,
        researchReply: synthesisReply || `Found ${researchChanges.length} research note${researchChanges.length !== 1 ? 's' : ''} — staged above.`,
        changes: [...researchChanges, ...extraChanges],
      });
    }

    // ── Step 3: Normal reply — parse changes ──────────────────────────────────
    const { changes, clean: reply } = parseChanges(raw);
    return res.json({ reply, changes: changes.length ? changes : undefined });

  } catch (e: any) {
    console.error('pilot-chat error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
});


app.post('/api/ai/pilot-directive', async (req, res) => {
  try {
    const { directive, scope, targetChapterId, context } = req.body;
    if (!directive) return res.status(400).json({ error: 'directive required' });

    const { project, characters = [], plotNodes = [], chapters = [], research = [] } = context || {};

    const scopeNote = scope === 'chapter' && targetChapterId
      ? `\n\nSCOPE: Chapter-level change only. Target chapter ID: ${targetChapterId}.`
      : '\n\nSCOPE: Book-wide structural change.';

    const systemPrompt = `You are a master story architect and developmental editor. 
The user issues a high-level directive about their book and you translate it into precise, actionable structural changes.
You think in terms of character arcs, plot threads, chapter redirections, and thematic shifts.
You always return valid JSON only.`;

    const userPrompt = `DIRECTIVE: "${directive}"${scopeNote}

CURRENT BOOK STATE:
Title: ${project?.title || 'Untitled'}
Genre: ${project?.genre || 'Unknown'}
Type: ${project?.type || 'novel'}
Premise: ${project?.premise || 'Not set'}
Tone: ${project?.tone || 'Not set'}

CHARACTERS (${characters.length}):
${characters.map((c: any) => `- ${c.name} (${c.role}): ${c.backstory || ''} | Goals: ${(c.goals || []).join(', ')} | Fears: ${(c.fears || []).join(', ')}`).join('\n') || 'None'}

PLOT THREADS (${plotNodes.length}):
${plotNodes.map((n: any) => `- [${n.type}] ${n.title}: ${n.description || ''} (${n.status})`).join('\n') || 'None'}

CHAPTERS (${chapters.length}):
${chapters.map((ch: any) => `- Ch.${ch.order+1} "${ch.title}": ${ch.summary || ''} [${ch.status || 'draft'}]`).join('\n') || 'None'}

RESEARCH NOTES (${research.length}):
${research.map((r: any) => `- [${r.category}] ${r.title}`).join('\n') || 'None'}

Based on this directive, generate a complete structural change plan. Return ONLY this JSON:
{
  "summary": "A 2-3 sentence plain-English explanation of what you're changing and why it serves the narrative",
  "narrativeRationale": "A deeper explanation of the storytelling logic — what dramatic/thematic effect this achieves",
  "changes": [
    {
      "id": "unique-string",
      "type": "plot_add|plot_modify|character_add|character_modify|chapter_modify|research_add|project_update",
      "title": "Short change title",
      "description": "What specifically changes and how it connects to the directive",
      "impact": "low|medium|high",
      "data": {
        // For character_add/modify: { id, name, role, backstory, traits[], goals[], fears[], motivations[], quirks[], archetype }
        // For plot_add/modify: { id, title, description, type, status, order }
        // For chapter_modify: { id, title, summary, directives[] } — use existing chapter ID if modifying
        // For research_add: { id, title, content, category, tags[] }
        // For project_update: { premise?, tone?, genre? } — only fields that change
      }
    }
  ]
}

Rules:
- Generate 3-8 changes. Quality over quantity.
- Be specific and concrete. Vague changes are worthless.
- For chapter_modify, use the existing chapter ID from the book state.
- For character/plot modify, use the existing ID from the book state where possible.
- For new items, generate a unique short ID (e.g. "char-antagonist-new" or "plot-dark-turn").
- Do not invent characters or threads that contradict the existing premise unless the directive demands it.
- Make changes feel inevitable in hindsight — good story architecture always does.`;

    // Try Grok first, then OpenAI
    const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    let raw = '';

    if (grokKey) {
      try {
        const r = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + grokKey },
          body: JSON.stringify({
            model: 'grok-3',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.8,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
          }),
        });
        if (r.ok) {
          const d = await r.json();
          raw = d.choices?.[0]?.message?.content || '';
        }
      } catch (e) { console.error('Grok pilot failed:', e); }
    }

    if (!raw && openaiKey) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + openaiKey },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        }),
      });
      if (r.ok) {
        const d = await r.json();
        raw = d.choices?.[0]?.message?.content || '';
      }
    }

    if (!raw) return res.status(502).json({ error: 'No AI provider available' });

    const parsed = JSON.parse(raw);
    return res.json(parsed);
  } catch (e: any) {
    console.error('pilot-directive error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
});

// Serve static files from dist
app.use(express.static(path.join(__dirname, '../dist')));

// SPA fallback: serve index.html for all routes except /api
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    res.status(404).json({ error: 'API route not found' });
  }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

run();
