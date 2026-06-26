import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Loader2, PenLine, Sparkles, Wand2 } from 'lucide-react';
import { getOutput } from '../api/outputs';
import { continueWriting } from '../api/casper';
import { runGoldPass } from '../api/gold';
import { useToast } from '../components/Toast';

type OutputRecord = {
  id: string;
  projectId?: string;
  type: string;
  title: string;
  metadata?: {
    text?: string;
    critique?: string;
    kind?: string;
    provider?: string;
    model?: string;
  };
  createdAt: string;
};

export default function OutputDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: output, isLoading } = useQuery({
    queryKey: ['output', id],
    queryFn: () => getOutput(id!) as Promise<OutputRecord>,
    enabled: !!id,
  });

  const text = output?.metadata?.text ?? '';

  const markdown = useMemo(() => {
    if (!output) return '';
    return `# ${output.title}\n\n> ${output.type} · ${output.metadata?.provider ?? 'unknown'}/${output.metadata?.model ?? 'model'}\n\n${text}`;
  }, [output, text]);

  const continueMutation = useMutation({
    mutationFn: () =>
      continueWriting({
        projectId: output!.projectId!,
        currentText: text,
        mode: 'continue',
        parentOutputId: output!.id,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['outputs'] });
      toast.success(`Continued · saved ${result.outputId.slice(0, 8)}`);
      navigate(`/outputs/${result.outputId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const goldMutation = useMutation({
    mutationFn: () => runGoldPass(output!.projectId!, text),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['outputs'] });
      toast.success(`Gold Pass saved · ${result.outputId.slice(0, 8)}`);
      navigate(`/outputs/${result.outputId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function copyText() {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  async function exportMarkdown() {
    await navigator.clipboard.writeText(markdown);
    toast.success('Markdown copied to clipboard');
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#98711d]" />
      </div>
    );
  }

  if (!output) {
    return <p className="py-20 text-center text-muted">Output not found</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-room">
        <Link to="/outputs" className="btn-ghost mb-4 inline-flex text-sm">
          <ArrowLeft className="h-4 w-4" /> Outputs Hub
        </Link>
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">{output.type}</div>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-[#171a22]">{output.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {output.id.slice(0, 8)} · {new Date(output.createdAt).toLocaleString()}
          {output.metadata?.provider ? ` · ${output.metadata.provider}/${output.metadata.model}` : ''}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={copyText} className="btn-secondary text-sm">
            <Copy className="h-4 w-4" /> Copy
          </button>
          {output.projectId && (
            <>
              <button type="button" onClick={() => continueMutation.mutate()} disabled={continueMutation.isPending || !text} className="btn-primary text-sm">
                {continueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                Continue from this
              </button>
              <button type="button" onClick={() => goldMutation.mutate()} disabled={goldMutation.isPending || !text} className="btn-secondary text-sm">
                {goldMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Run Gold Pass
              </button>
              {output.projectId && (
                <Link to={`/projects/${output.projectId}/bible`} className="btn-secondary text-sm">
                  <Wand2 className="h-4 w-4" /> Project Bible
                </Link>
              )}
            </>
          )}
          <button type="button" onClick={exportMarkdown} className="btn-secondary text-sm">
            Export Markdown
          </button>
        </div>
      </header>

      {output.metadata?.critique && (
        <section className="rounded-[1.8rem] border border-[#eadfca] bg-[#fff8e8] p-5 shadow-paper">
          <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Critique</h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#3d352b]">{output.metadata.critique}</pre>
        </section>
      )}

      <section className="rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper">
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap font-serif text-lg leading-9 text-[#20202a]">
          {text || 'No text stored for this output.'}
        </pre>
      </section>
    </div>
  );
}
