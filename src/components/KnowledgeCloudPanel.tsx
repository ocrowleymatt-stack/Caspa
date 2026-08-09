import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, Database, Link2, Loader, RefreshCw, Search, Unplug, Waves } from 'lucide-react';
import {
  connectGoogleDrive,
  getCachedAccessToken,
  handleRedirectLogin,
  setCachedAccessToken,
} from '../lib/firebase';
import {
  connectDropbox,
  disconnectDropbox,
  getDropboxAccessToken,
  handleDropboxOAuthRedirect,
} from '../lib/dropbox';
import {
  getKnowledgeStatus,
  reindexKnowledge,
  searchKnowledgeClient,
  syncCloudKnowledgeClient,
  type KnowledgeStatus,
} from '../services/knowledgeClient';

export default function KnowledgeCloudPanel() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [busy, setBusy] = useState<string>('');
  const [message, setMessage] = useState('');
  const [googleConnected, setGoogleConnected] = useState(() => Boolean(getCachedAccessToken()));
  const [dropboxConnected, setDropboxConnected] = useState(() => Boolean(getDropboxAccessToken()));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getKnowledgeStatus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read knowledge index status.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await handleRedirectLogin();
        const dropboxDone = await handleDropboxOAuthRedirect();
        if (dropboxDone && !cancelled) setMessage('Dropbox connected. Ready to scan and ingest.');
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Cloud sign-in could not be completed.');
      }
      if (cancelled) return;
      setGoogleConnected(Boolean(getCachedAccessToken()));
      setDropboxConnected(Boolean(getDropboxAccessToken()));
      await refresh();
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const connectGoogle = async () => {
    setBusy('connect-google');
    setMessage('Opening Google Drive authorisation…');
    try {
      await connectGoogleDrive();
      setGoogleConnected(Boolean(getCachedAccessToken()));
      if (getCachedAccessToken()) setMessage('Google Drive connected. Ready to scan and ingest.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google Drive connection failed.');
    } finally {
      setBusy('');
    }
  };

  const connectDropboxAccount = async () => {
    setBusy('connect-dropbox');
    setMessage('Opening Dropbox authorisation…');
    try {
      await connectDropbox();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Dropbox connection failed.');
      setBusy('');
    }
  };

  const syncProvider = async (provider: 'dropbox' | 'gdrive') => {
    const token = provider === 'dropbox' ? getDropboxAccessToken() : getCachedAccessToken();
    if (!token) {
      if (provider === 'dropbox') await connectDropboxAccount();
      else await connectGoogle();
      return;
    }
    setBusy(provider);
    setMessage(`Scanning ${provider === 'dropbox' ? 'Dropbox' : 'Google Drive'} and ingesting the next changed batch…`);
    try {
      const data = await syncCloudKnowledgeClient(provider, token, 8);
      setStatus(data.status || null);
      const parts = [
        `${data.discovered} discovered`,
        `${data.indexed} newly indexed`,
        `${data.duplicates} duplicate${data.duplicates === 1 ? '' : 's'} linked`,
        `${data.transcribed} media transcribed`,
        `${data.unchanged} unchanged`,
      ];
      if (data.remaining) parts.push(`${data.remaining} changed files remain for the next batch`);
      if (data.failed) parts.push(`${data.failed} failed`);
      setMessage(parts.join(' · '));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cloud corpus sync failed.');
    } finally {
      setBusy('');
      await refresh();
    }
  };

  const reindex = async () => {
    setBusy('reindex');
    setMessage('Vectorising chunks that only have lexical indexing…');
    try {
      const data = await reindexKnowledge(1000);
      setStatus(data.status || null);
      setMessage(`Vectorised ${data.updated} chunks${data.remaining ? ` · ${data.remaining} remain` : ' · vector index is caught up'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Vector reindex failed.');
    } finally {
      setBusy('');
    }
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setBusy('search');
    try {
      const found = await searchKnowledgeClient(query, 12);
      setResults(found);
      setMessage(`Found ${found.length} ranked corpus matches.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Corpus search failed.');
    } finally {
      setBusy('');
    }
  };

  const timecode = (ms?: number) => {
    if (ms === undefined) return '';
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };

  return (
    <article style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={title}><Database size={20} /> Cloud corpus & evidence search</h2>
          <p style={copy}>
            Dropbox and Drive remain the source of truth for originals. Atlas temporarily reads changed files, transcribes audio/video,
            extracts documents, deduplicates by exact content hash, then stores only derived text, semantic chunks, vectors and citations in your private index.
          </p>
        </div>
        {status && (
          <div style={pill}>
            {status.sources} sources · {status.chunks} chunks · {status.vectorChunks} vectors · {status.duplicates} duplicates linked
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginTop: 18 }}>
        <div style={providerCard}>
          <strong style={providerTitle}><Cloud size={16} /> Google Drive</strong>
          <span style={small}>{googleConnected ? 'Connected to this Atlas user for this browser session' : 'Not connected'}</span>
          <button style={primaryBtn} disabled={Boolean(busy)} onClick={() => googleConnected ? syncProvider('gdrive') : connectGoogle()}>
            {busy === 'gdrive' || busy === 'connect-google' ? <Loader size={14} className="spin" /> : googleConnected ? <RefreshCw size={14} /> : <Link2 size={14} />}
            {googleConnected ? 'Scan & ingest next batch' : 'Connect Google Drive'}
          </button>
          {googleConnected && (
            <button style={linkBtn} onClick={() => { setCachedAccessToken(null); setGoogleConnected(false); setMessage('Google Drive disconnected.'); }}>
              <Unplug size={12} /> Disconnect token
            </button>
          )}
        </div>

        <div style={providerCard}>
          <strong style={providerTitle}><Cloud size={16} /> Dropbox</strong>
          <span style={small}>{dropboxConnected ? 'Connected to this Atlas user for this browser session' : 'Not connected'}</span>
          <button style={primaryBtn} disabled={Boolean(busy)} onClick={() => dropboxConnected ? syncProvider('dropbox') : connectDropboxAccount()}>
            {busy === 'dropbox' || busy === 'connect-dropbox' ? <Loader size={14} className="spin" /> : dropboxConnected ? <RefreshCw size={14} /> : <Link2 size={14} />}
            {dropboxConnected ? 'Scan & ingest next batch' : 'Connect Dropbox'}
          </button>
          {dropboxConnected && (
            <button style={linkBtn} onClick={() => { disconnectDropbox(); setDropboxConnected(false); setMessage('Dropbox disconnected.'); }}>
              <Unplug size={12} /> Disconnect token
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={ghostBtn} disabled={Boolean(busy)} onClick={reindex}>
          {busy === 'reindex' ? <Loader size={14} className="spin" /> : <Waves size={14} />} Vectorise missing chunks
        </button>
        <button style={ghostBtn} disabled={Boolean(busy)} onClick={refresh}><RefreshCw size={14} /> Refresh index status</button>
      </div>

      <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #eadfce' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') runSearch(); }}
            placeholder="Search everything you have indexed…"
            style={searchInput}
          />
          <button style={primaryBtn} disabled={busy === 'search' || !query.trim()} onClick={runSearch}>
            {busy === 'search' ? <Loader size={14} className="spin" /> : <Search size={14} />} Search
          </button>
        </div>

        {results.length > 0 && (
          <div style={{ display: 'grid', gap: 9, marginTop: 14 }}>
            {results.map((result, index) => {
              const alias = result.aliases?.[0];
              const locator = result.page ? `page ${result.page}` : result.startMs !== undefined ? timecode(result.startMs) : '';
              return (
                <div key={`${result.sourceId}-${index}`} style={resultCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <strong>{result.sourceName}</strong>
                    <span style={small}>{alias?.provider || 'source'}{locator ? ` · ${locator}` : ''} · score {Number(result.score || 0).toFixed(3)}</span>
                  </div>
                  <p style={{ margin: '7px 0 0', whiteSpace: 'pre-wrap', color: '#4f463d', lineHeight: 1.5, fontSize: 13 }}>{result.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {message && <p style={{ margin: '14px 0 0', color: '#5c5146', lineHeight: 1.5, fontSize: 13 }}>{message}</p>}
      <p style={{ margin: '10px 0 0', color: '#8a7a66', lineHeight: 1.5, fontSize: 11 }}>
        Cloud access tokens are session-only, namespaced to the mounted Atlas user and destroyed on Atlas sign-out. Exact duplicates across providers are linked to one canonical index entry. Large archives and unsupported binaries are skipped rather than copied. Unattended refresh-token syncing belongs in encrypted server-side per-user storage, not browser storage.
      </p>
    </article>
  );
}

const card: React.CSSProperties = {
  borderRadius: 26, padding: 24, background: 'rgba(255,255,255,0.72)', border: '1px solid #d6a846',
  boxShadow: '0 18px 50px rgba(40, 29, 12, 0.06)', marginTop: 18,
};
const title: React.CSSProperties = { margin: '0 0 10px', fontSize: 20, letterSpacing: -0.3, display: 'flex', gap: 8, alignItems: 'center' };
const copy: React.CSSProperties = { margin: 0, color: '#5c5146', lineHeight: 1.6, maxWidth: 700 };
const providerCard: React.CSSProperties = { border: '1px solid #eadfce', borderRadius: 18, padding: 16, background: '#fffaf2', display: 'grid', gap: 10 };
const providerTitle: React.CSSProperties = { display: 'flex', gap: 7, alignItems: 'center' };
const small: React.CSSProperties = { fontSize: 11, color: '#8a7a66' };
const pill: React.CSSProperties = { border: '1px solid #d8c9b4', borderRadius: 999, padding: '7px 11px', background: '#fffaf2', fontSize: 11, color: '#5c5146', fontWeight: 700 };
const primaryBtn: React.CSSProperties = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 7, border: 'none', borderRadius: 12, padding: '10px 13px', background: '#d6a846', color: '#1d1408', fontWeight: 800, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #d8c9b4', borderRadius: 12, padding: '9px 12px', background: '#fffaf2', color: '#3d3428', fontWeight: 700, cursor: 'pointer' };
const linkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', color: '#8a6a28', padding: 0, fontSize: 11, cursor: 'pointer' };
const searchInput: React.CSSProperties = { minWidth: 0, flex: 1, border: '1px solid #d8c9b4', borderRadius: 12, padding: '11px 13px', background: '#fff', color: '#2e271f', outline: 'none' };
const resultCard: React.CSSProperties = { padding: 13, borderRadius: 14, border: '1px solid #eadfce', background: '#fffaf2' };
