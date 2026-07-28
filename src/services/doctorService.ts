/**
 * Caspa Doctor — safe deployment diagnostics (booleans/status only, no secrets)
 */

import fs from 'fs';
import path from 'path';
import { getJobAudit } from './jobQueueService';
import { jobStorePresent } from './jobStoreService';
import { backupsPresent, listBackups } from './localBackupService';

const OLLAMA_API = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api';
const VERSION = '1.0.0';

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

function buildReadiness(snapshot: {
  publicUiPresent: boolean;
  geminiConfigured: boolean;
  openaiConfigured: boolean;
  anthropicConfigured: boolean;
  grokConfigured: boolean;
  ollamaAvailable: boolean;
  usingDefaultDataDir: boolean;
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!snapshot.publicUiPresent) {
    blockers.push('Run npm run build — dist/index.html is missing.');
  }

  const anyCloudAi =
    snapshot.geminiConfigured ||
    snapshot.openaiConfigured ||
    snapshot.anthropicConfigured ||
    snapshot.grokConfigured;

  if (!anyCloudAi && !snapshot.ollamaAvailable) {
    blockers.push('No AI provider configured. Set GEMINI_API_KEY (or another provider), or start Ollama.');
  } else if (!anyCloudAi && snapshot.ollamaAvailable) {
    warnings.push('Only Ollama is available. Cloud models offline until an API key is set.');
  }

  if (!snapshot.geminiConfigured) {
    warnings.push('GEMINI_API_KEY not set — Gemini routes will fail.');
  }

  if (snapshot.usingDefaultDataDir) {
    warnings.push('CASPA_DATA_DIR unset — using ./data. Set it for production persistence.');
  }

  if (!snapshot.ollamaAvailable) {
    warnings.push('Ollama offline — local/self-hosted models unavailable.');
  }

  const ready = blockers.length === 0;
  const score = Math.max(0, 100 - blockers.length * 40 - warnings.length * 10);

  return {
    ready,
    score,
    label: ready ? (warnings.length ? 'ready_with_warnings' : 'ready') : 'blocked',
    blockers,
    warnings,
  };
}

export async function getDoctorSnapshot() {
  const ollama = await probeOllama();
  const publicUiPresent = fileExists(['dist', 'index.html']);
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY);
  const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY);
  const grokConfigured = Boolean(process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.VITE_GROK_API_KEY);
  const veniceConfigured = Boolean(process.env.VENICE_API_KEY || process.env.VITE_VENICE_API_KEY);
  const usingDefaultDataDir = !process.env.CASPA_DATA_DIR;

  const readiness = buildReadiness({
    publicUiPresent,
    geminiConfigured,
    openaiConfigured,
    anthropicConfigured,
    grokConfigured,
    ollamaAvailable: ollama.available,
    usingDefaultDataDir,
  });

  return {
    status: readiness.ready ? ('ok' as const) : ('degraded' as const),
    service: 'Caspa',
    version: VERSION,
    timestamp: new Date().toISOString(),
    readiness,
    deployment: {
      mode: process.env.NODE_ENV === 'development' ? 'development' : 'production',
      port: Number(process.env.PORT) || 3000,
      publicUiPresent,
      authEnabled: true,
      localGuestAllowed: true,
    },
    aiProviders: {
      geminiConfigured,
      openaiConfigured,
      anthropicConfigured,
      grokConfigured,
      veniceConfigured,
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
      storyBible: true,
      bookDesignStudio: true,
      quickWrite: true,
      plotHold: true,
    },
    jobs: {
      inMemoryQueue: false,
      persisted: jobStorePresent(),
      ...getJobAudit(),
    },
    storage: {
      localJsonDb: true,
      usingDefaultDataDir,
      backupsPresent: backupsPresent(),
      backupCount: listBackups().length,
    },
  };
}
