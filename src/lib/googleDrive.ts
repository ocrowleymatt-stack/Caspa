import { getCachedAccessToken } from './firebase';
import { Project } from '../types';

export interface DriveBackupFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface BackupPayload {
  project: Project;
  chapters: any[];
  characters: any[];
  plotNodes: any[];
  research: any[];
  sourceMaterials: any[];
  externalReviews: any[];
  backupDate: string;
}

/**
 * Helper to get the access token from memory cache. Urgently throws if not connected.
 */
function getRequiredToken(): string {
  const token = getCachedAccessToken();
  if (!token) {
    throw new Error('Google Drive access token is not available. Please authenticate.');
  }
  return token;
}

/**
 * Lists all active backup files with 'Caspa_Restore_' prefix from Google Drive.
 */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const token = getRequiredToken();
  const query = "name contains 'Caspa_Restore_' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&spaces=drive&orderBy=modifiedTime+desc`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to list Google Drive backups: ${res.statusText} (${errorText})`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Uploads (or updates) a manuscript backup JSON file on Google Drive.
 */
export async function uploadDriveBackup(projectTitle: string, projectId: string, payload: BackupPayload): Promise<any> {
  const token = getRequiredToken();
  const cleanTitle = projectTitle.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Untitled';
  const targetFileName = `Caspa_Restore_${cleanTitle}.json`;

  // 1. Search if the file already exists
  const searchQuery = `name = '${targetFileName}' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id)`;

  const searchRes = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  let existingFileId: string | null = null;
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      existingFileId = searchData.files[0].id;
    }
  }

  if (existingFileId) {
    // 2a. Update content of existing file
    console.log(`Updating existing backup file ID: ${existingFileId}`);
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
    
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      throw new Error(`Failed to update existing backup: ${updateRes.statusText} (${errorText})`);
    }

    return await updateRes.json();
  } else {
    // 2b. Create new file with metadata & content via multipart upload
    console.log(`Creating new backup file: ${targetFileName}`);
    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const boundary = '3d0fbe_caspa_upload_boundary';

    const metadata = {
      name: targetFileName,
      mimeType: 'application/json',
      description: `Caspa backup for narrative project: ${projectTitle}`
    };

    const multipartBody = 
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(payload) +
      `\r\n--${boundary}--`;

    const createRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      throw new Error(`Failed to create backup file: ${createRes.statusText} (${errorText})`);
    }

    return await createRes.json();
  }
}

/**
 * Downloads and parses backup file content from Google Drive by ID.
 */
export async function downloadDriveBackup(fileId: string): Promise<any> {
  const token = getRequiredToken();
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch file content from Google Drive: ${res.statusText} (${errorText})`);
  }

  return await res.json();
}
