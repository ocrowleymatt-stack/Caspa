import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Mic } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { listShowPackages } from '../api/showFactory';
import { blocking, castability, pacing, rehearsalNotes, tableRead } from '../api/rehearsal';

function RehearsalContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [packageId, setPackageId] = useState('');
  const [result, setResult] = useState<unknown>(null);

  const { data: packages = [] } = useQuery({
    queryKey: ['show-packages', projectId],
    queryFn: () => listShowPackages(projectId),
    enabled: !!projectId,
  });

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      if (!packageId) throw new Error('Select a show package');
      if (action === 'table') return tableRead(packageId);
      if (action === 'blocking') return blocking(packageId);
      if (action === 'pacing') return pacing(packageId);
      if (action === 'cast') return castability(packageId);
      return rehearsalNotes(packageId);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Rehearsal analysis complete');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className="input max-w-md">
        <option value="">Select show package...</option>
        {packages.map((p) => (
          <option key={p.id} value={p.id}>{p.title}</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={mutation.isPending || !packageId} onClick={() => mutation.mutate('table')} className="btn-primary">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Table Read'}
        </button>
        <button type="button" disabled={mutation.isPending || !packageId} onClick={() => mutation.mutate('blocking')} className="btn-secondary">Blocking</button>
        <button type="button" disabled={mutation.isPending || !packageId} onClick={() => mutation.mutate('pacing')} className="btn-secondary">Pacing</button>
        <button type="button" disabled={mutation.isPending || !packageId} onClick={() => mutation.mutate('cast')} className="btn-secondary">Castability</button>
        <button type="button" disabled={mutation.isPending || !packageId} onClick={() => mutation.mutate('notes')} className="btn-secondary">Notes Pack</button>
      </div>
      {packages.length === 0 && <p className="text-sm text-muted">Generate a show pack in Show Factory first.</p>}
      {result !== null && <ResultCard title="Results"><JsonPreview data={result} /></ResultCard>}
    </div>
  );
}

export default function Rehearsal() {
  return (
    <ElevationWorkbench title="Rehearsal Room" subtitle="Table reads, blocking, pacing, and castability" icon={<Mic className="h-7 w-7 text-accent" />}>
      {({ projectId }) => <RehearsalContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
