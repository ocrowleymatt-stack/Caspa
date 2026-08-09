import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Cloud, Database, Link2, Loader, RefreshCw, Search, Unplug, Waves } from 'lucide-react';
import {
  disconnectCloudAutopilotClient,
  getCloudAutopilotStatusClient,
  getKnowledgeStatus,
  reindexKnowledge,
  runCloudAutopilotNow,
  searchKnowledgeClient,
  startCloudAutopilotOAuth,
  type CloudAutopilotStatus,
  type KnowledgeStatus,
} from '../services/knowledgeClient';

export default function KnowledgeCloudPanel() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [cloud, setCloud] = useState<CloudAutopilotStatus[]>([]);
  const [busy, setBusy] = useState<string>('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [knowledge, connections] = await Promise.all([
        getKnowledgeStatus(),
        getCloudAutopilotStatusClient(),
      ]);
      setStatus(knowledge);
      setCloud(connections);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read knowledge index status.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('cloud_connected');
    const provider = url.searchParams.get('cloud');
    const cloudError = url.searchParams.get('cloud_error');
    if (connected === '1') {
      setMessage(`${provider === 'gdrive' ? 'Google Drive' : 'Dropbox'} connected. Background ingestion has started.`);
    } else if (cloudError) {
      setMessage(`Cloud connection failed: ${cloudError}`);
    }
    if (connected || cloudError || provider) {
      ['cloud_connected', 'cloud_error', 'cloud'].forEach((key) => url.searchParams.delete(key));
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }

    void refresh();
    const timer = window.setInterval(() => { if (!cancelled) void refresh(); }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const byProvider = useMemo(() => ({
    gdrive: cloud.find((row) => row.provider === 'gdrive'),
    dropbox: cloud.find((row) => row.provider === 'dropbox'),
  }), [cloud]);

  const connect = async (provider: 'dropbox' | 'gdrive') => {
    setBusy(`connect-${provider}`);
    setMessage(`Opening ${provider === 'dropbox' ? 'Dropbox' : 'Google Drive'} authorisation…`);
    try {
      const authorizationUrl = await startCloudAutopilotOAuth(provider);
      window.location.assign(authorizationUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cloud connection failed.');
      setBusy('');
    }
  };

  const syncProvider = async (provider: 'dropbox' | 'gdrive') => {
    setBusy(provider);
    setMessage(`Checking ${provider === 'dropbox' ? 'Dropbox' : 'Google Drive'} for changes now…`);
    try {
      const data = await runCloudAutopilotNow(provider);
      if (data.status) setStatus(data.status);
      if (data.connections) setCloud(data.connections);
      const result = data.result || {};
      if (result.unchangedProvider) {
        setMessage('Cloud cursor is caught up — no provider changes detected.');
      } else {
        const parts = [
          `${result.indexed || 0} newly indexed`,
          `${result.duplicates || 0} duplicate${result.duplicates === 1 ? '' : 's'} linked`,
          `${result.transcribed || 0} media transcribed`,
        ];
        if (result.remaining) parts.push(`${result.remaining} changed files remain in the background backlog`);
        if (result.failed) parts.push(`${result.failed} failed`);
        setMessage(parts.join(' · '));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cloud corpus sync failed.');
    } finally {
      setBusy('');
      await refresh();
    }
  };

  const disconnect = async (provider: 'dropbox' | 'gdrive') => {
    setBusy(`disconnect-${provider}`);
    try {
      setCloud(await disconnectCloudAutopilotClient(provider));
      setMessage(`${provider === 'dropbox' ? 'Dropbox' : 'Google Drive'} disconnected and its stored refresh credential destroyed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cloud disconnect failed.');
    } finally {
      setBusy('');
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

  const providerStatus = (provider: 'dropbox' | 'gdrive') => {
    const row = byProvider[provider];
    if (!row?.configured) return 'Server OAuth setup required';
    if (!row.connected) return 'Not connected';
    if (row.lastError) return `Background sync needs attention · ${row.lastError.slice(0, 90)}`;
    if (row.remaining) return `Background ingestion active · ${row.remaining} changed files queued`;
    if (row.initialComplete && row.cursorReady) return 'Background sync on · caught up';
    return 'Connected · initial ingestion running';
  };

  const providerCardView = (provider: 'gdrive' | 'dropbox', label: string) => {
    const row = byProvider[provider];
    const connected = Boolean(row?.connected);
    return (
      <div style={providerCard}>
        <strong style={providerTitle}><Cloud size={16} /> {label}</strong>
        <span style={small}>{providerStatus(provider)}</span>
        <button
          style={primaryBtn}
          disabled={Boolean(busy) || row?.configured === false}
          onClick={() => connected ? syncProvider(provider) : connect(provider)}
        >
          {busy === provider || busy === `connect-${provider}` ? <Loader size={14} className="spin" /> : connected ? <RefreshCw size={14} /> : <Link2 size={14} />}
          {connected ? 'Check & ingest now' : `Connect ${label}`}
        </button>
        {connected && (
          <button style={linkBtn} disabled={Boolean(busy)} onClick={() => disconnect(provider)}>
            <Unplug size={12} /> Disconnect & destroy credential
          </button>
        )}
        {row?.lastSuccessAt && <span style={tiny}>Last caught up: {new Date(row.lastSuccessAt).toLocaleString()}</span>}
      </div>
    );
  };

  return (
    <article style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h2 style={title}><Database size={20} /> Cloud corpus & evidence search</h2>
          <p style={copy}>
            Dropbox and Drive remain the source of truth for originals. Atlas automatically detects provider changes, temporarily reads changed files,
            transcribes audio/video, extracts documents, deduplicates by exact content hash, then stores only derived text, semantic chunks, vectors and citations in your private index.
          </p>
        </div>
        {status && (
          <div style={pill}>
            {status.sources} sources · {status.chunks} chunks · {status.vectorChunks} vectors · {status.duplicates} duplicates linked
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginTop: 18 }}>
        {providerCardView('gdrive', 'Google Drive')}
        {providerCardView('dropbox', 'Dropbox')}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={ghostBtn} disabled={Boolean(busy)} onClick={reindex}>
          {busy === 'reindex' ? <Loader size={14} className="spin" /> : <Waves size={14} />} Vectorise missing chunks
        </button>
        <button style={ghostBtn} disabled={Boolean(busy)} onClick={refresh}><RefreshCw size={14} /> Refresh status</button>
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
        Offline refresh credentials are encrypted server-side per Atlas user and never returned to browser JavaScript. Provider cursors avoid rescanning an unchanged cloud library. Exact duplicates across Drive and Dropbox resolve to one canonical corpus source; originals remain with the provider.
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
const tiny: React.CSSProperties = { fontSize: 10, color: '#9a8d7d' };
const pill: React.CSSProperties = { border: '1px solid #d8c9b4', borderRadius: 999, padding: '7px 11px', background: '#fffaf2', fontSize: 11, color: '#5c5146', fontWeight: 700 };
const primaryBtn: React.CSSProperties = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 7, border: 'none', borderRadius: 12, padding: '10px 13px', background: '#d6a846', color: '#1d1408', fontWeight: 800, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #d8c9b4', borderRadius: 12, padding: '9px 12px', background: '#fffaf2', color: '#3d3428', fontWeight: 700, cursor: 'pointer' };
const linkBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', color: '#8a6a28', padding: 0, fontSize: 11, cursor: 'pointer' };
const searchInput: React.CSSProperties = { minWidth: 0, flex: 1, border: '1px solid #d8c9b4', borderRadius: 12, padding: '11px 13px', background: '#fff', color: '#2e271f', outline: 'none' };
const resultCard: React.CSSProperties = { padding: 13, borderRadius: 14, border: '1px solid #eadfce', background: '#fffaf2' };
