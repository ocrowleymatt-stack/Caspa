/**
 * User-scoped Atlas knowledge/corpus routes.
 */
import express, { type Request } from 'express';
import multer from 'multer';
import os from 'os';
import fsp from 'fs/promises';
import { createHash, randomUUID } from 'crypto';
import { verifyFirebaseIdToken } from '../services/firebaseTokenVerifier';
import {
  getKnowledgeStatus,
  ingestKnowledgeSource,
  reindexMissingEmbeddings,
  searchKnowledge,
  type KnowledgeAlias,
} from '../services/knowledgeIndexService';
import { ingestUploadedKnowledgeFile, syncCloudKnowledge } from '../services/cloudKnowledgeIngestionService';
import {
  beginCloudOAuth,
  completeCloudOAuth,
  disconnectCloudAutopilot,
  getCloudAutopilotStatus,
  runCloudConnection,
  type AutopilotProvider,
} from '../services/cloudKnowledgeAutopilotService';

const router = express.Router();
const knowledgeFileUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: Math.max(5 * 1024 * 1024, Number(process.env.KNOWLEDGE_MAX_FILE_BYTES || 350 * 1024 * 1024)) },
});

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

function parseProvider(value: unknown): AutopilotProvider | null {
  const provider = String(value || '');
  return provider === 'dropbox' || provider === 'gdrive' ? provider : null;
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


router.post('/ingest/file', knowledgeFileUpload.single('file'), async (req, res) => {
  try {
    return await withScope(req, res, async (scope) => {
      if (!req.file) return res.status(400).json({ success: false, message: 'file is required' });
      const data = await ingestUploadedKnowledgeFile(
        scope,
        req.file.path,
        req.file.originalname || 'Uploaded file',
        req.file.mimetype || 'application/octet-stream',
        String(req.body?.fileId || '') || undefined,
      );
      return res.json({ success: true, data });
    });
  } finally {
    if (req.file?.path) await fsp.rm(req.file.path, { force: true }).catch(() => {});
  }
});

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

// ── Durable per-user cloud autopilot ──────────────────────────────────────────
router.get('/cloud/status', (req, res) => withScope(req, res, (scope) => {
  res.json({ success: true, data: { connections: getCloudAutopilotStatus(scope) } });
}));

router.post('/cloud/oauth/start', (req, res) => withScope(req, res, (scope) => {
  const provider = parseProvider(req.body?.provider);
  if (!provider) return res.status(400).json({ success: false, message: 'provider must be dropbox or gdrive' });
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwarded || req.protocol || 'https';
  const origin = `${protocol}://${req.get('host')}`;
  res.json({ success: true, data: beginCloudOAuth(scope, provider, origin) });
}));

// OAuth callback is authenticated by the short-lived, high-entropy state that
// was created for an already authenticated Atlas scope. No provider token is
// ever sent back to browser JavaScript.
router.get('/cloud/oauth/callback/:provider', async (req, res) => {
  const provider = parseProvider(req.params.provider);
  const state = String(req.query.state || '');
  const code = String(req.query.code || '');
  const providerError = String(req.query.error_description || req.query.error || '');
  if (!provider) return res.status(400).send('Unknown cloud provider');
  if (providerError) {
    return res.redirect(`/?cloud=${provider}&cloud_error=${encodeURIComponent(providerError.slice(0, 300))}`);
  }
  try {
    await completeCloudOAuth(provider, state, code);
    return res.redirect(`/?cloud=${provider}&cloud_connected=1`);
  } catch (error: any) {
    console.error('[knowledge/oauth]', error?.message || error);
    return res.redirect(`/?cloud=${provider}&cloud_error=${encodeURIComponent(String(error?.message || error).slice(0, 300))}`);
  }
});

router.post('/cloud/run', (req, res) => withScope(req, res, async (scope) => {
  const provider = parseProvider(req.body?.provider);
  if (!provider) return res.status(400).json({ success: false, message: 'provider must be dropbox or gdrive' });
  const data = await runCloudConnection(scope, provider);
  res.json({
    success: true,
    data: {
      result: data,
      connections: getCloudAutopilotStatus(scope),
      status: getKnowledgeStatus(scope),
    },
  });
}));

router.delete('/cloud/:provider', (req, res) => withScope(req, res, (scope) => {
  const provider = parseProvider(req.params.provider);
  if (!provider) return res.status(400).json({ success: false, message: 'provider must be dropbox or gdrive' });
  disconnectCloudAutopilot(scope, provider);
  res.json({ success: true, data: { connections: getCloudAutopilotStatus(scope) } });
}));

// Legacy/session-token manual sync remains for compatibility with older clients.
// It is intentionally separate from the encrypted unattended OAuth connection.
router.post('/cloud/sync', (req, res) => withScope(req, res, async (scope) => {
  const provider = parseProvider(req.body?.provider);
  if (!provider) return res.status(400).json({ success: false, message: 'provider must be dropbox or gdrive' });
  const accessToken = String(req.headers['x-cloud-access-token'] || '').trim();
  if (!accessToken) return res.status(400).json({ success: false, message: 'Cloud access token is required' });
  const maxFiles = Math.max(1, Math.min(30, Number(req.body?.maxFiles || 8)));
  const data = await syncCloudKnowledge(scope, provider, accessToken, maxFiles);
  res.json({ success: true, data: { ...data, status: getKnowledgeStatus(scope) } });
}));

export default router;
