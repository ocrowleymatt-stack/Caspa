/**
 * Caspa Psychology Studio — design emotional journeys
 */

import React, { useState } from 'react';
import { Brain, Loader, Sparkles } from 'lucide-react';
import type { ProjectBriefLike } from '../services/commissionService';
import { getProjectKey } from '../services/researchLibraryService';
import {
  designPsychologyBlueprint,
  loadBlueprint,
  saveBlueprint,
} from '../services/psychologyEngineService';
import type { PsychologyBlueprint } from '../types/psychology';

interface Props {
  brief: ProjectBriefLike;
  manuscriptText?: string;
}

const PRESETS = [
  'Uplifting but deeply sad — grief with earned hope',
  'Slow-burn dread into sudden cathartic release',
  'Bittersweet comedy — laugh until it hurts',
  'Hidden meaning the reader only gets on second read',
  'Twist ending that rewrites everything before it',
];

export default function PsychologyStudio({ brief, manuscriptText = '' }: Props) {
  const projectKey = getProjectKey(brief);
  const [intent, setIntent] = useState(() => loadBlueprint(projectKey)?.userIntent || '');
  const [blueprint, setBlueprint] = useState<PsychologyBlueprint | null>(() => loadBlueprint(projectKey));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleDesign = async () => {
    if (!intent.trim()) return;
    setLoading(true);
    setStatus('Designing emotional architecture…');
    try {
      const result = await designPsychologyBlueprint(intent, brief, manuscriptText);
      saveBlueprint(projectKey, result);
      setBlueprint(result);
      setStatus('Blueprint saved — injected into all Workshop drafts.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Design failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <div style={kicker}>Psychology Engine</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 52px)', lineHeight: 1, letterSpacing: -2 }}>
            Design the feeling
          </h1>
          <p style={{ margin: 0, color: '#73695d', fontSize: 18, lineHeight: 1.5 }}>
            Tell Caspa how you want readers to feel — uplifting but grieving, dread into catharsis, hidden meaning,
            twist reveals. Every Workshop draft will follow this emotional machine.
          </p>
        </header>

        <article style={card}>
          <h2 style={sectionTitle}>Emotional intent</h2>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            rows={4}
            placeholder="e.g. I want an ending that is both highly uplifting and deeply sad…"
            style={textareaStyle}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0 16px' }}>
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setIntent(p)} style={chipBtn}>
                {p.slice(0, 42)}…
              </button>
            ))}
          </div>
          <button type="button" onClick={handleDesign} disabled={loading || !intent.trim()} style={primaryBtn}>
            {loading ? <Loader size={18} className="spin" /> : <Brain size={18} />}
            {loading ? 'Designing…' : 'Design psychology blueprint'}
          </button>
          {status && <p style={{ marginTop: 12, color: '#9b6d16', fontSize: 14 }}>{status}</p>}
        </article>

        {blueprint && (
          <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
            <article style={card}>
              <h2 style={sectionTitle}>Journey</h2>
              <p style={{ lineHeight: 1.6, margin: 0 }}>{blueprint.journeySummary}</p>
              {blueprint.hiddenMeaning && (
                <p style={{ marginTop: 12, color: '#5b4724' }}>
                  <strong>Hidden meaning:</strong> {blueprint.hiddenMeaning}
                </p>
              )}
              {blueprint.twistReveal && (
                <p style={{ marginTop: 8, color: '#5b4724' }}>
                  <strong>Twist/reveal:</strong> {blueprint.twistReveal}
                </p>
              )}
            </article>

            {blueprint.beats.map((beat) => (
              <article key={`${beat.act}-${beat.label}`} style={card}>
                <h3 style={{ margin: '0 0 8px' }}>
                  Act {beat.act}: {beat.label}
                </h3>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#8a7a66' }}>
                  Hope {beat.target.hope}% · Grief {beat.target.grief}% · Tension {beat.target.tension}% · Joy{' '}
                  {beat.target.joy}% · Catharsis {beat.target.catharsis}%
                </p>
                <p style={{ margin: 0, fontSize: 14, color: '#5b4724' }}>
                  <Sparkles size={14} style={{ verticalAlign: -2 }} /> {beat.techniques.join(' · ')}
                </p>
                {beat.notes && <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>{beat.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
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
};

const sectionTitle: React.CSSProperties = { margin: '0 0 14px', fontSize: 20 };

const textareaStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #e2d6c3',
  borderRadius: 14,
  padding: 16,
  fontSize: 16,
  lineHeight: 1.6,
  fontFamily: 'inherit',
  background: '#fffdf8',
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

const chipBtn: React.CSSProperties = {
  border: '1px solid #eadfce',
  background: '#fff8ea',
  borderRadius: 999,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
  color: '#5b4724',
};
