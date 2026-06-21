import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, Image, File, Trash2, Sparkles, BookOpen,
  AlertCircle, X, Eye, Download, ChevronRight, Zap, Brain,
  UploadCloud, FileSearch, Layers, Check, RefreshCcw
} from 'lucide-react';
import { Project, SourceMaterial } from '../types';
import Markdown from 'react-markdown';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface EvidenceItem {
  id: string;
  name: string;
  type: 'text' | 'pdf' | 'image' | 'audio' | 'other';
  content: string;
  mimeType: string;
  size: number;
  status: 'processing' | 'ready' | 'error';
  errorMsg?: string;
  uploadedAt: number;
}

interface Props {
  project: Project;
  sourceMaterials: SourceMaterial[];
  onAddSource: (source: SourceMaterial) => Promise<void>;
  onDeleteSource: (id: string) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function fileTypeFrom(file: File): EvidenceItem['type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|rtf|csv|json)$/i)) return 'text';
  return 'other';
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map((it: any) => it.str).join(' ') + '\n';
  }
  return text.trim();
}

async function ocrImageViaServer(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const res = await fetch('/api/ai/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
  });
  if (!res.ok) throw new Error('Vision OCR failed');
  const data = await res.json();
  return data.result || '';
}

const EvidenceArchive: React.FC<Props> = ({
  project, sourceMaterials, onAddSource, onDeleteSource, onNotify
}) => {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<EvidenceItem | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'source' | 'plan'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const savedPlans = sourceMaterials.filter(s => s.type === 'book-plan');
  const savedSources = sourceMaterials.filter(s => s.type !== 'book-plan');
  const selectedPlan = savedPlans.find(p => p.id === selectedPlanId) || savedPlans[0] || null;

  // ── process a batch of files ──────────────────────────────────
  const processFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 10);
    const skeletons: EvidenceItem[] = arr.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      type: fileTypeFrom(f),
      content: '',
      mimeType: f.type,
      size: f.size,
      status: 'processing',
      uploadedAt: Date.now(),
    }));
    setItems(prev => [...prev, ...skeletons]);

    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const id = skeletons[i].id;
      const type = skeletons[i].type;
      try {
        let content = '';
        if (type === 'pdf') content = await extractPdfText(file);
        else if (type === 'image') content = await ocrImageViaServer(file);
        else if (type === 'text') content = await file.text();
        else content = `[Binary file: ${file.name} — ${formatBytes(file.size)}]`;

        setItems(prev => prev.map(it => it.id === id ? { ...it, content, status: 'ready' } : it));
      } catch (err: any) {
        setItems(prev => prev.map(it => it.id === id ? { ...it, status: 'error', errorMsg: err.message } : it));
      }
    }
  }, []);

  // ── drag & drop ───────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  // ── generate book plan ────────────────────────────────────────
  const generatePlan = async () => {
    const readySources = items.filter(it => it.status === 'ready');
    if (!readySources.length) {
      onNotify('Upload and process at least one document first.', 'error');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/ingest-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: readySources.map(s => ({ name: s.name, type: s.type, content: s.content })),
          projectTitle: project.title,
          projectGenre: project.genre,
          projectPremise: project.premise,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const planMd = data.result;
      const planId = `plan-${Date.now()}`;
      const planName = `${project.title.replace(/\s+/g, '_').toUpperCase()}_BOOK_PLAN.md`;
      const source: SourceMaterial = {
        id: planId,
        name: planName,
        content: planMd,
        type: 'book-plan',
        updatedAt: Date.now(),
      };
      await onAddSource(source);
      setSelectedPlanId(planId);
      onNotify('Book plan generated and saved ✓', 'success');
    } catch (err: any) {
      onNotify(`Generation failed: ${err.message}`, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // ── save individual evidence to Firestore ─────────────────────
  const saveItemToFirestore = async (item: EvidenceItem) => {
    const src: SourceMaterial = {
      id: item.id,
      name: item.name,
      content: item.content.slice(0, 50000), // cap at 50k chars
      type: item.type,
      updatedAt: Date.now(),
    };
    await onAddSource(src);
    onNotify(`"${item.name}" saved to archive ✓`, 'success');
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

  const readyCount = items.filter(i => i.status === 'ready').length;

  // ── filter for saved archive list ─────────────────────────────
  const archiveItems = filterTab === 'plan' ? savedPlans
    : filterTab === 'source' ? savedSources
    : sourceMaterials;

  return (
    <div className="flex flex-col h-full gap-0 min-h-0">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <UploadCloud size={16} className="text-brand-primary" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-text-primary">Evidence Archive</span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 pl-6">
            Drop documents, notes, images — Caspa builds your book plan automatically.
          </p>
        </div>
        <button
          onClick={generatePlan}
          disabled={generating || readyCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-accent disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-semibold uppercase tracking-widest text-xs transition-all shadow-[0_8px_24px_rgba(168,85,247,0.3)] active:scale-95"
        >
          {generating ? (
            <><RefreshCcw size={13} className="animate-spin" />Synthesising…</>
          ) : (
            <><Zap size={13} />Build Book Plan{readyCount > 0 ? ` (${readyCount})` : ''}</>
          )}
        </button>
      </div>

      <div className="flex flex-1 min-h-0 gap-0">

        {/* ── Left: ingest + queue ── */}
        <div className="flex flex-col w-[340px] shrink-0 border-r border-white/5 min-h-0">

          {/* Drop zone */}
          <div
            className={`mx-3 mt-2 mb-2 rounded-lg border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center py-8 gap-3 ${isDragging ? 'border-brand-primary bg-brand-primary/10' : 'border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/5'}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={28} className={isDragging ? 'text-brand-primary' : 'text-text-secondary/50'} />
            <div className="text-center px-4">
              <p className="text-xs font-bold uppercase tracking-widest text-text-primary">Ingest Reference Literature</p>
              <p className="text-xs text-text-secondary mt-1">Drop project briefs, notes, images, PDFs up to 15 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.rtf,.png,.jpg,.jpeg,.webp,.gif,.docx,.csv"
              className="hidden"
              onChange={e => e.target.files && processFiles(e.target.files)}
            />
          </div>

          {/* Processing queue */}
          {items.length > 0 && (
            <div className="mx-3 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary/60 mb-1">Processing Queue</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 bg-white/3 rounded px-2 py-1.5 group">
                    <div className="shrink-0">
                      {item.type === 'pdf' ? <FileText size={12} className="text-red-400" /> :
                       item.type === 'image' ? <Image size={12} className="text-blue-400" /> :
                       <File size={12} className="text-text-secondary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-primary truncate font-medium">{item.name}</p>
                      <p className="text-[10px] text-text-secondary">{formatBytes(item.size)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.status === 'processing' && <RefreshCcw size={11} className="animate-spin text-brand-primary" />}
                      {item.status === 'ready' && (
                        <>
                          <Check size={11} className="text-green-400" />
                          <button onClick={() => saveItemToFirestore(item)} className="opacity-0 group-hover:opacity-100 text-[10px] text-brand-primary hover:underline transition-opacity">save</button>
                          <button onClick={() => setPreviewItem(item)} className="opacity-0 group-hover:opacity-100 ml-1 transition-opacity"><Eye size={11} className="text-text-secondary hover:text-text-primary" /></button>
                        </>
                      )}
                      {item.status === 'error' && <AlertCircle size={11} className="text-red-400" title={item.errorMsg} />}
                      <button onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-100 ml-1 transition-opacity"><X size={11} className="text-text-secondary hover:text-red-400" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved archive list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
            <div className="flex items-center gap-1 mb-2">
              {(['all', 'source', 'plan'] as const).map(t => (
                <button key={t} onClick={() => setFilterTab(t)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${filterTab === t ? 'bg-brand-primary/20 text-brand-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                  {t === 'all' ? 'All' : t === 'source' ? 'Sources' : 'Plans'}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-text-secondary/50">{archiveItems.length} items</span>
            </div>
            {archiveItems.length === 0 && (
              <div className="text-center py-6">
                <FileSearch size={24} className="mx-auto text-text-secondary/20 mb-2" />
                <p className="text-xs text-text-secondary/40 uppercase tracking-wider">No saved items yet</p>
              </div>
            )}
            <div className="space-y-1.5">
              {archiveItems.map(src => (
                <div
                  key={src.id}
                  onClick={() => { if (src.type === 'book-plan') setSelectedPlanId(src.id); }}
                  className={`rounded px-3 py-2.5 cursor-pointer group transition-all border ${src.type === 'book-plan' && selectedPlan?.id === src.id ? 'border-brand-primary/40 bg-brand-primary/5' : 'border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/5'}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-text-primary truncate">{src.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${src.type === 'book-plan' ? 'bg-brand-primary/15 text-brand-primary' : 'bg-white/5 text-text-secondary'}`}>
                          {src.type === 'book-plan' ? 'TEXT/X-MARKDOWN' : src.type.toUpperCase()}
                        </span>
                        {src.updatedAt && (
                          <span className="text-[9px] text-text-secondary/50">
                            {new Date(src.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {src.content && src.type === 'book-plan' && (
                        <p className="text-[10px] text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                          {src.content.replace(/#+\s*/g, '').slice(0, 100)}…
                        </p>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteSource(src.id); }}
                      className="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity mt-0.5"
                    >
                      <Trash2 size={11} className="text-text-secondary hover:text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: plan preview ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {previewItem ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <Eye size={13} className="text-text-secondary" />
                  <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">{previewItem.name}</span>
                </div>
                <button onClick={() => setPreviewItem(null)} className="text-text-secondary hover:text-text-primary">
                  <X size={14} />
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 text-xs text-text-secondary font-mono whitespace-pre-wrap leading-relaxed">{previewItem.content}</pre>
            </div>
          ) : selectedPlan ? (
            <div className="h-full flex flex-col">
              {/* Plan header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-brand-primary" />
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-primary">{selectedPlan.name}</span>
                </div>
                <a
                  href={`data:text/markdown;charset=utf-8,${encodeURIComponent(selectedPlan.content)}`}
                  download={selectedPlan.name}
                  className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-text-primary uppercase tracking-wider"
                >
                  <Download size={11} />Export
                </a>
              </div>
              {/* Markdown plan body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 prose prose-invert prose-sm max-w-none
                [&_h1]:text-brand-primary [&_h1]:text-xl [&_h1]:font-black [&_h1]:tracking-wide [&_h1]:uppercase [&_h1]:mb-1
                [&_h2]:text-text-primary [&_h2]:text-sm [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-widest [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-white/10 [&_h2]:pb-1
                [&_h3]:text-brand-primary/80 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:mt-4 [&_h3]:mb-1
                [&_p]:text-text-secondary [&_p]:text-xs [&_p]:leading-relaxed
                [&_li]:text-text-secondary [&_li]:text-xs [&_li]:leading-relaxed
                [&_strong]:text-text-primary [&_strong]:font-semibold
                [&_hr]:border-white/10">
                <Markdown>{selectedPlan.content}</Markdown>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                <Brain size={28} className="text-brand-primary/50" />
              </div>
              <div className="text-center max-w-xs">
                <p className="text-sm font-bold uppercase tracking-widest text-text-primary">Intelligence Core</p>
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                  Ready to synthesise. Drop your reference materials on the left — notes, research, character outlines, story fragments — then hit <strong className="text-brand-primary">Build Book Plan</strong>.
                </p>
                <p className="text-xs text-text-secondary/50 mt-3 leading-relaxed">
                  Caspa will produce a complete Novel Development Bible: premise, structure, characters, chapter outline, and more.
                </p>
              </div>
              {savedPlans.length > 0 && (
                <div className="mt-4 text-center">
                  <p className="text-[10px] text-text-secondary/50 uppercase tracking-wider mb-2">{savedPlans.length} saved plan{savedPlans.length > 1 ? 's' : ''}</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {savedPlans.map(p => (
                      <button key={p.id} onClick={() => setSelectedPlanId(p.id)}
                        className="text-[10px] px-2 py-1 rounded border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/10 transition-all uppercase tracking-wider">
                        {p.name.replace(/_BOOK_PLAN\.md$/, '').replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvidenceArchive;
