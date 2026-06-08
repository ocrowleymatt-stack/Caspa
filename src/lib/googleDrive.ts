import { getCachedAccessToken } from './firebase';

export interface BackupPayload {
  project: any;
  chapters: any[];
  characters: any[];
  plotNodes: any[];
  research: any[];
  sourceMaterials: any[];
  externalReviews: any[];
  backupDate: string;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

/**
 * Lists available manuscript backups on Google Drive.
 */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const token = getCachedAccessToken();
  if (!token) throw new Error("Google Drive access token not cached. Please reconnect through identity portal.");

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name contains 'Casper_Restore_' and mimeType = 'application/json' and trashed = false&fields=files(id, name, modifiedTime, size)&orderBy=modifiedTime desc`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Failed to query Google Drive: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Downloads and parses backup file content from Google Drive.
 */
export async function downloadDriveBackup(fileId: string): Promise<BackupPayload> {
  const token = getCachedAccessToken();
  if (!token) throw new Error("Google Drive access token not cached. Please reconnect.");

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download backup: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Backs up current manuscript workspace to Google Drive.
 */
export async function uploadDriveBackup(projectName: string, projectId: string, payload: BackupPayload): Promise<string> {
  const token = getCachedAccessToken();
  if (!token) throw new Error("Google Drive access token not cached. Please reconnect through recovery settings.");

  const filename = `Casper_Restore_${projectId}.json`;
  
  // 1. Check if backup file already exists
  const listResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name = '${filename}' and trashed = false&fields=files(id)`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!listResponse.ok) {
    throw new Error(`Google Drive pre-scan failed: ${listResponse.statusText}`);
  }

  const listData = await listResponse.json();
  const existingFile = listData.files?.[0];

  let fileId = existingFile?.id;

  if (fileId) {
    // Overwrite existing content
    const updateResponse = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`Failed to overwrite backup on Google Drive: ${updateResponse.statusText}`);
    }
    
    // Also update modified time and description
    await fetch(
       `https://www.googleapis.com/drive/v3/files/${fileId}`,
       {
         method: 'PATCH',
         headers: {
           Authorization: `Bearer ${token}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           description: `Manuscript Backup: "${projectName}" [Automated Safe Guard]`
         })
       }
     );

  } else {
    // Create new file
    // Step A: Create metadata
    const createMetaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: filename,
          mimeType: 'application/json',
          description: `Manuscript Backup: "${projectName}" [Automated Safe Guard]`
        })
      }
    );

    if (!createMetaResponse.ok) {
      throw new Error(`Failed to create backup slot on Google Drive: ${createMetaResponse.statusText}`);
    }

    const metaData = await createMetaResponse.json();
    fileId = metaData.id;

    // Step B: Write content
    const writeResponse = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!writeResponse.ok) {
      throw new Error(`Failed write bytes to backup on Google Drive: ${writeResponse.statusText}`);
    }
  }

  return fileId;
}
