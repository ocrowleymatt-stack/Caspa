import { useQuery } from '@tanstack/react-query';
import { Database } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { listIntakeSources } from '../api/intake';

function SourcesContent({ projectId }: { projectId: string }) {
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['intake-sources', projectId],
    queryFn: () => listIntakeSources(projectId || undefined),
  });

  if (isLoading) return <p className="text-muted text-center py-8">Loading sources...</p>;

  return (
    <div className="space-y-4">
      {sources.length === 0 ? (
        <p className="text-muted text-center py-12">
          No sources yet. Analyse content in Forge & Intake to populate the ledger.
        </p>
      ) : (
        <ResultCard title={`Source Ledger (${sources.length})`}>
          <JsonPreview data={sources} />
        </ResultCard>
      )}
    </div>
  );
}

export default function Sources() {
  return (
    <ElevationWorkbench
      title="Sources"
      subtitle="Universal intake ledger — classified source material"
      icon={<Database className="h-7 w-7 text-accent" />}
      requireProject={false}
    >
      {({ projectId }) => <SourcesContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
