import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Loader2, PenLine, Sparkles, Wand2 } from 'lucide-react';
import { getOutput } from '../api/outputs';
import { continueWriting } from '../api/casper';
import { runGoldPass } from '../api/gold';
import { getProject } from '../api/projects';
import { updateChapter } from '../api/chapters';
import { countWords } from '../lib/utils';
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
    sourceChapterId?: string;
    sourceChapterTitle?: string;
    improvementMode?: string;
    improveExisting?: boolean;
  };
  createdAt: string;
};

export default function OutputDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: output, isLoading } = useQuery({
    queryKey: ['output', id],
    queryFn: () => getOutput(id!) as Promise<OutputRecord>,
    enabled: !!id,
  });

  const { data: sourceProject } = useQuery({
    queryKey: ['project', output?.projectId],
    queryFn: () => getProject(output!.projectId!),
    enabled: !!output?.projectId,
  });

  const text = output?.metadata?.text ?? '';
  const sourceChapterId = output?.metadata?.sourceChapterId;
  const canApplyRevision = Boolean(output?.projectId && sourceChapterId && text.trim());

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
      toast.success(`Gold Pass saved · ${result.outputId.slice(0, 8)} (used this output text)`);
      navigate(`/outputs/${result.outputId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const applyRevisionMutation = useMutation({
    mutationFn: async () => {
      await updateChapter(sourceChapterId!, {
        content: text,
        wordCount: countWords(text),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapter', sourceChapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapters', output?.projectId] });
      queryClient.invalidateQueries({ queryKey: ['chapter-history', sourceChapterId] });
      toast.success('Revision applied to chapter · previous version saved in chapter history');
      navigate(`/projects/${output!.projectId}/chapters/${sourceChapterId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleApplyRevision() {
    const confirmed = confirm(
      'Replace the current chapter text with this revision? The previous version will remain in chapter history.',
    );
    if (confirmed) applyRevisionMutation.mutate();
  }

  const autoGoldStarted = useRef(false);

  useEffect(() => {
    if (searchParams.get('gold') !== '1' || autoGoldStarted.current) return;
    if (!output?.projectId || !text.trim()) return;
    autoGoldStarted.current = true;
    goldMutation.mutate();
  }, [output?.projectId, text, searchParams, goldMutation]);

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
        <p className="mt-3 text-sm leading-6 text-[#5f5648]">
          Saved output only — your manuscript chapters are not changed unless you copy or apply text yourself.
        </p>
        {(output.type === 'manuscript-improvement' || output.metadata?.improveExisting) && (
          <div className="mt-4 rounded-[1.35rem] border border-[#eadfca] bg-[#fffdf8] p-4 text-sm leading-7 text-[#3d352b]">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Improvement source</div>
            <ul className="mt-2 space-y-1">
              {sourceProject && <li><strong>Project:</strong> {sourceProject.title}</li>}
              {output.metadata?.sourceChapterTitle && (
                <li><strong>Source chapter:</strong> {output.metadata.sourceChapterTitle}</li>
              )}
              {output.metadata?.improvementMode && (
                <li><strong>Mode:</strong> {output.metadata.improvementMode}</li>
              )}
            </ul>
          </div>
        )}
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
              {canApplyRevision && (
                <button
                  type="button"
                  onClick={handleApplyRevision}
                  disabled={applyRevisionMutation.isPending}
                  className="btn-secondary text-sm"
                >
                  {applyRevisionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  Apply this revision to chapter
                </button>
              )}
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
