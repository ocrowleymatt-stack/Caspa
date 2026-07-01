/**
 * Caspa Publish Pack — export profiles with quality gate
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Archive, CheckCircle2, Download, FileText, Loader, Shield, Sparkles } from 'lucide-react';
import type { ProjectBriefLike } from '../services/commissionService';
import {
  analyzeForExport,
  downloadMarkdown,
  downloadPdf,
  evaluateExportGate,
  loadExportContext,
} from '../services/exportService';
import { EXPORT_PROFILES, type ExportProfile, type ContentAnalysisSummary } from '../types/export';

interface Props {
  brief: ProjectBriefLike;
  authorEmail?: string;
  onGoWorkshop?: () => void;
  onMoveToLibrary?: () => void;
}

export default function PublishPack({ brief, authorEmail, onGoWorkshop, onMoveToLibrary }: Props) {
  const [profile, setProfile] = useState<ExportProfile>('kdp-novel');
  const [overrideGate, setOverrideGate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ContentAnalysisSummary | null>(null);
  const [status, setStatus] = useState('');
  const [ctx, setCtx] = useState(() => loadExportContext(brief, authorEmail));

  const refresh = useCallback(() => {
    setCtx(loadExportContext(brief, authorEmail));
  }, [brief, authorEmail]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const gate = useMemo(() => evaluateExportGate(ctx, overrideGate), [ctx, overrideGate]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setStatus('Analysing for print production…');
    try {
      const result = await analyzeForExport(ctx);
      setAnalysis(result);
      setStatus('');
    } catch {
      setStatus('Analysis unavailable — export still possible.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = async () => {
    if (!gate.canExport && !overrideGate) return;

    setExporting(true);
    setStatus('Building export…');

    try {
      if (profile === 'markdown') {
        downloadMarkdown(ctx);
        setStatus('Markdown downloaded. Move this manuscript to your library when you are done.');
      } else {
        await downloadPdf(ctx, profile);
        setStatus('PDF downloaded. Move this manuscript to your library when you are done.');
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <div style={kicker}>Publish Pack</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
            Export when it&apos;s ready
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: '#73695d', fontSize: 18, lineHeight: 1.5 }}>
            Nothing leaves Caspa broken. Export profiles for KDP, course books, and reference bibles — gated on story
            promises and manuscript quality.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, 0.8fr)', gap: 20 }} className="publish-grid">
          <div style={{ display: 'grid', gap: 16 }}>
            <article style={{ ...card, borderLeft: `4px solid ${gate.blocked && !overrideGate ? '#b91c1c' : '#15803d'}` }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <Shield size={22} color={gate.blocked && !overrideGate ? '#b91c1c' : '#15803d'} />
                <h2 style={{ ...sectionTitle, margin: 0 }}>Export gate</h2>
              </div>
              <p style={{ margin: '0 0 12px', color: '#6f6252' }}>
                {gate.wordCount.toLocaleString()} words · {ctx.promises.length} tracked promise
                {ctx.promises.length !== 1 ? 's' : ''}
                {ctx.diagnosis ? ` · ${ctx.diagnosis.viabilityScore}% viability` : ''}
              </p>

              {gate.blockers.length > 0 && !overrideGate && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#7f1d1d', fontWeight: 700 }}>What you need before export:</p>
                  <ul style={{ margin: 0, paddingLeft: 20, color: '#b91c1c', lineHeight: 1.6 }}>
                    {gate.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {gate.warnings.length > 0 && (
                <ul style={{ margin: '0 0 12px', paddingLeft: 20, color: '#b45309', lineHeight: 1.6 }}>
                  {gate.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}

              {gate.canExport && (
                <p style={{ margin: 0, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={18} /> Cleared for export
                </p>
              )}

              {gate.blocked && (
                <label style={{ display: 'flex', gap: 10, marginTop: 14, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={overrideGate} onChange={(e) => setOverrideGate(e.target.checked)} />
                  Export anyway (override broken-promise block)
                </label>
              )}
            </article>

            <article style={card}>
              <h2 style={sectionTitle}>Export profile</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {EXPORT_PROFILES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProfile(p.id)}
                    style={{
                      textAlign: 'left',
                      padding: 14,
                      borderRadius: 14,
                      border: `2px solid ${profile === p.id ? '#d6a846' : '#eadfce'}`,
                      background: profile === p.id ? '#fff8ea' : '#fffdf8',
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ display: 'block' }}>{p.label}</strong>
                    <small style={{ color: '#8a7a66' }}>{p.detail}</small>
                    <small style={{ display: 'block', color: '#9b6d16', marginTop: 4 }}>Trim: {p.trim}</small>
                  </button>
                ))}
              </div>
            </article>
          </div>

          <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <article style={card}>
              <h2 style={sectionTitle}>{ctx.title}</h2>
              <p style={{ color: '#73695d', margin: '0 0 16px', lineHeight: 1.5 }}>{brief.idea}</p>
              <button type="button" onClick={refresh} style={ghostBtn}>
                Refresh from Workshop
              </button>
              {onGoWorkshop && (
                <button type="button" onClick={onGoWorkshop} style={{ ...ghostBtn, marginTop: 8, width: '100%' }}>
                  Open Workshop
                </button>
              )}
            </article>

            <article style={card}>
              <h2 style={sectionTitle}>Production analysis</h2>
              <button type="button" onClick={handleAnalyze} disabled={analyzing || !ctx.manuscript.trim()} style={ghostBtn}>
                {analyzing ? <Loader size={16} className="spin" /> : <Sparkles size={16} />}
                Analyse for print
              </button>
              {analysis && (
                <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: '#5b4724' }}>
                  {analysis.documentType && <p style={{ margin: '0 0 6px' }}>Type: <strong>{analysis.documentType}</strong></p>}
                  {analysis.estimatedPages != null && <p style={{ margin: '0 0 6px' }}>Est. pages: {analysis.estimatedPages}</p>}
                  {analysis.readiness != null && <p style={{ margin: '0 0 6px' }}>Readiness: {analysis.readiness}%</p>}
                  {analysis.illustrationCount != null && (
                    <p style={{ margin: '0 0 6px' }}>Illustrations planned: {analysis.illustrationCount}</p>
                  )}
                </div>
              )}
            </article>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || (!gate.canExport && !overrideGate) || !ctx.manuscript.trim()}
              style={primaryBtn}
            >
              {exporting ? <Loader size={20} className="spin" /> : <Download size={20} />}
              {exporting ? 'Exporting…' : profile === 'markdown' ? 'Download Markdown' : 'Download PDF'}
            </button>

            {gate.canExport && onMoveToLibrary && (
              <article style={{ ...card, borderLeft: '4px solid #15803d' }}>
                <h2 style={sectionTitle}>Finished?</h2>
                <p style={{ margin: '0 0 12px', color: '#5b4724', lineHeight: 1.55, fontSize: 14 }}>
                  A completed manuscript belongs in the library — not on the active workbench. This frees the studio for your next project.
                </p>
                <button type="button" onClick={onMoveToLibrary} style={primaryBtn}>
                  <Archive size={18} /> Move to library
                </button>
              </article>
            )}

            {status && (
              <p style={{ margin: 0, fontSize: 14, color: '#9b6d16', display: 'flex', alignItems: 'center', gap: 8 }}>
                {exporting && <Loader size={14} className="spin" />}
                {status}
              </p>
            )}

            {!ctx.manuscript.trim() && (
              <p style={{ margin: 0, fontSize: 13, color: '#8a7a66', display: 'flex', gap: 8 }}>
                <AlertCircle size={16} /> Paste or commission a manuscript in Workshop first.
              </p>
            )}
          </aside>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; } @media (max-width: 900px) { .publish-grid { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}

const kicker: React.CSSProperties = {
  color: '#9b6d16',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
};

const card: React.CSSProperties = {
  borderRadius: 26,
  padding: 24,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid #eadfce',
  boxShadow: '0 18px 50px rgba(40, 29, 12, 0.06)',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 20,
  letterSpacing: -0.3,
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  width: '100%',
  border: 'none',
  borderRadius: 16,
  padding: '14px 20px',
  background: '#d6a846',
  color: '#1d1408',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 15,
};

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 16px',
  borderRadius: 14,
  border: '1px solid #d8c9b4',
  background: '#fffaf2',
  color: '#3b3126',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  width: '100%',
  justifyContent: 'center',
};
