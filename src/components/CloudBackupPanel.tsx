import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  FolderOpen,
  HardDriveDownload,
  Link2,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import type { Project } from '../types';
import {
  BackupPayload,
  DriveBackupFile,
  downloadDriveBackup,
  listDriveBackups,
  uploadDriveBackup,
} from '../lib/googleDrive';
import {
  connectGoogleDrive,
  getCachedAccessToken,
  handleRedirectLogin,
} from '../lib/firebase';
import {
  DropboxBackupFile,
  connectDropbox,
  downloadDropboxBackup,
  getDropboxAccessToken,
  handleDropboxOAuthRedirect,
  listDropboxBackups,
  uploadDropboxBackup,
} from '../lib/dropbox';

interface Props {
  project: Project;
  chapters?: any[];
  characters?: any[];
  plotNodes?: any[];
  research?: any[];
  sourceMaterials?: any[];
  externalReviews?: any[];
  onRestoreBackup?: (payload: any) => Promise<void>;
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function CloudBackupPanel({
  project,
  chapters = [],
  characters = [],
  plotNodes = [],
  research = [],
  sourceMaterials = [],
  externalReviews = [],
  onRestoreBackup,
  onNotify,
}: Props) {
  const [googleConnected, setGoogleConnected] = useState(() => !!getCachedAccessToken());
  const [dropboxConnected, setDropboxConnected] = useState(() => !!getDropboxAccessToken());
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [dropboxBackups, setDropboxBackups] = useState<DropboxBackupFile[]>([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingDropbox, setLoadingDropbox] = useState(false);
  const [busy, setBusy] = useState<'google' | 'dropbox' | 'restore-google' | 'restore-dropbox' | null>(null);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onNotify) onNotify(message, type);
  };

  const buildPayload = (): BackupPayload => ({
    project,
    chapters,
    characters,
    plotNodes,
    research,
    sourceMaterials,
    externalReviews,
    backupDate: new Date().toISOString(),
  });

