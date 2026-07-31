/**
 * Guided next step — one clear action with rationale
 * Shows the path to a finished book so end stages are never hidden.
 */

import React from 'react';
import { ArrowRight, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import {
  isFinishStage,
  stepToNavTarget,
  type WorkflowNavTarget,
  type WorkflowPhase,
  type WorkflowStep,
} from '../services/projectWorkflowService';

interface Props {
  step: WorkflowStep;
  progress: { done: number; total: number; percent: number };
  phases: WorkflowPhase[];
  onGo: (target: WorkflowNavTarget) => void;
  onComplete?: () => void;
  briefTitle: string;
  wordsNow?: number;
  wordsTarget?: number;
}

export default function GuidedNextStep({
  step,
  progress,
  phases,
  onGo,
  onComplete,
  briefTitle,
  wordsNow = 0,
  wordsTarget = 0,
}: Props) {
  const isCompleteAction = step.id === 'complete_to_library';
  const finishStage = isFinishStage(step.id);

  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          borderRadius: 28,
          padding: '28px 32px',
          background: finishStage
            ? 'linear-gradient(135deg, #1a2414 0%, #2a3a1c 100%)'
            : 'linear-gradient(135deg, #17120c 0%, #2a2115 100%)',
          color: '#fffaf2',
          boxShadow: '0 24px 80px rgba(23, 18, 12, 0.2)',
        }}
      >
        <PathRail phases={phases} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ color: '#d6a846', fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 }}>
              <Sparkles size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
              {finishStage ? 'Finish the book' : 'Your next step'}
            </div>
            <h2 style={{ margin: 0, fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: -1, lineHeight: 1.1 }}>{step.title}</h2>
            <p style={{ margin: '10px 0 0', color: '#c9b898', fontSize: 15, maxWidth: 640, lineHeight: 1.55 }}>{briefTitle}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#d6a846' }}>{progress.percent}%</div>
            <div style={{ fontSize: 12, color: '#9b8c73' }}>
              {progress.done} of {progress.total} required steps
            </div>
            {wordsTarget > 0 && (
              <div style={{ fontSize: 12, color: '#9b8c73', marginTop: 4 }}>
                {wordsNow.toLocaleString()} / {wordsTarget.toLocaleString()} words
              </div>
            )}
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
          {finishStage && step.id === 'export' && (
            <p style={{ margin: '12px 0 0', lineHeight: 1.5, color: '#c9b898', fontSize: 14 }}>
              After export: Move to library. That is the finished-book ending — the workbench clears for the next idea.
            </p>
          )}
          {finishStage && step.id === 'complete_to_library' && (
            <p style={{ margin: '12px 0 0', lineHeight: 1.5, color: '#c9b898', fontSize: 14 }}>
              This shelves the manuscript. Reopen anytime from Library.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {isCompleteAction ? (
            <button type="button" onClick={onComplete} style={primaryBtn}>
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

function PathRail({ phases }: { phases: WorkflowPhase[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${phases.length}, 1fr)`,
        gap: 8,
        marginBottom: 22,
      }}
      aria-label="Path to finished book"
    >
      {phases.map((phase, i) => (
        <div key={phase.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: phase.done || phase.current ? '#d6a846' : 'rgba(255,255,255,0.12)',
              opacity: phase.current ? 1 : phase.done ? 0.7 : 0.45,
            }}
          />
          <div
            style={{
              fontSize: 11,
              fontWeight: phase.current ? 800 : 600,
              letterSpacing: 0.4,
              color: phase.current ? '#ffe2a5' : phase.done ? '#c9b898' : '#7a6d58',
            }}
          >
            {i + 1}. {phase.label}
          </div>
        </div>
      ))}
    </div>
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
      <h2 style={sectionTitle}>Full path to finished book</h2>
      <p style={{ margin: '0 0 16px', color: '#73695d', fontSize: 14, lineHeight: 1.5 }}>
        Brief → Draft → Workshop (diagnose → commission → artefact) → Read → Export → Library. Every step is selectable.
      </p>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
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
                border: `1px solid ${s.done ? '#c6e7d4' : isFinishStage(s.id) ? '#d6a846' : '#eadfce'}`,
                borderRadius: 14,
                padding: '12px 14px',
                background: s.done ? '#f0fdf4' : isFinishStage(s.id) ? '#fff8ea' : '#fffdf8',
                cursor: 'pointer',
              }}
            >
              {s.done ? (
                <CheckCircle2 size={18} color="#15803d" style={{ flexShrink: 0, marginTop: 2 }} />
              ) : (
                <Circle size={18} color={isFinishStage(s.id) ? '#9b6d16' : '#9b8c73'} style={{ flexShrink: 0, marginTop: 2 }} />
              )}
              <span>
                <strong style={{ display: 'block', fontSize: 14, color: '#21180f' }}>
                  {s.title}
                  {s.optional ? ' (optional)' : ''}
                  {isFinishStage(s.id) && !s.done ? ' · end stage' : ''}
                </strong>
                <small style={{ color: '#73695d', lineHeight: 1.4 }}>{s.why}</small>
                {s.workshopTab && (
                  <small style={{ display: 'block', marginTop: 4, color: '#9b6d16', fontWeight: 600 }}>
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
  background: 'rgba(255,255,255,0.72)',
  border: '1px solid #eadfce',
  boxShadow: '0 18px 50px rgba(40, 29, 12, 0.06)',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 20,
  letterSpacing: -0.3,
};
