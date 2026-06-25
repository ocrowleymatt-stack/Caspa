import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, ShieldCheck } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { checkProject, checkText, finalGate } from '../api/quality';

function QualityContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [text, setText] = useState('Sample marketing or manuscript excerpt for quality gates.');
  const [result, setResult] = useState<unknown>(null);

  const mutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'project') return checkProject(projectId);
      if (action === 'final') return finalGate(projectId);
      return checkText(text);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Quality check complete');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="input min-h-[100px]" />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('text')} className="btn-primary">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check Text'}
        </button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('project')} className="btn-secondary">Check Project</button>
        <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate('final')} className="btn-secondary">Final Gate</button>
      </div>
      {result !== null && <ResultCard title="Gate Results"><JsonPreview data={result} /></ResultCard>}
    </div>
  );
}

export default function Quality() {
  return (
    <ElevationWorkbench title="Quality Gates" subtitle="PASS / REVISE / BLOCK checks across craft and safety" icon={<ShieldCheck className="h-7 w-7 text-accent" />}>
      {({ projectId }) => <QualityContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
