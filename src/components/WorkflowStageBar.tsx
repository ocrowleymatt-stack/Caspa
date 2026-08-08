/**
 * Always-visible Back / Continue bar for studio rooms.
 * Lets a normal user leave a room and advance the guided workflow
 * without hunting the sidebar.
 */
import React from 'react';
import { ArrowLeft, ArrowRight, Home } from 'lucide-react';
import type { WorkflowStep } from '../services/projectWorkflowService';

interface Props {
  /** Next incomplete guided step (or null when none). */
  nextStep: WorkflowStep | null;
  onBack: () => void;
  onContinue: () => void;
  /** Optional label for the current room (shown as context). */
  roomLabel?: string;
}

export default function WorkflowStageBar({ nextStep, onBack, onContinue, roomLabel }: Props) {
  const continueLabel = nextStep
    ? nextStep.id === 'complete_to_library'
      ? 'Finish · move to library'
      : nextStep.action
    : 'Back to next step';

  return (
    <div
      style={{
        flexShrink: 0,
        zIndex: 40,
        borderTop: '1px solid #e3d8c4',
        background: 'rgba(255,250,242,0.97)',
        boxShadow: '0 -8px 28px rgba(40, 29, 12, 0.08)',
        padding: '12px clamp(16px, 3vw, 32px)',
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button type="button" onClick={onBack} style={ghostBtn}>
          <ArrowLeft size={16} /> Back to next step
        </button>

        <span style={{ fontSize: 13, color: '#73695d' }}>
          {roomLabel ? <strong style={{ color: '#2f281f' }}>{roomLabel}</strong> : null}
          {roomLabel && nextStep ? ' · ' : null}
          {nextStep ? (
            <>
              Next: <strong style={{ color: '#2f281f' }}>{nextStep.title}</strong>
            </>
          ) : (
            'All required steps done'
          )}
        </span>

        <button type="button" onClick={onContinue} style={primaryBtn}>
          {nextStep ? (
            <>
              {continueLabel} <ArrowRight size={16} />
            </>
          ) : (
            <>
              <Home size={16} /> Next step
            </>
          )}
        </button>
      </div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid #e0d3bf',
  borderRadius: 12,
  padding: '11px 14px',
  background: '#fff',
  color: '#2f281f',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  borderRadius: 12,
  padding: '11px 16px',
  background: '#d6a846',
  color: '#1d1408',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
};
