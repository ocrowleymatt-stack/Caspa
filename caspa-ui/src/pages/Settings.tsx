import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cloud,
  Database,
  Download,
  HardDrive,
  Heart,
  Loader2,
  LogOut,
  RefreshCw,
  Upload,
  User,
} from 'lucide-react';
import { logout } from '../api/auth';
import { getProviders, getModels } from '../api/assistant';
import {
  exportData,
  getDropboxStatus,
  getHealth,
  getStorageStats,
  importData,
  listBackups,
  pullDropbox,
  pushDropbox,
  restoreBackup,
  triggerBackup,
} from '../api/client';
import { useToast } from '../components/Toast';
import { useAppStore } from '../store';

export default function Settings() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreName, setRestoreName] = useState('');
  const simpleMode = useAppStore((s) => s.simpleMode);
  const toggleSimpleMode = useAppStore((s) => s.toggleSimpleMode);
  const user = useAppStore((s) => s.user);
  const clearAuth = useAppStore((s) => s.clearAuth);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Clear local session even if server logout fails
    }
    clearAuth();
    navigate('/login', { replace: true });
  }

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30000,
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: getProviders,
  });

  const { data: models = [] } = useQuery({
    queryKey: ['models'],
    queryFn: getModels,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['storage-stats'],
    queryFn: getStorageStats,
  });

  const { data: backups = [] } = useQuery({
    queryKey: ['backups'],
    queryFn: listBackups,
  });

  const { data: dropbox } = useQuery({
    queryKey: ['dropbox-status'],
    queryFn: getDropboxStatus,
  });

  const backupMutation = useMutation({
    mutationFn: () => triggerBackup('manual'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: () => restoreBackup(restoreName),
    onSuccess: () => {
      toast.success('Backup restored');
      queryClient.invalidateQueries();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pushMutation = useMutation({
    mutationFn: pushDropbox,
    onSuccess: () => toast.success('Pushed to Dropbox'),
    onError: (err: Error) => toast.error(err.message),
  });

  const pullMutation = useMutation({
    mutationFn: pullDropbox,
    onSuccess: () => toast.success('Pulled from Dropbox'),
    onError: (err: Error) => toast.error(err.message),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importData(file),
    onSuccess: () => {
      toast.success('Data imported');
      queryClient.invalidateQueries();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted text-sm mt-1">Configure AI providers, storage, and system info</p>
      </div>

      {user && (
        <section className="card space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-accent" /> Account
          </h2>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted">Name</span>
              <span>{user.displayName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Email</span>
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Role</span>
              <span className="capitalize">{user.role}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Status</span>
              <span className="capitalize">{user.status}</span>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="btn-secondary">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold">Interface Mode</h2>
        <p className="text-sm text-muted">
          {simpleMode
            ? 'Simple Mode shows Command Centre, core workflows, and essential tools.'
            : 'Expert Mode adds Show Factory, Music Lab, Elevation suite, and full production tools.'}
        </p>
        <button type="button" onClick={toggleSimpleMode} className="btn-secondary">
          Switch to {simpleMode ? 'Expert' : 'Simple'} Mode
        </button>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Cloud className="h-5 w-5 text-accent" /> AI Providers
        </h2>
        {providersLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        ) : providers.length === 0 ? (
          <p className="text-sm text-muted">No providers configured</p>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium capitalize">{p.name}</span>
                  {p.isLocal && (
                    <span className="badge bg-accent/10 text-accent text-[10px]">Local</span>
                  )}
                </div>
                <span
                  className={`badge ${p.available ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}
                >
                  {p.available ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
        {models.length > 0 && (
          <div className="pt-3 border-t border-white/10">
            <h3 className="text-sm font-medium mb-2">Available Models</h3>
            <div className="flex flex-wrap gap-1">
              {models.map((model) => (
                <span key={model} className="badge bg-white/5 text-muted text-[10px]">
                  {model}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Database className="h-5 w-5 text-accent" /> Storage & Backup
        </h2>
        {statsLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Projects', value: stats.projects },
              { label: 'Chapters', value: stats.chapters },
              { label: 'Characters', value: stats.characters },
              { label: 'DB Size', value: `${stats.dbSizeKb} KB` },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-xs text-muted">{s.label}</p>
                <p className="text-lg font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => backupMutation.mutate()} disabled={backupMutation.isPending} className="btn-primary">
            {backupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
            Backup Now
          </button>
          <button type="button" onClick={() => exportData().catch((e: Error) => toast.error(e.message))} className="btn-secondary">
            <Download className="h-4 w-4" /> Export JSON
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary">
            <Upload className="h-4 w-4" /> Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importMutation.mutate(file);
            }}
          />
        </div>

        {backups.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="label">Restore from backup</label>
            <div className="flex gap-2">
              <select value={restoreName} onChange={(e) => setRestoreName(e.target.value)} className="input flex-1">
                <option value="">Select backup...</option>
                {backups.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({Math.round(b.size / 1024)} KB)
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!restoreName || restoreMutation.isPending}
                onClick={() => {
                  if (confirm('Restore will overwrite current data. Continue?')) {
                    restoreMutation.mutate();
                  }
                }}
                className="btn-secondary"
              >
                {restoreMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Restore
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Dropbox Sync</h3>
            <span className={`badge ${dropbox?.configured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}`}>
              {dropbox?.configured ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={!dropbox?.configured || pushMutation.isPending} onClick={() => pushMutation.mutate()} className="btn-secondary text-xs">
              Push to Dropbox
            </button>
            <button type="button" disabled={!dropbox?.configured || pullMutation.isPending} onClick={() => pullMutation.mutate()} className="btn-secondary text-xs">
              Pull from Dropbox
            </button>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Heart className="h-5 w-5 text-accent" /> About
        </h2>
        <div className="text-sm space-y-1 text-muted">
          <p><span className="text-foreground font-medium">CASPA Studio</span> v{health?.version ?? '1.0.0'}</p>
          <p>
            Backend status:{' '}
            <span className={health?.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
              {health?.status ?? 'checking...'}
            </span>
          </p>
          {health?.timestamp && (
            <p className="text-xs">Last checked: {new Date(health.timestamp).toLocaleString()}</p>
          )}
        </div>
      </section>
    </div>
  );
}
