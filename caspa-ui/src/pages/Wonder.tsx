import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import {
  analyseProject,
  audienceSim,
  createMotif,
  criticPanel,
  getWonderScore,
  listMotifs,
  polishText,
  revisionLadder,
} from '../api/wonder';

function WonderContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [motifLabel, setMotifLabel] = useState('');
  const [result, setResult] = useState<unknown>(null);

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      const sample = text || 'Sample passage for analysis.';
      switch (action) {
        case 'arc': return analyseProject(projectId);
        case 'score': return getWonderScore(projectId);
        case 'motifs': return listMotifs(projectId);
        case 'polish': return polishText(sample, projectId);
        case 'critic': return criticPanel(sample, projectId);
        case 'ladder': return revisionLadder(sample, projectId);
        case 'sim': return audienceSim(sample, projectId);
        case 'add-motif':
          if (!motifLabel.trim()) throw new Error('Enter a motif label');
          await createMotif({ projectId, label: motifLabel, description: '' });
          return listMotifs(projectId);
        default: throw new Error('Unknown action');
      }
    },
    onSuccess: (data, action) => {
      setResult(data);
      if (action === 'add-motif') setMotifLabel('');
      toast.success('Wonder engine complete');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="input min-h-[100px]" placeholder="Paste text for polish, critic panel, revision ladder, or audience sim..." />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('arc')} className="btn-primary">{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Analyse Project'}</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('score')} className="btn-secondary">Award Score</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('polish')} className="btn-secondary">Polish Text</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('critic')} className="btn-secondary">Critic Panel</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('ladder')} className="btn-secondary">Revision Ladder</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('sim')} className="btn-secondary">Audience Sim</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('motifs')} className="btn-secondary">Load Motifs</button>
      </div>
      <div className="flex gap-2">
        <input value={motifLabel} onChange={(e) => setMotifLabel(e.target.value)} className="input flex-1" placeholder="New motif label" />
        <button type="button" disabled={!motifLabel || mutation.isPending} onClick={() => mutation.mutate('add-motif')} className="btn-primary">Add Motif</button>
      </div>
      {result !== null && <ResultCard title="Results"><JsonPreview data={result} /></ResultCard>}
    </div>
  );
}

export default function Wonder() {
  return (
    <ElevationWorkbench title="Wonder Engine" subtitle="Emotional arc, critics, polish, and motifs" icon={<Sparkles className="h-7 w-7 text-accent" />}>
      {({ projectId }) => <WonderContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
