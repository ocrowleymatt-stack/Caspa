import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Briefcase } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { listShowPackages } from '../api/showFactory';
import { budget, castCrew, revenue, rightsRisk, schedule, venueFit } from '../api/producer';

function ProducerContent({ projectId }: { projectId: string }) {
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
      if (action === 'rights') return rightsRisk(projectId);
      if (!packageId) throw new Error('Select a show package');
      if (action === 'budget') return budget(packageId);
      if (action === 'venue') return venueFit(packageId);
      if (action === 'schedule') return schedule(packageId);
      if (action === 'cast') return castCrew(packageId);
      return revenue(packageId);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Producer analysis complete');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className="input max-w-md">
        <option value="">Select show package (optional for rights scan)...</option>
        {packages.map((p) => (
          <option key={p.id} value={p.id}>{p.title}</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('budget')} className="btn-primary">{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Budget'}</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('venue')} className="btn-secondary">Venue Fit</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('rights')} className="btn-secondary">Rights Risk</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('schedule')} className="btn-secondary">Schedule</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('cast')} className="btn-secondary">Cast & Crew</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('revenue')} className="btn-secondary">Revenue</button>
      </div>
      {result !== null && <ResultCard title="Results"><JsonPreview data={result} /></ResultCard>}
    </div>
  );
}

export default function Producer() {
  return (
    <ElevationWorkbench title="Producer Desk" subtitle="Budget, venue, rights, schedule, and revenue" icon={<Briefcase className="h-7 w-7 text-accent" />}>
      {({ projectId }) => <ProducerContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
