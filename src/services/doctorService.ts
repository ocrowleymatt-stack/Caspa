/**
 * Caspa Doctor — safe deployment diagnostics (booleans/status only, no secrets)
 */

import fs from 'fs';
import path from 'path';
import { getJobAudit } from './jobQueueService';
import { jobStorePresent } from './jobStoreService';
import { backupsPresent, listBackups } from './localBackupService';

const OLLAMA_API = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api';

function fileExists(relativeParts: string[]): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), ...relativeParts));
  } catch {
    return false;
  }
}

async function probeOllama(): Promise<{ available: boolean; status: 'online' | 'offline' }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${OLLAMA_API}/tags`, { signal: controller.signal });
    clearTimeout(timer);
    return { available: response.ok, status: response.ok ? 'online' : 'offline' };
  } catch {
    return { available: false, status: 'offline' };
  }
}

export async function getDoctorSnapshot() {
  const ollama = await probeOllama();

  return {
    status: 'ok' as const,
    service: 'Caspa',
    version: '0.0.0',
    timestamp: new Date().toISOString(),
    deployment: {
      mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
      port: Number(process.env.PORT) || 3000,
      publicUiPresent: fileExists(['dist', 'index.html']),
      authEnabled: true,
    },
    aiProviders: {
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY),
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY),
      grokConfigured: Boolean(process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.VITE_GROK_API_KEY),
      veniceConfigured: Boolean(process.env.VENICE_API_KEY || process.env.VITE_VENICE_API_KEY),
      ollama,
    },
    modules: {
      workshop: true,
      researchLibrary: true,
      promiseRegistry: true,
      psychologyEngine: true,
      jamCanvas: true,
      publishPack: true,
      ollamaProxy: true,
      serverPrintExport: true,
      goldPipeline: true,
      novelWritePro: true,
      localStorageBackup: true,
    },
    jobs: {
      inMemoryQueue: false,
      persisted: jobStorePresent(),
      ...getJobAudit(),
    },
    storage: {
      localJsonDb: true,
      usingDefaultDataDir: !process.env.CASPA_DATA_DIR,
      backupsPresent: backupsPresent(),
      backupCount: listBackups().length,
    },
  };
}
