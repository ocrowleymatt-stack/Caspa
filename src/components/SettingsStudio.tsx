/**
 * Settings — account, privacy, local backup/restore
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Download, Loader, RefreshCw, UploadCloud } from 'lucide-react';
import {
  applyLocalSnapshot,
  collectLocalSnapshot,
  snapshotKeyCount,
} from '../services/localSnapshotService';

interface BackupMeta {
  id: string;
  label: string;
  createdAt: string;
  keyCount: number;
}

interface Props {
  userEmail?: string;
}

export default function SettingsStudio({ userEmail }: Props) {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [keyCount, setKeyCount] = useState(snapshotKeyCount());

  const refreshBackups = useCallback(async () => {
    try {
      const res = await fetch('/api/caspa/storage/backups');
      const data = await res.json();
      if (data.success) setBackups(data.data.backups || []);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    refreshBackups();
  }, [refreshBackups]);

  const saveBackup = async () => {
    setLoading(true);
    setStatus('Saving backup…');
    try {
      const entries = collectLocalSnapshot();
      const res = await fetch('/api/caspa/storage/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`/api/caspa/storage/restore/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Restore failed');
      const applied = applyLocalSnapshot(data.data.entries);
      setStatus(`Restored ${applied} keys. Reload the page to see changes everywhere.`);
      setKeyCount(snapshotKeyCount());
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setLoading(false);
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
          <p style={{ margin: 0, color: '#73695d', fontSize: 17 }}>{userEmail || 'Private workspace'}</p>
        </div>

        <article style={card}>
          <h2 style={sectionTitle}>Authentication</h2>
          <p style={{ margin: 0, lineHeight: 1.6, color: '#5c5146' }}>
            Firebase auth is preserved. Your creative work stays in browser local storage unless you back it up below.
          </p>
        </article>

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
