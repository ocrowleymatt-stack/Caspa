from pathlib import Path
import re

# 1) Shared extraction service: accept upload provider and expose local-file ingest.
p = Path('src/services/cloudKnowledgeIngestionService.ts')
s = p.read_text()
s = s.replace("  provider: 'dropbox' | 'gdrive';", "  provider: KnowledgeProvider;", 1)
marker = "\nexport async function syncCloudKnowledge(\n"
if 'export async function ingestUploadedKnowledgeFile' not in s:
    helper = r'''
export async function ingestUploadedKnowledgeFile(
  scope: string,
  filePath: string,
  originalName: string,
  mimeType = 'application/octet-stream',
  fileId?: string,
): Promise<any> {
  const stat = await fsp.stat(filePath);
  if (stat.size > MAX_FILE_BYTES) {
    throw new Error(`${originalName} is over the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB ingest limit.`);
  }
  const sha = await sha256File(filePath);
  const alias: KnowledgeAlias = {
    provider: 'upload',
    fileId: fileId || `upload-${sha.slice(0, 24)}`,
    revision: sha,
    name: originalName,
    mimeType: mimeType || guessMime(originalName),
    size: stat.size,
    modifiedTime: new Date().toISOString(),
  };

  if (hasKnowledgeSha(scope, sha) && linkKnowledgeDuplicate(scope, sha, alias)) {
    return { accepted: true, duplicate: true, kind: 'duplicate', extractedText: '', alias };
  }

  const pseudoFile: CloudFile = {
    provider: 'upload',
    fileId: alias.fileId,
    name: originalName,
    mimeType: alias.mimeType || guessMime(originalName),
    size: stat.size,
    revision: sha,
  };
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'atlas-upload-extract-'));
  let extracted: ExtractedContent;
  let extractionWarning = '';
  try {
    if (isSupported(pseudoFile)) {
      try {
        extracted = await extractContent(pseudoFile, filePath, tempDir);
      } catch (error) {
        extractionWarning = error instanceof Error ? error.message : String(error);
        recordKnowledgeFailure(scope, alias, extractionWarning);
        extracted = {
          kind: 'document',
          units: [{ text: `[File accepted; automatic extraction needs attention]\nName: ${originalName}\nMIME: ${pseudoFile.mimeType}\nSize: ${stat.size} bytes\nExtraction: ${extractionWarning}` }],
        };
      }
    } else {
      extracted = {
        kind: 'document',
        units: [{ text: `[File accepted]\nName: ${originalName}\nMIME: ${pseudoFile.mimeType}\nSize: ${stat.size} bytes\nThis format is retained as an indexed source record even though Atlas does not yet extract its binary contents.` }],
      };
    }

    const ingested = await ingestKnowledgeSource(scope, {
      sha256: sha,
      alias,
      mimeType: pseudoFile.mimeType,
      size: stat.size,
      kind: extracted.kind,
      units: extracted.units,
    });
    const extractedText = extracted.units.map((unit) => unit.text || '').filter(Boolean).join('\n\n');
    return {
      ...ingested,
      accepted: true,
      kind: extracted.kind,
      extractionWarning: extractionWarning || undefined,
      extractedText: extractedText.slice(0, 2_000_000),
      alias,
    };
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
'''
    if marker not in s:
        raise SystemExit('syncCloudKnowledge marker not found')
    s = s.replace(marker, '\n' + helper + marker, 1)
p.write_text(s)

# 2) Multipart route: every selected file reaches shared extractor/indexer.
p = Path('src/routes/caspa-knowledge-routes.ts')
s = p.read_text()
if "import multer from 'multer';" not in s:
    s = s.replace("import express, { type Request } from 'express';", "import express, { type Request } from 'express';\nimport multer from 'multer';\nimport os from 'os';\nimport fsp from 'fs/promises';")
s = s.replace("import { syncCloudKnowledge } from '../services/cloudKnowledgeIngestionService';", "import { ingestUploadedKnowledgeFile, syncCloudKnowledge } from '../services/cloudKnowledgeIngestionService';")
if 'const knowledgeFileUpload = multer(' not in s:
    s = s.replace("const router = express.Router();", "const router = express.Router();\nconst knowledgeFileUpload = multer({\n  dest: os.tmpdir(),\n  limits: { fileSize: Math.max(5 * 1024 * 1024, Number(process.env.KNOWLEDGE_MAX_FILE_BYTES || 350 * 1024 * 1024)) },\n});")
route_marker = "\nrouter.post('/ingest/text',"
if "router.post('/ingest/file'" not in s:
    route = r'''
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

'''
    if route_marker not in s:
        raise SystemExit('ingest/text route marker not found')
    s = s.replace(route_marker, '\n' + route + "router.post('/ingest/text',", 1)
p.write_text(s)

# 3) Browser client helper for arbitrary multipart upload.
p = Path('src/services/knowledgeClient.ts')
s = p.read_text()
if 'export async function ingestKnowledgeFile' not in s:
    s += r'''

export async function ingestKnowledgeFile(file: File, fileId?: string): Promise<any> {
  const form = new FormData();
  form.append('file', file, file.name);
  if (fileId) form.append('fileId', fileId);
  const response = await fetch('/api/caspa/knowledge/ingest/file', {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  });
  return readJson(response);
}
'''
p.write_text(s)

