import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';

process.env.KNOWLEDGE_EMBEDDINGS = 'off';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'caspa-knowledge-test-'));
process.env.CASPA_DATA_DIR = temp;

const {
  getKnowledgeStatus,
  ingestKnowledgeSource,
  linkKnowledgeDuplicate,
  searchKnowledge,
} = await import('../src/services/knowledgeIndexService');

test('deduplicates the same content across providers and keeps it searchable', async () => {
  const scope = 'firebase:test-user';
  const text = 'The Birmingham incident includes a return to the scene and a disputed sequence of police decisions.';
  const sha = createHash('sha256').update(text).digest('hex');

  const first = await ingestKnowledgeSource(scope, {
    sha256: sha,
    alias: {
      provider: 'dropbox',
      fileId: 'id:dropbox-1',
      revision: 'rev-a',
      name: 'evidence.txt',
      path: '/Evidence/evidence.txt',
    },
    mimeType: 'text/plain',
    size: Buffer.byteLength(text),
    kind: 'text',
    units: [{ text }],
  });
  assert.equal(first.duplicate, false);

  const linked = linkKnowledgeDuplicate(scope, sha, {
    provider: 'gdrive',
    fileId: 'drive-1',
    revision: 'head-1',
    name: 'evidence copy.txt',
    webUrl: 'https://drive.google.com/example',
  });
  assert.equal(linked, true);

  const status = getKnowledgeStatus(scope);
  assert.equal(status.sources, 1);
  assert.equal(status.aliases, 2);
  assert.equal(status.duplicates, 1);
  assert.ok(status.chunks >= 1);

  const results = await searchKnowledge(scope, 'Birmingham police decisions', 5);
  assert.ok(results.length >= 1);
  assert.equal(results[0].sourceId, sha);
  assert.equal(results[0].aliases.length, 2);
});

test.after(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});
