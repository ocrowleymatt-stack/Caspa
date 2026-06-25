import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Download, FileText, Loader2, Package, Truck } from 'lucide-react';
import { listProjects } from '../api/projects';
import {
  downloadExport,
  exportEpub,
  exportIngram,
  exportKdp,
  exportPdf,
  listExports,
} from '../api/publishing';
import { useAppStore } from '../store';
import { formatDate } from '../lib/utils';
import { useToast } from '../components/Toast';
import { JobProgressCard } from '../components/JobProgressCard';
import { useJobTracker } from '../hooks/useJobTracker';

export default function Publish() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const upsertJob = useAppStore((s) => s.upsertJob);
  const [projectId, setProjectId] = useState(activeProjectId ?? '');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [pdfOptions, setPdfOptions] = useState({
    fontSize: 12,
    margin: 1,
    includeTableOfContents: true,
    pageSize: 'A5',
  });
  const [epubOptions, setEpubOptions] = useState({
    author: '',
    publisher: 'CASPA Studio',
    language: 'en',
    includeCover: true,
  });

  const activeJob = useJobTracker(activeJobId);

  useEffect(() => {
    if (activeJob?.status === 'complete') {
      queryClient.invalidateQueries({ queryKey: ['exports'] });
      toast.success('Export complete — ready to download');
      setActiveJobId(null);
    } else if (activeJob?.status === 'failed') {
      toast.error(activeJob.error ?? 'Export failed');
      setActiveJobId(null);
    }
  }, [activeJob?.status, activeJob?.error, queryClient, toast]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const { data: exports = [], isLoading } = useQuery({
    queryKey: ['exports', projectId],
    queryFn: () => listExports(projectId || undefined),
    refetchInterval: activeJobId ? 3000 : false,
  });

  const startExport = (jobId: string) => {
    setActiveJobId(jobId);
    upsertJob({
      id: jobId,
      type: 'export',
      status: 'running',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const pdfMutation = useMutation({
    mutationFn: () => exportPdf(projectId, pdfOptions),
    onSuccess: ({ jobId }) => {
      startExport(jobId);
      queryClient.invalidateQueries({ queryKey: ['exports'] });
      toast.success('PDF export queued');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const epubMutation = useMutation({
    mutationFn: () => exportEpub(projectId, epubOptions),
    onSuccess: ({ jobId }) => {
      startExport(jobId);
      queryClient.invalidateQueries({ queryKey: ['exports'] });
      toast.success('EPUB export queued');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const kdpMutation = useMutation({
    mutationFn: () => exportKdp(projectId),
    onSuccess: ({ jobId }) => {
      startExport(jobId);
      queryClient.invalidateQueries({ queryKey: ['exports'] });
      toast.success('KDP package queued');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const ingramMutation = useMutation({
    mutationFn: () => exportIngram(projectId),
    onSuccess: ({ jobId }) => {
      startExport(jobId);
      queryClient.invalidateQueries({ queryKey: ['exports'] });
      toast.success('IngramSpark export queued');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const exportCards = [
    {
      id: 'pdf',
      title: 'PDF Export',
      icon: FileText,
      description: 'Print-ready PDF with customizable typography and margins.',
      mutation: pdfMutation,
      options: (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="label">Font Size</label>
            <input type="number" value={pdfOptions.fontSize} onChange={(e) => setPdfOptions({ ...pdfOptions, fontSize: Number(e.target.value) })} className="input" />
          </div>
          <div>
            <label className="label">Margin (in)</label>
            <input type="number" step={0.1} value={pdfOptions.margin} onChange={(e) => setPdfOptions({ ...pdfOptions, margin: Number(e.target.value) })} className="input" />
          </div>
          <label className="flex items-center gap-2 col-span-2 text-sm">
            <input type="checkbox" checked={pdfOptions.includeTableOfContents} onChange={(e) => setPdfOptions({ ...pdfOptions, includeTableOfContents: e.target.checked })} />
            Include table of contents
          </label>
        </div>
      ),
    },
    {
      id: 'epub',
      title: 'EPUB Export',
      icon: BookOpen,
      description: 'E-reader compatible EPUB with metadata and optional cover.',
      mutation: epubMutation,
      options: (
        <div className="space-y-3 mt-4">
          <div>
            <label className="label">Author</label>
            <input value={epubOptions.author} onChange={(e) => setEpubOptions({ ...epubOptions, author: e.target.value })} className="input" placeholder="Author name" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={epubOptions.includeCover} onChange={(e) => setEpubOptions({ ...epubOptions, includeCover: e.target.checked })} />
            Include cover page
          </label>
        </div>
      ),
    },
    {
      id: 'kdp',
      title: 'KDP Package',
      icon: Package,
      description: 'Amazon Kindle Direct Publishing bundle with metadata and manuscript files.',
      mutation: kdpMutation,
      options: null,
    },
    {
      id: 'ingram',
      title: 'IngramSpark Export',
      icon: Truck,
      description: 'Print-on-demand package formatted for IngramSpark distribution.',
      mutation: ingramMutation,
      options: null,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Publish</h1>
        <p className="text-muted text-sm mt-1">Export your manuscript in multiple formats</p>
      </div>

      <div className="card">
        <label className="label">Project</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input max-w-md">
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {activeJob && <JobProgressCard job={activeJob} />}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {exportCards.map(({ id, title, icon: Icon, description, mutation, options }) => (
          <div key={id} className="card flex flex-col">
            <Icon className="h-8 w-8 text-accent mb-3" />
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted mt-1 flex-1">{description}</p>
            {options}
            <button
              type="button"
              disabled={!projectId || mutation.isPending || !!activeJobId}
              onClick={() => mutation.mutate()}
              className="btn-primary mt-4 w-full"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Export'}
            </button>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-semibold mb-4">Export History</h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : exports.length === 0 ? (
          <div className="card text-center py-12">
            <FileText className="h-10 w-10 mx-auto text-muted mb-3 opacity-40" />
            <p className="text-muted">No exports yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {exports.map((exp) => (
              <div key={exp.id} className="card flex items-center justify-between py-3">
                <div>
                  <p className="font-medium uppercase">{exp.format}</p>
                  <p className="text-xs text-muted capitalize">
                    {exp.status} · {formatDate(exp.createdAt)}
                  </p>
                </div>
                {exp.status === 'complete' && (
                  <button
                    type="button"
                    onClick={() => downloadExport(exp.id).catch((e: Error) => toast.error(e.message))}
                    className="btn-primary text-xs"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                )}
                {(exp.status === 'queued' || exp.status === 'running') && (
                  <span className="badge bg-blue-500/20 text-blue-300 text-xs flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Processing
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
