import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, FilePlus2, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import type { Chapter } from '../types';
import {
  addChapter,
  deleteChapter,
  detectChapters,
  loadChapterWorkspace,
  moveChapter,
  renameChapter,
  saveChapterWorkspace,
} from '../services/chapterStructureService';
import {
  addFilesToSourcePack,
  clearSourcePack,
  loadSourcePack,
  removeSource,
  type InspirationSource,
} from '../services/sourcePackService';

function projectMode() {
  try { return JSON.parse(localStorage.getItem('caspa.currentBrief') || '{}')?.mode || 'novel'; } catch { return 'novel'; }
}

function currentManuscript() {
  return localStorage.getItem('caspa.whitePage') || localStorage.getItem('caspa.manuscriptSource') || '';
}

export default function ChapterSourceDock() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chapters' | 'sources'>('chapters');
  const [chapters, setChapters] = useState<Chapter[]>(() => loadChapterWorkspace(projectMode()));
  const [sources, setSources] = useState<InspirationSource[]>(() => loadSourcePack());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const totalWords = useMemo(() => chapters.reduce((n, c) => n + (c.wordCount || (c.content || '').trim().split(/\s+/).filter(Boolean).length), 0), [chapters]);

  useEffect(() => {
    const refreshSources = () => setSources(loadSourcePack());
    const refreshChapters = () => setChapters(loadChapterWorkspace(projectMode()));
    window.addEventListener('caspa:sources-updated', refreshSources as EventListener);
    window.addEventListener('caspa:chapters-updated', refreshChapters as EventListener);
    return () => {
      window.removeEventListener('caspa:sources-updated', refreshSources as EventListener);
      window.removeEventListener('caspa:chapters-updated', refreshChapters as EventListener);
    };
  }, []);

  const uploadSources = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMessage('Reading source documents…');
    try {
      const { added, all } = await addFilesToSourcePack(files);
      setSources(all);
      setMessage(`${added.length} source${added.length === 1 ? '' : 's'} added. Caspa will carry them into writing calls as inspiration/reference context.`);
    } catch (err: any) {
      setMessage(err?.message || 'Could not read one of those files.');
    } finally { setBusy(false); }
  };

  const redetect = () => {
    const detected = detectChapters(currentManuscript(), projectMode());
    setChapters(saveChapterWorkspace(detected).chapters);
    setMessage(detected.length > 1 ? `Detected ${detected.length} chapters/sections.` : 'Only one reliable section was found. Add or rename chapters manually if needed.');
  };

  const persistAndRefresh = () => {
    saveChapterWorkspace(chapters);
    setMessage('Chapter structure saved. Refreshing Caspa so every open tool sees the same manuscript…');
    window.setTimeout(() => window.location.reload(), 350);
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    right: 'max(12px, env(safe-area-inset-right))',
    bottom: 'max(18px, env(safe-area-inset-bottom))',
    width: 'min(420px, calc(100vw - 24px))',
    maxHeight: 'min(72vh, 720px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 20,
    border: '1px solid rgba(212,166,255,.28)',
    background: 'rgba(18,13,24,.98)',
    color: '#f8f3fb',
    boxShadow: '0 24px 80px rgba(0,0,0,.48)',
    zIndex: 1000,
    backdropFilter: 'blur(18px)',
  };

  return (
    <>
      {open && (
        <aside style={panelStyle} aria-label="Sources and chapters">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderBottom: '1px solid rgba(212,166,255,.18)' }}>
            <BookOpen size={18} color="#d4a6ff" />
            <strong style={{ flex: 1 }}>Book structure & sources</strong>
            <button type="button" onClick={() => setOpen(false)} style={iconBtn} aria-label="Close"><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 10 }}>
            <button type="button" onClick={() => setTab('chapters')} style={tab === 'chapters' ? activeTab : tabBtn}>Chapters · {chapters.length}</button>
            <button type="button" onClick={() => setTab('sources')} style={tab === 'sources' ? activeTab : tabBtn}>Sources · {sources.length}</button>
          </div>

          <div style={{ overflowY: 'auto', padding: '4px 12px 14px', WebkitOverflowScrolling: 'touch' }}>
            {tab === 'chapters' ? (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <button type="button" onClick={redetect} style={smallBtn}><RefreshCw size={14} /> Re-detect</button>
                  <button type="button" onClick={() => setChapters(addChapter(chapters, projectMode()))} style={smallBtn}><Plus size={14} /> Add chapter</button>
                  <button type="button" onClick={persistAndRefresh} style={primarySmall}>Apply everywhere</button>
                </div>
                <p style={helper}>Chapter identity is canonical here. Rename, add, delete or reorder it once; Apply everywhere rebuilds the manuscript and reloads all Caspa rooms onto the same structure.</p>
                <div style={{ fontSize: 12, color: '#b9aec2', margin: '0 0 10px' }}>{totalWords.toLocaleString()} words across {chapters.length} section{chapters.length === 1 ? '' : 's'}</div>
                {chapters.map((chapter, index) => (
                  <div key={chapter.id} style={rowCard}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 24, textAlign: 'center', color: '#8fe3cf', fontWeight: 800 }}>{index + 1}</span>
                      <input
                        value={chapter.title}
                        onChange={(e) => setChapters((prev) => prev.map((c) => c.id === chapter.id ? { ...c, title: e.target.value } : c))}
                        onBlur={(e) => setChapters(renameChapter(chapters, chapter.id, e.target.value))}
                        style={titleInput}
                        aria-label={`Chapter ${index + 1} name`}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
                      <small style={{ flex: 1, color: '#aaa0b3' }}>{(chapter.wordCount || 0).toLocaleString()} words</small>
                      <button type="button" style={iconBtn} disabled={index === 0} onClick={() => setChapters(moveChapter(chapters, chapter.id, -1))} aria-label="Move up"><ArrowUp size={15} /></button>
                      <button type="button" style={iconBtn} disabled={index === chapters.length - 1} onClick={() => setChapters(moveChapter(chapters, chapter.id, 1))} aria-label="Move down"><ArrowDown size={15} /></button>
                      <button type="button" style={{ ...iconBtn, color: '#ffabab' }} onClick={() => setChapters(deleteChapter(chapters, chapter.id))} aria-label="Delete chapter"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <label style={uploadBox}>
                  <Upload size={22} />
                  <strong>{busy ? 'Reading…' : 'Add inspiration / reference documents'}</strong>
                  <span style={{ color: '#aaa0b3', fontSize: 12 }}>Dropbox, iCloud, Drive or local files · choose several at once · Caspa validates format after selection</span>
                  <input
                    type="file"
                    multiple
                    disabled={busy}
                    onChange={(e) => void uploadSources(e.target.files)}
                    style={{ display: 'none' }}
                  />
                </label>
                <p style={helper}>Cloud providers often expose files as generic MIME types, so Caspa no longer filters them out in the operating-system picker. Supported readable formats include PDF, DOCX, TXT, Markdown, RTF, HTML, JSON and CSV.</p>
                {sources.map((source) => (
                  <div key={source.id} style={rowCard}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <FilePlus2 size={16} color="#d4a6ff" />
                      <strong style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.name}</strong>
                      <button type="button" style={{ ...iconBtn, color: '#ffabab' }} onClick={() => setSources(removeSource(source.id))}><Trash2 size={15} /></button>
                    </div>
                    <small style={{ color: '#aaa0b3' }}>{source.wordCount.toLocaleString()} words</small>
                  </div>
                ))}
                {sources.length > 0 && <button type="button" onClick={() => { clearSourcePack(); setSources([]); }} style={{ ...smallBtn, color: '#ffb4b4', marginTop: 8 }}>Clear source pack</button>}
              </>
            )}
            {message && <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: 'rgba(143,227,207,.07)', color: '#cdeee6', fontSize: 12, lineHeight: 1.45 }}>{message}</div>}
          </div>
        </aside>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open chapters and sources"
          title="Chapters & sources"
          style={{
            position: 'fixed',
            right: 'max(4px, env(safe-area-inset-right))',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 901,
            width: 42,
            height: 52,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid rgba(212,166,255,.30)',
            borderRight: 0,
            borderRadius: '12px 0 0 12px',
            padding: 0,
            background: 'linear-gradient(180deg, rgba(234,214,255,.96), rgba(201,148,243,.96))',
            color: '#1a1021',
            boxShadow: '0 8px 24px rgba(0,0,0,.24)',
            cursor: 'pointer',
          }}
        >
          <BookOpen size={19} />
        </button>
      )}
    </>
  );
}

