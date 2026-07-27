/**
 * Book Design Studio — simple UI, powerful cover + picture-book layout under the hood.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BookImage, LayoutTemplate, Loader, Sparkles, Download, Image as ImageIcon, Check } from 'lucide-react';

type Brief = {
  title: string;
  mode: string;
  idea: string;
  tone: string;
  audience: string;
};

type Props = {
  brief: Brief;
  draftPage: string;
  authorName?: string;
  onDraftChange?: (text: string) => void;
};

type Tab = 'cover' | 'pages' | 'export';

const STORAGE_KEY = 'caspa.bookDesign';

export default function BookDesignStudio({ brief, draftPage, authorName = '', onDraftChange }: Props) {
  const [tab, setTab] = useState<Tab>('cover');
  const [ageBand, setAgeBand] = useState('3-5');
  const [trimId, setTrimId] = useState('8x8');
  const [artStyle, setArtStyle] = useState('watercolor-picture-book');
  const [coverFormat, setCoverFormat] = useState('wraparound');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState(authorName);
  const [characterName, setCharacterName] = useState('');
  const [catalog, setCatalog] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [coverHtml, setCoverHtml] = useState('');
  const [plan, setPlan] = useState<any>(null);
  const [pagesHtml, setPagesHtml] = useState('');
  const [selectedPage, setSelectedPage] = useState(0);

  useEffect(() => {
    fetch('/api/caspa/design/catalog')
      .then((r) => r.json())
      .then((j) => j.success && setCatalog(j.data))
      .catch(() => {});
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.coverImage) setCoverImage(saved.coverImage);
        if (saved.plan) setPlan(saved.plan);
        if (saved.ageBand) setAgeBand(saved.ageBand);
        if (saved.trimId) setTrimId(saved.trimId);
        if (saved.artStyle) setArtStyle(saved.artStyle);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ coverImage, plan, ageBand, trimId, artStyle, coverFormat })
    );
  }, [coverImage, plan, ageBand, trimId, artStyle, coverFormat]);

  const characters = useMemo(
    () =>
      characterName.trim()
        ? [{ name: characterName.trim(), ageLook: ageBand, features: ['consistent silhouette', 'warm expression'] }]
        : [],
    [characterName, ageBand]
  );

  const generateCover = async (mode: 'front' | 'wraparound' = 'front') => {
    setBusy(true);
    setError('');
    setStatus(mode === 'wraparound' ? 'Generating wraparound jacket…' : 'Generating cover…');
    try {
      const res = await fetch('/api/caspa/design/cover/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: brief.title,
          subtitle,
          author,
          ageBand,
          trimId,
          artStyle,
          format: coverFormat,
          pageCount: plan?.pageCount || 32,
          blurb: brief.idea,
          characters,
          mood: brief.tone,
          mode,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Cover failed');
      setCoverImage(json.data.imageUrl);
      setCoverHtml(json.data.htmlPreview || '');
      setStatus('Cover ready.');
      setTab('cover');
    } catch (err: any) {
      setError(err.message || 'Cover generation failed');
    } finally {
      setBusy(false);
    }
  };

  const buildPages = async () => {
    if (!draftPage.trim() && !brief.idea.trim()) {
      setError('Add manuscript text on the White Page (or a premise) first.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('Planning spreads, age band, and art briefs…');
    try {
      const res = await fetch('/api/caspa/design/picture-book/from-manuscript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: brief.title,
          manuscript: draftPage.trim() || brief.idea,
          ageBand,
          trimId,
          artStyle,
          author,
          characters,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Plan failed');
      setPlan(json.data.plan);
      setPagesHtml(json.data.html || '');
      if (json.data.adaptedText && onDraftChange && json.data.adaptedText !== draftPage) {
        // Keep adapted picture-book text available but don't force overwrite silently —
        // only sync if original was the short premise.
        if (!draftPage.trim() || draftPage.trim() === brief.idea.trim()) {
          onDraftChange(json.data.adaptedText);
        }
      }
      setSelectedPage(0);
      setStatus(`Planned ${json.data.plan.pageCount} pages · ${json.data.plan.trim.label}`);
      setTab('pages');
    } catch (err: any) {
      setError(err.message || 'Page plan failed');
    } finally {
      setBusy(false);
    }
  };

  const illustratePages = async () => {
    if (!plan) {
      setError('Build the page plan first.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('Illustrating pages (this can take a few minutes)…');
    try {
      const res = await fetch('/api/caspa/design/picture-book/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, maxPages: Math.min(plan.pages.length, 12) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Illustration failed');
      setPlan(json.data.plan);
      setPagesHtml(json.data.html || '');
      setStatus(`Illustrated ${json.data.illustrated} page(s).${json.data.failures?.length ? ` Missed: ${json.data.failures.join(', ')}` : ''}`);
    } catch (err: any) {
      setError(err.message || 'Illustration failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadHtml = (html: string, filename: string) => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const page = plan?.pages?.[selectedPage];

  return (
    <div style={{ padding: '32px clamp(20px, 4vw, 56px)', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 28 }}>
        <div style={{ color: '#8a6a28', fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          Design
        </div>
        <h1 style={{ margin: '6px 0 8px', fontSize: 34, letterSpacing: -1 }}>Cover &amp; pages</h1>
        <p style={{ margin: 0, color: '#6d6255', maxWidth: 640, lineHeight: 1.5 }}>
          One room for jackets and picture-book spreads. Age bands, character lock, wraparound covers, and print-safe text zones stay under the hood.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {(
          [
            { id: 'cover' as Tab, label: 'Cover', icon: BookImage },
            { id: 'pages' as Tab, label: 'Pages', icon: LayoutTemplate },
            { id: 'export' as Tab, label: 'Export', icon: Download },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              ...pill,
              borderColor: tab === id ? '#d6a846' : '#eadfce',
              background: tab === id ? '#fff6df' : '#fff',
              fontWeight: tab === id ? 700 : 500,
            }}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <section style={card}>
        <div style={controls}>
          <Field label="Age band">
            <select value={ageBand} onChange={(e) => setAgeBand(e.target.value)} style={input}>
              {(catalog?.ageBands || defaultAges).map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.label || a.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trim">
            <select value={trimId} onChange={(e) => setTrimId(e.target.value)} style={input}>
              {(catalog?.trims || defaultTrims).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.label || t.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Art style">
            <select value={artStyle} onChange={(e) => setArtStyle(e.target.value)} style={input}>
              {(catalog?.artStyles || defaultStyles).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.label || s.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hero character (lock)">
            <input
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="e.g. Pip the fox"
              style={input}
            />
          </Field>
        </div>
      </section>

      {tab === 'cover' && (
        <section style={{ ...card, marginTop: 16 }}>
          <h2 style={h2}>Cover designer</h2>
          <p style={muted}>Front or full wraparound jacket with spine width from page count. Typography overlays stay editable.</p>
          <div style={controls}>
            <Field label="Subtitle">
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} style={input} />
            </Field>
            <Field label="Author">
              <input value={author} onChange={(e) => setAuthor(e.target.value)} style={input} />
            </Field>
            <Field label="Jacket">
              <select value={coverFormat} onChange={(e) => setCoverFormat(e.target.value)} style={input}>
                <option value="front-only">Front only</option>
                <option value="wraparound">Wraparound</option>
                <option value="board-book">Board book</option>
                <option value="dust-jacket">Dust jacket</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" disabled={busy} onClick={() => generateCover('front')} style={primaryBtn}>
              {busy ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
              Generate front cover
            </button>
            <button type="button" disabled={busy} onClick={() => generateCover('wraparound')} style={secondaryBtn}>
              <ImageIcon size={16} /> Wraparound jacket
            </button>
          </div>
          {coverImage && (
            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <img src={coverImage} alt="Cover" style={{ width: '100%', maxWidth: 520, borderRadius: 16, border: '1px solid #eadfce' }} />
              {coverHtml && (
                <button type="button" onClick={() => downloadHtml(coverHtml, `${slug(brief.title)}-cover.html`)} style={secondaryBtn}>
                  <Download size={16} /> Download cover preview HTML
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {tab === 'pages' && (
        <section style={{ ...card, marginTop: 16 }}>
          <h2 style={h2}>Page layout</h2>
          <p style={muted}>
            Builds 24/32/40-page picture-book (or illustrated) spreads with text-safe zones, character lock, and print bleed.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} onClick={buildPages} style={primaryBtn}>
              {busy ? <Loader size={16} className="spin" /> : <LayoutTemplate size={16} />}
              Build page plan
            </button>
            <button type="button" disabled={busy || !plan} onClick={illustratePages} style={secondaryBtn}>
              <ImageIcon size={16} /> Illustrate pages
            </button>
          </div>

          {plan && (
            <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: '#5a4a38', fontSize: 14 }}>
                <Chip>{plan.pageCount} pages</Chip>
                <Chip>{plan.trim?.label}</Chip>
                <Chip>{plan.ageBand}</Chip>
                <Chip>{plan.artStyle}</Chip>
                <Chip>bleed {plan.bleedMm}mm</Chip>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {plan.pages.map((p: any, i: number) => (
                  <button
                    key={p.pageNumber}
                    type="button"
                    onClick={() => setSelectedPage(i)}
                    style={{
                      ...pill,
                      padding: '6px 10px',
                      borderColor: selectedPage === i ? '#d6a846' : '#eadfce',
                      background: p.imageUrl ? '#f3ecdf' : '#fff',
                    }}
                  >
                    {p.imageUrl ? <Check size={12} /> : null} {p.pageNumber}
                  </button>
                ))}
              </div>

              {page && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }} className="design-page-grid">
                  <div>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#8a7d6c', marginBottom: 8 }}>
                      Page {page.pageNumber} · {page.layout}
                    </div>
                    {page.imageUrl ? (
                      <img src={page.imageUrl} alt={`Page ${page.pageNumber}`} style={{ width: '100%', borderRadius: 14, border: '1px solid #eadfce' }} />
                    ) : (
                      <div style={{ ...emptyArt }}>{page.illustrationBrief}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#8a7d6c', marginBottom: 8 }}>Text</div>
                    <textarea
                      value={page.text}
                      onChange={(e) => {
                        const pages = plan.pages.map((p: any, i: number) =>
                          i === selectedPage ? { ...p, text: e.target.value } : p
                        );
                        setPlan({ ...plan, pages });
                      }}
                      rows={10}
                      style={textarea}
                    />
                    <p style={{ ...muted, marginTop: 10 }}>{page.wordCount} words · text zone {page.textZone?.w}% × {page.textZone?.h}%</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {tab === 'export' && (
        <section style={{ ...card, marginTop: 16 }}>
          <h2 style={h2}>Export</h2>
          <p style={muted}>Download print-oriented HTML previews (spreads + cover). Professional PDF assembly uses the same layout engine.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={!coverHtml && !coverImage}
              onClick={() => coverHtml && downloadHtml(coverHtml, `${slug(brief.title)}-cover.html`)}
              style={primaryBtn}
            >
              <Download size={16} /> Cover HTML
            </button>
            <button
              type="button"
              disabled={!pagesHtml && !plan}
              onClick={async () => {
                if (pagesHtml) return downloadHtml(pagesHtml, `${slug(brief.title)}-spreads.html`);
                if (!plan) return;
                const res = await fetch('/api/caspa/design/picture-book/preview-html', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ plan, facing: true }),
                });
                const json = await res.json();
                if (json.success) {
                  setPagesHtml(json.data.html);
                  downloadHtml(json.data.html, `${slug(brief.title)}-spreads.html`);
                }
              }}
              style={secondaryBtn}
            >
              <Download size={16} /> Spread HTML
            </button>
          </div>
          {plan && (
            <ul style={{ marginTop: 18, color: '#5a4a38', lineHeight: 1.6 }}>
              <li>Trim: {plan.trim?.label}</li>
              <li>Pages: {plan.pageCount} (signature-friendly multiples of 4)</li>
              <li>Bleed: {plan.bleedMm}mm · Safety: {plan.safetyMm}mm</li>
              <li>Character locks: {plan.characterLocks?.length || 0}</li>
            </ul>
          )}
        </section>
      )}

      {(status || error) && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 14,
            background: error ? '#fff0ef' : '#f3ecdf',
            color: error ? '#a02b20' : '#3d3428',
          }}
        >
          {error || status}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @media (max-width: 860px) {
          .design-page-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6, minWidth: 160, flex: 1 }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8a7d6c' }}>{label}</span>
      {children}
    </label>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: '#f3ecdf', border: '1px solid #eadfce', borderRadius: 999, padding: '4px 10px', fontSize: 12 }}>
      {children}
    </span>
  );
}

function slug(s: string) {
  return (s || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'book';
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e8e1d4',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 12px 40px rgba(20,16,10,.05)',
};
const controls: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' };
const h2: React.CSSProperties = { margin: '0 0 8px', fontSize: 20 };
const muted: React.CSSProperties = { margin: '0 0 14px', color: '#6d6255' };
const input: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: '1px solid #eadfce',
  background: '#fffaf2',
  width: '100%',
  boxSizing: 'border-box',
};
const textarea: React.CSSProperties = { ...input, resize: 'vertical', lineHeight: 1.5 };
const pill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 999,
  border: '1px solid #eadfce',
  padding: '10px 14px',
  background: '#fff',
  cursor: 'pointer',
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid #d6a846',
  background: '#d6a846',
  color: '#1d1408',
  borderRadius: 14,
  padding: '12px 16px',
  cursor: 'pointer',
  fontWeight: 700,
};
const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: '#fffaf2',
  color: '#4a3b28',
  borderColor: '#eadfce',
  fontWeight: 600,
};
const emptyArt: React.CSSProperties = {
  minHeight: 220,
  borderRadius: 14,
  border: '1px dashed #d2c4ad',
  background: '#f7f1e6',
  padding: 16,
  color: '#6d6255',
  lineHeight: 1.45,
};

const defaultAges = [
  { id: '0-3', label: '0–3 board / toddler' },
  { id: '3-5', label: '3–5 preschool' },
  { id: '5-8', label: '5–8 early reader' },
  { id: '8-12', label: '8–12 illustrated chapter' },
  { id: 'all-ages', label: 'All-ages picture book' },
  { id: 'adult-illustrated', label: 'Adult illustrated' },
];
const defaultTrims = [
  { id: '8x8', label: '8×8″ square' },
  { id: '8.5x8.5', label: '8.5×8.5″ square' },
  { id: '10x8', label: '10×8″ landscape' },
  { id: '8x10', label: '8×10″ portrait' },
  { id: '6x9', label: '6×9″ novel' },
];
const defaultStyles = [
  { id: 'watercolor-picture-book', label: 'Watercolour picture book' },
  { id: 'gouache-storybook', label: 'Gouache storybook' },
  { id: 'digital-cel', label: 'Digital cel' },
  { id: 'painterly-literary', label: 'Painterly literary' },
];
