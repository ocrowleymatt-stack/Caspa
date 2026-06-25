import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { config } from '../../shared/index';
import { StorageService } from './StorageService';
import { DropboxSync } from './DropboxSync';

const DROPBOX_NOT_CONFIGURED =
  'Dropbox not configured. Set DROPBOX_TOKEN environment variable.';

const storageService = new StorageService();
const dropboxSync = new DropboxSync();

const upload = multer({
  dest: path.join(os.tmpdir(), 'caspa-imports'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function sendSuccess(res: Response, data?: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

function sendError(res: Response, error: unknown, status = 500): void {
  const message = error instanceof Error ? error.message : String(error);
  res.status(status).json({ success: false, error: message });
}

export const storageRouter = Router();

storageRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await storageService.getStats();
    sendSuccess(res, stats);
  } catch (error) {
    sendError(res, error);
  }
});

storageRouter.get('/backups', async (_req: Request, res: Response) => {
  try {
    const backups = await storageService.listBackups();
    sendSuccess(res, backups);
  } catch (error) {
    sendError(res, error);
  }
});

storageRouter.post('/backup', async (req: Request, res: Response) => {
  try {
    const label =
      typeof req.body?.label === 'string' ? req.body.label : undefined;
    const backupPath = await storageService.backup(label);
    sendSuccess(res, { path: backupPath });
  } catch (error) {
    sendError(res, error);
  }
});

storageRouter.post('/restore', async (req: Request, res: Response) => {
  try {
    const backupName = req.body?.backupName;

    if (typeof backupName !== 'string' || backupName.trim() === '') {
      sendError(res, 'backupName is required', 400);
      return;
    }

    await storageService.restore(backupName);
    sendSuccess(res, { restored: backupName });
  } catch (error) {
    sendError(res, error);
  }
});

storageRouter.get('/export', async (_req: Request, res: Response) => {
  try {
    const exportPath = await storageService.exportDataAsJSON();
    res.download(exportPath, path.basename(exportPath), (error) => {
      if (error && !res.headersSent) {
        sendError(res, error);
      }
    });
  } catch (error) {
    sendError(res, error);
  }
});

storageRouter.post(
  '/import',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        sendError(res, 'file is required (multipart field: file)', 400);
        return;
      }

      await storageService.importDataFromJSON(req.file.path);
      await fs.unlink(req.file.path).catch(() => undefined);

      sendSuccess(res, { imported: true });
    } catch (error) {
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => undefined);
      }
      sendError(res, error);
    }
  },
);

storageRouter.get('/dropbox/status', (_req: Request, res: Response) => {
  sendSuccess(res, {
    configured: dropboxSync.isConfigured(),
    token: dropboxSync.isConfigured(),
  });
});

storageRouter.post('/dropbox/push', async (_req: Request, res: Response) => {
  try {
    if (!dropboxSync.isConfigured()) {
      sendError(res, DROPBOX_NOT_CONFIGURED, 400);
      return;
    }

    const backups = await storageService.listBackups();
    if (backups.length === 0) {
      const backupPath = await storageService.backup('dropbox');
      const remotePath = path.posix.join(
        dropboxSync.getRemoteBackupDir(),
        path.basename(backupPath),
      );
      await dropboxSync.syncToDropbox(backupPath, remotePath);
      sendSuccess(res, { path: remotePath });
      return;
    }

    const latest = backups[0];
    const localPath = path.join(config.backupDir, latest.name);
    const remotePath = path.posix.join(
      dropboxSync.getRemoteBackupDir(),
      latest.name,
    );

    await dropboxSync.syncToDropbox(localPath, remotePath);
    sendSuccess(res, { path: remotePath });
  } catch (error) {
    sendError(res, error);
  }
});

storageRouter.post('/dropbox/pull', async (_req: Request, res: Response) => {
  try {
    if (!dropboxSync.isConfigured()) {
      sendError(res, DROPBOX_NOT_CONFIGURED, 400);
      return;
    }

    const remoteBackups = await dropboxSync.listRemoteBackups();
    if (remoteBackups.length === 0) {
      sendError(res, 'No remote backups found', 404);
      return;
    }

    const latest = remoteBackups[0];
    const localPath = path.join(config.backupDir, latest.name);
    const remotePath = path.posix.join(
      dropboxSync.getRemoteBackupDir(),
      latest.name,
    );

    await dropboxSync.syncFromDropbox(remotePath, localPath);
    sendSuccess(res, { path: localPath, name: latest.name });
  } catch (error) {
    sendError(res, error);
  }
});
