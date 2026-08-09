#!/usr/bin/env python3
from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1))


# 1) Knowledge index: lexical/chunk registration can complete immediately;
# embeddings are an enrichment stage and must not hold the upload response open.
replace_once(
    'src/services/knowledgeIndexService.ts',
    "  kind: KnowledgeSource['kind'];\n  units: KnowledgeUnit[];\n}",
    "  kind: KnowledgeSource['kind'];\n  units: KnowledgeUnit[];\n  deferEmbeddings?: boolean;\n}",
)

replace_once(
    'src/services/knowledgeIndexService.ts',
    "  const chunks = buildChunks(input.units.filter((unit) => unit.text?.trim()));\n  if (!chunks.length) throw new Error('No searchable text extracted from source');\n  const vectorChunkCount = await attachEmbeddings(chunks);",
    "  const chunks = buildChunks(input.units.filter((unit) => unit.text?.trim()));\n  if (!chunks.length) throw new Error('No searchable text extracted from source');\n  // Direct uploads are latency-sensitive. Commit their lexical/chunk index first\n  // and enrich vectors in the background. Search remains fully functional via\n  // lexical scoring while embeddings catch up.\n  const vectorChunkCount = input.deferEmbeddings ? 0 : await attachEmbeddings(chunks);",
)

old_reindex = '''export async function reindexMissingEmbeddings(scope: string, maxChunks = 500): Promise<{ updated: number; remaining: number }> {
  const manifest = readManifest(scope);
  let updated = 0;
  let remaining = 0;

  for (const source of Object.values(manifest.sources)) {
    if (!source.active) continue;
    let chunks: KnowledgeChunk[];
    try {
      chunks = JSON.parse(fs.readFileSync(chunksPath(scope, source.id), 'utf8')) as KnowledgeChunk[];
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
      fs.writeFileSync(chunksPath(scope, source.id), JSON.stringify(chunks), 'utf8');
      source.vectorChunkCount = chunks.filter((chunk) => chunk.embedding?.length).length;
      source.updatedAt = new Date().toISOString();
      updated += count;
    }
    remaining += Math.max(0, missing.length - count);
  }
  writeManifest(scope, manifest);
  return { updated, remaining };
}
'''
new_reindex = '''export async function reindexMissingEmbeddings(scope: string, maxChunks = 500): Promise<{ updated: number; remaining: number }> {
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
'''
replace_once('src/services/knowledgeIndexService.ts', old_reindex, new_reindex)


# 2) Uploaded file extraction: accept a fast/direct-upload mode. Also avoid
# blocking Node's event loop on long ffmpeg jobs and transcribe segments in a
# small bounded pool.
replace_once(
    'src/services/cloudKnowledgeIngestionService.ts',
    "import { spawnSync } from 'child_process';",
    "import { spawn, spawnSync } from 'child_process';",
)

replace_once(
    'src/services/cloudKnowledgeIngestionService.ts',
    "const TRANSCRIBE_DIRECT_LIMIT = 21 * 1024 * 1024;",
    "const TRANSCRIBE_DIRECT_LIMIT = 21 * 1024 * 1024;\nconst TRANSCRIBE_CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.KNOWLEDGE_TRANSCRIBE_CONCURRENCY || 2)));",
)

old_ffmpeg = '''  const segmentDir = path.join(tempDir, 'audio-segments');
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
'''
new_ffmpeg = '''  const segmentDir = path.join(tempDir, 'audio-segments');
  await fsp.mkdir(segmentDir, { recursive: true });
  const outputPattern = path.join(segmentDir, 'segment-%04d.mp3');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', filePath,
      '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k',
      '-f', 'segment', '-segment_time', '1200', '-reset_timestamps', '1', outputPattern,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < 10000) stderr += String(chunk);
    });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg extraction failed: ${stderr.slice(0, 800)}`)));
  });

  const segments = (await fsp.readdir(segmentDir)).filter((name) => name.endsWith('.mp3')).sort();
  if (!segments.length) throw new Error('ffmpeg produced no audio segments');
  const results: KnowledgeUnit[][] = new Array(segments.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(TRANSCRIBE_CONCURRENCY, segments.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= segments.length) return;
      results[index] = await transcribeOne(path.join(segmentDir, segments[index]), index * 1200 * 1000);
    }
  });
  await Promise.all(workers);
  return results.flat();
'''
replace_once('src/services/cloudKnowledgeIngestionService.ts', old_ffmpeg, new_ffmpeg)

