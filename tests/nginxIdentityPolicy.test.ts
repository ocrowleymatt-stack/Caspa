import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { evaluateNginxIdentityConfig } from '../src/services/nginxIdentityPolicy';

const fixtures = path.join(process.cwd(), 'tests', 'fixtures', 'nginx');

test('safe nginx identity config is approved', () => {
  const result = evaluateNginxIdentityConfig(fs.readFileSync(path.join(fixtures, 'safe.conf'), 'utf8'));
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('nginx configs that echo client identity headers are rejected', () => {
  const result = evaluateNginxIdentityConfig(fs.readFileSync(path.join(fixtures, 'client-header.conf'), 'utf8'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /client-supplied|http_x_authentik_uid/i);
});

test('nginx configs that proxy off loopback are rejected', () => {
  const result = evaluateNginxIdentityConfig(fs.readFileSync(path.join(fixtures, 'public-pass.conf'), 'utf8'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /loopback:3000|10\.1\.2\.3/);
});

test('combined gateway configs audit only the Caspa server block', () => {
  const otherService = `server { server_name atlas.example.test; location / { proxy_pass http://127.0.0.1:9999; } }`;
  const caspa = fs.readFileSync(path.join(fixtures, 'safe.conf'), 'utf8');
  const result = evaluateNginxIdentityConfig(`${otherService}\n${caspa}`);
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('empty or missing nginx identity config is rejected', () => {
  const empty = evaluateNginxIdentityConfig('');
  assert.equal(empty.ok, false);
});

test('nginx configs that leave X-Caspa-User-Id uncleared are rejected', () => {
  const result = evaluateNginxIdentityConfig(fs.readFileSync(path.join(fixtures, 'fallback-id.conf'), 'utf8'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /x-caspa-user-id/i);
});

test('nginx configs that rename client identity variables are rejected', () => {
  const result = evaluateNginxIdentityConfig(fs.readFileSync(path.join(fixtures, 'derived-client.conf'), 'utf8'));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /client-derived|client-supplied|authentik_uid/i);
});

test('verify-nginx-identity.sh fails closed on a client-header fixture', () => {
  const script = path.join(process.cwd(), 'scripts', 'verify-nginx-identity.sh');
  const unsafe = spawnSync('bash', [script], {
    env: { ...process.env, VERIFY_NGINX_CONF: path.join(fixtures, 'client-header.conf') },
    encoding: 'utf8',
  });
  assert.notEqual(unsafe.status, 0);
  assert.match(`${unsafe.stdout}\n${unsafe.stderr}`, /FAIL|client-supplied|http_x_authentik/i);

  const safe = spawnSync('bash', [script], {
    env: { ...process.env, VERIFY_NGINX_CONF: path.join(fixtures, 'safe.conf') },
    encoding: 'utf8',
  });
  assert.equal(safe.status, 0, `${safe.stdout}\n${safe.stderr}`);
});
