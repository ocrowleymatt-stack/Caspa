/**
 * Ollama Proxy Routes
 * Safe backend proxying for self-hosted LLM requests
 */

import express, { Router } from 'express';

const router = Router();
const OLLAMA_API = 'http://localhost:11434/api';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  num_predict?: number;
  stream?: boolean;
}

// Health check - is Ollama available?
router.get('/health', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_API}/tags`, { timeout: 5000 });
    return res.json({ 
      available: response.ok,
      status: response.ok ? 'online' : 'offline'
    });
  } catch {
    return res.json({ available: false, status: 'offline' });
  }
});

// Get available models
router.get('/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_API}/tags`);
    const data = await response.json() as { models?: Array<{ name: string }> };
    return res.json({ models: data.models?.map(m => m.name) || [] });
  } catch (err) {
    return res.status(503).json({ error: 'Ollama unavailable', models: [] });
  }
});

// Generate (non-streaming)
router.post('/generate', async (req, res) => {
  try {
    const body = req.body as OllamaGenerateRequest;
    
    const response = await fetch(`${OLLAMA_API}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: body.model || 'mistral',
        prompt: body.prompt,
        system: body.system,
        temperature: body.temperature ?? 0.7,
        num_predict: body.num_predict ?? 500,
        stream: false,
      }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: response.statusText });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error('[Ollama] Generate error:', err);
    return res.status(500).json({ error: 'Generation failed' });
  }
});

// Generate (streaming)
router.post('/generate-stream', async (req, res) => {
  try {
    const body = req.body as OllamaGenerateRequest;
    
    const response = await fetch(`${OLLAMA_API}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: body.model || 'mistral',
        prompt: body.prompt,
        system: body.system,
        temperature: body.temperature ?? 0.7,
        num_predict: body.num_predict ?? 500,
        stream: true,
      }),
    });

    if (!response.ok) {
      res.status(response.status);
      return res.json({ error: response.statusText });
    }

    // Set up streaming response
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = response.body?.getReader();
    if (!reader) {
      res.status(500);
      return res.json({ error: 'No stream' });
    }

    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
    } catch (err) {
      console.error('[Ollama] Stream error:', err);
      res.end();
    }
  } catch (err) {
    console.error('[Ollama] Stream setup error:', err);
    return res.status(500).json({ error: 'Stream failed' });
  }
});

export default router;
