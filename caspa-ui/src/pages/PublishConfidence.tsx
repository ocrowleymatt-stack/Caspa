import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, ShieldCheck } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { checkPublishConfidence, listConfidenceCertificates } from '../api/publishConfidence';

function PublishConfidenceContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [result, setResult] = useState<unknown>(null);

  const { data: certs = [], refetch } = useQuery({
    queryKey: ['confidence-certs', projectId],
    queryFn: () => listConfidenceCertificates(projectId),
    enabled: Boolean(projectId),
  });

  const mutation = useMutation({
    mutationFn: () => checkPublishConfidence(projectId),
    onSuccess: (data) => {
      setResult(data);
      refetch();
      toast.success('Confidence check complete');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="btn-primary">
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Confidence Check'}
      </button>
      <p className="text-sm text-muted">
        Combines quality-core, verification, and publishing readiness into a single certificate.
      </p>
      {result !== null && (
        <ResultCard title="Latest Certificate">
          <JsonPreview data={result} />
        </ResultCard>
      )}
      {certs.length > 0 && (
        <ResultCard title={`Previous Certificates (${certs.length})`}>
          <JsonPreview data={certs} />
        </ResultCard>
      )}
    </div>
  );
}

export default function PublishConfidence() {
  return (
    <ElevationWorkbench
      title="Publish Confidence"
      subtitle="Pre-flight checks before export and distribution"
      icon={<ShieldCheck className="h-7 w-7 text-accent" />}
    >
      {({ projectId }) => <PublishConfidenceContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