# 4) Atlas global Data Ingest/Fast Upload: no picker restriction, no extension rejection.
p = Path('src/App.tsx')
s = p.read_text()
s = s.replace("import { ingestKnowledgeText } from './services/knowledgeClient';", "import { ingestKnowledgeFile, ingestKnowledgeText } from './services/knowledgeClient';")
start = s.find('  const handleFastDataUpload = async (files: File[]) => {')
end = s.find('\n  const runSidebarFastUpload = async', start)
if start < 0 or end < 0:
    raise SystemExit('Fast upload handler bounds not found')
new_handler = r'''  const handleFastDataUpload = async (files: File[]) => {
    if (!files.length) return;
    saveCurrentProjectState();

    const selected = files.slice(0, 20);
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
      : useful.map((item) => `===== ${item.name} =====\n\n${item.text}`).join('\n\n');
    const title = useful.length === 1
      ? useful[0].name.replace(/\.[^.]+$/, '') || 'Uploaded material'
      : `Data pack — ${new Date().toLocaleDateString('en-GB')}`;

    const nextBrief: ProjectBrief = {
      title,
      mode: 'adaptation',
      idea: useful.length === 1 ? `Data ingest: ${useful[0].name}` : `Data ingest: ${useful.length} source files`,
      tone: 'Preserve the source voice and evidential boundaries. Structure before embellishment.',
      output: 'Analyse, organise and turn the uploaded material into the strongest appropriate finished form.',
      audience: 'Determine from the source material and project intent.',
      targetWordCount: defaultTargetWordCount('adaptation'),
      createdAt: new Date().toISOString(),
    };

    setBrief(nextBrief);
    saveBrief(nextBrief);
    setProjectStatus('active');
    setDraftPage('');
    setManuscriptSource(combined);
    localStorage.setItem('caspa.whitePage', '');
    localStorage.setItem('caspa.manuscriptSource', combined);
    localStorage.removeItem('caspa.commission');
    localStorage.removeItem('caspa.commission.tab');
    clearShowBox();
    clearPlotHold();
    recordProjectSnapshot(nextBrief);
    persistActiveUserDatabase();
    goTo('workshop');
  };
'''
s = s[:start] + new_handler + s[end:]
s = re.sub(r'\n\s*accept="[^"]+"', '', s)
s = s.replace('PDF · text · data packs → project + shared search index', 'Any file type → extract/transcribe/index where possible')
p.write_text(s)

# 5) Settings picker unrestricted.
p = Path('src/components/SettingsStudio.tsx')
s = p.read_text()
s = re.sub(r'\n\s*accept="[^"]+"', '', s)
s = s.replace('PDF, text, Markdown, RTF, HTML, JSON, YAML and CSV are accepted; multiple files are combined with filenames preserved.', 'Any file type is accepted. Atlas extracts/transcribes supported formats and still registers unsupported binary formats without rejecting them; multiple files keep their filenames and provenance.')
p.write_text(s)

# 6) Caspa Workshop uses the same arbitrary-file ingest path.
p = Path('src/components/CommissionStudio.tsx')
s = p.read_text()
if "from '../services/knowledgeClient';" not in s:
    insertion = "import { extractPromises, openPromiseWarnings, savePromises } from '../services/promiseRegistryService';"
    s = s.replace(insertion, insertion + "\nimport { ingestKnowledgeFile } from '../services/knowledgeClient';")
start = s.find('  const handleFiles = async (files: File[]) => {')
end = s.find('\n  const handleSuggestIdea = async', start)
if start < 0 or end < 0:
    raise SystemExit('CommissionStudio handleFiles bounds not found')
new_files = r'''  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setStatusLine(`Ingesting ${files.length} file${files.length === 1 ? '' : 's'}…`);
    try {
      const chunks = await Promise.all(files.map(async (file, index) => {
        const heading = `\n\n===== SOURCE: ${file.name} =====\n\n`;
        const data = await ingestKnowledgeFile(file, `workshop:${Date.now()}:${index}:${file.name}`);
        const extracted = String(data?.extractedText || '').trim();
        const warning = String(data?.extractionWarning || '').trim();
        return `${heading}${extracted || `[File accepted: ${file.name} · ${file.type || 'unknown type'} · ${file.size.toLocaleString()} bytes${warning ? ` · extraction warning: ${warning}` : ''}]`}`;
      }));
      setInboxText((prev) => `${prev.trim()}${chunks.join('')}`.trim());
    } finally {
      setStatusLine('');
    }
  };
'''
s = s[:start] + new_files + s[end:]
s = s.replace('Text-based files are read directly; other formats are accepted and clearly listed instead of being silently rejected.', 'Any file type is accepted. Text/documents are extracted, audio/video is transcribed, and other binary formats are registered rather than rejected.')
p.write_text(s)
