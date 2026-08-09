/**
 * Guided next step — one clear action with rationale
 */

import React from 'react';
import { ArrowRight, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import {
  stepToNavTarget,
  type WorkflowNavTarget,
  type WorkflowStep,
} from '../services/projectWorkflowService';

interface Props {
  step: WorkflowStep;
  progress: { done: number; total: number; percent: number };
  onGo: (target: WorkflowNavTarget) => void;
  onComplete?: () => void;
  briefTitle: string;
}

export default function GuidedNextStep({ step, progress, onGo, onComplete, briefTitle }: Props) {
  const isCompleteAction = step.id === 'complete_to_library';

  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          borderRadius: 28,
          padding: '28px 32px',
          background: 'linear-gradient(135deg, #17120c 0%, #2a2115 100%)',
          color: '#fffaf2',
          boxShadow: '0 24px 80px rgba(23, 18, 12, 0.2)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ color: '#d6a846', fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 }}>
              <Sparkles size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              Your next step
            </div>
            <h2 style={{ margin: 0, fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: -1, lineHeight: 1.1 }}>{step.title}</h2>
            <p style={{ margin: '10px 0 0', color: '#c9b898', fontSize: 15, maxWidth: 640, lineHeight: 1.55 }}>{briefTitle}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#d6a846' }}>{progress.percent}%</div>
            <div style={{ fontSize: 12, color: '#9b8c73' }}>
              {progress.done} of {progress.total} required steps
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(214, 168, 70, 0.25)',
            borderRadius: 18,
            padding: '18px 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#d6a846', marginBottom: 8 }}>
            Why this step
          </div>
          <p style={{ margin: 0, lineHeight: 1.6, color: '#e8dcc4', fontSize: 15 }}>{step.why}</p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {isCompleteAction ? (
            <button
              type="button"
              onClick={onComplete}
              style={primaryBtn}
            >
              <CheckCircle2 size={18} /> {step.action}
            </button>
          ) : (
            <button type="button" onClick={() => onGo(stepToNavTarget(step))} style={primaryBtn}>
              {step.action} <ArrowRight size={18} />
            </button>
          )}
          {step.optional && (
            <span style={{ alignSelf: 'center', fontSize: 13, color: '#9b8c73' }}>Optional — skip if not needed</span>
          )}
        </div>
      </div>
    </section>
  );
}

export function WorkflowChecklist({
  steps,
  onGo,
}: {
  steps: WorkflowStep[];
  onGo: (target: WorkflowNavTarget) => void;
}) {
  return (
    <article style={card}>
      <h2 style={sectionTitle}>Full path</h2>
      <p style={{ margin: '0 0 16px', color: '#f1e9f7', fontSize: 14, lineHeight: 1.55 }}>
        Every step is selectable — Diagnose → Recommendations; Commission → Write it; Review artefact stays in Workshop before White Page.
      </p>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 9 }}>
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onGo(stepToNavTarget(s))}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                textAlign: 'left',
                border: `1px solid ${s.done ? 'rgba(83, 209, 139, .55)' : 'rgba(212, 166, 255, .28)'}`,
                borderRadius: 14,
                padding: '12px 14px',
                background: s.done ? 'rgba(25, 59, 45, .42)' : 'rgba(255,255,255,.025)',
                color: '#f8f3fb',
                cursor: 'pointer',
              }}
            >
              {s.done ? (
                <CheckCircle2 size={18} color="#58d68d" style={{ flexShrink: 0, marginTop: 2 }} />
              ) : (
                <Circle size={18} color="#d4a6ff" style={{ flexShrink: 0, marginTop: 2 }} />
              )}
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 14, color: '#ffffff', lineHeight: 1.35 }}>
                  {s.title}
                  {s.optional ? ' (optional)' : ''}
                </strong>
                <small style={{ display: 'block', color: s.done ? '#93e7b6' : '#d9b8f3', lineHeight: 1.45, marginTop: 3 }}>
                  {s.why}
                </small>
                {s.workshopTab && (
                  <small style={{ display: 'block', marginTop: 5, color: '#d4a6ff', fontWeight: 700 }}>
                    Opens Workshop →{' '}
                    {s.workshopTab === 'recommendations'
                      ? 'Recommendations'
                      : s.workshopTab === 'commission'
                        ? 'Commission'
                        : s.workshopTab === 'workshop'
                          ? 'Artefact'
                          : s.workshopTab === 'inbox'
                            ? 'Inbox'
                            : 'Promises'}
                  </small>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </article>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  borderRadius: 14,
  padding: '14px 22px',
  background: '#d6a846',
  color: '#1d1408',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
};

const card: React.CSSProperties = {
  borderRadius: 26,
  padding: 24,
  background: 'linear-gradient(180deg, rgba(29,21,38,.98), rgba(18,13,24,.98))',
  border: '1px solid rgba(212,166,255,.28)',
  boxShadow: '0 18px 50px rgba(0, 0, 0, 0.24)',
  color: '#f8f3fb',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 20,
  letterSpacing: -0.3,
  color: '#ffffff',
};