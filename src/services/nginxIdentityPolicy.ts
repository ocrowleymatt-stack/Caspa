/**
 * Fail-closed nginx identity policy.
 * Client-supplied $http_ / $arg_ / $cookie_ identity headers must never be forwarded.
 */
import { readFileSync } from 'node:fs';

export const IDENTITY_HEADERS = [
  'x-authentik-uid',
  'x-authentik-email',
  'x-authentik-name',
  'x-authentik-username',
  'x-authentik-groups',
  'x-caspa-user-id',
  'x-caspa-user-email',
  'x-caspa-user-name',
  'x-caspa-user-groups',
  'x-caspa-proxy-secret',
] as const;

export type NginxIdentityResult = {
  ok: boolean;
  errors: string[];
  notes: string[];
};

function stripComments(text: string): string {
  return text.split(/\r?\n/).map((line) => {
    let out = '';
    let inSingle = false;
    let inDouble = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === "'" && !inDouble) inSingle = !inSingle;
      else if (char === '"' && !inSingle) inDouble = !inDouble;
      else if (char === '#' && !inSingle && !inDouble) break;
      out += char;
    }
    return out;
  }).join('\n');
}

function headerKey(name: string): string {
  return name.trim().toLowerCase();
}

function isIdentityHeader(name: string): boolean {
  return (IDENTITY_HEADERS as readonly string[]).includes(headerKey(name));
}

function isClientSourced(value: string): boolean {
  return /\$http_|\$arg_|\$cookie_|\$sent_http_/i.test(value);
}

function isEmptyAssignment(value: string): boolean {
  return /^(""|'')$/.test(value.trim());
}

function isTrustedIdentityValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || isEmptyAssignment(trimmed) || isClientSourced(trimmed)) return false;
  return (
    /^\$authentik_[a-z0-9_]+$/i.test(trimmed)
    || /^\$ak_[a-z0-9_]+$/i.test(trimmed)
    || /^\$caspa_[a-z0-9_]+$/i.test(trimmed)
    || /^\$upstream_http_[a-z0-9_]+$/i.test(trimmed)
    || trimmed === '$remote_user'
  );
}

function isLoopbackCaspaPass(value: string): boolean {
  const raw = value.trim();
  try {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    return (host === '127.0.0.1' || host === 'localhost' || host === '::1') && port === '3000';
  } catch {
    return false;
  }
}

function collectDirectives(text: string, name: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`${name}\\s+([^;]+);`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    values.push(match[1].trim());
  }
  return values;
}

function collectSetHeaders(text: string): Array<{ header: string; value: string }> {
  const found: Array<{ header: string; value: string }> = [];
  const pattern = /proxy_set_header\s+(\S+)\s+([^;]+);/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    found.push({ header: match[1], value: match[2].trim() });
  }
  return found;
}

function collectClearedHeaders(text: string): Set<string> {
  const cleared = new Set<string>();
  for (const raw of collectDirectives(text, 'more_clear_input_headers')) {
    for (const token of raw.split(/\s+/)) {
      const name = token.replace(/^['"]|['"]$/g, '');
      if (name) cleared.add(headerKey(name));
    }
  }
  for (const raw of collectDirectives(text, 'proxy_hide_header')) {
    cleared.add(headerKey(raw.replace(/^['"]|['"]$/g, '')));
  }
  return cleared;
}

export function evaluateNginxIdentityConfig(text: string): NginxIdentityResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const body = stripComments(String(text || ''));
  if (!body.trim()) {
    return { ok: false, errors: ['nginx configuration is empty'], notes };
  }

  const proxyPasses = collectDirectives(body, 'proxy_pass');
  if (!proxyPasses.length) {
    errors.push('configuration must proxy_pass to Caspa on loopback:3000');
  }
  for (const value of proxyPasses) {
    if (!isLoopbackCaspaPass(value)) {
      errors.push(`proxy_pass ${value} is not loopback:3000`);
    }
  }
  if (proxyPasses.length && proxyPasses.every(isLoopbackCaspaPass)) {
    notes.push('proxy_pass stays on loopback:3000');
  }

  const headers = collectSetHeaders(body);
  const cleared = collectClearedHeaders(body);
  const trustedInject = new Set<string>();
  const emptied = new Set<string>();

  for (const entry of headers) {
    if (!isIdentityHeader(entry.header)) continue;
    const key = headerKey(entry.header);
    if (isClientSourced(entry.value)) {
      errors.push(`${entry.header} forwards a client-supplied variable (${entry.value})`);
      continue;
    }
    if (isEmptyAssignment(entry.value)) {
      emptied.add(key);
      continue;
    }
    if (isTrustedIdentityValue(entry.value)) {
      trustedInject.add(key);
      continue;
    }
    errors.push(`${entry.header} must be cleared or set from a trusted Authentik/Caspa variable, not ${entry.value}`);
  }

  const uidCleared = emptied.has('x-authentik-uid') || cleared.has('x-authentik-uid');
  const secretCleared = emptied.has('x-caspa-proxy-secret') || cleared.has('x-caspa-proxy-secret');
  if (!uidCleared) errors.push('client-supplied X-Authentik-Uid must be stripped before inject');
  if (!secretCleared) errors.push('client-supplied X-Caspa-Proxy-Secret must be stripped before inject');
  if (!trustedInject.has('x-authentik-uid')) {
    errors.push('X-Authentik-Uid must be injected from a trusted Authentik/upstream variable');
  }
  if (!trustedInject.has('x-caspa-proxy-secret')) {
    errors.push('X-Caspa-Proxy-Secret must be injected from a trusted Caspa/upstream variable');
  }
  if (uidCleared && trustedInject.has('x-authentik-uid')) notes.push('X-Authentik-Uid is stripped then injected from a trusted source');
  if (secretCleared && trustedInject.has('x-caspa-proxy-secret')) notes.push('X-Caspa-Proxy-Secret is stripped then injected from a trusted source');

  return { ok: errors.length === 0, errors, notes };
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && entry.includes('nginxIdentityPolicy') && process.argv[2]);
}

function main(): void {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: nginxIdentityPolicy <nginx.conf>');
    process.exit(2);
  }
  const result = evaluateNginxIdentityConfig(readFileSync(file, 'utf8'));
  if (!result.ok) {
    for (const error of result.errors) console.error(`FAIL: ${error}`);
    process.exit(1);
  }
  for (const note of result.notes) console.log(`OK: ${note}`);
}

if (isDirectRun()) main();