replace_once(
    'src/services/cloudKnowledgeIngestionService.ts',
    "  mimeType = 'application/octet-stream',\n  fileId?: string,\n): Promise<any> {",
    "  mimeType = 'application/octet-stream',\n  fileId?: string,\n  deferEmbeddings = false,\n): Promise<any> {",
)

replace_once(
    'src/services/cloudKnowledgeIngestionService.ts',
    "      kind: extracted.kind,\n      units: extracted.units,\n    });",
    "      kind: extracted.kind,\n      units: extracted.units,\n      deferEmbeddings,\n    });",
)


# 3) Routes: direct upload can return after extraction/chunk registration, then
# coalesced vectorisation runs server-side after the HTTP response is sent.
replace_once(
    'src/routes/caspa-knowledge-routes.ts',
    "  reindexMissingEmbeddings,\n  searchKnowledge,",
    "  reindexMissingEmbeddings,\n  queueMissingEmbeddings,\n  searchKnowledge,",
)

old_file_route = '''      const data = await ingestUploadedKnowledgeFile(
        scope,
        req.file.path,
        req.file.originalname || 'Uploaded file',
        req.file.mimetype || 'application/octet-stream',
        String(req.body?.fileId || '') || undefined,
      );
      return res.json({ success: true, data });
'''
new_file_route = '''      const deferEmbeddings = /^(1|true|yes)$/i.test(String(req.body?.deferEmbeddings || ''));
      const data = await ingestUploadedKnowledgeFile(
        scope,
        req.file.path,
        req.file.originalname || 'Uploaded file',
        req.file.mimetype || 'application/octet-stream',
        String(req.body?.fileId || '') || undefined,
        deferEmbeddings,
      );
      res.json({ success: true, data });
      if (deferEmbeddings) queueMissingEmbeddings(scope);
      return;
'''
replace_once('src/routes/caspa-knowledge-routes.ts', old_file_route, new_file_route)

old_text_route = '''  const data = await ingestKnowledgeSource(scope, {
    sha256,
    alias,
    mimeType: alias.mimeType || 'text/plain',
    size: alias.size || Buffer.byteLength(text),
    kind: 'text',
    units: [{ text }],
  });
  res.json({ success: true, data });
'''
new_text_route = '''  const deferEmbeddings = Boolean(req.body?.deferEmbeddings);
  const data = await ingestKnowledgeSource(scope, {
    sha256,
    alias,
    mimeType: alias.mimeType || 'text/plain',
    size: alias.size || Buffer.byteLength(text),
    kind: 'text',
    units: [{ text }],
    deferEmbeddings,
  });
  res.json({ success: true, data });
  if (deferEmbeddings) queueMissingEmbeddings(scope);
'''
replace_once('src/routes/caspa-knowledge-routes.ts', old_text_route, new_text_route)


# 4) Browser client: expose the fast flag.
replace_once(
    'src/services/knowledgeClient.ts',
    "export async function ingestKnowledgeText(name: string, text: string, mimeType = 'text/plain', fileId?: string): Promise<any> {",
    "export async function ingestKnowledgeText(name: string, text: string, mimeType = 'text/plain', fileId?: string, deferEmbeddings = false): Promise<any> {",
)
replace_once(
    'src/services/knowledgeClient.ts',
    "    body: JSON.stringify({ name, text, mimeType, fileId }),",
    "    body: JSON.stringify({ name, text, mimeType, fileId, deferEmbeddings }),",
)
replace_once(
    'src/services/knowledgeClient.ts',
    "export async function ingestKnowledgeFile(file: File, fileId?: string): Promise<any> {\n  const form = new FormData();\n  form.append('file', file, file.name);\n  if (fileId) form.append('fileId', fileId);",
    "export async function ingestKnowledgeFile(file: File, fileId?: string, deferEmbeddings = false): Promise<any> {\n  const form = new FormData();\n  form.append('file', file, file.name);\n  if (fileId) form.append('fileId', fileId);\n  if (deferEmbeddings) form.append('deferEmbeddings', '1');",
)


