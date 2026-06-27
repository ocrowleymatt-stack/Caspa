import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getOutput } from '../api/outputs';
import { continueWriting } from '../api/casper';
import { runGoldPass } from '../api/gold';
import { getProject } from '../api/projects';
import { applyManuscriptOutput } from '../api/book';
import { OutputApplyActions } from '../components/outputs/OutputApplyActions';
import { OutputProvenancePanel } from '../components/outputs/OutputProvenancePanel';
import {
  extractOutputProvenance,
  extractOutputText,
  getApplyCapabilities,
  normalizeOutputKind,
  OUTPUT_KIND_LABELS,
} from '../lib/outputSemantics';
import { useToast } from '../components/Toast';

export default function OutputDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: output, isLoading } = useQuery({
    queryKey: ['output', id],
    queryFn: () => getOutput(id!),
    enabled: !!id,
  });

  const { data: sourceProject } = useQuery({
    queryKey: ['project', output?.projectId],
    queryFn: () => getProject(output!.projectId!),
    enabled: !!output?.projectId,
  });

  const text = extractOutputText(output?.metadata);
  const sourceChapterId = output?.metadata?.sourceChapterId ?? output?.metadata?.chapterId;
  const provenance = useMemo(
    () => (output ? extractOutputProvenance(output, sourceProject?.workType) : null),
    [output, sourceProject?.workType],
  );
  const capabilities = useMemo(
    () => (output ? getApplyCapabilities(output) : null),
    [output],
  );

  const kindLabel = output
    ? OUTPUT_KIND_LABELS[normalizeOutputKind(output.type, output.metadata)]
    : 'Output';

  const markdown = useMemo(() => {
    if (!output) return '';
    return `# ${output.title}\n\n> ${kindLabel} · ${output.metadata?.provider ?? 'archive'}/${output.metadata?.model ?? 'model'}\n\n${text}`;
  }, [output, text, kindLabel]);

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

  const applyRevisionMutation = useMutation({
    mutationFn: async () => {
      if (!output?.projectId || !sourceChapterId) {
        throw new Error('Missing project or source chapter for apply.');
      }
      return applyManuscriptOutput(output.projectId, {
        outputId: output.id,
        mode: 'replace-unit',
        unitId: sourceChapterId,
        confirmed: true,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['chapter', sourceChapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapters', output?.projectId] });
      queryClient.invalidateQueries({ queryKey: ['chapter-history', sourceChapterId] });
      toast.success(`Revision applied safely · snapshot ${result.snapshotId.slice(0, 8)}`);
      navigate(`/projects/${output!.projectId}/chapters/${result.unitId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleApplyRevision() {
    const confirmed = confirm(
      'Replace the current chapter text with this revision? A snapshot will be created first. The previous version will remain in chapter history.',
    );
    if (!confirmed) return;
    applyRevisionMutation.mutate();
  }

  const autoGoldStarted = useRef(false);
  const [goldPromptOpen, setGoldPromptOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('gold') !== '1' || autoGoldStarted.current) return;
    if (!output?.projectId || !text.trim()) return;
    autoGoldStarted.current = true;
    setGoldPromptOpen(true);
  }, [output?.projectId, text, searchParams]);

  function handleGoldPass() {
    const confirmed = confirm(
      'Run Gold Pass on this output? A new gold artefact will be saved — your original output stays untouched.',
    );
    if (confirmed) goldMutation.mutate();
  }

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

  if (!output || !provenance || !capabilities) {
    return <p className="py-20 text-center text-muted">Output not found</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 overflow-x-hidden pb-6">
      <header className="rounded-[2rem] border border-[#eadfca] bg-white p-4 shadow-room sm:p-6">
        <Link
          to={output.projectId ? `/projects/${output.projectId}/outputs` : '/outputs'}
          className="btn-ghost mb-4 inline-flex text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Outputs archive
        </Link>
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">{kindLabel}</div>
        <h1 className="mt-2 break-words font-serif text-2xl font-semibold text-[#171a22] sm:text-4xl">{output.title}</h1>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <OutputProvenancePanel
            provenance={provenance}
            projectTitle={sourceProject?.title}
            outputId={output.id}
            createdAt={output.createdAt}
          />
          <OutputApplyActions
            projectId={output.projectId}
            capabilities={capabilities}
            onCopy={copyText}
            onContinue={() => continueMutation.mutate()}
            onGold={handleGoldPass}
            onApply={handleApplyRevision}
            onExportMarkdown={exportMarkdown}
            continuePending={continueMutation.isPending}
            goldPending={goldMutation.isPending}
            applyPending={applyRevisionMutation.isPending}
          />
        </div>
      </header>

      {goldPromptOpen && (
        <section className="rounded-[1.5rem] border border-[#caa044] bg-[#fff8e8] p-5 text-sm leading-7 text-[#5f5648]">
          <strong className="text-[#171a22]">Run Gold Pass on this output?</strong>
          <p className="mt-2">Gold saves a new artefact — it does not replace this output.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleGoldPass} disabled={goldMutation.isPending} className="btn-primary text-xs">
              {goldMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Run Gold Pass
            </button>
            <button type="button" onClick={() => setGoldPromptOpen(false)} className="btn-secondary text-xs">
              Not now
            </button>
          </div>
        </section>
      )}

      {output.metadata?.critique && (
        <section className="rounded-[1.8rem] border border-[#eadfca] bg-[#fff8e8] p-5 shadow-paper">
          <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Critique</h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#3d352b]">{output.metadata.critique}</pre>
        </section>
      )}

      {output.metadata?.synthesis && (
        <section className="rounded-[1.8rem] border border-[#eadfca] bg-[#fffdf8] p-5 shadow-paper">
          <h2 className="font-serif text-2xl font-semibold text-[#171a22]">Gold synthesis notes</h2>
          <p className="mt-3 text-sm leading-7 text-[#5f5648]">
            {output.metadata.synthesis.disclaimer ?? 'Synthesis pass — apply manually after review.'}
          </p>
        </section>
      )}

      {Boolean((output.metadata as Record<string, unknown>)?.driftBlocked) && (
        <section className="rounded-[1.8rem] border border-red-300 bg-red-50 p-5 shadow-paper">
          <h2 className="font-serif text-2xl font-semibold text-red-900">Source drift detected</h2>
          <p className="mt-2 text-sm leading-7 text-red-800">
            Gold Pass drifted from the source. This has been kept as an alternative, not as a safe revision. Apply is blocked.
          </p>
        </section>
      )}

      <section className="rounded-[1.8rem] border border-[#eadfca] bg-white/85 p-5 shadow-paper">
        {text ? (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap font-serif text-lg leading-9 text-[#20202a]">
            {text}
          </pre>
        ) : (
          <div className="py-8 text-center">
            <p className="font-serif text-xl text-[#171a22]">No readable text stored for this output.</p>
            <p className="mt-2 text-sm text-muted">
              This may be a structure report, legacy record, or failed save. Apply, continue, and export are disabled.
            </p>
            {Boolean((output.metadata as Record<string, unknown>)?.unrecoverable) && (
              <p className="mt-2 text-xs text-red-700">Marked unrecoverable — rerun the tool to regenerate.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
