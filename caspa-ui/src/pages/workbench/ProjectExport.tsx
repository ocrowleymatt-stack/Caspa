import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { Download, FileText, Loader2, Package } from 'lucide-react';
import {
  downloadDocxManuscript,
  exportMarkdownManuscript,
  exportProjectArchive,
} from '../../api/book';
import {
  downloadExport,
  exportEpub,
  exportPdf,
  listExports,
} from '../../api/publishing';
import { useToast } from '../../components/Toast';
import { useAppStore } from '../../store';
import { JobProgressCard } from '../../components/JobProgressCard';
import { useJobTracker } from '../../hooks/useJobTracker';
import { formatDate } from '../../lib/utils';
import type { ProjectWorkbenchContext } from '../../components/workbench/ProjectWorkbenchShell';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export default function ProjectExport() {
  const { projectId } = useOutletContext<ProjectWorkbenchContext>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const upsertJob = useAppStore((s) => s.upsertJob);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const activeJob = useJobTracker(activeJobId);

  const { data: exports = [], isLoading } = useQuery({
    queryKey: ['exports', projectId],
    queryFn: () => listExports(projectId),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (activeJob?.status === 'complete') {
      queryClient.invalidateQueries({ queryKey: ['exports', projectId] });
      toast.success('Export complete');
      setActiveJobId(null);
    } else if (activeJob?.status === 'failed') {
      toast.error(activeJob.error ?? 'Export failed');
      setActiveJobId(null);
    }
  }, [activeJob?.error, activeJob?.status, projectId, queryClient, toast]);

  const markdownMutation = useMutation({
    mutationFn: () => exportMarkdownManuscript(projectId),
    onSuccess: async ({ markdown }) => {
      await navigator.clipboard.writeText(markdown);
      toast.success('Full manuscript Markdown copied to clipboard');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const docxMutation = useMutation({
    mutationFn: () => downloadDocxManuscript(projectId),
    onSuccess: () => toast.success('DOCX manuscript downloaded'),
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: () => exportProjectArchive(projectId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['outputs', projectId] });
      toast.success(`Project archive saved · output ${result.outputId.slice(0, 8)}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pdfMutation = useMutation({
    mutationFn: () =>
      exportPdf(projectId, {
        fontSize: 12,
        margin: 1,
        includeTableOfContents: true,
        pageSize: 'A5',
      }),
    onSuccess: ({ jobId }) => {
      setActiveJobId(jobId);
      upsertJob({
        id: jobId,
        type: 'export',
        status: 'running',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['exports', projectId] });
      toast.success('PDF export queued');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const epubMutation = useMutation({
    mutationFn: () =>
      exportEpub(projectId, {
        author: '',
        publisher: 'CASPA Studio',
        language: 'en',
        includeCover: true,
      }),
    onSuccess: ({ jobId }) => {
      setActiveJobId(jobId);
      upsertJob({
        id: jobId,
        type: 'export',
        status: 'running',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['exports', projectId] });
      toast.success('EPUB export queued');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const busy =
    pdfMutation.isPending ||
    epubMutation.isPending ||
    markdownMutation.isPending ||
    docxMutation.isPending ||
    archiveMutation.isPending;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper md:p-8">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#98711d]">Export / publishing</div>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-[#171a22]">Submission packages</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
          Export manuscript, bible, Book Map, and Saved Writing. AI drafts in Outputs are included in the full archive.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button type="button" onClick={() => markdownMutation.mutate()} disabled={busy} className="btn-secondary">
            {markdownMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Copy Markdown manuscript
          </button>
          <button type="button" onClick={() => docxMutation.mutate()} disabled={busy} className="btn-primary">
            {docxMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download DOCX
          </button>
          <button type="button" onClick={() => archiveMutation.mutate()} disabled={busy} className="btn-secondary">
            {archiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            Full project archive (ZIP)
          </button>
          <button type="button" onClick={() => pdfMutation.mutate()} disabled={busy} className="btn-secondary">
            {pdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Export PDF
          </button>
          <button type="button" onClick={() => epubMutation.mutate()} disabled={busy} className="btn-secondary">
            {epubMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            Export EPUB
          </button>
        </div>
        {activeJob && (
          <div className="mt-5">
            <JobProgressCard job={activeJob} />
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-[#eadfca] bg-white p-6 shadow-paper">
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-5 w-5 text-[#98711d]" />
          <h3 className="font-serif text-2xl font-semibold text-[#171a22]">Previous exports</h3>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#98711d]" />
          </div>
        ) : exports.length === 0 ? (
          <p className="text-sm text-muted">No PDF/EPUB jobs yet for this project.</p>
        ) : (
          <ul className="space-y-3">
            {exports.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eadfca] bg-[#fffdf8] px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-[#171a22]">{item.format?.toUpperCase() ?? 'Export'}</div>
                  <div className="text-xs text-muted">{formatDate(item.createdAt)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadExport(item.id)}
                  className="btn-secondary text-xs"
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
