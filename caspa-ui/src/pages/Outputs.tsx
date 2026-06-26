import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Package, PenLine, Sparkles } from 'lucide-react';
import { ElevationWorkbench } from '../components/ElevationWorkbench';
import { listOutputs } from '../api/outputs';
import { listProjects } from '../api/projects';
import { useToast } from '../components/Toast';

type OutputRecord = {
  id: string;
  projectId?: string;
  type: string;
  title: string;
  metadata?: {
    text?: string;
    kind?: string;
    provider?: string;
    model?: string;
  };
  createdAt: string;
};

function excerpt(text: string, limit = 220): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

function OutputsContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const navigate = useNavigate();

  const { data: outputs = [], isLoading } = useQuery({
    queryKey: ['outputs', projectId],
    queryFn: () => listOutputs(projectId || undefined) as Promise<OutputRecord[]>,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const projectTitle = (pid?: string) =>
    projects.find((p) => p.id === pid)?.title ?? (pid ? pid.slice(0, 8) : 'Unscoped');

  if (isLoading) return <p className="text-muted text-center py-8">Loading outputs...</p>;

  return (
    <div className="space-y-4">
      {outputs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted">No registered outputs yet. Run Novel Write Pro or Gold Pipeline to populate this hub.</p>
          <Link to="/casper" className="btn-primary mt-6 inline-flex">Open Casper · Novel Write Pro</Link>
        </div>
      ) : (
        outputs.map((output) => {
          const text = output.metadata?.text ?? '';
          return (
            <article key={output.id} className="rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">{output.type}</div>
                  <h3 className="mt-1 font-serif text-2xl font-semibold text-[#171a22]">{output.title}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {output.id.slice(0, 8)} · {projectTitle(output.projectId)} · {new Date(output.createdAt).toLocaleString()}
                    {output.metadata?.provider ? ` · ${output.metadata.provider}/${output.metadata.model ?? 'model'}` : ''}
                  </p>
                  {text && <p className="mt-3 text-sm leading-7 text-[#5f5648]">{excerpt(text)}</p>}
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
                  <Link to={`/outputs/${output.id}`} className="btn-secondary text-xs">
                    <PenLine className="h-3.5 w-3.5" /> Continue
                  </Link>
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
      title="Outputs Hub"
      subtitle="Central registry for all generated artefacts"
      icon={<Package className="h-7 w-7 text-accent" />}
      requireProject={false}
    >
      {({ projectId }) => <OutputsContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
