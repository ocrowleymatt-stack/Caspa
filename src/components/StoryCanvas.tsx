/**
 * Caspa Jam Canvas — draw storyboards, extract structure, commission
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Hammer, Loader, Sparkles, Trash2 } from 'lucide-react';
import type { ProjectBriefLike } from '../services/commissionService';

interface Props {
  brief: ProjectBriefLike;
  onCommission: (text: string) => void;
}

const COLORS = ['#1a1208', '#b91c1c', '#2563eb', '#15803d', '#d6a846'];

export default function StoryCanvas({ brief, onCommission }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState(COLORS[0]);
  const [notes, setNotes] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState('');

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = color === COLORS[0] ? 3 : 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    initCanvas();
    setResult(null);
  };

  const canvasToBase64 = (): string => {
    const canvas = canvasRef.current!;
    const data = canvas.toDataURL('image/png');
    return data.split(',')[1] || '';
  };

  const handleExtract = async () => {
    setExtracting(true);
    setStatus('Reading your storyboard…');
    try {
      const response = await fetch('/api/caspa/canvas/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: canvasToBase64(),
          mimeType: 'image/png',
          notes,
          title: brief.title,
          premise: brief.idea,
          tone: brief.tone,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Extraction failed');
      }

      setResult(payload.data);
      setStatus('Structure extracted.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleCommission = () => {
    const seed =
      (result?.manuscriptSeed as string) ||
      `# ${brief.title}\n\n## Jam summary\n${result?.summary || notes}\n\n## Spine\n${((result?.spine as string[]) || []).map((s) => `- ${s}`).join('\n')}`;

    localStorage.setItem('caspa.manuscriptSource', seed);
    onCommission(seed);
  };

  return (
    <section style={{ minHeight: '100vh', padding: '36px clamp(16px, 4vw, 56px)', background: '#f2f2f0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ marginBottom: 20 }}>
          <div style={kicker}>Jam Canvas</div>
          <h1 style={{ margin: '4px 0', fontSize: 38, letterSpacing: -1 }}>Draw the story before you commit</h1>
          <p style={{ margin: 0, color: '#62584c' }}>
            Marker pens, finger or mouse — map plot lines, then let Caspa read the board.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18 }} className="canvas-grid">
          <div style={{ background: '#fff', border: '1px solid #dedede', boxShadow: '0 12px 40px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', gap: 8, padding: 12, borderBottom: '1px solid #eee', flexWrap: 'wrap', alignItems: 'center' }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Pen ${c}`}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: c,
                    border: color === c ? '3px solid #111' : '2px solid #fff',
                    cursor: 'pointer',
                  }}
                />
              ))}
              <button type="button" onClick={clearCanvas} style={toolBtn} title="Clear">
                <Trash2 size={16} />
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={1200}
              height={720}
              style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', cursor: 'crosshair' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>

          <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <article style={sideCard}>
              <h2 style={sideTitle}>Jam notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Throw ideas here — half sentences welcome…"
                style={{ width: '100%', minHeight: 140, border: 'none', resize: 'vertical', fontSize: 15, lineHeight: 1.6, fontFamily: 'Georgia, serif' }}
              />
            </article>

            <button type="button" onClick={handleExtract} disabled={extracting} style={primaryBtn}>
              {extracting ? <Loader size={18} className="spin" /> : <Sparkles size={18} />}
              {extracting ? 'Reading board…' : 'Extract structure'}
            </button>

            <button type="button" onClick={handleCommission} disabled={!result && !notes.trim()} style={secondaryBtn}>
              <Hammer size={18} /> Commission in Workshop
            </button>

            {status && <p style={{ fontSize: 13, color: '#9b6d16', margin: 0 }}>{status}</p>}

            {result && (
              <article style={sideCard}>
                <h2 style={sideTitle}>Extracted</h2>
                <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>{String(result.summary || '')}</p>
                {Array.isArray(result.spine) && (
                  <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                    {(result.spine as string[]).slice(0, 8).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
              </article>
            )}
          </aside>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; } @media (max-width: 900px) { .canvas-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

const kicker: React.CSSProperties = { color: '#9b6d16', fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' };
const sideCard: React.CSSProperties = { background: '#fff', border: '1px solid #dedede', padding: 16 };
const sideTitle: React.CSSProperties = { margin: '0 0 10px', fontSize: 16 };
const primaryBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 12, border: 'none', borderRadius: 12, background: '#1f2937', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const secondaryBtn: React.CSSProperties = { ...primaryBtn, background: '#d6a846', color: '#1d1408' };
const toolBtn: React.CSSProperties = { border: '1px solid #ddd', background: '#fafafa', borderRadius: 8, padding: 6, cursor: 'pointer', marginLeft: 'auto' };
