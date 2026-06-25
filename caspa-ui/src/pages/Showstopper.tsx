import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Star } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { bigNumber, finale, findShowstopper, posterQuotes, trailerMoments } from '../api/showstopper';

function ShowstopperContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [result, setResult] = useState<unknown>(null);

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'find') return findShowstopper(projectId);
      if (action === 'big') return bigNumber(projectId);
      if (action === 'finale') return finale(projectId);
      if (action === 'trailer') return trailerMoments(projectId);
      return posterQuotes(projectId);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Showstopper pack generated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('find')} className="btn-primary">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find Moments'}
        </button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('big')} className="btn-secondary">Big Number</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('finale')} className="btn-secondary">Finale</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('trailer')} className="btn-secondary">Trailer Moments</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('poster')} className="btn-secondary">Poster Quotes</button>
      </div>
      {result !== null && <ResultCard title="Showstopper Bundle"><JsonPreview data={result} /></ResultCard>}
    </div>
  );
}

export default function Showstopper() {
  return (
    <ElevationWorkbench title="Showstopper" subtitle="Signature moments, killer lines, and trailer beats" icon={<Star className="h-7 w-7 text-accent" />}>
      {({ projectId }) => <ShowstopperContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
