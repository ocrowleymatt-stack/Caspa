export type InspirationSource = {
  id: string;
  name: string;
  kind: string;
  text: string;
  wordCount: number;
  addedAt: number;
};

const SOURCE_KEY = 'caspa.inspirationSources';
const MAX_SOURCE_CHARS = 30000;

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function safeId() {
  try { return crypto.randomUUID(); } catch { return `src-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

export function loadSourcePack(): InspirationSource[] {
  try {
    const raw = localStorage.getItem(SOURCE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => s && s.name && typeof s.text === 'string') : [];
  } catch { return []; }
}

export function saveSourcePack(sources: InspirationSource[]) {
  try { localStorage.setItem(SOURCE_KEY, JSON.stringify(sources)); } catch { /* local-only convenience */ }
  try { window.dispatchEvent(new CustomEvent('caspa:sources-updated', { detail: sources })); } catch { /* noop */ }
}

export function removeSource(id: string) {
  const next = loadSourcePack().filter((s) => s.id !== id);
  saveSourcePack(next);
  return next;
}

export function clearSourcePack() { saveSourcePack([]); }

function xmlText(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const paras = Array.from(doc.getElementsByTagName('w:p'));
  if (!paras.length) return (doc.documentElement?.textContent || '').trim();
  return paras.map((p) => {
    const texts = Array.from(p.getElementsByTagName('w:t')).map((n) => n.textContent || '');
    return texts.join('');
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function readDocx(file: File) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('This DOCX has no readable document body.');
  return xmlText(documentXml);
}

async function readPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => item.str || '').join(' '));
  }
  return pages.join('\n\n').replace(/[ \t]+\n/g, '\n').trim();
}

function stripRtf(text: string) {
  return text
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtml(text: string) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return (doc.body?.innerText || doc.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return readPdf(file);
  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return readDocx(file);
  const raw = await file.text();
  if (name.endsWith('.rtf') || file.type === 'application/rtf') return stripRtf(raw);
  if (name.endsWith('.html') || name.endsWith('.htm') || file.type === 'text/html') return stripHtml(raw);
  return raw.trim();
}

export async function extractFiles(files: FileList | File[]): Promise<InspirationSource[]> {
  const list = Array.from(files as ArrayLike<File>);
  const out: InspirationSource[] = [];
  for (const file of list) {
    const text = await extractTextFromFile(file);
    if (!text.trim()) continue;
    out.push({
      id: safeId(),
      name: file.name,
      kind: file.type || file.name.split('.').pop() || 'document',
      text,
      wordCount: words(text),
      addedAt: Date.now(),
    });
  }
  return out;
}

export async function addFilesToSourcePack(files: FileList | File[]) {
  const extracted = await extractFiles(files);
  const existing = loadSourcePack();
  const next = [...existing, ...extracted];
  saveSourcePack(next);
  return { added: extracted, all: next };
}

export function formatSourcePack(maxChars = MAX_SOURCE_CHARS) {
  const sources = loadSourcePack();
  if (!sources.length) return '';
  const joined = sources.map((s, i) => `SOURCE ${i + 1}: ${s.name}\n${s.text}`).join('\n\n---\n\n');
  return joined.length > maxChars ? `${joined.slice(0, maxChars)}\n\n[Source pack truncated for this call]` : joined;
}

/**
 * Make inspiration material genuinely available to the simple writing path without
 * forcing every writing component to know about the source drawer. Only Caspa write
 * endpoints are touched, and the source pack is capped to keep requests bounded.
 */
export function installInspirationFetchBridge() {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (w.__caspaInspirationFetchInstalled) return;
  w.__caspaInspirationFetchInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/caspa/write/') && init?.body && typeof init.body === 'string') {
        const pack = formatSourcePack();
        if (pack) {
          const body = JSON.parse(init.body);
          const context = `\n\n---\nINSPIRATION / SOURCE PACK — use as source material, not as permission to invent facts:\n${pack}`;
          if (typeof body.seed === 'string') body.seed = `${body.seed}${context}`;
          if (typeof body.premise === 'string') body.premise = `${body.premise}${context}`;
          if (typeof body.sourceText === 'string') body.sourceText = `${body.sourceText}${context}`;
          else if (!body.seed && !body.premise) body.sourceText = context;
          init = { ...init, body: JSON.stringify(body) };
        }
      }
    } catch {
      // Never break a real request because optional source enrichment failed.
    }
    return originalFetch(input as any, init);
  };
}
