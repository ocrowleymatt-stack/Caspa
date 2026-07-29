/**
 * Production build fingerprint — read from dist/build-info.json when present.
 */

import fs from 'fs';
import path from 'path';

export interface BuildInfo {
  service: string;
  version: string;
  gitSha: string;
  gitShaShort: string;
  gitBranch: string;
  builtAt: string;
  source: 'build-info' | 'env' | 'fallback';
}

let cached: BuildInfo | null = null;

function fromEnv(): Partial<BuildInfo> {
  const gitSha = (process.env.CASPA_GIT_SHA || process.env.GITHUB_SHA || '').trim();
  if (!gitSha) return {};
  return {
    gitSha,
    gitShaShort: gitSha.slice(0, 12),
    gitBranch: (process.env.CASPA_GIT_BRANCH || process.env.GITHUB_REF_NAME || '').trim() || 'unknown',
    builtAt: (process.env.CASPA_BUILD_TIME || '').trim() || undefined,
  };
}

function readBuildFile(): Partial<BuildInfo> | null {
  const candidates = [
    path.join(process.cwd(), 'dist', 'build-info.json'),
    path.join(process.cwd(), 'build-info.json'),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<BuildInfo>;
      if (raw && typeof raw === 'object') return raw;
    } catch {
      /* ignore corrupt file */
    }
  }
  return null;
}

export function getBuildInfo(): BuildInfo {
  if (cached) return cached;

  const file = readBuildFile();
  const env = fromEnv();
  const gitSha = (file?.gitSha || env.gitSha || 'unknown').trim() || 'unknown';
  const builtAt = (file?.builtAt || env.builtAt || new Date(0).toISOString()).trim();

  cached = {
    service: file?.service || 'Caspa',
    version: file?.version || process.env.npm_package_version || '1.0.0',
    gitSha,
    gitShaShort: (file?.gitShaShort || gitSha.slice(0, 12)).trim() || gitSha.slice(0, 12),
    gitBranch: (file?.gitBranch || env.gitBranch || 'unknown').trim() || 'unknown',
    builtAt,
    source: file ? 'build-info' : env.gitSha ? 'env' : 'fallback',
  };

  return cached;
}

/** Test helper — clear memoised fingerprint between runs. */
export function resetBuildInfoCache(): void {
  cached = null;
}
