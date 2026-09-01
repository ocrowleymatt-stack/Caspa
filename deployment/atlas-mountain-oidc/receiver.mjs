import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = 3016;
const DEPLOY_PATH = '/__atlas_mountain_deploy/v1';
const MUSIC_RUNTIME_PATH = '/__atlas_mountain_music_runtime/v1';
const HEALTH_PATH = '/health';
const MAX_BODY = 20 * 1024 * 1024;
const MAX_CONTROL_BODY = 64 * 1024;
const MAX_MUSIC_RUNTIME_BODY = 16 * 1024;
const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
const REPOSITORY = 'ocrowleymatt-stack/atlas-mountain';
const REPOSITORY_ID = '1343069841';
const OWNER_ID = '274130919';
const REF = 'refs/heads/main';
const USED_JTI_FILE = '/root/AtlasMountainDeploy/used-jti.json';
const INBOX = '/root/AtlasMountainDeploy/inbox';
const ARTIFACT_WORK = '/root/AtlasMountainDeploy/artifact-work';
const CONTROL_STATUS = '/root/AtlasMountainDeploy/control-status';
const DEPLOY_RUNNER = '/root/AtlasMountainDeploy/deploy-runner.sh';
const ATLAS_ENV_FILE = '/etc/atlas-mountain/atlas.env';
const DEPLOY_STATUS = '/var/lib/atlas-mountain/deployments';
const NEXUS_SERVICE = 'atlas-mountain-nexus.service';
const NEXUS_HEALTH = 'http://127.0.0.1:43101/health';
const GITHUB_API = 'https://api.github.com';

const AUTH_PROFILES = Object.freeze({
  [DEPLOY_PATH]: Object.freeze({
    audience: 'atlas-mountain-deploy',
    workflowRef: 'ocrowleymatt-stack/atlas-mountain/.github/workflows/deploy-hetzner.yml@refs/heads/main',
    workflowName: 'Deploy Atlas Mountain to Hetzner',
    eventNames: new Set(['push', 'workflow_dispatch']),
  }),
  [MUSIC_RUNTIME_PATH]: Object.freeze({
    audience: 'atlas-mountain-music-runtime',
    workflowRef: 'ocrowleymatt-stack/atlas-mountain/.github/workflows/provision-runpod-music.yml@refs/heads/main',
    workflowName: 'Provision RunPod Music ACE-Step',
    eventNames: new Set(['workflow_dispatch']),
  }),
});

let jwksCache = { expires: 0, keys: [] };
const activeArtifactDeploys = new Map();

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
      headers: { 'User-Agent': 'AtlasMountainDeploy/2.0' },
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

function audienceMatches(audience, expected) {
  return audience === expected || (Array.isArray(audience) && audience.includes(expected));
}

async function verifyToken(token, profile) {
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
  if (!audienceMatches(claims.aud, profile.audience)) throw new Error('claim_aud');
  if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) < now - 15) throw new Error('claim_exp');
  if (Number.isFinite(Number(claims.nbf)) && Number(claims.nbf) > now + 30) throw new Error('claim_nbf');
  if (!Number.isFinite(Number(claims.iat)) || Number(claims.iat) > now + 30) throw new Error('claim_iat');
  if (claims.repository !== REPOSITORY) throw new Error('claim_repository');
  if (String(claims.repository_id) !== REPOSITORY_ID) throw new Error('claim_repository_id');
  if (String(claims.repository_owner_id) !== OWNER_ID) throw new Error('claim_owner_id');
  if (claims.repository_visibility !== 'private') throw new Error('claim_visibility');
  if (claims.ref !== REF || claims.ref_type !== 'branch') throw new Error('claim_ref');
  if (claims.workflow_ref !== profile.workflowRef) throw new Error('claim_workflow_ref');
  if (claims.workflow !== profile.workflowName) throw new Error('claim_workflow');
  if (!profile.eventNames.has(claims.event_name)) throw new Error('claim_event');
  if (!String(claims.sub || '').includes('atlas-mountain')) throw new Error('claim_sub');
  if (!/^[0-9a-f]{40}$/i.test(String(claims.sha || ''))) throw new Error('claim_sha');
  if (!claims.jti || String(claims.jti).length < 16) throw new Error('claim_jti');
  if (!/^[0-9]+$/.test(String(claims.run_id || ''))) throw new Error('claim_run_id');
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