  const refreshGoogle = async () => {
    if (!getCachedAccessToken()) {
      setGoogleConnected(false);
      setDriveBackups([]);
      return;
    }

    setLoadingGoogle(true);
    try {
      const files = await listDriveBackups();
      setDriveBackups(files);
      setGoogleConnected(true);
    } catch (error: any) {
      console.error(error);
      if (!getCachedAccessToken()) setGoogleConnected(false);
      notify(error?.message || 'Google Drive could not be read.', 'error');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const refreshDropbox = async () => {
    if (!getDropboxAccessToken()) {
      setDropboxConnected(false);
      setDropboxBackups([]);
      return;
    }

    setLoadingDropbox(true);
    try {
      const files = await listDropboxBackups();
      setDropboxBackups(files);
      setDropboxConnected(true);
    } catch (error: any) {
      console.error(error);
      if (!getDropboxAccessToken()) setDropboxConnected(false);
      notify(error?.message || 'Dropbox could not be read.', 'error');
    } finally {
      setLoadingDropbox(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const finishCloudLogins = async () => {
      try {
        await handleRedirectLogin();
      } catch (error: any) {
        console.error(error);
        notify(error?.message || 'Google sign-in could not be completed.', 'error');
      }

      try {
        const completed = await handleDropboxOAuthRedirect();
        if (completed) notify('Dropbox connected.', 'success');
      } catch (error: any) {
        console.error(error);
        notify(error?.message || 'Dropbox sign-in could not be completed.', 'error');
      }

      if (cancelled) return;

      const hasGoogle = !!getCachedAccessToken();
      const hasDropbox = !!getDropboxAccessToken();
      setGoogleConnected(hasGoogle);
      setDropboxConnected(hasDropbox);

      if (hasGoogle) await refreshGoogle();
      if (hasDropbox) await refreshDropbox();
    };

    finishCloudLogins();
    return () => {
      cancelled = true;
    };
    // OAuth callbacks only need to be consumed once when this panel mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectGoogle = async () => {
    try {
      notify('Opening Google authorisation…', 'info');
      await connectGoogleDrive();
      if (getCachedAccessToken()) {
        setGoogleConnected(true);
        notify('Google Drive connected.', 'success');
        await refreshGoogle();
      }
    } catch (error: any) {
      console.error(error);
      notify(error?.message || 'Google Drive connection failed.', 'error');
    }
  };

  const connectDropboxAccount = async () => {
    try {
      notify('Opening Dropbox authorisation…', 'info');
      await connectDropbox();
    } catch (error: any) {
      console.error(error);
      notify(error?.message || 'Dropbox connection failed.', 'error');
    }
  };

  const backupGoogle = async () => {
    if (!getCachedAccessToken()) {
      await connectGoogle();
      return;
    }

    setBusy('google');
    try {
      await uploadDriveBackup(project.title, project.id, buildPayload());
      notify('Backup saved to Google Drive.', 'success');
      await refreshGoogle();
    } catch (error: any) {
      console.error(error);
      notify(error?.message || 'Google Drive backup failed.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const backupDropbox = async () => {
    if (!getDropboxAccessToken()) {
      await connectDropboxAccount();
      return;
    }

    setBusy('dropbox');
    try {
      await uploadDropboxBackup(project.title, project.id, buildPayload());
      notify('Backup saved to Dropbox.', 'success');
      await refreshDropbox();
    } catch (error: any) {
      console.error(error);
      notify(error?.message || 'Dropbox backup failed.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const restoreGoogle = async (file: DriveBackupFile) => {
    if (!window.confirm(`Restore "${file.name}" from Google Drive? This replaces the active workspace.`)) return;
    setBusy('restore-google');
    try {
      const payload = await downloadDriveBackup(file.id);
      if (onRestoreBackup) await onRestoreBackup(payload);
      notify('Google Drive backup restored.', 'success');
    } catch (error: any) {
      console.error(error);
      notify(error?.message || 'Google Drive restore failed.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const restoreDropbox = async (file: DropboxBackupFile) => {
    if (!window.confirm(`Restore "${file.name}" from Dropbox? This replaces the active workspace.`)) return;
    setBusy('restore-dropbox');
    try {
      const payload = await downloadDropboxBackup(file.pathLower);
      if (onRestoreBackup) await onRestoreBackup(payload);
      notify('Dropbox backup restored.', 'success');
    } catch (error: any) {
      console.error(error);
      notify(error?.message || 'Dropbox restore failed.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const statusPill = (connected: boolean, label: string) => (
    <span
      className={`text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 border ${
        connected
          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
          : 'text-text-secondary/50 border-border-subtle bg-surface-muted/40'
      }`}
    >
      {connected && <CheckCircle2 size={11} />}
      {connected ? `${label} connected` : 'Not connected'}
    </span>
  );

  const backupList = (
    files: Array<DriveBackupFile | DropboxBackupFile>,
    loading: boolean,
    provider: 'google' | 'dropbox'
  ) => {
    if (loading) {
      return (
        <div className="py-3 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-text-secondary/60">
          <RefreshCw size={12} className="animate-spin" /> Checking backups…
        </div>
      );
    }

    if (files.length === 0) {
      return (
        <div className="py-3 text-center text-[10px] uppercase tracking-widest text-text-secondary/40 border border-dashed border-border-subtle rounded">
          No backups yet
        </div>
      );
    }

    return (
      <div className="max-h-[130px] overflow-y-auto custom-scrollbar space-y-1.5">
        {files.map((file) => (
          <button
            key={file.id}
            onClick={() => provider === 'google'
              ? restoreGoogle(file as DriveBackupFile)
              : restoreDropbox(file as DropboxBackupFile)}
            disabled={busy === 'restore-google' || busy === 'restore-dropbox'}
            className="w-full p-3 rounded border border-border-subtle bg-white/[0.02] hover:border-brand-primary/30 text-left transition-all flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text-primary truncate">
                {file.name.replace('Caspa_Restore_', '').replace('.json', '')}
              </div>
              <div className="text-[10px] text-text-secondary/50 mt-1">
                {new Date(file.modifiedTime).toLocaleString()}
              </div>
            </div>
            <HardDriveDownload size={14} className="text-brand-primary shrink-0" />
          </button>
        ))}
      </div>
    );
  };

  return (
    <section className="space-y-3 md:col-span-2">
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-1.5 text-brand-primary">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-widest">Cloud Connections</span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-text-secondary/40">One-click OAuth</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="p-4 ethereal-panel border border-border-subtle rounded shadow-xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold text-brand-primary uppercase tracking-[0.2em] flex items-center gap-2">
                <Cloud size={16} /> Google Drive
              </h4>
              <p className="text-xs text-text-secondary/60 mt-2 leading-relaxed">
                Uses the same Google account sign-in, then asks only for permission to create and manage Atlas backup files.
              </p>
            </div>
            {statusPill(googleConnected, 'Google')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {!googleConnected ? (
              <button
                onClick={connectGoogle}
                className="sm:col-span-2 w-full py-2 bg-brand-primary text-white rounded text-xs font-semibold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Link2 size={13} /> Connect Google Drive
              </button>
            ) : (
              <>
                <button
                  onClick={backupGoogle}
                  disabled={busy === 'google'}
                  className="w-full py-2 bg-brand-primary text-white rounded text-xs font-semibold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {busy === 'google' ? <RefreshCw size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                  Back up now
                </button>
                <button
                  onClick={refreshGoogle}
                  disabled={loadingGoogle}
                  className="w-full py-2 bg-white/5 border border-border-subtle rounded text-xs font-semibold uppercase tracking-widest text-text-primary hover:border-brand-primary/30 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={13} className={loadingGoogle ? 'animate-spin' : ''} /> Refresh
                </button>
              </>
            )}
          </div>

          {googleConnected && backupList(driveBackups, loadingGoogle, 'google')}
        </div>

        <div className="p-4 ethereal-panel border border-border-subtle rounded shadow-xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold text-brand-primary uppercase tracking-[0.2em] flex items-center gap-2">
                <FolderOpen size={16} /> Dropbox
              </h4>
              <p className="text-xs text-text-secondary/60 mt-2 leading-relaxed">
                Browser-safe PKCE login: no Dropbox secret in Atlas. If no app key is deployed, paste the key once and this browser remembers it.
              </p>
            </div>
            {statusPill(dropboxConnected, 'Dropbox')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {!dropboxConnected ? (
              <button
                onClick={connectDropboxAccount}
                className="sm:col-span-2 w-full py-2 bg-brand-primary text-white rounded text-xs font-semibold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Link2 size={13} /> Connect Dropbox
              </button>
            ) : (
              <>
                <button
                  onClick={backupDropbox}
                  disabled={busy === 'dropbox'}
                  className="w-full py-2 bg-brand-primary text-white rounded text-xs font-semibold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {busy === 'dropbox' ? <RefreshCw size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                  Back up now
                </button>
                <button
                  onClick={refreshDropbox}
                  disabled={loadingDropbox}
                  className="w-full py-2 bg-white/5 border border-border-subtle rounded text-xs font-semibold uppercase tracking-widest text-text-primary hover:border-brand-primary/30 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={13} className={loadingDropbox ? 'animate-spin' : ''} /> Refresh
                </button>
              </>
            )}
          </div>

          {dropboxConnected && backupList(dropboxBackups, loadingDropbox, 'dropbox')}
        </div>
      </div>

      <div className="px-2 text-[10px] text-text-secondary/40 leading-relaxed">
        iCloud Drive remains available through the normal Files picker on iPhone, iPad and Mac; Apple does not expose an equivalent general-purpose iCloud Drive OAuth API to web apps.
      </div>
    </section>
  );
}
