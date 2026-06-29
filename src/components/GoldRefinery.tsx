/**
 * Caspa Gold Refinery — live multi-pass polish with SSE progress
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Check, Loader, Play, Sparkles } from 'lucide-react';
import type { ProjectBriefLike } from '../services/commissionService';
import type { GoldPassDefinition, GoldPassResult, GoldPipelineProgressEvent } from '../types/gold';
import { GOLD_PASS_DEFINITIONS } from '../types/gold';

interface Props {
  brief: ProjectBriefLike;
  draftPage: string;
  setDraftPage: (value: string) => void;
}

type PassStatus = 'idle' | 'running' | 'done' | 'failed';

export default function GoldRefinery({ brief, draftPage, setDraftPage }: Props) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [passStates, setPassStates] = useState<Record<string, PassStatus>>({});
  const [passResults, setPassResults] = useState<Record<string, GoldPassResult>>({});
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [rewritePrompt, setRewritePrompt] = useState('');

  const wordCount = useMemo(
    () => draftPage.trim().split(/\s+/).filter(Boolean).length,
    [draftPage]
  );

  const resetPasses = () => {
    const next: Record<string, PassStatus> = {};
    GOLD_PASS_DEFINITIONS.forEach((p) => {
      next[p.id] = 'idle';
    });
    setPassStates(next);
    setPassResults({});
  };

  const runQualityPass = async () => {
    if (!draftPage.trim()) {
      setStatus('Paste text first.');
      return;
    }
    setStatus('Running Novel Write Pro quality pass…');
    try {
      const res = await fetch('/api/caspa/novel-write-pro/quality-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draftPage,
          mode: brief.mode === 'script' || brief.mode === 'musical' ? brief.mode : brief.mode === 'gold' ? 'polish' : 'novel',
          title: brief.title,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Quality pass failed');
      setQualityScore(data.data.overallScore);
      setRewritePrompt(data.data.recommendedRewritePrompt);
      setStatus(`Quality pass: ${data.data.status} (${data.data.overallScore}%)`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Quality pass failed');
    }
  };

  const runPipeline = useCallback(async () => {
    if (!draftPage.trim()) {
      setStatus('Paste text first.');
      return;
    }

    resetPasses();
    setRunning(true);
    setStatus('Gold Pipeline running…');
    setQualityScore(null);
    setRewritePrompt('');

    try {
      const res = await fetch('/api/caspa/gold/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draftPage,
          title: brief.title,
          tone: brief.tone,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Pipeline request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;

          const event = JSON.parse(payload) as GoldPipelineProgressEvent;
          if (event.type === 'stage' && event.passId) {
            setPassStates((prev) => ({
              ...prev,
              [event.passId!]: event.status === 'running' ? 'running' : 'done',
            }));
            if (event.status === 'done' && event.notes) {
              setPassResults((prev) => ({
                ...prev,
                [event.passId!]: {
                  passId: event.passId!,
                  name: event.passName || event.passId!,
                  notes: event.notes || '',
                  revisedText: event.revisedText,
                  durationMs: 0,
                },
              }));
              if (event.revisedText?.trim()) {
                setDraftPage(event.revisedText);
              }
            }
            setStatus(`${event.passName || event.passId} — ${event.status}`);
          }
          if (event.type === 'complete' && event.finalText) {
            setDraftPage(event.finalText);
            setStatus('Gold Pipeline complete.');
          }
          if (event.type === 'error') {
            setStatus(event.message || 'Pipeline error');
          }
        }
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Pipeline failed');
    } finally {
      setRunning(false);
    }
  }, [brief, draftPage, setDraftPage]);

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={kicker}>Gold Refinery</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
            Polish existing work
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: '#73695d', fontSize: 17, lineHeight: 1.5 }}>
            Novel Write Pro quality pass plus five-pass Gold Pipeline — streamed live, no log fishing.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: 20 }}>
          <article style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={sectionTitle}>Manuscript</h2>
              <span style={{ fontSize: 13, color: '#8a7a66' }}>{wordCount.toLocaleString()} words</span>
            </div>
            <textarea
              value={draftPage}
              onChange={(e) => setDraftPage(e.target.value)}
              placeholder="Paste chapter, scene, treatment or script extract here."
              style={{ ...textarea, minHeight: 360 }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button type="button" onClick={runPipeline} disabled={running} style={primaryBtn}>
                {running ? <Loader size={18} className="spin" /> : <Play size={18} />}
                Run Gold Pipeline
              </button>
              <button type="button" onClick={runQualityPass} disabled={running} style={ghostBtn}>
                <Sparkles size={18} /> Novel Write Pro pass
              </button>
            </div>
            {status && <p style={{ marginTop: 12, fontSize: 14, color: '#5c5146' }}>{status}</p>}
          </article>

          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <article style={card}>
              <h2 style={sectionTitle}>Refinement route</h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {GOLD_PASS_DEFINITIONS.map((pass: GoldPassDefinition, index) => (
                  <PassRow
                    key={pass.id}
                    index={index + 1}
                    pass={pass}
                    state={passStates[pass.id] || 'idle'}
                    result={passResults[pass.id]}
                  />
                ))}
              </div>
            </article>

            {(qualityScore != null || rewritePrompt) && (
              <article style={card}>
                <h2 style={sectionTitle}>Novel Write Pro</h2>
                {qualityScore != null && (
                  <p style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px', color: qualityScore >= 75 ? '#047857' : '#b45309' }}>
                    {qualityScore}%
                  </p>
                )}
                {rewritePrompt && (
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#5c5146' }}>{rewritePrompt}</p>
                )}
              </article>
            )}

            <article style={card}>
              <h2 style={sectionTitle}>Current project</h2>
              <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>{brief.title}</p>
              <p style={{ margin: 0, color: '#73695d', lineHeight: 1.5 }}>{brief.idea}</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function PassRow({
  index,
  pass,
  state,
  result,
}: {
  index: number;
  pass: GoldPassDefinition;
  state: PassStatus;
  result?: GoldPassResult;
}) {
  return (
    <div style={{ padding: 12, borderRadius: 14, background: '#fff8ea', border: '1px solid #eadfce' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <strong style={{ minWidth: 18 }}>{index}</strong>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b>{pass.name}</b>
            {state === 'running' && <Loader size={14} className="spin" />}
            {state === 'done' && <Check size={14} color="#047857" />}
          </div>
          <small style={{ display: 'block', color: '#73695d', marginTop: 2 }}>{pass.detail}</small>
          {result?.notes && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#5c5146', lineHeight: 1.5 }}>
              {result.notes.slice(0, 280)}
              {result.notes.length > 280 ? '…' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
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

const textarea: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #e2d6c3',
  borderRadius: 14,
  padding: '14px 16px',
  background: '#fffdf8',
  fontFamily: 'Georgia, Cambria, serif',
  fontSize: 17,
  lineHeight: 1.65,
  resize: 'vertical',
};

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
  gap: 8,
  border: '1px solid #d8c9b4',
  borderRadius: 14,
  padding: '12px 18px',
  background: '#fffaf2',
  fontWeight: 700,
  cursor: 'pointer',
  color: '#3d3428',
};
