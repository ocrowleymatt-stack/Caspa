import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Music2 } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { interpretMusicPrompt, startJamSession } from '../api/musicPrompt';

function MusicPromptContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [prompt, setPrompt] = useState('Slow atmospheric ballad with piano and strings, melancholic but hopeful');
  const [result, setResult] = useState<unknown>(null);

  const interpretMutation = useMutation({
    mutationFn: () => interpretMusicPrompt(prompt),
    onSuccess: (data) => {
      setResult(data);
      toast.success('Prompt interpreted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const jamMutation = useMutation({
    mutationFn: () =>
      startJamSession({
        projectId: projectId || undefined,
        promptId: (result as { id?: string })?.id,
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success('Jam session started');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="input min-h-[100px]" />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={interpretMutation.isPending} onClick={() => interpretMutation.mutate()} className="btn-primary">
          {interpretMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Interpret Prompt'}
        </button>
        <button type="button" disabled={jamMutation.isPending} onClick={() => jamMutation.mutate()} className="btn-secondary">
          Start Jam Session
        </button>
      </div>
      <p className="text-xs text-muted">
        Distinct from Music Lab — this module interprets natural language and runs jam sessions. Music Lab handles track briefs.
      </p>
      {result !== null && (
        <ResultCard title="Music Prompt Result">
          <JsonPreview data={result} />
        </ResultCard>
      )}
    </div>
  );
}

export default function MusicPromptLab() {
  return (
    <ElevationWorkbench
      title="Music Prompt Lab"
      subtitle="Natural language music interpretation and jam sessions"
      icon={<Music2 className="h-7 w-7 text-accent" />}
      requireProject={false}
    >
      {({ projectId }) => <MusicPromptContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
