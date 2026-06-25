import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Paintbrush } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { palette, posterCopy, trailerScript, visualIdentity } from '../api/visuals';

function VisualsContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [result, setResult] = useState<unknown>(null);

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'identity') return visualIdentity(projectId);
      if (action === 'poster') return posterCopy(projectId);
      if (action === 'palette') return palette(projectId);
      return trailerScript(projectId);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Visuals generated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('identity')} className="btn-primary">{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Visual Identity'}</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('poster')} className="btn-secondary">Poster Copy</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('palette')} className="btn-secondary">Colour Palette</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('trailer')} className="btn-secondary">Trailer Script</button>
      </div>
      {result !== null && <ResultCard title="Results"><JsonPreview data={result} /></ResultCard>}
    </div>
  );
}

export default function Visuals() {
  return (
    <ElevationWorkbench title="Visuals" subtitle="Identity, poster, palette, and trailer script" icon={<Paintbrush className="h-7 w-7 text-accent" />}>
      {({ projectId }) => <VisualsContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
