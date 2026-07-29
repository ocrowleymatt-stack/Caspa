/**
 * Red Pen — quick Novel Write Pro quality scan
 */

import React, { useState } from 'react';
import { CircleAlert, Hammer, Loader, Sparkles } from 'lucide-react';
import type { ProjectBriefLike } from '../services/commissionService';
import type { QualityGateFinding } from '../types/gold';

interface Props {
  brief: ProjectBriefLike;
  draftPage: string;
  onOpenWorkshop: () => void;
}

const cardStyle: React.CSSProperties = {
  borderRadius: 26,
  padding: 24,
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid #eadfce',
  boxShadow: '0 18px 50px rgba(40, 29, 12, 0.06)',
};

const cardGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 18,
};

const sectionTitle: React.CSSProperties = { margin: '0 0 12px', fontSize: 20, letterSpacing: -0.3 };
const bigText: React.CSSProperties = { fontSize: 28, fontWeight: 800, margin: '0 0 8px' };

export default function RedPenStudio({ brief, draftPage, onOpenWorkshop }: Props) {
  const [scanning, setScanning] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [findings, setFindings] = useState<QualityGateFinding[]>([]);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');

  const wordCount = draftPage.trim().split(/\s+/).filter(Boolean).length;

  const runScan = async () => {
    if (!draftPage.trim()) {
      setStatus('Paste a draft in White Page or Workshop first.');
      return;
    }
    setScanning(true);
    setStatus('Scanning…');
    try {
      const res = await fetch('/api/caspa/novel-write-pro/quality-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draftPage, mode: 'novel', title: brief.title }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Scan failed');
      setScore(data.data.overallScore);
      setFindings(data.data.findings || []);
      setPrompt(data.data.recommendedRewritePrompt || '');
      setStatus(`Scan complete — ${data.data.status}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: '#9b6d16', fontSize: 12, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            Red Pen
          </div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
            Quick scan
          </h1>
          <p style={{ margin: 0, maxWidth: 640, color: '#73695d', fontSize: 17, lineHeight: 1.5 }}>
            Novel Write Pro quality pass — fast heuristic gates before full Workshop diagnosis.
          </p>
        </div>

        <div style={cardGrid}>
          <article style={cardStyle}>
            <h2 style={sectionTitle}>Project</h2>
            <p style={bigText}>{brief.title}</p>
            <p style={{ margin: 0, color: '#73695d' }}>{brief.idea}</p>
          </article>

          <article style={cardStyle}>
            <h2 style={sectionTitle}>Draft status</h2>
            <p style={bigText}>{wordCount.toLocaleString()} words</p>
            <p style={{ color: '#73695d' }}>
              {wordCount ? 'Ready to scan or send to Workshop.' : 'No draft yet.'}
            </p>
            <button
              type="button"
              onClick={runScan}
              disabled={scanning || !wordCount}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 14,
                border: 'none',
                borderRadius: 14,
                padding: '12px 18px',
                background: '#d6a846',
                color: '#1d1408',
                fontWeight: 800,
                cursor: wordCount ? 'pointer' : 'not-allowed',
                opacity: wordCount ? 1 : 0.6,
              }}
            >
              {scanning ? <Loader size={18} className="spin" /> : <Sparkles size={18} />}
              Run quality scan
            </button>
            {status && <p style={{ marginTop: 10, fontSize: 14, color: '#5c5146' }}>{status}</p>}
          </article>

          <article style={cardStyle}>
            <h2 style={sectionTitle}>Full pipeline</h2>
            <p style={{ color: '#73695d', lineHeight: 1.6 }}>
              Workshop gives structured recommendations and one-click Write it.
            </p>
            <button
              type="button"
              onClick={onOpenWorkshop}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 14,
                border: 'none',
                borderRadius: 14,
                padding: '12px 18px',
                background: '#1d1408',
                color: '#ffe2a5',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Hammer size={18} /> Open Workshop
            </button>
          </article>

          {score != null && (
            <article style={{ ...cardStyle, gridColumn: '1 / -1' }}>
              <h2 style={sectionTitle}>
                <CircleAlert size={20} style={{ verticalAlign: -3, marginRight: 8 }} />
                Quality score: {score}%
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {findings.map((f) => (
                  <div
                    key={f.gate}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      background: f.status === 'pass' ? '#ecfdf5' : f.status === 'warn' ? '#fff7ed' : '#fef2f2',
                      border: '1px solid #eadfce',
                    }}
                  >
                    <strong>{f.gate}</strong>
                    <div style={{ fontSize: 22, fontWeight: 800, margin: '4px 0' }}>{f.score}%</div>
                    {f.issues[0] && <small style={{ color: '#73695d' }}>{f.issues[0]}</small>}
                  </div>
                ))}
              </div>
              {prompt && (
                <p style={{ marginTop: 16, fontSize: 15, lineHeight: 1.6, color: '#5c5146' }}>
                  <strong>Rewrite prompt:</strong> {prompt}
                </p>
              )}
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
