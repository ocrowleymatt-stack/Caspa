/**
 * Caspa local-first storage — backup, list, restore (JSON on disk)
 */

import express from 'express';
import {
  createBackup,
  deleteBackup,
  listBackups,
  loadBackup,
} from '../services/localBackupService';

const router = express.Router();

router.get('/backups', (_req, res) => {
  res.json({ success: true, data: { backups: listBackups() } });
});

router.post('/backup', (req, res) => {
  const { entries, label } = req.body as {
    entries?: Record<string, string>;
    label?: string;
  };

  if (!entries || typeof entries !== 'object') {
    return res.status(400).json({ success: false, message: 'entries object is required' });
  }

  const caspaEntries: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (key.startsWith('caspa.') && typeof value === 'string') {
      caspaEntries[key] = value;
    }
  }

  if (!Object.keys(caspaEntries).length) {
    return res.status(400).json({ success: false, message: 'No caspa.* keys in entries' });
  }

  const meta = createBackup(caspaEntries, label);
  res.json({ success: true, data: meta });
});

router.get('/restore/:id', (req, res) => {
  const snapshot = loadBackup(req.params.id);
  if (!snapshot) {
    return res.status(404).json({ success: false, message: 'Backup not found' });
  }
  res.json({ success: true, data: { meta: snapshot.meta, entries: snapshot.entries } });
});

router.delete('/backups/:id', (req, res) => {
  const ok = deleteBackup(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: 'Backup not found' });
  res.json({ success: true, data: { deleted: req.params.id } });
});

export default router;
