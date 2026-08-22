/**
 * Settings — account, privacy, local backup/restore, deploy readiness
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader, RefreshCw, UploadCloud, Activity } from 'lucide-react';
import KnowledgeCloudPanel from './KnowledgeCloudPanel';
import {
  applyLocalSnapshot,
  collectLocalSnapshot,
  snapshotKeyCount,
} from '../services/localSnapshotService';
import { getDeviceBackupScope, persistActiveUserDatabase } from '../services/userDatabaseService';

interface BackupMeta {
  id: string;
  label: string;
  createdAt: string;
  keyCount: number;
}

interface DoctorReadiness {
  ready?: boolean;
  score?: number;
  label?: string;
  blockers?: string[];
  warnings?: string[];
}

interface Props {
  userEmail?: string;
  userId?: string;
  onFastUpload?: (files: File[]) => Promise<void>;
}

export default function SettingsStudio({ userEmail, userId, onFastUpload }: Props) {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [keyCount, setKeyCount] = useState(snapshotKeyCount());
  const [readiness, setReadiness] = useState<DoctorReadiness | null>(null);
  const [doctorVersion, setDoctorVersion] = useState('');
  const [buildFingerprint, setBuildFingerprint] = useState('');
  const [checkingDoctor, setCheckingDoctor] = useState(false);
  const [fastUploading, setFastUploading] = useState(false);
  const fastUploadRef = useRef<HTMLInputElement | null>(null);

  const storageHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (userId && userId !== 'local-guest') {
      const { getAuth } = await import('firebase/auth');
      const current = getAuth().currentUser;
      if (!current) throw new Error('Your Firebase session is not available. Sign in again before using server backups.');
      const token = await current.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
    return { 'X-Caspa-Local-Scope': getDeviceBackupScope() };
  }, [userId]);

  const refreshBackups = useCallback(async () => {
    try {
      const res = await fetch('/api/caspa/storage/backups', { headers: await storageHeaders() });
      const data = await res.json();
      if (data.success) setBackups(data.data.backups || []);
    } catch {
      /* offline */
    }
  }, [storageHeaders]);

  const refreshDoctor = useCallback(async () => {
    setCheckingDoctor(true);
    try {
      const res = await fetch('/api/v2/doctor');
      const data = await res.json();
      if (data.success) {
        setReadiness(data.data.readiness || null);
        setDoctorVersion(data.data.version || '');
        const sha = data.data.gitShaShort || data.data.deployment?.gitShaShort || '';
        const builtAt = data.data.builtAt || data.data.deployment?.builtAt || '';
        const parts = [sha ? `commit ${sha}` : '', builtAt ? `built ${builtAt}` : ''].filter(Boolean);
        setBuildFingerprint(parts.join(' · '));
      }
    } catch {
      setReadiness({
        ready: false,
        score: 0,
        label: 'unreachable',
        blockers: ['Doctor endpoint unreachable. Is the server running?'],
      });
    } finally {
      setCheckingDoctor(false);
    }
  }, []);

  useEffect(() => {
    refreshBackups();
    refreshDoctor();
  }, [refreshBackups, refreshDoctor]);

  const saveBackup = async () => {
    setLoading(true);
    setStatus('Saving backup…');
    try {
      const entries = collectLocalSnapshot();
      persistActiveUserDatabase();
      const res = await fetch('/api/caspa/storage/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await storageHeaders()) },
        body: JSON.stringify({
          entries,
          label: `backup-${new Date().toISOString().slice(0, 10)}`,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Backup failed');
      setStatus(`Saved ${data.data.keyCount} keys to server.`);
      setKeyCount(snapshotKeyCount());
      await refreshBackups();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async (id: string) => {
    if (!confirm('Restore this backup? Current local Caspa data will be overwritten.')) return;
    setLoading(true);
    setStatus('Restoring…');
    try {
      const res = await fetch(`/api/caspa/storage/restore/${id}`, { headers: await storageHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Restore failed');
      const applied = applyLocalSnapshot(data.data.entries);
      persistActiveUserDatabase();
      setStatus(`Restored ${applied} keys. Reload the page to see changes everywhere.`);
      setKeyCount(snapshotKeyCount());
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setLoading(false);
    }
  };

  const isLocal = !userEmail || userEmail.includes('local@caspa');

  const runFastUpload = async (files: FileList | null) => {
    if (!onFastUpload) return;
    const selected = Array.from(files || []);
    if (!selected.length) return;
    setFastUploading(true);
    setStatus('Reading uploaded data…');
    try {
      await onFastUpload(selected);
      setStatus(`Loaded ${selected.length} file${selected.length === 1 ? '' : 's'} into a new isolated project.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Fast data upload failed.');
    } finally {
      setFastUploading(false);
      if (fastUploadRef.current) fastUploadRef.current.value = '';
    }
  };

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: '#9b6d16', fontSize: 12, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            Settings
          </div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
            Account & privacy
          </h1>
          <p style={{ margin: 0, color: '#73695d', fontSize: 17 }}>{isLocal ? 'Local workspace' : userEmail}</p>
        </div>

        <article style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
            <h2 style={{ ...sectionTitle, margin: 0 }}>Deploy readiness</h2>
            <button type="button" onClick={refreshDoctor} disabled={checkingDoctor} style={ghostBtn}>
              {checkingDoctor ? <Loader size={14} className="spin" /> : <Activity size={14} />}
              Recheck
            </button>
          </div>
          {readiness ? (
            <>
              <p style={{ margin: '0 0 10px', color: readiness.ready ? '#15803d' : '#a02b20', fontWeight: 800 }}>
                {readiness.ready ? 'Ready to run' : 'Blocked'} · score {readiness.score ?? '—'}
                {doctorVersion ? ` · v${doctorVersion}` : ''}
              </p>
              {buildFingerprint && (
                <p style={{ margin: '0 0 10px', color: '#5c5146', fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  {buildFingerprint}
                </p>
              )}
              {(readiness.blockers || []).map((b) => (
                <p key={b} style={{ margin: '0 0 6px', color: '#a02b20', fontSize: 14 }}>
                  {b}
                </p>
              ))}
              {(readiness.warnings || []).map((w) => (
                <p key={w} style={{ margin: '0 0 6px', color: '#8a6a28', fontSize: 14 }}>
                  {w}
                </p>
              ))}
              {!readiness.blockers?.length && !readiness.warnings?.length && (
                <p style={{ margin: 0, color: '#5c5146', lineHeight: 1.55 }}>
                  All checks passed. UI, data dir, and at least one AI path look good.
                </p>
              )}
            </>
          ) : (
            <p style={{ margin: 0, color: '#73695d' }}>Checking server…</p>
          )}
        </article>

        <article style={{ ...card, marginTop: 18 }}>
          <h2 style={sectionTitle}>Authentication & data separation</h2>
          <p style={{ margin: 0, lineHeight: 1.6, color: '#5c5146' }}>
            {isLocal
              ? 'Local workspace is isolated to this device scope. Signing into another account unmounts this workspace before the other user is loaded.'
              : 'Signed in with Firebase. Browser projects and server backups are now isolated to this verified user ID; another signed-in user gets a separate database.'}
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#8a7a66', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            Database: {isLocal ? 'local-device' : `user:${(userId || '').slice(0, 10)}…`}
          </p>
        </article>

        {onFastUpload ? (
          <article style={{ ...card, marginTop: 18, borderColor: '#d6a846' }}>
            <h2 style={sectionTitle}>Fast Data Upload</h2>
            <p style={{ margin: '0 0 14px', color: '#73695d', lineHeight: 1.6 }}>
              Drop a manuscript or evidence/data pack straight into a fresh project. Any file type is accepted. Atlas extracts/transcribes supported formats and still registers unsupported binary formats without rejecting them; multiple files keep their filenames and provenance.
            </p>
            <button type="button" onClick={() => fastUploadRef.current?.click()} disabled={fastUploading} style={primaryBtn}>
              {fastUploading ? <Loader size={16} className="spin" /> : <UploadCloud size={16} />}
              {fastUploading ? 'Reading data…' : 'Fast Data Upload'}
            </button>
            <input
              ref={fastUploadRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(event) => runFastUpload(event.target.files)}
            />
          </article>
        ) : null}

        <KnowledgeCloudPanel />

        <article style={{ ...card, marginTop: 18 }}>
          <h2 style={sectionTitle}>Local-first backup</h2>
          <p style={{ margin: '0 0 14px', color: '#73695d', lineHeight: 1.6 }}>
            {keyCount} Caspa keys in this browser. Save a snapshot to the server disk (JSON in <code>data/backups/</code>).
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={saveBackup} disabled={loading} style={primaryBtn}>
              {loading ? <Loader size={16} className="spin" /> : <UploadCloud size={16} />}
              Save backup
            </button>
            <button type="button" onClick={refreshBackups} disabled={loading} style={ghostBtn}>
              <RefreshCw size={16} /> Refresh list
            </button>
          </div>
          {status && <p style={{ marginTop: 12, fontSize: 14, color: '#5c5146' }}>{status}</p>}

          {backups.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Server backups</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {backups.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: '#fff8ea',
                      border: '1px solid #eadfce',
                    }}
                  >
                    <div>
                      <strong>{b.label}</strong>
                      <div style={{ fontSize: 12, color: '#8a7a66' }}>
                        {b.keyCount} keys · {new Date(b.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button type="button" onClick={() => restoreBackup(b.id)} disabled={loading} style={ghostBtn}>
                      <Download size={14} /> Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

const card: React.CSSProperties = {
  borderRadius: 26,
  padding: 24,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid #eadfce',
  boxShadow: '0 18px 50px rgba(40, 29, 12, 0.06)',
};

const sectionTitle: React.CSSProperties = { margin: '0 0 12px', fontSize: 20, letterSpacing: -0.3 };

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  borderRadius: 14,
  padding: '12px 18px',
  background: '#d6a846',
  color: '#1d1408',
  fontWeight: 800,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid #d8c9b4',
  borderRadius: 12,
  padding: '10px 14px',
  background: '#fffaf2',
  fontWeight: 700,
  cursor: 'pointer',
  color: '#3d3428',
};
