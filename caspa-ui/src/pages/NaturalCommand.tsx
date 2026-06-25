import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Command, Loader2 } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { interpretCommand, planCommand, executeCommand } from '../api/command';

function NaturalCommandContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [result, setResult] = useState<unknown>(null);

  const mutation = useMutation({
    mutationFn: (action: 'interpret' | 'plan' | 'execute') => {
      const body = { text, projectId: projectId || undefined };
      if (action === 'interpret') return interpretCommand(body);
      if (action === 'plan') return planCommand(body);
      return executeCommand(body);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success('Command processed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canRun = text.trim().length > 0;

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input min-h-[120px]"
        placeholder="Describe what you want CASPA to do..."
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canRun || mutation.isPending}
          onClick={() => mutation.mutate('interpret')}
          className="btn-primary"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Command className="h-4 w-4" />}
          Go
        </button>
        <button type="button" disabled={!canRun || mutation.isPending} onClick={() => mutation.mutate('plan')} className="btn-secondary">
          Plan Workflow
        </button>
        <button type="button" disabled={!canRun || mutation.isPending} onClick={() => mutation.mutate('execute')} className="btn-secondary">
          Execute
        </button>
      </div>
      {result !== null && (
        <ResultCard title="Command Result">
          <JsonPreview data={result} />
        </ResultCard>
      )}
    </div>
  );
}

export default function NaturalCommand() {
  return (
    <ElevationWorkbench
      title="Natural Command"
      subtitle="Plain-English orchestration across CASPA modules"
      icon={<Command className="h-7 w-7 text-accent" />}
      requireProject={false}
    >
      {({ projectId }) => <NaturalCommandContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
