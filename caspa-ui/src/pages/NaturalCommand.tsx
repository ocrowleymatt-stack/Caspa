import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Command, Loader2 } from 'lucide-react';
import { ElevationWorkbench } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { executeCommand } from '../api/command';
import {
  parseCommandResponse,
  QUICK_COMMANDS,
  routeForText,
} from '../lib/commandNavigation';
import { useAppStore } from '../store';

function NaturalCommandContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const navigate = useNavigate();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const effectiveProjectId = projectId || activeProjectId || '';
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReturnType<typeof parseCommandResponse> | null>(null);

  const mutation = useMutation({
    mutationFn: (commandText: string) =>
      executeCommand({
        text: commandText,
        projectId: effectiveProjectId || undefined,
      }),
    onSuccess: (data, commandText) => {
      const view = parseCommandResponse(data, commandText, effectiveProjectId);
      setResult(view);
      toast.success(view.route ? `Ready: ${view.route.label}` : 'Command processed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function runCommand(nextText: string) {
    setText(nextText);
    const route = routeForText(nextText, effectiveProjectId);
    if (route) {
      setResult(parseCommandResponse({ summary: `Opening ${route.label}.` }, nextText, effectiveProjectId));
      navigate(route.path);
      return;
    }
    mutation.mutate(nextText);
  }

  const canRun = text.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-[1.6rem] border border-[#eadfca] bg-[#fffdf8] p-5 text-sm leading-7 text-[#5f5648]">
        <p>
          <strong className="text-[#171a22]">Studio Command</strong> is project-aware orchestration — not a chatbot.
          It routes you to the right room: Pier, Research, Gold, Swarm, Outputs, or Novel Write Pro.
        </p>
        {!effectiveProjectId && (
          <p className="mt-2 text-[#98711d]">
            Select an active project in the sidebar for manuscript-specific commands.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            type="button"
            onClick={() => runCommand(cmd.text)}
            className="rounded-full border border-[#eadfca] bg-white px-3 py-1.5 text-xs font-semibold text-[#5f5648] hover:border-[#caa044] hover:bg-[#fff8e8]"
          >
            {cmd.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input min-h-[120px] font-serif leading-loose tracking-wide"
        placeholder="e.g. What should I do next? · Run Gold against the Awards Shelf · Check research accuracy · Swarm this chapter"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canRun || mutation.isPending}
          onClick={() => runCommand(text)}
          className="btn-primary"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Command className="h-4 w-4" />}
          Run command
        </button>
        {effectiveProjectId && (
          <Link to={`/projects/${effectiveProjectId}`} className="btn-secondary">
            Open project overview
          </Link>
        )}
      </div>

      {result && (
        <section className="rounded-[1.6rem] border border-[#eadfca] bg-white p-5 shadow-paper">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Result</div>
          <p className="mt-2 text-sm leading-7 text-[#171a22]">{result.summary}</p>
          {result.intent && (
            <p className="mt-2 text-xs text-muted">
              Intent: {result.intent.replace(/_/g, ' ')}
              {typeof result.confidence === 'number' ? ` · ${Math.round(result.confidence * 100)}% match` : ''}
            </p>
          )}
          {result.route && (
            <Link to={result.route.path} className="btn-primary mt-4 text-sm">
              {result.route.label} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {result.route?.hint && (
            <p className="mt-2 text-xs leading-5 text-muted">{result.route.hint}</p>
          )}
          {result.suggestedActions && result.suggestedActions.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-muted">
              {result.suggestedActions.map((action) => (
                <li key={action}>• {action}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default function NaturalCommand() {
  return (
    <ElevationWorkbench
      title="Studio Command"
      subtitle="Project-aware commands — route to the right workflow, not random chat"
      icon={<Command className="h-7 w-7 text-accent" />}
      requireProject={false}
    >
      {({ projectId }) => <NaturalCommandContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
