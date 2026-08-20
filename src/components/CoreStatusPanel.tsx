import { useEffect, useMemo, useState } from 'react';
import { projectMigrationState, syncProjectsToServer } from '../services/serverProjectSync';

interface JobStatus {
  id: string;
  status: string;
  stage?: string;
  progress: number;
  updatedAt: string;
  resumable: boolean;
  resultAvailable: boolean;
}

export default function CoreStatusPanel() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const response = await fetch('/api/jobs?limit=5', { cache: 'no-store' });
      const body = await response.json();
      if (response.ok) setJobs(body?.data?.jobs || []);
    } catch { /* health remains visible as offline */ }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const active = jobs.find((job) => job.status === 'running' || job.status === 'queued');
  const recoverable = jobs.find((job) => job.resumable && job.status !== 'complete');
  const migration = projectMigrationState();
  const lastSave = useMemo(() => {
    const stamp = migration?.at ? new Date(String(migration.at)) : null;
    return stamp && Number.isFinite(stamp.getTime()) ? stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'pending';
  }, [migration?.at]);

  const recover = async () => {
    if (!recoverable) return;
    setBusy(true);
    try {
      await fetch(`/api/jobs/${encodeURIComponent(recoverable.id)}/retry`, { method: 'POST' });
      await refresh();
    } finally { setBusy(false); }
  };

  const sync = async () => {
    setBusy(true);
    try { await syncProjectsToServer(); await refresh(); } finally { setBusy(false); }
  };

  return (
    <aside aria-label="Caspa server status" style={{ position: 'fixed', right: 16, bottom: 14, zIndex: 1000, width: open ? 330 : 210, border: '1px solid rgba(212,166,255,.35)', borderRadius: 15, background: 'rgba(24,17,32,.96)', color: '#f8f3fb', boxShadow: '0 14px 42px rgba(0,0,0,.28)', fontSize: 12 }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ width: '100%', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontWeight: 800 }}>
        <span>Core {active ? `${active.progress}%` : 'ready'}</span><span>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{ padding: '0 12px 12px', display: 'grid', gap: 7, color: '#d8cde0' }}>
        <div>Stage: {active?.stage || 'checkpointed'}</div>
        <div>Server save: {String(migration?.status || 'pending')} · {lastSave}</div>
        <div>Jobs: {jobs.length} recent · {recoverable ? 'recovery available' : 'no recovery needed'}</div>
        <div>Model/cost: recorded per run when provider reports usage</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={busy} onClick={sync}>Sync now</button>
          {recoverable && <button type="button" disabled={busy} onClick={recover}>Recover</button>}
        </div>
      </div>}
    </aside>
  );
}
