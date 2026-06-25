import fs from 'fs';
import path from 'path';
import type { CASPAConfig } from './types';

function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const LOG_LEVELS: CASPAConfig['logLevel'][] = ['debug', 'info', 'warn', 'error'];

function parsePort(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseLogLevel(value: string | undefined): CASPAConfig['logLevel'] {
  if (value && LOG_LEVELS.includes(value as CASPAConfig['logLevel'])) {
    return value as CASPAConfig['logLevel'];
  }

  return 'info';
}

function parseAuthEnabled(value: string | undefined): boolean {
  if (value === undefined || value === '') {
    return false;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

function parseJwtExpiresIn(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 60 * 60 * 24 * 7;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 60 * 60 * 24 * 7 : parsed;
}

export function getConfig(): CASPAConfig {
  return {
    port: parsePort(process.env.PORT, 3000),
    dataDir: process.env.DATA_DIR ?? './data',
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'mistral:latest',
    geminiApiKey: process.env.GEMINI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    grokApiKey: process.env.GROK_API_KEY,
    dropboxToken: process.env.DROPBOX_TOKEN,
    backupDir: process.env.BACKUP_DIR ?? './backups',
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    authEnabled: parseAuthEnabled(process.env.AUTH_ENABLED),
    authSecret: process.env.AUTH_SECRET ?? 'change-me-in-production',
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
    jwtExpiresIn: parseJwtExpiresIn(process.env.JWT_EXPIRES_IN),
  };
}

export const config: CASPAConfig = getConfig();
