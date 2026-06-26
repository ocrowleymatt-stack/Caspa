import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { ElevationWorkbench } from '../components/ElevationWorkbench';
import { listOutputs } from '../api/outputs';

type OutputRecord = {
  id: string;
  projectId?: string;
  type: string;
  title: string;
  path?: string;
  metadata?: {
    text?: string;
    kind?: string;
    provider?: string;
    model?: string;
  };
  createdAt: string;
};

function OutputsContent({ projectId }: { projectId: string }) {
  const { data: outputs = [], isLoading } = useQuery({
    queryKey: ['outputs', projectId],
    queryFn: () => listOutputs(projectId || undefined) as Promise<OutputRecord[]>,
  });

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
                    {output.id.slice(0, 8)} · {new Date(output.createdAt).toLocaleString()}
                    {output.metadata?.provider ? ` · ${output.metadata.provider}/${output.metadata.model ?? 'model'}` : ''}
                  </p>
                </div>
              </div>
              {text ? (
                <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4 text-sm leading-7 text-[#3d352b]">
                  {text.slice(0, 4000)}{text.length > 4000 ? '\n\n[Truncated in list view]' : ''}
                </pre>
              ) : (
                <p className="mt-4 text-sm text-muted">No inline text stored for this output.</p>
              )}
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
