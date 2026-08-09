/**
 * Atlas knowledge index — user-scoped, deduplicated derived corpus.
 *
 * Originals remain in their source provider. Atlas stores only derived text,
 * semantic chunks, embeddings and provenance. Exact content SHA-256 is the
 * canonical identity so the same file in Drive + Dropbox is indexed once.
 */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { getDataDir } from './dataPaths';

export type KnowledgeProvider = 'dropbox' | 'gdrive' | 'upload';

export interface KnowledgeAlias {
  provider: KnowledgeProvider;
  fileId: string;
  revision: string;
  name: string;
  path?: string;
  mimeType?: string;
  size?: number;
  modifiedTime?: string;
  webUrl?: string;
}

export interface KnowledgeUnit {
  text: string;
  page?: number;
  startMs?: number;
  endMs?: number;
  speaker?: string;
}

export interface KnowledgeChunk {
  id: string;
  ordinal: number;
  text: string;
  page?: number;
  startMs?: number;
  endMs?: number;
  speaker?: string;
  embedding?: number[];
}

interface KnowledgeSource {
  id: string;
  sha256: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'document' | 'audio' | 'video' | 'text';
  aliases: KnowledgeAlias[];
  chunkCount: number;
  vectorChunkCount: number;
  active: boolean;
  indexedAt: string;
  updatedAt: string;
}

interface AliasPointer {
  canonicalId: string;
  revision: string;
}

interface KnowledgeFailure {
  name: string;
  revision: string;
  message: string;
  updatedAt: string;
}

interface KnowledgeManifest {
  version: 1;
  sources: Record<string, KnowledgeSource>;
  pointers: Record<string, AliasPointer>;
  failures: Record<string, KnowledgeFailure>;
}

export interface IngestKnowledgeInput {
  sha256: string;
  alias: KnowledgeAlias;
  mimeType: string;
  size: number;
  kind: KnowledgeSource['kind'];
  units: KnowledgeUnit[];
  deferEmbeddings?: boolean;
}

const EMPTY: KnowledgeManifest = { version: 1, sources: {}, pointers: {}, failures: {} };

function hashScope(scope: string): string {
  return createHash('sha256').update(scope).digest('hex').slice(0, 32);
}

function userDir(scope: string): string {
  const dir = path.join(getDataDir(), 'knowledge', 'users', hashScope(scope));
  fs.mkdirSync(path.join(dir, 'chunks'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'text'), { recursive: true });
  return dir;
}

function manifestPath(scope: string): string {
  return path.join(userDir(scope), 'manifest.json');
}

function chunksPath(scope: string, sourceId: string): string {
  return path.join(userDir(scope), 'chunks', `${sourceId}.json`);
}

function textPath(scope: string, sourceId: string): string {
  return path.join(userDir(scope), 'text', `${sourceId}.txt`);
}

function readManifest(scope: string): KnowledgeManifest {
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath(scope), 'utf8')) as KnowledgeManifest;
    if (!parsed || parsed.version !== 1) return structuredClone(EMPTY);
    parsed.sources ||= {};
    parsed.pointers ||= {};
    parsed.failures ||= {};
    return parsed;
  } catch {
    return structuredClone(EMPTY);
  }
}

function writeManifest(scope: string, manifest: KnowledgeManifest): void {
  const target = manifestPath(scope);
  const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, JSON.stringify(manifest, null, 2), 'utf8');
  fs.renameSync(temp, target);
}

function aliasKey(provider: KnowledgeProvider, fileId: string): string {
  return `${provider}:${fileId}`;
}

function sameAlias(a: KnowledgeAlias, b: KnowledgeAlias): boolean {
  return a.provider === b.provider && a.fileId === b.fileId;
}

function detachCurrentAlias(manifest: KnowledgeManifest, alias: KnowledgeAlias): void {
  const key = aliasKey(alias.provider, alias.fileId);
  const old = manifest.pointers[key];
  if (!old) return;
  const oldSource = manifest.sources[old.canonicalId];
  if (oldSource) {
    oldSource.aliases = oldSource.aliases.filter((entry) => !sameAlias(entry, alias));
    oldSource.active = oldSource.aliases.length > 0;
    oldSource.updatedAt = new Date().toISOString();
  }
  delete manifest.pointers[key];
}

export function getKnowledgeAliasState(
  scope: string,
  provider: KnowledgeProvider,
  fileId: string,
): { canonicalId: string; revision: string } | null {
  const pointer = readManifest(scope).pointers[aliasKey(provider, fileId)];
  return pointer ? { ...pointer } : null;
}

