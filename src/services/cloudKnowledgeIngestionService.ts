/**
 * Cloud corpus ingestion.
 *
 * Provider originals are streamed to a temporary directory only. Atlas retains
 * extracted/transcribed text, chunks, embeddings and provider provenance; the
 * original audio/video/document remains in Dropbox or Google Drive.
 */
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { spawnSync } from 'child_process';
import JSZip from 'jszip';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import {
  type KnowledgeAlias,
  type KnowledgeProvider,
  type KnowledgeUnit,
  getKnowledgeAliasState,
  hasKnowledgeSha,
  ingestKnowledgeSource,
  linkKnowledgeDuplicate,
  recordKnowledgeFailure,
  sha256File,
} from './knowledgeIndexService';

interface CloudFile {
  provider: 'dropbox' | 'gdrive';
  fileId: string;
  name: string;
  path?: string;
  mimeType: string;
  size: number;
  revision: string;
  modifiedTime?: string;
  webUrl?: string;
  nativeExportMime?: string;
}

interface ExtractedContent {
  kind: 'document' | 'audio' | 'video' | 'text';
  units: KnowledgeUnit[];
}

export interface CloudSyncResult {
  provider: 'dropbox' | 'gdrive';
  discovered: number;
  eligible: number;
  unchanged: number;
  indexed: number;
  duplicates: number;
  transcribed: number;
  failed: number;
  skippedUnsupported: number;
  skippedLarge: number;
  remaining: number;
  inventoryTruncated: boolean;
  failures: Array<{ name: string; message: string }>;
}

const MAX_INVENTORY = Math.max(100, Number(process.env.KNOWLEDGE_INVENTORY_LIMIT || 25000));
const MAX_FILE_BYTES = Math.max(5 * 1024 * 1024, Number(process.env.KNOWLEDGE_MAX_FILE_BYTES || 350 * 1024 * 1024));
const TRANSCRIBE_DIRECT_LIMIT = 21 * 1024 * 1024;

function ext(name: string): string {
  return path.extname(name).toLowerCase();
}

function isMedia(file: CloudFile): boolean {
  return file.mimeType.startsWith('audio/') || file.mimeType.startsWith('video/') ||
    ['.mp3', '.m4a', '.wav', '.ogg', '.opus', '.flac', '.aac', '.mp4', '.mov', '.mkv', '.webm', '.mpeg', '.mpg'].includes(ext(file.name));
}

function isSupported(file: CloudFile): boolean {
  if (isMedia(file)) return true;
  if (file.nativeExportMime) return true;
  if (file.mimeType.startsWith('text/')) return true;
  if (['application/pdf', 'application/json', 'application/rtf', 'application/xml'].includes(file.mimeType)) return true;
  return ['.pdf', '.txt', '.md', '.markdown', '.csv', '.json', '.yaml', '.yml', '.xml', '.html', '.htm', '.rtf', '.log', '.docx'].includes(ext(file.name));
}

function aliasFor(file: CloudFile): KnowledgeAlias {
  return {
    provider: file.provider,
    fileId: file.fileId,
    revision: file.revision,
    name: file.name,
    path: file.path,
    mimeType: file.mimeType,
    size: file.size,
    modifiedTime: file.modifiedTime,
    webUrl: file.webUrl,
  };
}

async function providerJson(url: string, token: string, init: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${url.includes('dropbox') ? 'Dropbox' : 'Google Drive'} ${response.status}: ${text.slice(0, 500) || response.statusText}`);
  }
  return response.json();
}

async function listDropbox(token: string): Promise<{ files: CloudFile[]; truncated: boolean }> {
  const files: CloudFile[] = [];
  let cursor = '';
  let first = true;
  let hasMore = true;
  while (hasMore && files.length < MAX_INVENTORY) {
    const url = first
      ? 'https://api.dropboxapi.com/2/files/list_folder'
      : 'https://api.dropboxapi.com/2/files/list_folder/continue';
    const body = first
      ? { path: '', recursive: true, include_deleted: false, include_non_downloadable_files: false, limit: 2000 }
      : { cursor };
    const data = await providerJson(url, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    for (const entry of data.entries || []) {
      if (entry['.tag'] !== 'file') continue;
      const name = String(entry.name || 'Untitled');
      files.push({
        provider: 'dropbox',
        fileId: String(entry.id || entry.path_lower || entry.path_display),
        name,
        path: String(entry.path_display || entry.path_lower || ''),
        mimeType: guessMime(name),
        size: Number(entry.size || 0),
        revision: String(entry.rev || entry.content_hash || entry.server_modified || ''),
        modifiedTime: entry.server_modified || entry.client_modified,
      });
      if (files.length >= MAX_INVENTORY) break;
    }
    cursor = String(data.cursor || '');
    hasMore = Boolean(data.has_more && cursor);
    first = false;
  }
  return { files, truncated: hasMore };
}

function googleNativeExport(mimeType: string): string | undefined {
  if (mimeType === 'application/vnd.google-apps.document') return 'text/plain';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'text/csv';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'application/pdf';
  if (mimeType === 'application/vnd.google-apps.drawing') return 'application/pdf';
  return undefined;
}

async function listGoogleDrive(token: string): Promise<{ files: CloudFile[]; truncated: boolean }> {
  const files: CloudFile[] = [];
  let pageToken = '';
  let more = true;
  while (more && files.length < MAX_INVENTORY) {
    const params = new URLSearchParams({
      q: 'trashed = false',
      pageSize: '1000',
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,md5Checksum,sha256Checksum,headRevisionId,webViewLink)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await providerJson(`https://www.googleapis.com/drive/v3/files?${params}`, token, { method: 'GET' });
    for (const entry of data.files || []) {
      const mimeType = String(entry.mimeType || 'application/octet-stream');
      if (mimeType === 'application/vnd.google-apps.folder') continue;
      const exportMime = googleNativeExport(mimeType);
      if (mimeType.startsWith('application/vnd.google-apps.') && !exportMime) continue;
      const name = String(entry.name || 'Untitled');
      files.push({
        provider: 'gdrive',
        fileId: String(entry.id),
        name,
        mimeType: exportMime || mimeType,
        nativeExportMime: exportMime,
        size: Number(entry.size || 0),
        revision: String(entry.headRevisionId || entry.sha256Checksum || entry.md5Checksum || entry.modifiedTime || ''),
        modifiedTime: entry.modifiedTime,
        webUrl: entry.webViewLink,
      });
      if (files.length >= MAX_INVENTORY) break;
    }
    pageToken = String(data.nextPageToken || '');
    more = Boolean(pageToken);
  }
  return { files, truncated: more };
}