async function readBody(request, maxBody = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBody) {
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

function validatePayloadSha(payload, claims) {
  const commitSha = String(payload.sha || '').toLowerCase();
  if (commitSha !== String(claims.sha || '').toLowerCase()) throw new Error('payload_sha_mismatch');
  if (!/^[0-9a-f]{40}$/.test(commitSha)) throw new Error('payload_sha');
  return commitSha;
}

function atomicWritePreservingMetadata(target, text) {
  const directory = path.dirname(target);
  const basename = path.basename(target);
  const temporary = path.join(directory, `.${basename}.tmp-${process.pid}-${crypto.randomBytes(8).toString('hex')}`);
  const existing = fs.statSync(target);
  const mode = existing.mode & 0o777;
  const fd = fs.openSync(temporary, 'wx', mode);
  try {
    fs.writeFileSync(fd, text, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.chownSync(temporary, existing.uid, existing.gid);
  fs.chmodSync(temporary, mode);
  fs.renameSync(temporary, target);
}

function renderMusicRuntimeEnvironment(original, nativeUrl, apiKey) {
  const lines = String(original || '')
    .split(/\r?\n/)
    .filter((line) => !/^ATLAS_MUSIC_GPU_(?:NATIVE_URL|API_KEY)=/.test(line));
  while (lines.length && lines.at(-1) === '') lines.pop();
  lines.push(`ATLAS_MUSIC_GPU_NATIVE_URL=${nativeUrl}`);
  lines.push(`ATLAS_MUSIC_GPU_API_KEY=${apiKey}`);
  return `${lines.join('\n')}\n`;
}

function restartNexusAndVerify() {
  const restart = spawnSync('systemctl', ['restart', NEXUS_SERVICE], {
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 256 * 1024,
    env: { PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
  });
  if (restart.error) throw new Error(`music_runtime_restart_spawn:${restart.error.message}`);
  if (restart.status !== 0) throw new Error(`music_runtime_restart_status_${restart.status}`);

  const health = spawnSync('bash', ['-lc', `for i in $(seq 1 60); do curl -fsS --max-time 3 ${NEXUS_HEALTH} >/dev/null && exit 0; sleep 1; done; exit 1`], {
    encoding: 'utf8',
    timeout: 75000,
    maxBuffer: 64 * 1024,
    env: { PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
  });
  if (health.error) throw new Error(`music_runtime_health_spawn:${health.error.message}`);
  if (health.status !== 0) throw new Error('music_runtime_nexus_unhealthy');
}

function installMusicRuntime(payload, claims) {
  const commitSha = validatePayloadSha(payload, claims);
  const nativeUrl = String(payload.nativeUrl || '').trim();
  const apiKey = String(payload.apiKey || '').trim();
  if (!/^https:\/\/[A-Za-z0-9_-]{5,128}-8001\.proxy\.runpod\.net\/?$/.test(nativeUrl)) {
    throw new Error('music_runtime_native_url');
  }
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(apiKey)) throw new Error('music_runtime_api_key');
  if (!fs.existsSync(ATLAS_ENV_FILE)) throw new Error('music_runtime_env_missing');

  const original = fs.readFileSync(ATLAS_ENV_FILE, 'utf8');
  const updated = renderMusicRuntimeEnvironment(original, nativeUrl.replace(/\/$/, ''), apiKey);
  atomicWritePreservingMetadata(ATLAS_ENV_FILE, updated);
  try {
    restartNexusAndVerify();
  } catch (error) {
    try {
      atomicWritePreservingMetadata(ATLAS_ENV_FILE, original);
      restartNexusAndVerify();
    } catch (rollbackError) {
      console.error('music_runtime_rollback_failed', rollbackError?.message || rollbackError);
    }
    throw error;
  }

  const runId = String(claims.run_id || '');
  console.log(`${new Date().toISOString()} music_runtime_installed sha=${commitSha} run_id=${runId || 'unknown'}`);
  return {
    ok: true,
    installed: true,
    sha: commitSha,
    runId,
    nexusRestarted: true,
    keys: ['ATLAS_MUSIC_GPU_NATIVE_URL', 'ATLAS_MUSIC_GPU_API_KEY'],
  };
}

function controlPath(sha) {
  return path.join(CONTROL_STATUS, `${sha}.json`);
}

function writeControl(sha, runId, state, stage, failureReason = null) {
  fs.mkdirSync(CONTROL_STATUS, { recursive: true, mode: 0o700 });
  const target = controlPath(sha);
  let data = {};
  try { data = JSON.parse(fs.readFileSync(target, 'utf8')); } catch {}
  const now = new Date().toISOString();
  data.requestedSha = sha;
  data.runId = String(runId || data.runId || '');
  data.state = state;
  data.stage = stage;
  data.startedAt ||= now;
  if (failureReason) data.failureReason = String(failureReason).slice(0, 2000);
  if (['succeeded', 'failed', 'rolled_back'].includes(state)) data.finishedAt = now;
  const tmp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, target);
}

function readJsonFile(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function deploymentStatus(sha) {
  const deploy = readJsonFile(path.join(DEPLOY_STATUS, `${sha}.json`));
  const control = readJsonFile(controlPath(sha));
  if (deploy) return { ok: true, deploymentId: sha, ...control, ...deploy };
  if (control) return { ok: true, deploymentId: sha, ...control };
  return { ok: true, deploymentId: sha, state: activeArtifactDeploys.has(sha) ? 'running' : 'unknown' };
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AtlasMountainDeploy/2.0',
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`github_http_${response.status}`);
  return response.json();
}

async function githubBytes(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AtlasMountainDeploy/2.0',
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`github_download_http_${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 64 * 1024 * 1024) throw new Error('artifact_too_large');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 64 * 1024 * 1024) throw new Error('artifact_size');
  return bytes;
}

function extractArtifactZip(zipPath, dest) {
  const script = String.raw`
import pathlib, sys, zipfile
archive, dest = sys.argv[1:]
root = pathlib.Path(dest).resolve()
with zipfile.ZipFile(archive) as z:
    for info in z.infolist():
        target = (root / info.filename).resolve()
        if target != root and root not in target.parents:
            raise SystemExit('artifact zip traversal rejected')
    z.extractall(root)
`;
  const result = spawnSync('python3', ['-c', script, zipPath, dest], { encoding: 'utf8', timeout: 60000 });
  if (result.error || result.status !== 0) throw new Error(`artifact_extract:${result.stderr || result.error?.message || result.status}`);
}

function verifyManifestAndExtractHelper(sha, archive, manifest, helper) {
  const script = String.raw`
import hashlib, json, sys, tarfile
sha, archive, manifest_path, helper = sys.argv[1:]
m = json.load(open(manifest_path, encoding='utf-8'))
requested = str(m.get('requestedSha') or m.get('sha') or '').lower()
if requested != sha.lower(): raise SystemExit('manifest sha mismatch')
h = hashlib.sha256()
with open(archive,'rb') as f:
    for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
if h.hexdigest() != str(m.get('archiveSha256') or '').lower(): raise SystemExit('archive hash mismatch')
with tarfile.open(archive, 'r:gz') as tf:
    names = {n.lstrip('./'): n for n in tf.getnames()}
    key = 'deploy/hetzner/atlas-mountain-deploy.sh'
    if key not in names: raise SystemExit('canonical deploy helper missing')
    src = tf.extractfile(names[key])
    if src is None: raise SystemExit('canonical deploy helper unreadable')
    data = src.read()
open(helper, 'wb').write(data)
`;
  const result = spawnSync('python3', ['-c', script, sha, archive, manifest, helper], { encoding: 'utf8', timeout: 60000 });
  if (result.error || result.status !== 0) throw new Error(`artifact_verify:${result.stderr || result.error?.message || result.status}`);
  fs.chmodSync(helper, 0o700);
}

async function runArtifactDeployment({ sha, runId, artifactName, githubToken }) {
  const jobRoot = path.join(ARTIFACT_WORK, sha, String(runId));
  try {
    fs.rmSync(jobRoot, { recursive: true, force: true });
    fs.mkdirSync(jobRoot, { recursive: true, mode: 0o700 });
    writeControl(sha, runId, 'running', 'artifact_lookup');

    const listing = await githubJson(`${GITHUB_API}/repos/${REPOSITORY}/actions/runs/${runId}/artifacts?per_page=100`, githubToken);
    const matches = (listing.artifacts || []).filter((item) => item?.name === artifactName && !item?.expired);
    if (matches.length !== 1) throw new Error('artifact_not_unique');
    const artifact = matches[0];
    if (String(artifact?.workflow_run?.head_sha || '').toLowerCase() !== sha) throw new Error('artifact_sha_mismatch');

    writeControl(sha, runId, 'running', 'artifact_download');
    const bytes = await githubBytes(artifact.archive_download_url, githubToken);
    githubToken = '';
    const zipPath = path.join(jobRoot, 'artifact.zip');
    fs.writeFileSync(zipPath, bytes, { mode: 0o600 });

    const releaseDir = path.join(jobRoot, 'release');
    fs.mkdirSync(releaseDir, { recursive: true, mode: 0o700 });
    extractArtifactZip(zipPath, releaseDir);
    const archive = path.join(releaseDir, `atlas-mountain-${sha}.tgz`);
    const manifest = path.join(releaseDir, 'manifest.json');
    if (!fs.existsSync(archive) || !fs.existsSync(manifest)) throw new Error('artifact_release_missing');

    writeControl(sha, runId, 'running', 'artifact_verify');
    const helper = path.join(jobRoot, 'atlas-mountain-deploy');
    verifyManifestAndExtractHelper(sha, archive, manifest, helper);

    writeControl(sha, runId, 'running', 'host_local_deploy');
    const logPath = path.join('/root/AtlasMountainDeploy/logs', `${sha}.artifact.log`);
    fs.mkdirSync(path.dirname(logPath), { recursive: true, mode: 0o700 });
    const fd = fs.openSync(logPath, 'a', 0o600);
    const child = spawn(helper, [sha, archive], {
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        ATLAS_DEPLOY_WORKSPACE_PREFIX: ARTIFACT_WORK,
      },
      stdio: ['ignore', fd, fd],
    });
    const status = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code) => resolve(Number(code ?? 1)));
    });
    fs.closeSync(fd);
    if (status !== 0) throw new Error(`host_local_deploy_status_${status}`);

    const final = readJsonFile(path.join(DEPLOY_STATUS, `${sha}.json`));
    if (!final || final.state !== 'succeeded' || String(final.deployedSha || '').toLowerCase() !== sha) {
      throw new Error('deploy_status_not_succeeded');
    }
    writeControl(sha, runId, 'succeeded', 'succeeded');
    console.log(`${new Date().toISOString()} artifact_deploy_success sha=${sha} run_id=${runId}`);
  } catch (error) {
    githubToken = '';
    writeControl(sha, runId, 'failed', 'failed', error?.message || error);
    console.error(`${new Date().toISOString()} artifact_deploy_failed sha=${sha} run_id=${runId}`, error?.stack || error);
  } finally {
    activeArtifactDeploys.delete(sha);
  }
}

fs.mkdirSync(INBOX, { recursive: true, mode: 0o700 });
fs.mkdirSync(ARTIFACT_WORK, { recursive: true, mode: 0o700 });
fs.mkdirSync(CONTROL_STATUS, { recursive: true, mode: 0o700 });

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === HEALTH_PATH) {
      return send(response, 200, { ok: true, service: 'AtlasMountainDeployReceiver', version: '2.0.0', artifactControl: true });
    }

    const profile = AUTH_PROFILES[request.url];
    if (!profile) return send(response, 404, { ok: false, error: 'not_found' });
    if (request.method !== 'POST') return send(response, 405, { ok: false, error: 'method_not_allowed' });
    if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return send(response, 415, { ok: false, error: 'content_type' });
    }

    const authorization = String(request.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) return send(response, 401, { ok: false, error: 'missing_bearer' });
    const claims = await verifyToken(authorization.slice(7), profile);

    const raw = await readBody(request, request.url === MUSIC_RUNTIME_PATH ? MAX_MUSIC_RUNTIME_BODY : MAX_BODY);
    const payload = JSON.parse(raw.toString('utf8'));

    if (request.url === MUSIC_RUNTIME_PATH) {
      consumeJti(String(claims.jti), Number(claims.exp));
      return send(response, 200, installMusicRuntime(payload, claims));
    }

    const commitSha = validatePayloadSha(payload, claims);
    const action = String(payload.action || (payload.archiveB64 ? 'legacy' : 'trigger'));

    if (action === 'status') {
      return send(response, 200, deploymentStatus(commitSha));
    }

    consumeJti(String(claims.jti), Number(claims.exp));

    if (action === 'trigger') {
      const artifactName = String(payload.artifactName || '');
      const githubToken = String(payload.githubToken || '');
      const runId = String(claims.run_id || '');
      if (artifactName !== `atlas-production-${commitSha}`) throw new Error('artifact_name');
      if (githubToken.length < 20 || githubToken.length > 512) throw new Error('github_token_shape');
      if (activeArtifactDeploys.has(commitSha)) {
        return send(response, 202, { ok: true, deploymentId: commitSha, state: 'running', runId });
      }
      writeControl(commitSha, runId, 'queued', 'queued');
      const promise = runArtifactDeployment({ sha: commitSha, runId, artifactName, githubToken });
      activeArtifactDeploys.set(commitSha, promise);
      void promise;
      return send(response, 202, { ok: true, deploymentId: commitSha, state: 'queued', runId });
    }

    if (action !== 'legacy') throw new Error('deploy_action');
    const archive = Buffer.from(String(payload.archiveB64 || ''), 'base64');
    if (!archive.length || archive.length > 14 * 1024 * 1024) throw new Error('archive_size');
    const expectedHash = String(payload.archiveSha256 || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(expectedHash) || sha256(archive) !== expectedHash) throw new Error('archive_hash');

    const runId = String(claims.run_id || '');
    const archivePath = path.join(INBOX, `${commitSha}.tgz`);
    fs.writeFileSync(archivePath, archive, { mode: 0o600 });
    console.log(`${new Date().toISOString()} deploy_start sha=${commitSha} run_id=${runId || 'unknown'}`);
    const processResult = spawnSync(DEPLOY_RUNNER, [commitSha, archivePath, runId], {
      encoding: 'utf8',
      timeout: 480000,
      maxBuffer: 4 * 1024 * 1024,
      env: { PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
    });
    const stdout = String(processResult.stdout || '');
    const stderr = String(processResult.stderr || '');
    if (processResult.error) throw new Error(`deploy_spawn:${processResult.error.message}`);
    if (processResult.status === 75) {
      console.warn(`${new Date().toISOString()} deploy_busy sha=${commitSha} run_id=${runId || 'unknown'}`);
      return send(response, 409, { ok: false, error: 'deploy_busy', deployedSha: commitSha, runId });
    }
    if (processResult.status !== 0) {
      console.error(`${new Date().toISOString()} deploy_failed sha=${commitSha} run_id=${runId || 'unknown'} status=${processResult.status}`);
      return send(response, 500, {
        ok: false,
        error: 'deploy_failed',
        status: processResult.status,
        stdout: stdout.slice(-16000),
        stderr: stderr.slice(-16000),
      });
    }
    console.log(`${new Date().toISOString()} deploy_success sha=${commitSha} run_id=${runId || 'unknown'}`);
    return send(response, 200, { ok: true, deployedSha: commitSha, runId, stdout: stdout.slice(-16000) });
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
