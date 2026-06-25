import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { getMarketFit, getTicketBuyerFit, simulateAudience, simulateReviews } from '../api/audience';

function AudienceContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [result, setResult] = useState<unknown>(null);

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'simulate') return simulateAudience(projectId);
      if (action === 'market') return getMarketFit(projectId);
      if (action === 'ticket') return getTicketBuyerFit(projectId);
      return simulateReviews(projectId);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Audience analysis complete');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('simulate')} className="btn-primary">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simulate Audience'}
        </button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('market')} className="btn-secondary">Market Fit</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('reviews')} className="btn-secondary">Review Sim</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('ticket')} className="btn-secondary">Ticket Buyer Fit</button>
      </div>
      {result !== null && <ResultCard title="Results"><JsonPreview data={result} /></ResultCard>}
    </div>
  );
}

export default function Audience() {
  return (
    <ElevationWorkbench title="Audience Lab" subtitle="Persona simulation, market fit, and review previews" icon={<Users className="h-7 w-7 text-accent" />}>
      {({ projectId }) => <AudienceContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