export function hasKnowledgeSha(scope: string, sha256: string): boolean {
  const id = sha256.toLowerCase();
  return Boolean(readManifest(scope).sources[id]);
}

export function linkKnowledgeDuplicate(scope: string, sha256: string, alias: KnowledgeAlias): boolean {
  const manifest = readManifest(scope);
  const id = sha256.toLowerCase();
  const source = manifest.sources[id];
  if (!source) return false;

  detachCurrentAlias(manifest, alias);
  source.aliases = source.aliases.filter((entry) => !sameAlias(entry, alias));
  source.aliases.push(alias);
  source.active = true;
  source.updatedAt = new Date().toISOString();
  manifest.pointers[aliasKey(alias.provider, alias.fileId)] = { canonicalId: id, revision: alias.revision };
  delete manifest.failures[aliasKey(alias.provider, alias.fileId)];
  writeManifest(scope, manifest);
  return true;
}

function sentencePieces(text: string): string[] {
  const normal = text.replace(/\r\n/g, '\n').replace(/[\t ]+/g, ' ').trim();
  if (!normal) return [];
  const paragraphs = normal.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const pieces: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 2200) {
      pieces.push(paragraph);
      continue;
    }
    const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/).filter(Boolean);
    if (sentences.length <= 1) {
      for (let i = 0; i < paragraph.length; i += 1800) pieces.push(paragraph.slice(i, i + 1800));
    } else {
      pieces.push(...sentences);
    }
  }
  return pieces;
}

function chunkText(text: string, target = 1800): string[] {
  const pieces = sentencePieces(text);
  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + piece.length + 1 > target) {
      chunks.push(current.trim());
      const overlap = current.slice(-220);
      current = overlap && !overlap.includes('\n') ? `${overlap} ${piece}` : piece;
    } else {
      current = current ? `${current}\n${piece}` : piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function buildChunks(units: KnowledgeUnit[]): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  let ordinal = 0;

  const timed = units.some((unit) => unit.startMs !== undefined || unit.endMs !== undefined);
  if (timed) {
    let bucket: KnowledgeUnit[] = [];
    let chars = 0;
    const flush = () => {
      if (!bucket.length) return;
      const text = bucket.map((u) => u.text.trim()).filter(Boolean).join(' ').trim();
      if (text) {
        chunks.push({
          id: `c${ordinal}`,
          ordinal: ordinal++,
          text,
          startMs: bucket.find((u) => u.startMs !== undefined)?.startMs,
          endMs: [...bucket].reverse().find((u) => u.endMs !== undefined)?.endMs,
          speaker: bucket.every((u) => u.speaker === bucket[0]?.speaker) ? bucket[0]?.speaker : undefined,
        });
      }
      bucket = [];
      chars = 0;
    };
    for (const unit of units) {
      if (bucket.length && chars + unit.text.length > 1800) flush();
      bucket.push(unit);
      chars += unit.text.length + 1;
    }
    flush();
    return chunks;
  }

  for (const unit of units) {
    for (const text of chunkText(unit.text)) {
      chunks.push({ id: `c${ordinal}`, ordinal: ordinal++, text, page: unit.page });
    }
  }
  return chunks;
}

function ollamaEmbedUrl(): string {
  const raw = String(process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api').replace(/\/+$/, '');
  return raw.endsWith('/api') ? `${raw}/embed` : `${raw}/api/embed`;
}

async function embedBatch(texts: string[]): Promise<number[][] | null> {
  if (!texts.length) return [];
  if (String(process.env.KNOWLEDGE_EMBEDDINGS || 'on').toLowerCase() === 'off') return null;
  const model = process.env.KNOWLEDGE_EMBED_MODEL || 'embeddinggemma';
  try {
    const response = await fetch(ollamaEmbedUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(90000),
      body: JSON.stringify({ model, input: texts, truncate: true, keep_alive: '30m' }),
    });
    if (!response.ok) throw new Error(`Ollama embed ${response.status}`);
    const data = await response.json() as { embeddings?: number[][] };
    if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) {
      throw new Error('Ollama returned incomplete embeddings');
    }
    return data.embeddings;
  } catch (error) {
    console.warn('[knowledge] embeddings unavailable; lexical index remains active:', error);
    return null;
  }
}

