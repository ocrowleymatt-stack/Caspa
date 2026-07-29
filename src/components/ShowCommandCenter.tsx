/**
 * Show command center — one spine: pack → draft → workshop → publish
 */

import React from 'react';
import { Check, Circle, Clapperboard, Download, Hammer, Music2, Zap } from 'lucide-react';
import type { WorkflowNavTarget } from '../services/projectWorkflowService';
import { hasShowBoxContent, loadShowBox, showBoxPieceCount } from '../services/showBoxService';

interface Props {
  bookWords: number;
  onGo: (target: WorkflowNavTarget) => void;
}

export default function ShowCommandCenter({ bookWords, onGo }: Props) {
  const live = showBoxPieceCount(loadShowBox());
  const hasPack = hasShowBoxContent();

  const stations = [
    {
      id: 'pack',
      label: 'Pack',
      detail: hasPack ? `${live.done}/5 pieces` : 'Songs, order, cast, production',
      done: live.done >= 2,
      target: { view: 'showbox' as const },
      icon: Music2,
    },
    {
      id: 'draft',
      label: 'Draft book',
      detail: bookWords > 0 ? `${bookWords.toLocaleString()} words` : 'Scenes that turn into numbers',
      done: bookWords >= 80,
      target: { view: 'quickwrite' as const },
      icon: Zap,
    },
    {
      id: 'workshop',
      label: 'Workshop',
      detail: 'Diagnose & commission',
      done: false,
      target: { view: 'workshop' as const, workshopTab: 'inbox' as const },
      icon: Hammer,
    },
    {
      id: 'canvas',
      label: 'Storyboard',
      detail: 'Optional running-order board',
      done: false,
      target: { view: 'canvas' as const },
      icon: Clapperboard,
    },
    {
      id: 'publish',
      label: 'Export pack',
      detail: 'Show in a Box profile',
      done: false,
      target: { view: 'publish' as const },
      icon: Download,
    },
  ];

  return (
    <article
      style={{
        borderRadius: 26,
        padding: 24,
        background: 'linear-gradient(135deg, #fffaf2 0%, #fff8ea 100%)',
        border: '1px solid #eadfce',
        boxShadow: '0 18px 50px rgba(40, 29, 12, 0.06)',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ color: '#9b6d16', fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            Show command center
          </div>
          <h2 style={{ margin: '6px 0 0', fontSize: 22, letterSpacing: -0.4 }}>One spine for the whole box</h2>
          <p style={{ margin: '8px 0 0', color: '#73695d', fontSize: 14, lineHeight: 1.5, maxWidth: 560 }}>
            Pack the show, draft the book, pressure-test in Workshop, export the rehearsal pack. Every room shares the same locked songs and running order.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#9b6d16' }}>
            {live.done}/{live.total}
          </div>
          <div style={{ fontSize: 12, color: '#8a7a66' }}>pack pieces</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {stations.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onGo(s.target)}
              style={{
                textAlign: 'left',
                border: `1px solid ${s.done ? '#c6e7d4' : '#eadfce'}`,
                background: s.done ? '#f0fdf4' : '#fffdf8',
                borderRadius: 16,
                padding: 14,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {s.done ? <Check size={16} color="#15803d" /> : <Circle size={16} color="#9b8c73" />}
                <Icon size={16} color="#9b6d16" />
              </div>
              <strong style={{ display: 'block', fontSize: 14, color: '#21180f' }}>{s.label}</strong>
              <small style={{ color: '#73695d', lineHeight: 1.35 }}>{s.detail}</small>
            </button>
          );
        })}
      </div>

      {!hasPack && (
        <p style={{ margin: '14px 0 0', fontSize: 13, color: '#b45309' }}>
          Start in Pack — song list and running order lock before the book wanders.
        </p>
      )}
    </article>
  );
}
