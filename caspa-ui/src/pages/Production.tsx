import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clapperboard, Filter, Loader2, Trash2 } from 'lucide-react';
import { cancelJob, clearCompletedJobs, listJobs, subscribeToJobs } from '../api/jobs';
import { useAppStore } from '../store';
import { JobProgressCard } from '../components/JobProgressCard';
import { useToast } from '../components/Toast';
import type { JobStatus } from '../types';

export default function Production() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const jobs = useAppStore((s) => s.jobs);
  const setJobs = useAppStore((s) => s.setJobs);
  const upsertJob = useAppStore((s) => s.upsertJob);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: initialJobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => listJobs(),
  });

  useEffect(() => {
    if (initialJobs.length > 0) {
      setJobs(initialJobs);
    }
  }, [initialJobs, setJobs]);

  useEffect(() => {
    const source = subscribeToJobs((job) => {
      upsertJob(job as JobStatus);
    });
    return () => source.close();
  }, [upsertJob]);

  const cancelMutation = useMutation({
    mutationFn: cancelJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job cancelled');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const clearMutation = useMutation({
    mutationFn: clearCompletedJobs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setJobs(jobs.filter((j) => j.status !== 'complete'));
      toast.success('Completed jobs cleared');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const displayJobs = jobs.length > 0 ? jobs : initialJobs;
  const filtered =
    statusFilter === 'all'
      ? displayJobs
      : displayJobs.filter((j) => j.status === statusFilter);

  const stats = {
    queued: displayJobs.filter((j) => j.status === 'queued').length,
    running: displayJobs.filter((j) => j.status === 'running').length,
    complete: displayJobs.filter((j) => j.status === 'complete').length,
    failed: displayJobs.filter((j) => j.status === 'failed').length,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clapperboard className="h-7 w-7 text-accent" /> Production Jobs
          </h1>
          <p className="text-muted text-sm mt-1">Live job board with real-time SSE updates</p>
        </div>
        <button
          type="button"
          onClick={() => clearMutation.mutate()}
          disabled={clearMutation.isPending || stats.complete === 0}
          className="btn-secondary text-xs"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear Completed
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(['queued', 'running', 'complete', 'failed'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            className={`card py-3 text-center transition-colors ${
              statusFilter === status ? 'border-accent/50' : ''
            }`}
          >
            <p className="text-2xl font-bold">{stats[status]}</p>
            <p className="text-xs text-muted capitalize mt-1">{status}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto text-sm">
          <option value="all">All statuses</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="complete">Complete</option>
          <option value="failed">Failed</option>
        </select>
        <span className="text-xs text-muted ml-auto flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Live SSE connected
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Clapperboard className="h-12 w-12 mx-auto text-muted mb-4 opacity-40" />
          <p className="text-muted">
            {statusFilter === 'all'
              ? 'No jobs yet. Start a show pack, export, or music generation.'
              : `No ${statusFilter} jobs`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <JobProgressCard
              key={job.id}
              job={job}
              onCancel={(id) => cancelMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
