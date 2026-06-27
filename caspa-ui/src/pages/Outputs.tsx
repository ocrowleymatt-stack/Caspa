import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Package, Sparkles } from 'lucide-react';
import { ElevationWorkbench } from '../components/ElevationWorkbench';
import { listOutputs } from '../api/outputs';
import { listProjects } from '../api/projects';
import {
  extractOutputProvenance,
  extractOutputText,
  normalizeOutputKind,
  outputExcerpt,
  OUTPUT_KIND_LABELS,
  type OutputKind,
  type OutputRecord,
} from '../lib/outputSemantics';
import { useToast } from '../components/Toast';
import { countWords } from '../lib/utils';

const FILTER_OPTIONS: Array<{ id: 'all' | OutputKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'novel-write-pro', label: 'Drafts' },
  { id: 'next-chapter-draft', label: 'Chapter drafts' },
  { id: 'book-map', label: 'Book maps' },
  { id: 'finish-book', label: 'Finish plans' },
  { id: 'trash-to-treasure', label: 'Trash to Treasure' },
  { id: 'gold-pass', label: 'Gold passes' },
  { id: 'agent-swarm-report', label: 'Swarm reports' },
  { id: 'claim-extraction', label: 'Research' },
  { id: 'export-package', label: 'Exports' },
];

export function OutputsContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [kindFilter, setKindFilter] = useState<'all' | OutputKind>('all');

  const { data: outputs = [], isLoading } = useQuery({
    queryKey: ['outputs', projectId],
    queryFn: () => listOutputs(projectId || undefined),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const projectTitle = (pid?: string) =>
    projects.find((p) => p.id === pid)?.title ?? (pid ? pid.slice(0, 8) : 'Unscoped');

  const filtered = useMemo(() => {
    if (kindFilter === 'all') return outputs;
    return outputs.filter((output) => normalizeOutputKind(output.type, output.metadata) === kindFilter);
  }, [outputs, kindFilter]);

  if (isLoading) return <p className="text-muted text-center py-8">Loading outputs...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setKindFilter(option.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              kindFilter === option.id
                ? 'bg-[#171a22] text-white'
                : 'border border-[#eadfca] bg-white text-[#766b58] hover:border-[#caa044]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted">No outputs in this filter. Run Novel Write Pro, Trash to Treasure, or Gold Pipeline.</p>
          <Link to="/casper/trash-to-treasure" className="btn-primary mt-6 inline-flex">Trash to Treasure</Link>
        </div>
      ) : (
        filtered.map((output: OutputRecord) => {
          const text = extractOutputText(output.metadata);
          const kind = normalizeOutputKind(output.type, output.metadata);
          const kindLabel = OUTPUT_KIND_LABELS[kind];
          const provenance = extractOutputProvenance(output);

          return (
            <article key={output.id} className="rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">{kindLabel}</div>
                  <h3 className="mt-1 font-serif text-2xl font-semibold text-[#171a22]">{output.title}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {output.id.slice(0, 8)} · {projectTitle(output.projectId)} · {new Date(output.createdAt).toLocaleString()}
                    {provenance.providerLabel ? ` · ${provenance.providerLabel}` : ''}
                    {text ? ` · ${countWords(text).toLocaleString()} words` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5f5648]">
                    {provenance.workTypeLabel && (
                      <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-2 py-0.5">
                        {provenance.workTypeLabel}
                      </span>
                    )}
                    {provenance.sourceLabel && (
                      <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-2 py-0.5">
                        {provenance.sourceLabel}
                      </span>
                    )}
                    {provenance.awardsLabel && (
                      <span className="rounded-full border border-[#eadfca] bg-[#fffdf8] px-2 py-0.5">
                        Awards: {provenance.awardsLabel}
                      </span>
                    )}
                  </div>
                  {text && <p className="mt-3 text-sm leading-7 text-[#5f5648]">{outputExcerpt(text)}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigate(`/outputs/${output.id}`)} className="btn-primary text-xs">
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(text);
                      toast.success('Copied');
                    }}
                    disabled={!text}
                    className="btn-secondary text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                  <Link to={`/outputs/${output.id}?gold=1`} className="btn-secondary text-xs">
                    <Sparkles className="h-3.5 w-3.5" /> Gold
                  </Link>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}

export default function Outputs() {
  return (
    <ElevationWorkbench
      title="Saved Writing Hub"
      subtitle="Central registry for all generated artefacts — provenance, safe apply, and export"
      icon={<Package className="h-7 w-7 text-accent" />}
      requireProject={false}
    >
      {({ projectId }) => <OutputsContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
