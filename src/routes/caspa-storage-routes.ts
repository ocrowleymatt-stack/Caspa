/**
 * Caspa local-first storage — authenticated/user-scoped backup, list, restore.
 */

import express, { type Request } from 'express';
import {
  createBackup,
  deleteBackup,
  listBackups,
  loadBackup,
} from '../services/localBackupService';
import { verifyFirebaseIdToken } from '../services/firebaseTokenVerifier';

const router = express.Router();

function validLocalScope(value: string): boolean {
  return /^[a-zA-Z0-9._-]{12,180}$/.test(value);
}

async function resolveStorageScope(req: Request): Promise<string> {
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const verified = await verifyFirebaseIdToken(token);
    return `firebase:${verified.uid}`;
  }

  // Continue Locally has no Firebase identity, so isolate its server snapshots
  // to a stable, high-entropy device scope generated in this browser.
  const local = String(req.headers['x-caspa-local-scope'] || '').trim();
  if (validLocalScope(local)) return `local:${local}`;

  throw new Error('Authenticated Firebase token or local device scope required');
}

function isBackupDataKey(key: string): boolean {
  return key.startsWith('caspa.') || key.startsWith('ls_') || key === 'currentUserEmail';
}

router.get('/backups', async (req, res) => {
  try {
    const scope = await resolveStorageScope(req);
    res.json({ success: true, data: { backups: listBackups(scope) } });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error?.message || 'Unauthorized backup scope' });
  }
});

router.post('/backup', async (req, res) => {
  try {
    const scope = await resolveStorageScope(req);
    const { entries, label } = req.body as {
      entries?: Record<string, string>;
      label?: string;
    };

    if (!entries || typeof entries !== 'object') {
      return res.status(400).json({ success: false, message: 'entries object is required' });
    }

    const scopedEntries: Record<string, string> = {};
    for (const [key, value] of Object.entries(entries)) {
      if (isBackupDataKey(key) && typeof value === 'string') scopedEntries[key] = value;
    }

    if (!Object.keys(scopedEntries).length) {
      return res.status(400).json({ success: false, message: 'No Caspa workspace keys in entries' });
    }

    const meta = createBackup(scope, scopedEntries, label);
    res.json({ success: true, data: meta });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error?.message || 'Unauthorized backup scope' });
  }
});

router.get('/restore/:id', async (req, res) => {
  try {
    const scope = await resolveStorageScope(req);
    const snapshot = loadBackup(scope, req.params.id);
    if (!snapshot) return res.status(404).json({ success: false, message: 'Backup not found' });
    res.json({ success: true, data: { meta: snapshot.meta, entries: snapshot.entries } });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error?.message || 'Unauthorized backup scope' });
  }
});

router.delete('/backups/:id', async (req, res) => {
  try {
    const scope = await resolveStorageScope(req);
    const ok = deleteBackup(scope, req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Backup not found' });
    res.json({ success: true, data: { deleted: req.params.id } });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error?.message || 'Unauthorized backup scope' });
  }
});

export default router;