async function attachEmbeddings(chunks: KnowledgeChunk[]): Promise<number> {
  let count = 0;
  for (let i = 0; i < chunks.length; i += 24) {
    const slice = chunks.slice(i, i + 24);
    const vectors = await embedBatch(slice.map((chunk) => chunk.text));
    if (!vectors) break;
    vectors.forEach((vector, index) => {
      slice[index].embedding = vector;
      count += 1;
    });
  }
  return count;
}

export async function ingestKnowledgeSource(scope: string, input: IngestKnowledgeInput): Promise<{
  canonicalId: string;
  duplicate: boolean;
  chunkCount: number;
  vectorChunkCount: number;
}> {
  const sha = input.sha256.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha)) throw new Error('Invalid source SHA-256');

  if (linkKnowledgeDuplicate(scope, sha, input.alias)) {
    const source = readManifest(scope).sources[sha];
    return { canonicalId: sha, duplicate: true, chunkCount: source.chunkCount, vectorChunkCount: source.vectorChunkCount };
  }

  const chunks = buildChunks(input.units.filter((unit) => unit.text?.trim()));
  if (!chunks.length) throw new Error('No searchable text extracted from source');
  // Direct uploads are latency-sensitive. Commit their lexical/chunk index first
  // and enrich vectors in the background. Search remains fully functional via
  // lexical scoring while embeddings catch up.
  const vectorChunkCount = input.deferEmbeddings ? 0 : await attachEmbeddings(chunks);
  const fullText = input.units.map((unit) => unit.text).filter(Boolean).join('\n\n');

  fs.writeFileSync(chunksPath(scope, sha), JSON.stringify(chunks), 'utf8');
  fs.writeFileSync(textPath(scope, sha), fullText, 'utf8');

  const manifest = readManifest(scope);
  detachCurrentAlias(manifest, input.alias);
  const now = new Date().toISOString();
  manifest.sources[sha] = {
    id: sha,
    sha256: sha,
    name: input.alias.name,
    mimeType: input.mimeType || input.alias.mimeType || 'application/octet-stream',
    size: input.size,
    kind: input.kind,
    aliases: [input.alias],
    chunkCount: chunks.length,
    vectorChunkCount,
    active: true,
    indexedAt: now,
    updatedAt: now,
  };
  manifest.pointers[aliasKey(input.alias.provider, input.alias.fileId)] = {
    canonicalId: sha,
    revision: input.alias.revision,
  };
  delete manifest.failures[aliasKey(input.alias.provider, input.alias.fileId)];
  writeManifest(scope, manifest);
  return { canonicalId: sha, duplicate: false, chunkCount: chunks.length, vectorChunkCount };
}

export function recordKnowledgeFailure(scope: string, alias: KnowledgeAlias, message: string): void {
  const manifest = readManifest(scope);
  manifest.failures[aliasKey(alias.provider, alias.fileId)] = {
    name: alias.name,
    revision: alias.revision,
    message: String(message).slice(0, 1000),
    updatedAt: new Date().toISOString(),
  };
  writeManifest(scope, manifest);
}

function tokens(value: string): string[] {
  return Array.from(new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9'-]{1,}/g) || []));
}

function lexicalScore(query: string, text: string, sourceName: string): number {
  const wanted = tokens(query);
  if (!wanted.length) return 0;
  const haystack = `${sourceName}\n${text}`.toLowerCase();
  let hits = 0;
  for (const term of wanted) if (haystack.includes(term)) hits += 1;
  let score = hits / wanted.length;
  if (query.length > 3 && haystack.includes(query.toLowerCase())) score += 0.35;
  if (sourceName.toLowerCase().includes(query.toLowerCase())) score += 0.2;
  return Math.min(1, score);
}

function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
}