function guessMime(name: string): string {
  const extension = ext(name);
  const map: Record<string, string> = {
    '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown', '.markdown': 'text/markdown',
    '.csv': 'text/csv', '.json': 'application/json', '.yaml': 'text/yaml', '.yml': 'text/yaml',
    '.xml': 'application/xml', '.html': 'text/html', '.htm': 'text/html', '.rtf': 'application/rtf',
    '.log': 'text/plain', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.opus': 'audio/ogg',
    '.flac': 'audio/flac', '.aac': 'audio/aac', '.mp4': 'video/mp4', '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.mpeg': 'video/mpeg', '.mpg': 'video/mpeg',
  };
  return map[extension] || 'application/octet-stream';
}

function safeTempName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-160);
  return clean || 'source.bin';
}

async function streamResponseToFile(response: Response, target: string): Promise<void> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Cloud download ${response.status}: ${text.slice(0, 500) || response.statusText}`);
  }
  if (!response.body) throw new Error('Cloud download returned no body');
  await pipeline(Readable.fromWeb(response.body as any), fs.createWriteStream(target));
}

async function downloadCloudFile(file: CloudFile, token: string, tempDir: string): Promise<string> {
  const target = path.join(tempDir, safeTempName(file.name));
  let response: Response;
  if (file.provider === 'dropbox') {
    response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: file.fileId }),
      },
      signal: AbortSignal.timeout(180000),
    });
  } else if (file.nativeExportMime) {
    const params = new URLSearchParams({ mimeType: file.nativeExportMime });
    response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.fileId)}/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(180000),
    });
  } else {
    response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.fileId)}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(180000),
    });
  }
  await streamResponseToFile(response, target);
  return target;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

async function extractDocx(filePath: string): Promise<string> {
  const zip = await JSZip.loadAsync(await fsp.readFile(filePath));
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('DOCX has no word/document.xml');
  return decodeEntities(xml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim());
}

function cleanHtml(text: string): string {
  return decodeEntities(text
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n'));
}

function cleanRtf(text: string): string {
  return text
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdf(filePath: string): Promise<KnowledgeUnit[]> {
  const buffer = await fsp.readFile(filePath);
  const pages: string[] = [];
  try {
    await pdfParse(buffer, {
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
        const text = (textContent.items || []).map((item: any) => item.str || '').join(' ').replace(/\s+/g, ' ').trim();
        pages.push(text);
        return text;
      },
    } as any);
  } catch {
    const parsed = await pdfParse(buffer);
    return [{ text: parsed.text || '' }];
  }
  return pages.map((text, index) => ({ text, page: index + 1 })).filter((unit) => unit.text.trim());
}

function ffmpegAvailable(): boolean {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
}

async function transcribeOne(filePath: string, offsetMs: number): Promise<KnowledgeUnit[]> {
  const key = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is required for audio/video transcription');
  const bytes = await fsp.readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([bytes]), path.basename(filePath));
  form.append('model', process.env.KNOWLEDGE_TRANSCRIBE_MODEL || 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(240000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Transcription ${response.status}: ${text.slice(0, 800) || response.statusText}`);
  }
  const data = await response.json() as any;
  const segments = Array.isArray(data.segments) ? data.segments : [];
  if (segments.length) {
    return segments.map((segment: any) => ({
      text: String(segment.text || '').trim(),
      startMs: offsetMs + Math.round(Number(segment.start || 0) * 1000),
      endMs: offsetMs + Math.round(Number(segment.end || segment.start || 0) * 1000),
      speaker: segment.speaker ? String(segment.speaker) : undefined,
    })).filter((unit: KnowledgeUnit) => unit.text);
  }
  const text = String(data.text || '').trim();
  return text ? [{ text, startMs: offsetMs }] : [];
}

