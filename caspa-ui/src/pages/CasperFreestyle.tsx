import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ghost, Loader2, Send } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { casperFreestyle, getCasperStatus, listCasperSessions } from '../api/casper';

function CasperContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const { data: status } = useQuery({ queryKey: ['casper-status'], queryFn: getCasperStatus });
  const { data: sessions = [] } = useQuery({ queryKey: ['casper-sessions'], queryFn: listCasperSessions });

  const mutation = useMutation({
    mutationFn: () =>
      casperFreestyle({
        input,
        sessionId: sessionId ?? undefined,
        projectId: projectId || undefined,
      }),
    onSuccess: (data) => {
      const d = data as { session?: { id: string } };
      if (d.session?.id) setSessionId(d.session.id);
      setResult(data);
      setInput('');
      toast.success('Casper responded');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {status && (
        <p className="text-sm text-muted">{status.message}</p>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && input.trim() && mutation.mutate()}
          className="input flex-1"
          placeholder="Ask Casper anything..."
        />
        <button type="button" disabled={!input.trim() || mutation.isPending} onClick={() => mutation.mutate()} className="btn-primary">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </button>
      </div>
      {sessionId && <p className="text-xs text-muted">Session: {sessionId}</p>}
      {sessions.length > 0 && (
        <div className="text-xs text-muted">Recent sessions: {sessions.length}</div>
      )}
      {result !== null && (
        <ResultCard title="Casper Response">
          <JsonPreview data={result} />
        </ResultCard>
      )}
    </div>
  );
}

export default function CasperFreestyle() {
  return (
    <ElevationWorkbench
      title="Casper Freestyle"
      subtitle="Conversational command routing with tool suggestions"
      icon={<Ghost className="h-7 w-7 text-accent" />}
      requireProject={false}
    >
      {({ projectId }) => <CasperContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
