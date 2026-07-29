#!/usr/bin/env node
/**
 * Write dist/build-info.json so production can expose a commit fingerprint.
 * Runs as part of `npm run build`. Safe when git is unavailable.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });

function git(cmd) {
  try {
    return execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const gitSha =
  process.env.CASPA_GIT_SHA ||
  process.env.GITHUB_SHA ||
  git('git rev-parse HEAD') ||
  'unknown';
const gitShaShort = gitSha === 'unknown' ? 'unknown' : gitSha.slice(0, 12);
const gitBranch =
  process.env.CASPA_GIT_BRANCH ||
  process.env.GITHUB_REF_NAME ||
  git('git rev-parse --abbrev-ref HEAD') ||
  'unknown';

const info = {
  service: 'Caspa',
  version: pkg.version || '1.0.0',
  gitSha,
  gitShaShort,
  gitBranch,
  builtAt: process.env.CASPA_BUILD_TIME || new Date().toISOString(),
};

const outPath = path.join(distDir, 'build-info.json');
fs.writeFileSync(outPath, `${JSON.stringify(info, null, 2)}\n`);
console.log(`[build-info] wrote ${outPath} (${info.gitShaShort} @ ${info.builtAt})`);
