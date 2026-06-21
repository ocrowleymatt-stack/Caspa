import PrizeCalibrationDashboard from './PrizeCalibrationDashboard';
import React, { useState, useRef, useCallback } from 'react';
import {
  Project, ResearchNote, Chapter, SourceMaterial, Character, PlotNode
} from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, FileText, Image, File, Trash2, CheckCircle2,
  Loader2, Sparkles, BookOpen, Users, GitBranch, FlaskConical,
  AlertCircle, ChevronDown, ChevronUp, Tag, Plus, Search, X
} from 'lucide-react';

interface DiscoverViewProps {
  project: Project;
  research: ResearchNote[];
  chapters: Chapter[];
  sourceMaterials: SourceMaterial[];
  characters: Character[];
  plotNodes: PlotNode[];
  updateProject: (p: Partial<Project>) => Promise<void>;
  onAddResearch: (r: ResearchNote) => Promise<void>;
  onDeleteResearch: (id: string) => Promise<void>;
  onAddChapter: (c: Chapter) => Promise<void>;
  onAddSource: (s: SourceMaterial) => Promise<void>;
  onDeleteSource: (id: string) => Promise<void>;
  onSaveCharacter: (c: Character) => Promise<void>;
  onSavePlotNode: (n: PlotNode) => Promise<void>;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface ParsedFile {
  id: string;
  name: string;
  type: string;
  content: string;
  size: number;
  status: 'parsing' | 'ready' | 'error';
  error?: string;
}

interface IngestResult {
  characters: Character[];
  plotNodes: PlotNode[];
  researchNotes: ResearchNote[];
  sourceMaterials: SourceMaterial[];
  projectUpdates: { premise?: string; tone?: string; genre?: string };
  summary: string;
}

type PipelineStage = 'idle' | 'parsing' | 'analysing' | 'extracting' | 'saving' | 'done' | 'error';

const stageLabels: Record<PipelineStage, string> = {
  idle: 'Ready',
  parsing: 'Reading files…',
  analysing: 'Analysing content with AI…',
  extracting: 'Extracting structure…',
  saving: 'Injecting into your project…',
  done: 'Done',
  error: 'Something went wrong'
};

function genId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext || '')) return <Image size={16} className="text-purple-400" />;
  if (['pdf'].includes(ext || '')) return <FileText size={16} className="text-red-400" />;
  return <File size={16} className="text-blue-400" />;
}

async function parseFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // Plain text
  if (['txt', 'md', 'markdown', 'csv', 'json'].includes(ext)) {
    return await file.text();
  }

  // Images — send to server vision endpoint
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) {
    const b64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch('/api/ai/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: b64, mimeType: file.type || 'image/jpeg' })
    });
    if (!res.ok) throw new Error('Vision OCR failed');
    const data = await res.json();
    return data.text || '';
  }

  // PDFs — extract as text via pdf.js if available, else send as base64
  if (ext === 'pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      // Basic text extraction: look for stream content
      const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8);
      const chunks: string[] = [];
      const bjRegex = /BT[\s\S]*?ET/g;
      let m;
      while ((m = bjRegex.exec(text)) !== null) {
        const tjMatch = m[0].match(/\(([^)]+)\)/g);
        if (tjMatch) chunks.push(...tjMatch.map(s => s.slice(1, -1)));
      }
      const extracted = chunks.join(' ').replace(/\\n/g, '\n').trim();
      if (extracted.length > 100) return extracted.slice(0, 15000);
    } catch {}
    // Fallback: return filename as note
    return `[PDF file: ${file.name} — content could not be extracted. Please paste key content manually.]`;
  }

  // Word / RTF / other — read as text with best effort
  try {
    return (await file.text()).slice(0, 15000);
  } catch {
    return `[File: ${file.name} — binary file, content not extractable]`;
  }
}

