/**
 * User-scoped Atlas knowledge/corpus routes.
 */
import express, { type Request } from 'express';
import { createHash, randomUUID } from 'crypto';
import { verifyFirebaseIdToken } from '../services/firebaseTokenVerifier';
import {
  getKnowledgeStatus,
  ingestKnowledgeSource,
  reindexMissingEmbeddings,
  searchKnowledge,
  type KnowledgeAlias,
} from '../services/knowledgeIndexService';
import { syncCloudKnowledge } from '../services/cloudKnowledgeIngestionService';

const router = express.Router();

function validLocalScope(value: string): boolean {
  return /^[a-zA-Z0-9._-]{12,180}$/.test(value);
}

async function resolveScope(req: Request): Promise<string> {
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) {
    const verified = await verifyFirebaseIdToken(auth.slice(7).trim());
    return `firebase:${verified.uid}`;
  }
  const local = String(req.headers['x-caspa-local-scope'] || '').trim();
  if (validLocalScope(local)) return `local:${local}`;
  throw new Error('Authenticated Firebase token or local device scope required');
}

async function withScope(req: Request, res: express.Response, fn: (scope: string) => Promise<any> | any) {
  let scope = '';
  try {
    scope = await resolveScope(req);
  } catch (error: any) {
    return res.status(401).json({ success: false, message: error?.message || 'Unauthorized knowledge scope' });
  }
  try {
    return await fn(scope);
  } catch (error: any) {
    console.error('[knowledge]', error?.message || error);
    return res.status(500).json({ success: false, message: error?.message || 'Knowledge operation failed' });
  }
}

router.get('/status', (req, res) => withScope(req, res, (scope) => {
  res.json({ success: true, data: getKnowledgeStatus(scope) });
}));

router.post('/search', (req, res) => withScope(req, res, async (scope) => {
  const query = String(req.body?.query || req.body?.q || '').trim();
  if (!query) return res.status(400).json({ success: false, message: 'query is required' });
  const topK = Math.max(1, Math.min(50, Number(req.body?.topK || 12)));
  const results = await searchKnowledge(scope, query, topK);
  res.json({ success: true, data: { query, results, count: results.length } });
}));

router.post('/context', (req, res) => withScope(req, res, async (scope) => {
  const query = String(req.body?.query || '').trim();
  if (!query) return res.status(400).json({ success: false, message: 'query is required' });
  const maxChars = Math.max(1000, Math.min(30000, Number(req.body?.maxChars || 12000)));
  const results = await searchKnowledge(scope, query, 20);
  let used = 0;
  const selected: any[] = [];
  for (const result of results) {
    const block = `${result.sourceName}\n${result.text}`;
    if (selected.length && used + block.length > maxChars) break;
    selected.push(result);
    used += block.length;
  }
  const context = selected.map((result, index) => {
    const alias = result.aliases?.[0];
    const locator = result.page
      ? `page ${result.page}`
      : result.startMs !== undefined
        ? `${Math.floor(result.startMs / 60000)}:${String(Math.floor((result.startMs % 60000) / 1000)).padStart(2, '0')}`
        : 'file';
    return `[CORPUS ${index + 1}: ${result.sourceName} · ${alias?.provider || 'source'} · ${locator}]\n${result.text}`;
  }).join('\n\n---\n\n');
  res.json({ success: true, data: { query, context, citations: selected } });
}));

router.post('/reindex', (req, res) => withScope(req, res, async (scope) => {
  const maxChunks = Math.max(1, Math.min(5000, Number(req.body?.maxChunks || 500)));
  const data = await reindexMissingEmbeddings(scope, maxChunks);
  res.json({ success: true, data: { ...data, status: getKnowledgeStatus(scope) } });
}));

router.post('/ingest/text', (req, res) => withScope(req, res, async (scope) => {
  const text = String(req.body?.text || '');
  const name = String(req.body?.name || 'Uploaded text').slice(0, 300);
  if (!text.trim()) return res.status(400).json({ success: false, message: 'text is required' });
  const sha256 = createHash('sha256').update(text).digest('hex');
  const id = String(req.body?.fileId || `upload-${randomUUID()}`);
  const alias: KnowledgeAlias = {
    provider: 'upload',
    fileId: id,
    revision: sha256,
    name,
    mimeType: String(req.body?.mimeType || 'text/plain'),
    size: Buffer.byteLength(text),
    modifiedTime: new Date().toISOString(),
  };
  const data = await ingestKnowledgeSource(scope, {
    sha256,
    alias,
    mimeType: alias.mimeType || 'text/plain',
    size: alias.size || Buffer.byteLength(text),
    kind: 'text',
    units: [{ text }],
  });
  res.json({ success: true, data });
}));

router.post('/cloud/sync', (req, res) => withScope(req, res, async (scope) => {
  const provider = String(req.body?.provider || '');
  if (provider !== 'dropbox' && provider !== 'gdrive') {
    return res.status(400).json({ success: false, message: 'provider must be dropbox or gdrive' });
  }
  const accessToken = String(req.headers['x-cloud-access-token'] || '').trim();
  if (!accessToken) return res.status(400).json({ success: false, message: 'Cloud access token is required' });
  const maxFiles = Math.max(1, Math.min(30, Number(req.body?.maxFiles || 8)));
  const data = await syncCloudKnowledge(scope, provider, accessToken, maxFiles);
  res.json({ success: true, data: { ...data, status: getKnowledgeStatus(scope) } });
}));

export default router;
