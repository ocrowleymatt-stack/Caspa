import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Trophy } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { artistStatement, awardsReadiness, categoryFit, festivalPack, judgesBrief, pullQuotes } from '../api/awards';

function AwardsContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [result, setResult] = useState<unknown>(null);

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'readiness') return awardsReadiness(projectId);
      if (action === 'festival') return festivalPack(projectId);
      if (action === 'artist') return artistStatement(projectId);
      if (action === 'judges') return judgesBrief(projectId);
      if (action === 'quotes') return pullQuotes(projectId);
      return categoryFit(projectId);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Awards pack generated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('readiness')} className="btn-primary">{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Readiness Pack'}</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('festival')} className="btn-secondary">Festival Fit</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('artist')} className="btn-secondary">Artist Statement</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('judges')} className="btn-secondary">Judges Brief</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('quotes')} className="btn-secondary">Pull Quotes</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('category')} className="btn-secondary">Category Fit</button>
      </div>
      {result !== null && <ResultCard title="Results"><JsonPreview data={result} /></ResultCard>}
    </div>
  );
}

export default function Awards() {
  return (
    <ElevationWorkbench title="Awards" subtitle="Festival packs, statements, and submission materials" icon={<Trophy className="h-7 w-7 text-accent" />}>
      {({ projectId }) => <AwardsContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