export async function searchKnowledge(scope: string, query: string, topK = 12): Promise<any[]> {
  const q = query.trim();
  if (!q) return [];
  const manifest = readManifest(scope);
  const queryVector = (await embedBatch([q]))?.[0] || null;
  const results: any[] = [];

  for (const source of Object.values(manifest.sources)) {
    if (!source.active) continue;
    let chunks: KnowledgeChunk[] = [];
    try {
      chunks = JSON.parse(fs.readFileSync(chunksPath(scope, source.id), 'utf8')) as KnowledgeChunk[];
    } catch {
      continue;
    }
    for (const chunk of chunks) {
      const lexical = lexicalScore(q, chunk.text, source.name);
      const semantic = queryVector && chunk.embedding ? (cosine(queryVector, chunk.embedding) + 1) / 2 : null;
      const score = semantic === null ? lexical : (semantic * 0.82) + (lexical * 0.18);
      if (score <= 0) continue;
      results.push({
        score,
        sourceId: source.id,
        sourceName: source.name,
        kind: source.kind,
        mimeType: source.mimeType,
        text: chunk.text,
        page: chunk.page,
        startMs: chunk.startMs,
        endMs: chunk.endMs,
        speaker: chunk.speaker,
        aliases: source.aliases,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(50, topK))).map((item) => ({
    ...item,
    score: Number(item.score.toFixed(6)),
    text: item.text.length > 1800 ? `${item.text.slice(0, 1800)}…` : item.text,
  }));
}

export function getKnowledgeStatus(scope: string): any {
  const manifest = readManifest(scope);
  const active = Object.values(manifest.sources).filter((source) => source.active);
  const aliases = active.reduce((sum, source) => sum + source.aliases.length, 0);
  const chunks = active.reduce((sum, source) => sum + source.chunkCount, 0);
  const vectorChunks = active.reduce((sum, source) => sum + source.vectorChunkCount, 0);
  return {
    sources: active.length,
    aliases,
    duplicates: Math.max(0, aliases - active.length),
    chunks,
    vectorChunks,
    lexicalChunks: chunks,
    transcribedMedia: active.filter((source) => source.kind === 'audio' || source.kind === 'video').length,
    failures: Object.keys(manifest.failures).length,
    embeddingModel: process.env.KNOWLEDGE_EMBED_MODEL || 'embeddinggemma',
  };
}

export async function reindexMissingEmbeddings(scope: string, maxChunks = 500): Promise<{ updated: number; remaining: number }> {
  // Never hold a stale manifest object across an async embedding call. Direct
  // uploads may register another source while Ollama is working; merge each
  // vector-count update into a freshly-read manifest so no source is clobbered.
  const sourceIds = Object.values(readManifest(scope).sources)
    .filter((source) => source.active)
    .map((source) => source.id);
  let updated = 0;
  let remaining = 0;

  for (const sourceId of sourceIds) {
    const current = readManifest(scope).sources[sourceId];
    if (!current?.active) continue;
    let chunks: KnowledgeChunk[];
    try {
      chunks = JSON.parse(fs.readFileSync(chunksPath(scope, sourceId), 'utf8')) as KnowledgeChunk[];
    } catch {
      continue;
    }
    const missing = chunks.filter((chunk) => !chunk.embedding?.length);
    if (!missing.length) continue;
    const budget = Math.max(0, maxChunks - updated);
    if (!budget) {
      remaining += missing.length;
      continue;
    }
    const target = missing.slice(0, budget);
    const count = await attachEmbeddings(target);
    if (count) {
      fs.writeFileSync(chunksPath(scope, sourceId), JSON.stringify(chunks), 'utf8');
      const fresh = readManifest(scope);
      const freshSource = fresh.sources[sourceId];
      if (freshSource) {
        freshSource.vectorChunkCount = chunks.filter((chunk) => chunk.embedding?.length).length;
        freshSource.updatedAt = new Date().toISOString();
        writeManifest(scope, fresh);
      }
      updated += count;
    }
    remaining += Math.max(0, missing.length - count);
  }
  return { updated, remaining };
}

interface BackgroundEmbeddingQueueState {
  timer?: ReturnType<typeof setTimeout>;
  running: boolean;
  rerun: boolean;
}

const backgroundEmbeddingQueues = new Map<string, BackgroundEmbeddingQueueState>();

/** Coalesce direct-upload vector work per user and run it after the response. */
export function queueMissingEmbeddings(scope: string, maxChunks = 1200): void {
  let state = backgroundEmbeddingQueues.get(scope);
  if (!state) {
    state = { running: false, rerun: false };
    backgroundEmbeddingQueues.set(scope, state);
  }
  state.rerun = true;
  if (state.running || state.timer) return;

  state.timer = setTimeout(() => {
    state!.timer = undefined;
    state!.running = true;
    void (async () => {
      try {
        do {
          state!.rerun = false;
          let passes = 0;
          while (passes < 8) {
            const result = await reindexMissingEmbeddings(scope, maxChunks);
            passes += 1;
            if (!result.remaining || !result.updated) break;
          }
        } while (state!.rerun);
      } catch (error) {
        console.warn('[knowledge] background embedding enrichment failed:', error);
      } finally {
        state!.running = false;
        const rerun = state!.rerun;
        backgroundEmbeddingQueues.delete(scope);
        if (rerun) queueMissingEmbeddings(scope, maxChunks);
      }
    })();
  }, 1200);
}

export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
