import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Gem } from 'lucide-react';
import { ElevationWorkbench, JsonPreview, ResultCard } from '../components/ElevationWorkbench';
import { useToast } from '../components/Toast';
import { getGoldReport, runGoldPipeline } from '../api/gold';
import type { GoldReport } from '../types';

function GoldContent({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [report, setReport] = useState<GoldReport | null>(null);

  useQuery({
    queryKey: ['gold-report', projectId],
    queryFn: async () => {
      const r = await getGoldReport(projectId);
      if (r) setReport(r);
      return r;
    },
    enabled: !!projectId,
  });

  const mutation = useMutation({
    mutationFn: () => runGoldPipeline(projectId),
    onSuccess: (data) => {
      setReport(data);
      toast.success('Gold pipeline complete — 12 steps executed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="btn-primary">
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Gold Pipeline'}
      </button>
      {report && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-accent">{report.overallScore}</div>
            <div>
              <p className="font-medium">{report.overallStatus.replace(/_/g, ' ')}</p>
              <p className="text-xs text-muted">{report.steps.length} steps · {new Date(report.completedAt).toLocaleString()}</p>
            </div>
          </div>
          <div className="grid gap-2">
            {report.steps.map((step) => (
              <div key={step.step} className="rounded-lg bg-white/5 p-3 flex justify-between items-center text-sm">
                <span>{step.label}</span>
                <span className="badge bg-accent/10 text-accent">{step.score} — {step.status}</span>
              </div>
            ))}
          </div>
          {report.blockers.length > 0 && (
            <ResultCard title="Blockers">
              <ul>{report.blockers.map((b) => <li key={b}>• {b}</li>)}</ul>
            </ResultCard>
          )}
          <ResultCard title="Full Report"><JsonPreview data={report} /></ResultCard>
        </div>
      )}
    </div>
  );
}

export default function Gold() {
  return (
    <ElevationWorkbench title="Gold Pipeline" subtitle="12-step elevation run across all engines" icon={<Gem className="h-7 w-7 text-accent" />}>
      {({ projectId }) => <GoldContent projectId={projectId} />}
    </ElevationWorkbench>
  );
}
