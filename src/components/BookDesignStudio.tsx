/**
 * Book Design Studio — Grok Imagine first, cover + picture-book layout under the hood.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BookImage, LayoutTemplate, Loader, Sparkles, Download, Image as ImageIcon, Check } from 'lucide-react';
import { fetchWithTimeout, friendlyFetchError } from '../lib/fetchWithTimeout';
import { IMAGINE_ASPECTS, type ImagineAspect, type ImagineQuality, type ImagineResolution } from '../services/grokImagineTypes';

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

type Tab = 'imagine' | 'cover' | 'pages' | 'export';

type ImagineTake = {
  id: string;
  url: string;
  prompt: string;
  aspectRatio: string;
  model: string;
  at: string;
};

const STORAGE_KEY = 'caspa.bookDesign';
const MAX_STORED_IMAGE = 1_400_000;

export default function BookDesignStudio({ brief, draftPage, authorName = '', onDraftChange }: Props) {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('imagine');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<ImagineAspect>('3:4');
  const [resolution, setResolution] = useState<ImagineResolution>('1k');
  const [quality, setQuality] = useState<ImagineQuality>('medium');
  const [takes, setTakes] = useState<ImagineTake[]>([]);
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
        if (typeof saved.prompt === 'string') setPrompt(saved.prompt);
        if (saved.aspectRatio) setAspectRatio(saved.aspectRatio);
        if (saved.resolution === '1k' || saved.resolution === '2k') setResolution(saved.resolution);
        if (saved.quality === 'low' || saved.quality === 'medium') setQuality(saved.quality);
        if (Array.isArray(saved.takes)) {
          setTakes(
            saved.takes
              .filter((take: ImagineTake) => take && typeof take.url === 'string' && take.url)
              .slice(0, 12)
          );
        }
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const latest = coverImage && coverImage.length < MAX_STORED_IMAGE ? coverImage : '';
    const storedTakes = takes.slice(0, 8).map((take, index) => ({
      ...take,
      url: index === 0 && take.url.length < MAX_STORED_IMAGE ? take.url : '',
    }));
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          coverImage: latest,
          plan,
          ageBand,
          trimId,
          artStyle,
          coverFormat,
          prompt,
          aspectRatio,
          resolution,
          quality,
          takes: storedTakes,
        })
      );
    } catch {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ plan, ageBand, trimId, artStyle, coverFormat, prompt, aspectRatio, resolution, quality, takes: [] })
        );
      } catch {
        /* quota — keep working in memory */
      }
    }
  }, [ready, coverImage, plan, ageBand, trimId, artStyle, coverFormat, prompt, aspectRatio, resolution, quality, takes]);

  useEffect(() => {
    if (!ready || prompt.trim()) return;
    const seed = [
      brief.title ? `Literary still for “${brief.title}”.` : 'Literary still.',
      brief.idea ? brief.idea.slice(0, 280) : '',
      brief.tone ? `Tone: ${brief.tone}.` : '',
      `Art direction: ${artStyle.replace(/-/g, ' ')}.`,
      'No logos, no barcode, no watermark. Typography only if it belongs in the image.',
    ].filter(Boolean).join(' ');
    setPrompt(seed);
  }, [ready, brief.title, brief.idea, brief.tone, artStyle, prompt]);

  const characters = useMemo(
    () =>
      characterName.trim()
        ? [{ name: characterName.trim(), ageLook: ageBand, features: ['consistent silhouette', 'warm expression'] }]
        : [],
    [characterName, ageBand]
  );

  const activeTake = takes.find((take) => take.url === coverImage);

  const runImagine = async () => {
    if (!prompt.trim()) {
      setError('Write what you want to see.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus(quality === 'low' ? 'Imagine is sketching…' : 'Grok Imagine is working…');
    try {
      const res = await fetchWithTimeout('/api/caspa/design/imagine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio, resolution, quality }),
      }, 180_000);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Imagine failed');
      const take: ImagineTake = {
        id: `${Date.now()}`,
        url: json.data.url,
        prompt: json.data.prompt,
        aspectRatio: json.data.aspectRatio,
        model: json.data.model,
        at: new Date().toISOString(),
      };
      setTakes((current) => [take, ...current].slice(0, 12));
      setCoverImage(json.data.url);
      setStatus(json.data.model === 'grok-imagine-image-2.0' ? 'Imagine 2.0 ready.' : `Ready · ${json.data.model}`);
      setTab('imagine');
    } catch (err) {
      setError(friendlyFetchError(err, 'Imagine failed'));
    } finally {
      setBusy(false);
    }
  };

  const generateCover = async (mode: 'front' | 'wraparound' = 'front') => {
    setBusy(true);
    setError('');
    setStatus(mode === 'wraparound' ? 'Generating wraparound jacket…' : 'Generating cover…');
    try {
      const res = await fetchWithTimeout('/api/caspa/design/cover/generate', {
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
      }, 180_000);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Cover failed');
      setCoverImage(json.data.imageUrl);
      setCoverHtml(json.data.htmlPreview || '');
      setStatus('Cover ready.');
      setTab('cover');
    } catch (err) {
      setError(friendlyFetchError(err, 'Cover generation failed'));
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
  const bookControls = (
    <section style={{ ...card, marginTop: tab === 'imagine' ? 0 : 16 }}>
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
  );

  return (
    <div style={tab === 'imagine' ? imagineShell : paperShell}>
      <header style={{ marginBottom: tab === 'imagine' ? 18 : 28 }}>
        <div style={{ color: tab === 'imagine' ? '#d4b36a' : '#8a6a28', fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          Grok Imagine
        </div>
        <h1 style={{ margin: '6px 0 8px', fontSize: tab === 'imagine' ? 40 : 34, letterSpacing: -1, color: tab === 'imagine' ? '#f6efe2' : undefined, fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
          {tab === 'imagine' ? 'See it first' : 'See the book'}
        </h1>
        <p style={{ margin: 0, color: tab === 'imagine' ? '#b9aa98' : '#6d6255', maxWidth: 640, lineHeight: 1.5 }}>
          {tab === 'imagine'
            ? 'Image 2.0 on a dark stage. Write the still. Keep the takes. Jacket and spreads wait until one bites.'
            : 'Lock the jacket or spreads once a still is true.'}
        </p>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {(
          [
            { id: 'imagine' as Tab, label: 'Imagine', icon: Sparkles },
            { id: 'cover' as Tab, label: 'Cover', icon: BookImage },
            { id: 'pages' as Tab, label: 'Pages', icon: LayoutTemplate },
            { id: 'export' as Tab, label: 'Export', icon: Download },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                ...pill,
                borderColor: on ? (tab === 'imagine' ? '#c9a768' : '#d6a846') : tab === 'imagine' ? 'rgba(201,167,104,.28)' : '#eadfce',
                background: on ? (tab === 'imagine' ? '#c9a768' : '#fff6df') : tab === 'imagine' ? 'rgba(20,16,26,.6)' : '#fff',
                color: on ? (tab === 'imagine' ? '#17110a' : '#1d1408') : tab === 'imagine' ? '#eee3d2' : undefined,
                fontWeight: on ? 700 : 500,
              }}
            >
              <Icon size={16} /> {label}
            </button>
          );
        })}
      </div>

      {tab === 'imagine' && (
        <section style={imagineCard}>
          <div style={stage}>
            {coverImage ? (
              <img src={coverImage} alt="Imagine take" style={stageImage} />
            ) : (
              <div style={stageEmpty}>
                <Sparkles size={22} />
                <p style={{ margin: '10px 0 0', maxWidth: 380 }}>
                  {busy ? 'Holding for the still…' : 'The stage is empty. Tell Imagine what the book looks like when nobody is explaining it.'}
                </p>
              </div>
            )}
            {busy && <div style={stageBusy}><Loader size={18} className="spin" /> Working</div>}
            {activeTake?.model && !busy && (
              <div style={stageBadge}>{activeTake.model === 'grok-imagine-image-2.0' ? 'Imagine 2.0' : activeTake.model}</div>
            )}
          </div>
          <div style={promptDock}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy) void runImagine();
                }
              }}
              rows={3}
              placeholder="A clerk at a harbour window, late light, no face shown…"
              style={imagineTextarea}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
              {IMAGINE_ASPECTS.map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  style={{
                    ...darkChip,
                    borderColor: aspectRatio === ratio ? '#c9a768' : 'rgba(201,167,104,.22)',
                    background: aspectRatio === ratio ? '#c9a768' : 'transparent',
                    color: aspectRatio === ratio ? '#17110a' : '#eee3d2',
                    fontWeight: aspectRatio === ratio ? 700 : 500,
                  }}
                >
                  {ratio}
                </button>
              ))}
              <button type="button" onClick={() => setResolution(resolution === '1k' ? '2k' : '1k')} style={darkChip}>
                {resolution.toUpperCase()}
              </button>
              <button type="button" onClick={() => setQuality(quality === 'medium' ? 'low' : 'medium')} style={darkChip}>
                {quality === 'low' ? 'Fast' : 'Quality'}
              </button>
              <button type="button" disabled={busy} onClick={() => void runImagine()} style={imaginePrimary}>
                {busy ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
                {coverImage ? 'Another take' : 'Imagine'}
              </button>
              {coverImage && (
                <button type="button" onClick={() => setTab('cover')} style={imagineGhost}>
                  <BookImage size={16} /> Use as cover
                </button>
              )}
            </div>
            {takes.length > 1 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 16, paddingBottom: 4 }}>
                {takes.filter((take) => take.url).map((take) => (
                  <button
                    key={take.id}
                    type="button"
                    onClick={() => {
                      setCoverImage(take.url);
                      setPrompt(take.prompt);
                    }}
                    title={take.model}
                    style={{
                      border: coverImage === take.url ? '2px solid #c9a768' : '1px solid rgba(201,167,104,.28)',
                      borderRadius: 12,
                      padding: 0,
                      overflow: 'hidden',
                      width: 72,
                      height: 72,
                      flex: '0 0 auto',
                      cursor: 'pointer',
                      background: '#17120e',
                    }}
                  >
                    <img src={take.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab !== 'imagine' && bookControls}

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
            <button
              type="button"
              disabled={busy || !plan}
              onClick={async () => {
                if (!plan) return;
                setBusy(true);
                setError('');
                setStatus('Building picture-book PDF…');
                try {
                  const res = await fetch('/api/caspa/design/picture-book/pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plan, facing: true }),
                  });
                  const ctype = res.headers.get('content-type') || '';
                  if (ctype.includes('application/pdf')) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${slug(brief.title)}-spreads.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setStatus('PDF downloaded.');
                  } else {
                    const json = await res.json();
                    if (json?.data?.html) {
                      setPagesHtml(json.data.html);
                      downloadHtml(json.data.html, `${slug(brief.title)}-spreads.html`);
                      setStatus(json.message || 'PDF engine unavailable — downloaded HTML instead.');
                    } else {
                      throw new Error(json.message || 'PDF failed');
                    }
                  }
                } catch (err: any) {
                  setError(err.message || 'PDF export failed');
                } finally {
                  setBusy(false);
                }
              }}
              style={secondaryBtn}
            >
              <Download size={16} /> Picture-book PDF
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
            background: error ? (tab === 'imagine' ? '#4c211d' : '#fff0ef') : tab === 'imagine' ? 'rgba(28,24,36,.82)' : '#f3ecdf',
            color: error ? (tab === 'imagine' ? '#ffd6cf' : '#a02b20') : tab === 'imagine' ? '#eee3d2' : '#3d3428',
            border: tab === 'imagine' ? '1px solid rgba(201,167,104,.18)' : undefined,
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

const paperShell: React.CSSProperties = {
  padding: '32px clamp(20px, 4vw, 56px)',
  maxWidth: 1200,
  margin: '0 auto',
};
const imagineShell: React.CSSProperties = {
  ...paperShell,
  maxWidth: 1280,
  minHeight: '100%',
  color: '#f4ead6',
};
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e8e1d4',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 12px 40px rgba(20,16,10,.05)',
};
const imagineCard: React.CSSProperties = {
  marginTop: 4,
  padding: 0,
  overflow: 'hidden',
  borderRadius: 22,
  border: '1px solid rgba(201,167,104,.18)',
  background: 'rgba(16,13,22,.88)',
  boxShadow: '0 24px 80px rgba(8,6,12,.35)',
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
const darkChip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  borderRadius: 999,
  border: '1px solid rgba(201,167,104,.22)',
  background: 'rgba(20,16,26,.6)',
  color: '#eee3d2',
  padding: '7px 11px',
  cursor: 'pointer',
};
const imaginePrimary: React.CSSProperties = {
  ...primaryBtn,
  background: '#c9a768',
  borderColor: '#c9a768',
  marginLeft: 'auto',
};
const imagineGhost: React.CSSProperties = {
  ...darkChip,
  padding: '12px 16px',
  borderRadius: 14,
};
const stage: React.CSSProperties = {
  position: 'relative',
  minHeight: 'min(64vh, 700px)',
  background:
    'radial-gradient(circle at 50% 18%, rgba(201,167,104,.12), transparent 28rem), #0d0b12',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const stageImage: React.CSSProperties = {
  width: '100%',
  maxHeight: 'min(64vh, 700px)',
  objectFit: 'contain',
  display: 'block',
};
const stageEmpty: React.CSSProperties = {
  color: '#c9b89a',
  textAlign: 'center',
  padding: 32,
  lineHeight: 1.5,
};
const stageBusy: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(16,13,22,.78)',
  color: '#d4b36a',
  fontSize: 12,
  letterSpacing: 0.4,
};
const stageBadge: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(16,13,22,.78)',
  color: '#d4b36a',
  fontSize: 11,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  fontWeight: 700,
};
const promptDock: React.CSSProperties = {
  padding: 18,
  borderTop: '1px solid rgba(201,167,104,.14)',
  background: 'rgba(12,10,16,.94)',
};
const imagineTextarea: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  lineHeight: 1.5,
  padding: 14,
  borderRadius: 14,
  border: '1px solid #514230',
  background: '#17120e',
  color: '#f4ebdc',
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
