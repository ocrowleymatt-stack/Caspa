import fs from 'fs/promises';
import path from 'path';
import { config, logger } from '../../shared/index';

const DROPBOX_CONTENT_BASE = 'https://content.dropboxapi.com/2';
const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2';
const REMOTE_BACKUP_DIR = '/caspa-studio/backups';

export class DropboxSync {
  private static readonly NOT_CONFIGURED =
    'Dropbox not configured. Set DROPBOX_TOKEN environment variable.';

  isConfigured(): boolean {
    return Boolean(config.dropboxToken);
  }

  private requireToken(): string {
    if (!config.dropboxToken) {
      throw new Error(DropboxSync.NOT_CONFIGURED);
    }

    return config.dropboxToken;
  }

  async syncToDropbox(localPath: string, remotePath: string): Promise<void> {
    const token = this.requireToken();
    const fileBuffer = await fs.readFile(localPath);
    const normalizedRemote = remotePath.startsWith('/')
      ? remotePath
      : `/${remotePath}`;

    const response = await fetch(`${DROPBOX_CONTENT_BASE}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: normalizedRemote,
          mode: 'overwrite',
          autorename: false,
          mute: false,
        }),
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dropbox upload failed: ${errorText}`);
    }

    logger.info(`Uploaded ${localPath} to Dropbox ${normalizedRemote}`);
  }

  async syncFromDropbox(remotePath: string, localPath: string): Promise<void> {
    const token = this.requireToken();
    const normalizedRemote = remotePath.startsWith('/')
      ? remotePath
      : `/${remotePath}`;

    const response = await fetch(`${DROPBOX_CONTENT_BASE}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: normalizedRemote }),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dropbox download failed: ${errorText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, buffer);

    logger.info(`Downloaded Dropbox ${normalizedRemote} to ${localPath}`);
  }

  async listRemoteBackups(): Promise<{ name: string; size: number }[]> {
    const token = this.requireToken();

    const response = await fetch(`${DROPBOX_API_BASE}/files/list_folder`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: REMOTE_BACKUP_DIR,
        recursive: false,
        include_deleted: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dropbox list failed: ${errorText}`);
    }

    const payload = (await response.json()) as {
      entries: Array<{
        '.tag': string;
        name: string;
        size?: number;
      }>;
    };

    return payload.entries
      .filter((entry) => entry['.tag'] === 'file' && entry.name.endsWith('.zip'))
      .map((entry) => ({
        name: entry.name,
        size: entry.size ?? 0,
      }))
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  getRemoteBackupDir(): string {
    return REMOTE_BACKUP_DIR;
  }
}