async function transcribeMedia(filePath: string, tempDir: string): Promise<KnowledgeUnit[]> {
  const stat = await fsp.stat(filePath);
  if (!ffmpegAvailable()) {
    if (stat.size > TRANSCRIBE_DIRECT_LIMIT) {
      throw new Error('ffmpeg is not installed and media is too large for a single transcription request');
    }
    return transcribeOne(filePath, 0);
  }

  const segmentDir = path.join(tempDir, 'audio-segments');
  await fsp.mkdir(segmentDir, { recursive: true });
  const outputPattern = path.join(segmentDir, 'segment-%04d.mp3');
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', filePath,
    '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k',
    '-f', 'segment', '-segment_time', '1200', '-reset_timestamps', '1', outputPattern,
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`ffmpeg extraction failed: ${(result.stderr || '').slice(0, 800)}`);

  const segments = (await fsp.readdir(segmentDir)).filter((name) => name.endsWith('.mp3')).sort();
  if (!segments.length) throw new Error('ffmpeg produced no audio segments');
  const units: KnowledgeUnit[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    units.push(...await transcribeOne(path.join(segmentDir, segments[i]), i * 1200 * 1000));
  }
  return units;
}

async function extractContent(file: CloudFile, filePath: string, tempDir: string): Promise<ExtractedContent> {
  if (isMedia(file)) {
    return {
      kind: file.mimeType.startsWith('video/') || ['.mp4', '.mov', '.mkv', '.webm', '.mpeg', '.mpg'].includes(ext(file.name)) ? 'video' : 'audio',
      units: await transcribeMedia(filePath, tempDir),
    };
  }
  const extension = ext(file.name);
  if (file.mimeType === 'application/pdf' || extension === '.pdf') {
    return { kind: 'document', units: await extractPdf(filePath) };
  }
  if (extension === '.docx' || file.mimeType.includes('wordprocessingml.document')) {
    return { kind: 'document', units: [{ text: await extractDocx(filePath) }] };
  }
  let text = await fsp.readFile(filePath, 'utf8');
  if (file.mimeType === 'text/html' || ['.html', '.htm'].includes(extension)) text = cleanHtml(text);
  if (file.mimeType === 'application/rtf' || extension === '.rtf') text = cleanRtf(text);
  return { kind: 'text', units: [{ text }] };
}

export async function syncCloudKnowledge(
  scope: string,
  provider: 'dropbox' | 'gdrive',
  accessToken: string,
  maxFiles = 8,
): Promise<CloudSyncResult> {
  if (!accessToken.trim()) throw new Error('Cloud access token is required');
  const inventory = provider === 'dropbox' ? await listDropbox(accessToken) : await listGoogleDrive(accessToken);
  const all = inventory.files;
  const supported = all.filter(isSupported);
  const result: CloudSyncResult = {
    provider,
    discovered: all.length,
    eligible: supported.length,
    unchanged: 0,
    indexed: 0,
    duplicates: 0,
    transcribed: 0,
    failed: 0,
    skippedUnsupported: all.length - supported.length,
    skippedLarge: 0,
    remaining: 0,
    inventoryTruncated: inventory.truncated,
    failures: [],
  };

  const candidates: CloudFile[] = [];
  for (const file of supported) {
    const current = getKnowledgeAliasState(scope, provider as KnowledgeProvider, file.fileId);
    if (current?.revision === file.revision) {
      result.unchanged += 1;
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      result.skippedLarge += 1;
      continue;
    }
    candidates.push(file);
  }
  candidates.sort((a, b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || '')) || a.size - b.size);

  const selected = candidates.slice(0, Math.max(1, Math.min(30, maxFiles)));
  result.remaining = Math.max(0, candidates.length - selected.length);

  for (const file of selected) {
    const alias = aliasFor(file);
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'atlas-knowledge-'));
    try {
      const localFile = await downloadCloudFile(file, accessToken, tempDir);
      const stat = await fsp.stat(localFile);
      const sha = await sha256File(localFile);

      if (hasKnowledgeSha(scope, sha) && linkKnowledgeDuplicate(scope, sha, { ...alias, size: stat.size })) {
        result.duplicates += 1;
        continue;
      }

      const extracted = await extractContent(file, localFile, tempDir);
      const ingested = await ingestKnowledgeSource(scope, {
        sha256: sha,
        alias: { ...alias, size: stat.size },
        mimeType: file.mimeType,
        size: stat.size,
        kind: extracted.kind,
        units: extracted.units,
      });
      if (ingested.duplicate) result.duplicates += 1;
      else result.indexed += 1;
      if (extracted.kind === 'audio' || extracted.kind === 'video') result.transcribed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed += 1;
      result.failures.push({ name: file.name, message: message.slice(0, 600) });
      recordKnowledgeFailure(scope, alias, message);
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
  return result;
}
