/**
 * Fail-closed nginx identity policy.
 * Client-supplied identity headers must be stripped. Fallback Caspa identity
 * headers must never be forwarded. Variables derived from $http_ / $arg_ /
 * $cookie_ are not trusted even if they are later renamed.
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

export const FALLBACK_IDENTITY_HEADERS = [
  'x-caspa-user-id',
  'x-caspa-user-email',
  'x-caspa-user-name',
  'x-caspa-user-groups',
] as const;

const TRUSTED_UID_VARS = new Set([
  '$authentik_uid',
  '$ak_uid',
  '$upstream_http_x_authentik_uid',
]);

const TRUSTED_SECRET_VARS = new Set([
  '$caspa_proxy_secret',
  '$upstream_http_x_caspa_proxy_secret',
]);

const TRUSTED_OPTIONAL_VARS: Record<string, Set<string>> = {
  'x-authentik-email': new Set(['$authentik_email', '$ak_email', '$upstream_http_x_authentik_email']),
  'x-authentik-name': new Set(['$authentik_name', '$ak_name', '$upstream_http_x_authentik_name']),
  'x-authentik-username': new Set(['$authentik_username', '$ak_username', '$upstream_http_x_authentik_username']),
  'x-authentik-groups': new Set(['$authentik_groups', '$ak_groups', '$upstream_http_x_authentik_groups']),
};

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

function extractVars(value: string): string[] {
  return (value.match(/\$[A-Za-z0-9_]+/g) || []).map((item) => item.toLowerCase());
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
  return cleared;
}

function collectAssignments(text: string): Map<string, string[]> {
  const assigns = new Map<string, string[]>();
  const add = (name: string, value: string) => {
    const key = name.startsWith('$') ? name.toLowerCase() : `$${name.toLowerCase()}`;
    const list = assigns.get(key) || [];
    list.push(value);
    assigns.set(key, list);
  };
  const setPattern = /(?:^|[;\s{])(?:set|auth_request_set)\s+(\$[A-Za-z0-9_]+)\s+([^;]+);/gi;
  let match: RegExpExecArray | null;
  while ((match = setPattern.exec(text))) {
    add(match[1], match[2].trim());
  }
  const mapPattern = /map\s+(\S+)\s+(\$[A-Za-z0-9_]+)\s*\{/gi;
  while ((match = mapPattern.exec(text))) {
    add(match[2], match[1].trim());
  }
  return assigns;
}

function taintedVariables(assigns: Map<string, string[]>): Set<string> {
  const tainted = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, values] of assigns) {
      if (tainted.has(name)) continue;
      if (values.some((value) => isClientSourced(value) || extractVars(value).some((item) => tainted.has(item)))) {
        tainted.add(name);
        changed = true;
      }
    }
  }
  return tainted;
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

function allowedVarsFor(header: string): Set<string> | null {
  const key = headerKey(header);
  if (key === 'x-authentik-uid') return TRUSTED_UID_VARS;
  if (key === 'x-caspa-proxy-secret') return TRUSTED_SECRET_VARS;
  return TRUSTED_OPTIONAL_VARS[key] || null;
}

function isTrustedIdentityValue(header: string, value: string, tainted: Set<string>): boolean {
  const trimmed = value.trim();
  if (!trimmed || isEmptyAssignment(trimmed) || isClientSourced(trimmed)) return false;
  const vars = extractVars(trimmed);
  if (!vars.length || vars.some((item) => tainted.has(item))) return false;
  const allowed = allowedVarsFor(header);
  if (!allowed) return false;
  return vars.length === 1 && allowed.has(vars[0]);
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
  const tainted = taintedVariables(collectAssignments(body));
  const trustedInject = new Set<string>();
  const emptied = new Set<string>();

  for (const entry of headers) {
    if (!isIdentityHeader(entry.header)) continue;
    const key = headerKey(entry.header);
    if (isClientSourced(entry.value) || extractVars(entry.value).some((item) => tainted.has(item))) {
      errors.push(`${entry.header} forwards a client-supplied or client-derived variable (${entry.value})`);
      continue;
    }
    if (isEmptyAssignment(entry.value)) {
      emptied.add(key);
      continue;
    }
    if ((FALLBACK_IDENTITY_HEADERS as readonly string[]).includes(key)) {
      errors.push(`${entry.header} is a fallback identity header and must be cleared, not injected`);
      continue;
    }
    if (isTrustedIdentityValue(entry.header, entry.value, tainted)) {
      trustedInject.add(key);
      continue;
    }
    errors.push(`${entry.header} must be cleared or set from a trusted Authentik/Caspa variable, not ${entry.value}`);
  }

  for (const header of IDENTITY_HEADERS) {
    if (!(emptied.has(header) || cleared.has(header))) {
      errors.push(`client-supplied ${header} must be stripped before inject`);
    }
  }
  if (!trustedInject.has('x-authentik-uid')) {
    errors.push('X-Authentik-Uid must be injected from a trusted Authentik/upstream variable');
  }
  if (!trustedInject.has('x-caspa-proxy-secret')) {
    errors.push('X-Caspa-Proxy-Secret must be injected from a trusted Caspa/upstream variable');
  }
  if (trustedInject.has('x-authentik-uid')) notes.push('X-Authentik-Uid is stripped then injected from a trusted source');
  if (trustedInject.has('x-caspa-proxy-secret')) notes.push('X-Caspa-Proxy-Secret is stripped then injected from a trusted source');

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
