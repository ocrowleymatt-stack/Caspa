import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, MapPin } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { castSize, localiseProject, localJokes, sponsorSafe, venueCustom } from '../api/localise';

function LocaliseContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [region, setRegion] = useState('UK');
  const [result, setResult] = useState<unknown>(null);

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'project') return localiseProject(projectId, region);
      if (action === 'jokes') return localJokes(region, undefined, projectId);
      if (action === 'cast') return castSize(8, 200);
      if (action === 'venue') return venueCustom('proscenium', 'theatre');
      return sponsorSafe('Tonight\'s performance', 'Community Partner');
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Localisation complete');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <input value={region} onChange={(e) => setRegion(e.target.value)} className="input max-w-xs" placeholder="Region" />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('project')} className="btn-primary">{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adapt Project'}</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('jokes')} className="btn-secondary">Local Jokes</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('cast')} className="btn-secondary">Cast Size</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('venue')} className="btn-secondary">Venue</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('sponsor')} className="btn-secondary">Sponsor Safe</button>
      </div>
      {result !== null && <ResultCard title="Results"><JsonPreview data={result} /></ResultCard>}
    </div>
  );
}

export default function Localise() {
  return (
    <ElevationWorkbench title="Localise" subtitle="Regional tone, jokes, cast and venue customisation" icon={<MapPin className="h-7 w-7 text-accent" />}>
      {({ projectId }) => <LocaliseContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