const helper: React.CSSProperties = { margin: '0 0 12px', color: '#b9aec2', fontSize: 12, lineHeight: 1.45 };
const rowCard: React.CSSProperties = { padding: 10, borderRadius: 13, background: 'rgba(212,166,255,.045)', border: '1px solid rgba(212,166,255,.14)', marginBottom: 7 };
const titleInput: React.CSSProperties = { flex: 1, minWidth: 0, borderRadius: 9, border: '1px solid rgba(212,166,255,.18)', padding: '8px 9px', background: '#120d18', color: '#f8f3fb', fontSize: 14, fontWeight: 700 };
const iconBtn: React.CSSProperties = { width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 9, border: '1px solid rgba(212,166,255,.16)', background: 'rgba(255,255,255,.025)', color: '#d8cfea', cursor: 'pointer' };
const smallBtn: React.CSSProperties = { minHeight: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, border: '1px solid rgba(212,166,255,.22)', padding: '7px 10px', background: 'rgba(212,166,255,.06)', color: '#eee5f7', fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const primarySmall: React.CSSProperties = { ...smallBtn, background: '#d4a6ff', color: '#1a1021', borderColor: '#d4a6ff' };
const tabBtn: React.CSSProperties = { border: '1px solid rgba(212,166,255,.12)', background: 'rgba(255,255,255,.02)', color: '#b9aec2', borderRadius: 10, padding: 9, fontWeight: 800, cursor: 'pointer' };
const activeTab: React.CSSProperties = { ...tabBtn, background: 'rgba(212,166,255,.16)', color: '#ead6ff', borderColor: 'rgba(212,166,255,.34)' };
const uploadBox: React.CSSProperties = { display: 'grid', justifyItems: 'center', gap: 7, padding: 18, borderRadius: 14, border: '1px dashed rgba(212,166,255,.36)', background: 'rgba(212,166,255,.045)', color: '#f8f3fb', textAlign: 'center', cursor: 'pointer', marginBottom: 10 };