export default function DiscoverView({
  project,
  research,
  chapters,
  sourceMaterials,
  characters,
  plotNodes,
  updateProject,
  onAddResearch,
  onDeleteResearch,
  onAddChapter,
  onAddSource,
  onDeleteSource,
  onSaveCharacter,
  onSavePlotNode,
  onNotify
}: DiscoverViewProps) {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('characters');
  const [activeTab, setActiveTab] = useState<'ingest' | 'library' | 'prize'>('ingest');
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    await addFiles(dropped);
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    await addFiles(selected);
    e.target.value = '';
  }, []);

  const addFiles = async (newFiles: File[]) => {
    const parsedEntries: ParsedFile[] = newFiles.map(f => ({
      id: genId(),
      name: f.name,
      type: f.type || 'text/plain',
      content: '',
      size: f.size,
      status: 'parsing' as const
    }));

    setFiles(prev => [...prev, ...parsedEntries]);
    setStage('parsing');

    const updated = await Promise.all(
      newFiles.map(async (file, i) => {
        try {
          const content = await parseFile(file);
          return { ...parsedEntries[i], content, status: 'ready' as const };
        } catch (err: any) {
          return { ...parsedEntries[i], status: 'error' as const, error: err.message };
        }
      })
    );

    setFiles(prev => {
      const ids = new Set(parsedEntries.map(p => p.id));
      return [...prev.filter(p => !ids.has(p.id)), ...updated];
    });
    setStage('idle');
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const runPipeline = async () => {
    const readyFiles = files.filter(f => f.status === 'ready' && f.content);
    if (!readyFiles.length) {
      onNotify('Add some files first', 'error');
      return;
    }

    setResult(null);
    setError('');
    setStage('analysing');

    try {
      const sources = readyFiles.map(f => ({
        name: f.name,
        type: f.type,
        content: f.content.slice(0, 10000)
      }));

      const res = await fetch('/api/ai/deep-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources,
          projectTitle: project.title,
          projectGenre: project.genre,
          projectPremise: project.premise,
          projectType: project.type
        })
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'AI ingest failed');
      }

      setStage('extracting');
      const data: IngestResult = await res.json();

      setStage('saving');

      // Inject everything into Firestore
      const saves: Promise<any>[] = [];

      // Characters
      for (const char of data.characters || []) {
        saves.push(onSaveCharacter({ ...char, id: char.id || genId(), updatedAt: Date.now() }));
      }

      // Plot nodes
      for (const node of data.plotNodes || []) {
        saves.push(onSavePlotNode({ ...node, id: node.id || genId(), updatedAt: Date.now() }));
      }

      // Research notes
      for (const note of data.researchNotes || []) {
        saves.push(onAddResearch({ ...note, id: note.id || genId(), updatedAt: Date.now() }));
      }

      // Source materials (the raw files)
      for (const f of readyFiles) {
        saves.push(onAddSource({
          id: genId(),
          name: f.name,
          content: f.content.slice(0, 8000),
          type: 'Evidence Upload',
          updatedAt: Date.now()
        }));
      }

      // Update project metadata if AI extracted better premise/tone/genre
      if (data.projectUpdates && Object.keys(data.projectUpdates).length > 0) {
        const updates: Partial<Project> = {};
        if (data.projectUpdates.premise && !project.premise) updates.premise = data.projectUpdates.premise;
        if (data.projectUpdates.tone && !project.tone) updates.tone = data.projectUpdates.tone;
        if (data.projectUpdates.genre && !project.genre) updates.genre = data.projectUpdates.genre;
        if (Object.keys(updates).length > 0) saves.push(updateProject(updates));
      }

      await Promise.all(saves);

      setResult(data);
      setStage('done');
      onNotify(
        `Injected: ${data.characters?.length || 0} characters, ${data.plotNodes?.length || 0} plot threads, ${data.researchNotes?.length || 0} research notes`,
        'success'
      );
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      setStage('error');
      onNotify('Ingest failed: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  const clearAll = () => {
    setFiles([]);
    setResult(null);
    setError('');
    setStage('idle');
  };

  const isProcessing = ['parsing', 'analysing', 'extracting', 'saving'].includes(stage);

  const filteredResearch = research.filter(r =>
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSources = sourceMaterials.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FlaskConical size={20} className="text-violet-400" />
            Research Desk
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Drop evidence — Caspa reads it and builds your book automatically</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('ingest')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'ingest' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            📥 Import & Analyze
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'library' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            📚 Research Library ({research.length + sourceMaterials.length})
          </button>
            <button
              onClick={() => setActiveTab('prize')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'prize' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              🏆 Compete
            </button>
        </div>
      </div>

      {activeTab === 'ingest' && (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-violet-400 bg-violet-500/10 scale-[1.01]'
                : 'border-gray-600 hover:border-violet-500/60 hover:bg-white/5'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.gif,.webp,.csv,.json,.doc,.docx,.rtf"
              onChange={handleFileInput}
            />
            <Upload size={28} className={`mx-auto mb-2 transition-colors ${isDragging ? 'text-violet-400' : 'text-gray-500'}`} />
            <p className="text-white font-medium">Drop files here or click to browse</p>
            <p className="text-gray-500 text-sm mt-1">PDFs, images, text files, notes, research docs — anything goes</p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-gray-900/50 rounded-xl border border-gray-700/50 divide-y divide-gray-700/30 overflow-hidden">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                  {fileIcon(f.name)}
                  <span className="flex-1 text-sm text-gray-200 truncate">{f.name}</span>
                  <span className="text-xs text-gray-500">{(f.size / 1024).toFixed(0)}KB</span>
                  {f.status === 'parsing' && <Loader2 size={14} className="text-violet-400 animate-spin" />}
                  {f.status === 'ready' && <CheckCircle2 size={14} className="text-emerald-400" />}
                  {f.status === 'error' && <AlertCircle size={14} className="text-red-400" title={f.error} />}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                    disabled={isProcessing}
                    className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pipeline Controls */}
          {files.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={runPipeline}
                disabled={isProcessing || files.filter(f => f.status === 'ready').length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {stageLabels[stage]}
                  </>
                ) : stage === 'done' ? (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    Run Again
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Analyse &amp; Inject into Project
                  </>
                )}
              </button>
              {(files.length > 0 || result) && (
                <button
                  onClick={clearAll}
                  disabled={isProcessing}
                  className="px-4 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Progress Pipeline */}
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900/60 border border-violet-500/20 rounded-xl p-4"
            >
              <div className="flex items-center gap-4">
                {(['parsing', 'analysing', 'extracting', 'saving'] as PipelineStage[]).map((s, i) => {
                  const stages: PipelineStage[] = ['parsing', 'analysing', 'extracting', 'saving'];
                  const currentIdx = stages.indexOf(stage);
                  const isDone = i < currentIdx;
                  const isCurrent = s === stage;
                  return (
                    <React.Fragment key={s}>
                      <div className="flex flex-col items-center gap-1 flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                          isDone ? 'bg-emerald-500/20 border-emerald-500' :
                          isCurrent ? 'bg-violet-500/20 border-violet-400 animate-pulse' :
                          'bg-gray-800 border-gray-600'
                        }`}>
                          {isDone ? <CheckCircle2 size={14} className="text-emerald-400" /> :
                           isCurrent ? <Loader2 size={14} className="text-violet-400 animate-spin" /> :
                           <div className="w-2 h-2 rounded-full bg-gray-600" />}
                        </div>
                        <span className={`text-xs text-center ${isCurrent ? 'text-violet-300' : isDone ? 'text-emerald-400' : 'text-gray-600'}`}>
                          {stageLabels[s].replace('…', '')}
                        </span>
                      </div>
                      {i < 3 && <div className={`h-0.5 flex-1 -mt-4 rounded ${isDone ? 'bg-emerald-500/40' : 'bg-gray-700'}`} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Error */}
          {stage === 'error' && error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm flex gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </motion.div>
          )}

          {/* Results */}
          {result && stage === 'done' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3 overflow-y-auto"
            >
              <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-emerald-300 font-semibold text-sm">Successfully injected into your project</span>
                </div>
                {result.summary && <p className="text-gray-300 text-sm">{result.summary}</p>}
              </div>

              {/* Characters */}
              {result.characters?.length > 0 && (
                <ResultSection
                  icon={<Users size={15} />}
                  title={`${result.characters.length} Characters`}
                  color="blue"
                  expanded={expandedSection === 'characters'}
                  onToggle={() => setExpandedSection(expandedSection === 'characters' ? null : 'characters')}
                >
                  {result.characters.map(c => (
                    <div key={c.id} className="bg-gray-800/60 rounded-lg p-3">
                      <div className="font-medium text-white text-sm">{c.name}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{c.role}</div>
                      {c.backstory && <p className="text-gray-300 text-xs mt-1 line-clamp-2">{c.backstory}</p>}
                    </div>
                  ))}
                </ResultSection>
              )}

              {/* Plot nodes */}
              {result.plotNodes?.length > 0 && (
                <ResultSection
                  icon={<GitBranch size={15} />}
                  title={`${result.plotNodes.length} Plot Threads`}
                  color="amber"
                  expanded={expandedSection === 'plot'}
                  onToggle={() => setExpandedSection(expandedSection === 'plot' ? null : 'plot')}
                >
                  {result.plotNodes.map(n => (
                    <div key={n.id} className="bg-gray-800/60 rounded-lg p-3">
                      <div className="font-medium text-white text-sm">{n.title}</div>
                      <div className="text-gray-400 text-xs mt-0.5 capitalize">{n.type} arc</div>
                      {n.description && <p className="text-gray-300 text-xs mt-1 line-clamp-2">{n.description}</p>}
                    </div>
                  ))}
                </ResultSection>
              )}

              {/* Research notes */}
              {result.researchNotes?.length > 0 && (
                <ResultSection
                  icon={<BookOpen size={15} />}
                  title={`${result.researchNotes.length} Research Notes`}
                  color="green"
                  expanded={expandedSection === 'research'}
                  onToggle={() => setExpandedSection(expandedSection === 'research' ? null : 'research')}
                >
                  {result.researchNotes.map(n => (
                    <div key={n.id} className="bg-gray-800/60 rounded-lg p-3">
                      <div className="font-medium text-white text-sm">{n.title}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{n.category}</div>
                      {n.content && <p className="text-gray-300 text-xs mt-1 line-clamp-2">{n.content}</p>}
                    </div>
                  ))}
                </ResultSection>
              )}
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'library' && (
        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search research & sources…"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Source Materials */}
          {filteredSources.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Source Files ({filteredSources.length})</h3>
              <div className="flex flex-col gap-2">
                {filteredSources.map(s => (
                  <div key={s.id} className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-3 flex items-start gap-3">
                    {fileIcon(s.name)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{s.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.type}</div>
                      {s.content && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{s.content}</p>}
                    </div>
                    <button
                      onClick={() => onDeleteSource(s.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Research Notes */}
          {filteredResearch.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Research Notes ({filteredResearch.length})</h3>
              <div className="flex flex-col gap-2">
                {filteredResearch.map(r => (
                  <div key={r.id} className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-3 flex items-start gap-3">
                    <BookOpen size={14} className="text-green-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{r.title}</div>
                      <div className="text-xs text-gray-500">{r.category}</div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-3">{r.content}</p>
                      {r.tags?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {r.tags.map(t => (
                            <span key={t} className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <Tag size={9} />{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onDeleteResearch(r.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredResearch.length === 0 && filteredSources.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <FlaskConical size={40} className="mx-auto mb-3 opacity-30" />
              <p>{searchTerm ? 'Nothing matches your search' : 'No research yet — upload some files to get started'}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'prize' && (
        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto p-4">
          <PrizeCalibrationDashboard />
        </div>
      )}
    </div>
  );
}

function ResultSection({
  icon, title, color, children, expanded, onToggle
}: {
  icon: React.ReactNode;
  title: string;
  color: 'blue' | 'amber' | 'green';
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = {
    blue: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    green: 'text-green-400 border-green-500/20 bg-green-500/5'
  };

  return (
    <div className={`border rounded-xl overflow-hidden ${colors[color]}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 font-medium text-sm">
          {icon}
          {title}
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-2"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}
