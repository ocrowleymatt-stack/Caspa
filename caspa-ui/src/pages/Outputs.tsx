import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { listOutputs } from '../api/outputs';

function OutputsContent({ projectId }: { projectId: string }) {
  const { data: outputs = [], isLoading } = useQuery({
    queryKey: ['outputs', projectId],
    queryFn: () => listOutputs(projectId || undefined),
  });

  if (isLoading) return <p className="text-muted text-center py-8">Loading outputs...</p>;

  return (
    <div className="space-y-4">
      {outputs.length === 0 ? (
        <p className="text-muted text-center py-12">
          No registered outputs yet. Generate documents, confidence certificates, or product plans to populate this hub.
        </p>
      ) : (
        <ResultCard title={`Output Registry (${outputs.length})`}>
          <JsonPreview data={outputs} />
        </ResultCard>
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
