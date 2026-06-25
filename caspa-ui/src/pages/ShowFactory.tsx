import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Package, Theater, Trash2 } from 'lucide-react';
import { listProjects } from '../api/projects';
import {
  deleteShowPackage,
  downloadShowPackage,
  generateShowPackage,
  getShowFactoryJobStatus,
  listShowPackages,
} from '../api/showFactory';
import { useAppStore } from '../store';
import { formatDate } from '../lib/utils';
import { useToast } from '../components/Toast';
import { JobProgressCard } from '../components/JobProgressCard';
import { useJobTracker } from '../hooks/useJobTracker';
import type { ShowPackage } from '../types';

const showTypes: { value: ShowPackage['type']; label: string }[] = [
  { value: 'theatre', label: 'Theatre' },
  { value: 'radio', label: 'Radio Drama' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'live-reading', label: 'Live Reading' },
];

export default function ShowFactory() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const upsertJob = useAppStore((s) => s.upsertJob);
  const [projectId, setProjectId] = useState(activeProjectId ?? '');
  const [showType, setShowType] = useState<ShowPackage['type']>('theatre');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const activeJob = useJobTracker(activeJobId, getShowFactoryJobStatus, { sse: false });

  useEffect(() => {
    if (activeJob?.status === 'complete') {
      queryClient.invalidateQueries({ queryKey: ['show-packages', projectId] });
      toast.success('Show pack generation complete');
      setActiveJobId(null);
    } else if (activeJob?.status === 'failed') {
      toast.error(activeJob.error ?? 'Generation failed');
      setActiveJobId(null);
    }
  }, [activeJob?.status, activeJob?.error, queryClient, projectId, toast]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  });

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['show-packages', projectId],
    queryFn: () => listShowPackages(projectId),
    enabled: !!projectId,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateShowPackage(projectId, showType),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['show-packages', projectId] });
      if (result.jobId) {
        setActiveJobId(result.jobId);
        upsertJob({
          id: result.jobId,
          type: 'show-factory',
          status: 'running',
          progress: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      toast.success('Show pack generation started');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteShowPackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['show-packages', projectId] });
      toast.success('Package deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Theater className="h-7 w-7 text-accent" /> Show Factory
        </h1>
        <p className="text-muted text-sm mt-1">Transform manuscripts into production-ready show packs</p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Generate Show Pack</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Project</label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setActiveProjectId(e.target.value || null);
              }}
              className="input"
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Show Type</label>
            <select value={showType} onChange={(e) => setShowType(e.target.value as ShowPackage['type'])} className="input">
              {showTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          disabled={!projectId || generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
          className="btn-primary"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Package className="h-4 w-4" />
          )}
          Generate Show Pack
        </button>
        {activeJob && <JobProgressCard job={activeJob} />}
      </div>

      <div>
        <h2 className="font-semibold mb-4">My Packages</h2>
        {!projectId ? (
          <p className="text-muted text-sm">Select a project to view packages</p>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : packages.length === 0 ? (
          <div className="card text-center py-12">
            <Package className="h-10 w-10 mx-auto text-muted mb-3 opacity-40" />
            <p className="text-muted">No show packages yet. Generate your first pack above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => (
              <div key={pkg.id} className="card flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium">{pkg.title}</h3>
                  <p className="text-xs text-muted mt-1 capitalize">
                    {pkg.type} · {pkg.status} · {formatDate(pkg.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pkg.components.map((c) => (
                      <span key={c} className="badge bg-white/5 text-muted text-[10px]">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {pkg.status === 'ready' && (
                    <button
                      type="button"
                      onClick={() => downloadShowPackage(pkg.id).catch((e: Error) => toast.error(e.message))}
                      className="btn-primary text-xs"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this package?')) deleteMutation.mutate(pkg.id);
                    }}
                    className="btn-ghost p-2 text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
