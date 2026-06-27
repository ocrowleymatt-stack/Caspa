import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Plus, Tag, Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import {
  createProjectAsset,
  deleteProjectAsset,
  listProjectAssets,
  patchProjectAsset,
  type AssetKind,
  type DetectedUse,
  type ProjectAsset,
} from '../../api/studio';
import { useToast } from '../../components/Toast';
import { isSupportedManuscriptFile, readManuscriptFile } from '../../lib/manuscriptUpload';

const USE_ACTIONS: Array<{ label: string; kind: AssetKind; detectedUse: DetectedUse; tag?: string }> = [
  { label: 'Use as story seed', kind: 'unknown', detectedUse: 'unknown', tag: 'story-seed' },
  { label: 'Use as research', kind: 'research', detectedUse: 'research' },
  { label: 'Use as world detail', kind: 'setting-note', detectedUse: 'setting note' },
  { label: 'Use as character evidence', kind: 'character-note', detectedUse: 'character note' },
  { label: 'Use as style sample', kind: 'style-sample', detectedUse: 'style sample' },
  { label: 'Ignore for generation', kind: 'unknown', detectedUse: 'unknown', tag: 'ignore-generation' },
];

function AssetCard({ asset, projectId }: { asset: ProjectAsset; projectId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const classifyMutation = useMutation({
    mutationFn: (action: (typeof USE_ACTIONS)[number]) =>
      patchProjectAsset(projectId, asset.id, {
        kind: action.kind,
        detectedUse: action.detectedUse,
        tags: action.tag ? [...new Set([...asset.tags, action.tag])] : asset.tags,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      toast.success('Asset classified — original preserved.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: () => deleteProjectAsset(projectId, asset.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      toast.success('Asset removed from library (original file not touched elsewhere).');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <article className="rounded-[1.5rem] border border-[#eadfca] bg-white p-5 shadow-paper">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl font-semibold text-[#171a22]">{asset.title}</h3>
          <p className="mt-1 text-xs font-mono uppercase tracking-wider text-muted">
            {asset.detectedUse} · {asset.kind}
          </p>
        </div>
        <button type="button" className="btn-ghost p-2 text-red-600" onClick={() => removeMutation.mutate()}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {asset.summary && <p className="mt-3 text-sm leading-6 text-muted">{asset.summary}</p>}
      <p className="mt-3 line-clamp-4 whitespace-pre-wrap font-serif text-sm leading-7 text-[#2a2520]">
        {asset.extractedText.slice(0, 400)}
        {asset.extractedText.length > 400 ? '…' : ''}
      </p>
      {asset.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {asset.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#fff8e8] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#98711d]">
              <Tag className="h-3 w-3" /> {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {USE_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="btn-secondary text-[10px]"
            disabled={classifyMutation.isPending}
            onClick={() => classifyMutation.mutate(action)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </article>
  );
}

export default function ProjectSourceLibrary() {
  const { id: projectId } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['project-assets', projectId],
    queryFn: () => listProjectAssets(projectId!),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createProjectAsset>[1]) => createProjectAsset(projectId!, input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      setPasteText('');
      setPasteTitle('');
      const units = result.structureSuggestion?.units?.length ?? 0;
      if (units >= 2) {
        toast.success(`Source saved — CASPA found ${units} possible chapters. Open Current Work to create them.`);
      } else {
        toast.success('Source asset saved — original preserved.');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length || !projectId) return;
    for (const file of Array.from(files)) {
      if (!isSupportedManuscriptFile(file) && !/\.(csv|json|pdf)$/i.test(file.name)) {
        toast.error(`${file.name}: use text, markdown, csv, json, or pdf — or paste directly.`);
        continue;
      }
      const { title, text } = await readManuscriptFile(file);
      if (!text.trim()) {
        toast.error(`${file.name}: no extractable text — paste or use a text file.`);
        continue;
      }
      await createProjectAsset(projectId, {
        title: title || file.name,
        originalFilename: file.name,
        mimeType: file.type || undefined,
        sourceText: text,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
    toast.success('Upload complete — classify assets below.');
    event.target.value = '';
  }

  function handlePaste(event: FormEvent) {
    event.preventDefault();
    if (!pasteText.trim()) {
      toast.error('Paste some material first.');
      return;
    }
    createMutation.mutate({
      title: pasteTitle.trim() || 'Pasted note',
      sourceText: pasteText.trim(),
    });
  }

  if (!projectId) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-[#eadfca] bg-[#fffaf0] p-6">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Source Library</div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Upload manuscripts, notes, receipts, fragments — even odd items. CASPA classifies them without overwriting originals.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="btn-primary cursor-pointer">
            <FileUp className="h-4 w-4" />
            Upload files
            <input type="file" multiple className="hidden" onChange={handleUpload} />
          </label>
        </div>
      </div>

      <form onSubmit={handlePaste} className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#98711d]">Paste a note or fragment</div>
        <input
          value={pasteTitle}
          onChange={(e) => setPasteTitle(e.target.value)}
          className="input mt-3"
          placeholder="Title (optional)"
        />
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          className="input mt-3 min-h-[120px] font-serif leading-7"
          placeholder="Paste notes, dialogue, receipt text, lyrics…"
        />
        <button type="submit" className="btn-secondary mt-3" disabled={createMutation.isPending}>
          <Plus className="h-4 w-4" /> Add to library
        </button>
      </form>

      {isLoading ? (
        <p className="text-center text-muted py-8">Loading source assets…</p>
      ) : assets.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-[#eadfca] py-16 text-center">
          <p className="font-serif text-xl text-[#171a22]">No source assets yet</p>
          <p className="mt-2 text-sm text-muted">Upload mixed files or paste fragments — receipts can become props or clues.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} projectId={projectId} />
          ))}
        </div>
      )}
    </div>
  );
}
