import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = 3016;
const DEPLOY_PATH = '/__atlas_mountain_deploy/v1';
const HEALTH_PATH = '/health';
const MAX_BODY = 20 * 1024 * 1024;
const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
const AUDIENCE = 'atlas-mountain-deploy';
const REPOSITORY = 'ocrowleymatt-stack/atlas-mountain';
const REPOSITORY_ID = '1343069841';
const OWNER_ID = '274130919';
const REF = 'refs/heads/main';
const WORKFLOW_REF = 'ocrowleymatt-stack/atlas-mountain/.github/workflows/deploy-hetzner.yml@refs/heads/main';
const WORKFLOW_NAME = 'Deploy Atlas Mountain to Hetzner';
const USED_JTI_FILE = '/root/AtlasMountainDeploy/used-jti.json';
const INBOX = '/root/AtlasMountainDeploy/inbox';

let jwksCache = { expires: 0, keys: [] };

function b64urlToBuffer(value) {
  let text = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  while (text.length % 4) text += '=';
  return Buffer.from(text, 'base64');
}

function parsePart(value) {
  return JSON.parse(b64urlToBuffer(value).toString('utf8'));
}

async function getJwks() {
  const now = Date.now();
  if (jwksCache.expires > now && jwksCache.keys.length) return jwksCache.keys;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(JWKS_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AtlasMountainDeploy/1.0' },
    });
    if (!response.ok) throw new Error(`jwks_http_${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.keys) || data.keys.length === 0) throw new Error('jwks_empty');
    jwksCache = { expires: now + 10 * 60 * 1000, keys: data.keys };
    return data.keys;
  } finally {
    clearTimeout(timer);
  }
}

function audienceMatches(audience) {
  return audience === AUDIENCE || (Array.isArray(audience) && audience.includes(AUDIENCE));
}

async function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('jwt_shape');
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = parsePart(headerPart);
  const claims = parsePart(payloadPart);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('jwt_header');
  const keys = await getJwks();
  const jwk = keys.find((candidate) => candidate.kid === header.kid && candidate.kty === 'RSA');
  if (!jwk) throw new Error('jwt_kid');
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${headerPart}.${payloadPart}`),
    key,
    b64urlToBuffer(signaturePart),
  );
  if (!valid) throw new Error('jwt_signature');

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISSUER) throw new Error('claim_iss');
  if (!audienceMatches(claims.aud)) throw new Error('claim_aud');
  if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) < now - 15) throw new Error('claim_exp');
  if (Number.isFinite(Number(claims.nbf)) && Number(claims.nbf) > now + 30) throw new Error('claim_nbf');
  if (!Number.isFinite(Number(claims.iat)) || Number(claims.iat) > now + 30) throw new Error('claim_iat');
  if (claims.repository !== REPOSITORY) throw new Error('claim_repository');
  if (String(claims.repository_id) !== REPOSITORY_ID) throw new Error('claim_repository_id');
  if (String(claims.repository_owner_id) !== OWNER_ID) throw new Error('claim_owner_id');
  if (claims.repository_visibility !== 'private') throw new Error('claim_visibility');
  if (claims.ref !== REF || claims.ref_type !== 'branch') throw new Error('claim_ref');
  if (claims.workflow_ref !== WORKFLOW_REF) throw new Error('claim_workflow_ref');
  if (claims.workflow !== WORKFLOW_NAME) throw new Error('claim_workflow');
  if (!['push', 'workflow_dispatch'].includes(claims.event_name)) throw new Error('claim_event');
  if (!String(claims.sub || '').includes('atlas-mountain')) throw new Error('claim_sub');
  if (!/^[0-9a-f]{40}$/i.test(String(claims.sha || ''))) throw new Error('claim_sha');
  if (!claims.jti || String(claims.jti).length < 16) throw new Error('claim_jti');
  return claims;
}

function consumeJti(jti, exp) {
  const now = Math.floor(Date.now() / 1000);
  let rows = [];
  try { rows = JSON.parse(fs.readFileSync(USED_JTI_FILE, 'utf8')); } catch {}
  if (!Array.isArray(rows)) rows = [];
  rows = rows.filter((row) => row && Number(row.exp) > now);
  if (rows.some((row) => row.jti === jti)) throw new Error('jwt_replay');
  rows.push({ jti, exp: Number(exp) });
  fs.writeFileSync(USED_JTI_FILE, JSON.stringify(rows), { mode: 0o600 });
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function send(response, status, data) {
  const body = Buffer.from(JSON.stringify(data));
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': String(body.length),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

async function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body_too_large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

fs.mkdirSync(INBOX, { recursive: true, mode: 0o700 });

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === HEALTH_PATH) {
      return send(response, 200, { ok: true, service: 'AtlasMountainDeployReceiver', version: '1.0.0' });
    }
    if (request.url !== DEPLOY_PATH) return send(response, 404, { ok: false, error: 'not_found' });
    if (request.method !== 'POST') return send(response, 405, { ok: false, error: 'method_not_allowed' });
    if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return send(response, 415, { ok: false, error: 'content_type' });
    }

    const authorization = String(request.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) return send(response, 401, { ok: false, error: 'missing_bearer' });
    const claims = await verifyToken(authorization.slice(7));
    consumeJti(String(claims.jti), Number(claims.exp));

    const raw = await readBody(request);
    const payload = JSON.parse(raw.toString('utf8'));
    const commitSha = String(payload.sha || '');
    if (commitSha !== String(claims.sha)) throw new Error('payload_sha_mismatch');
    if (!/^[0-9a-f]{40}$/i.test(commitSha)) throw new Error('payload_sha');

    const archive = Buffer.from(String(payload.archiveB64 || ''), 'base64');
    if (!archive.length || archive.length > 14 * 1024 * 1024) throw new Error('archive_size');
    const expectedHash = String(payload.archiveSha256 || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(expectedHash) || sha256(archive) !== expectedHash) throw new Error('archive_hash');

    const archivePath = path.join(INBOX, `${commitSha}.tgz`);
    fs.writeFileSync(archivePath, archive, { mode: 0o600 });
    const processResult = spawnSync('/root/AtlasMountainDeploy/deploy.sh', [commitSha, archivePath], {
      encoding: 'utf8',
      timeout: 480000,
      maxBuffer: 4 * 1024 * 1024,
      env: { PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
    });
    const stdout = String(processResult.stdout || '');
    const stderr = String(processResult.stderr || '');
    if (processResult.error) throw new Error(`deploy_spawn:${processResult.error.message}`);
    if (processResult.status !== 0) {
      return send(response, 500, {
        ok: false,
        error: 'deploy_failed',
        status: processResult.status,
        stdout: stdout.slice(-16000),
        stderr: stderr.slice(-16000),
      });
    }
    return send(response, 200, {
      ok: true,
      deployedSha: commitSha,
      runId: String(claims.run_id || ''),
      stdout: stdout.slice(-16000),
    });
  } catch (error) {
    console.error(new Date().toISOString(), error?.stack || error);
    const message = String(error?.message || 'request_failed');
    const authFailure = message.startsWith('jwt_') || message.startsWith('claim_');
    return send(response, authFailure ? 401 : 400, { ok: false, error: message });
  }
});

server.headersTimeout = 10000;
server.requestTimeout = 540000;
server.listen(PORT, HOST, () => console.log(`Atlas Mountain deploy receiver listening on ${HOST}:${PORT}`));