# 5) Data Ingest UI: process a bounded set of files in parallel instead of one
# at a time, and keep the working manuscript bounded while the complete corpus
# remains searchable server-side.
old_handler = '''    const selected = files.slice(0, 20);
    const parsed: Array<{ name: string; text: string }> = [];
    for (const [index, file] of selected.entries()) {
      const data = await ingestKnowledgeFile(file, `data-ingest:${Date.now()}:${index}:${file.name}`);
      const extracted = String(data?.extractedText || '').trim();
      const warning = String(data?.extractionWarning || '').trim();
      parsed.push({
        name: file.name,
        text: extracted || `[File accepted: ${file.name} · ${file.type || 'unknown type'} · ${file.size.toLocaleString()} bytes${warning ? ` · extraction warning: ${warning}` : ''}]`,
      });
    }

    const useful = parsed.filter((item) => item.text.trim());
    if (!useful.length) throw new Error('The selected files could not be registered for ingestion.');

    const combined = useful.length === 1
      ? useful[0].text
      : useful.map((item) => `===== ${item.name} =====\\n\\n${item.text}`).join('\\n\\n');
'''
new_handler = '''    const selected = files.slice(0, 20);
    const parsed: Array<{ name: string; text: string; failed?: boolean }> = new Array(selected.length);
    let cursor = 0;
    const uploadConcurrency = Math.min(3, selected.length);
    const workers = Array.from({ length: uploadConcurrency }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= selected.length) return;
        const file = selected[index];
        try {
          // Fast ingest returns as soon as extraction + lexical/chunk registration
          // are complete. Vector embeddings are enriched server-side afterwards.
          const data = await ingestKnowledgeFile(
            file,
            `data-ingest:${Date.now()}:${index}:${file.name}`,
            true,
          );
          const extracted = String(data?.extractedText || '').trim();
          const warning = String(data?.extractionWarning || '').trim();
          parsed[index] = {
            name: file.name,
            text: extracted || `[File accepted: ${file.name} · ${file.type || 'unknown type'} · ${file.size.toLocaleString()} bytes${warning ? ` · extraction warning: ${warning}` : ''}]`,
          };
        } catch (error) {
          parsed[index] = {
            name: file.name,
            text: `[Ingest failed for ${file.name}: ${error instanceof Error ? error.message : String(error)}]`,
            failed: true,
          };
        }
      }
    });
    await Promise.all(workers);

    const useful = parsed.filter((item) => item && !item.failed && item.text.trim());
    if (!useful.length) throw new Error('The selected files could not be registered for ingestion.');

    // The complete extracted source stays in the server corpus. The active project
    // only needs a representative working set; keeping it bounded prevents huge
    // synchronous localStorage writes and makes Workshop open immediately.
    const WORKING_SOURCE_MAX_CHARS = 3_000_000;
    const perFileBudget = Math.max(75_000, Math.floor(WORKING_SOURCE_MAX_CHARS / useful.length));
    const working = useful.map((item) => ({
      ...item,
      text: item.text.length > perFileBudget
        ? `${item.text.slice(0, perFileBudget)}\\n\\n[Working excerpt clipped here; the complete source remains in the Atlas knowledge index.]`
        : item.text,
    }));
    const combined = working.length === 1
      ? working[0].text
      : working.map((item) => `===== ${item.name} =====\\n\\n${item.text}`).join('\\n\\n');
'''
replace_once('src/App.tsx', old_handler, new_handler)

replace_once(
    'src/App.tsx',
    "    recordProjectSnapshot(nextBrief);\n    persistActiveUserDatabase();\n    goTo('workshop');",
    "    goTo('workshop');\n    // Let React paint Workshop before doing non-critical persistence work.\n    window.setTimeout(() => {\n      recordProjectSnapshot(nextBrief);\n      void persistActiveUserDatabase();\n    }, 0);",
)

print('fast data ingest surgery applied')
