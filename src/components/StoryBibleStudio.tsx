/**
 * Story Bible — live canon from Workshop, promises, psychology, research
 */

import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Brain, Hammer, Search, Sparkles } from 'lucide-react';
import type { ProjectBriefLike } from '../services/commissionService';
import { loadStoryCanon, type StoryCanon } from '../services/storyBibleService';

interface Props {
  brief: ProjectBriefLike;
  onOpenWorkshop: () => void;
  onOpenPsychology: () => void;
  onOpenResearch: () => void;
}

export default function StoryBibleStudio({
  brief,
  onOpenWorkshop,
  onOpenPsychology,
  onOpenResearch,
}: Props) {
  const [canon, setCanon] = useState<StoryCanon>(() => loadStoryCanon(brief));

  const refresh = useCallback(() => {
    setCanon(loadStoryCanon(brief));
  }, [brief]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section style={{ minHeight: '100vh', padding: '48px clamp(20px, 5vw, 72px)', background: '#f5efe5' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
          <div>
            <div style={kicker}>Story Bible</div>
            <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1, letterSpacing: -2 }}>
              {brief.title}
            </h1>
            <p style={{ margin: 0, maxWidth: 720, color: '#73695d', fontSize: 17, lineHeight: 1.5 }}>
              Canon pulled from Workshop diagnosis, promise registry, psychology blueprint, and research.
            </p>
          </div>
          <button type="button" onClick={refresh} style={ghostBtn}>
            Refresh canon
          </button>
        </div>

        {!canon.hasWorkshopData ? (
          <article style={card}>
            <BookOpen size={36} style={{ color: '#d6a846', marginBottom: 12 }} />
            <h2 style={sectionTitle}>No canon yet</h2>
            <p style={{ color: '#73695d', lineHeight: 1.6 }}>
              Paste a manuscript in Workshop to extract chapters, promises, and editorial verdict. Add psychology and research to fill this room.
            </p>
            <button type="button" onClick={onOpenWorkshop} style={{ ...primaryBtn, marginTop: 16 }}>
              <Hammer size={18} /> Open Workshop
            </button>
          </article>
        ) : (
          <>
            <div style={statRow}>
              <Stat label="Chapters" value={String(canon.chapters.length)} />
              <Stat label="Words" value={canon.wordCount.toLocaleString()} />
              <Stat label="Promises" value={String(canon.promiseHealth.total)} />
              <Stat label="Research notes" value={String(canon.researchCount)} />
              {canon.diagnosis?.viabilityScore != null && (
                <Stat label="Viability" value={`${canon.diagnosis.viabilityScore}%`} />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginTop: 20 }}>
              <article style={card}>
                <h2 style={sectionTitle}>Premise & tone</h2>
                <p style={{ margin: '0 0 10px', lineHeight: 1.6 }}>{brief.idea}</p>
                <p style={{ margin: 0, fontSize: 14, color: '#73695d' }}>
                  <strong>Tone:</strong> {brief.tone}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#73695d' }}>
                  <strong>Audience:</strong> {brief.audience}
                </p>
              </article>

              {canon.diagnosis && (
                <article style={card}>
                  <h2 style={sectionTitle}>Editorial verdict</h2>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{canon.diagnosis.verdict}</p>
                  {canon.diagnosis.suggestRebuild && (
                    <p style={{ marginTop: 10, color: '#b45309', fontWeight: 700 }}>Caspa flagged a possible full restructure.</p>
                  )}
                </article>
              )}

              {canon.psychology && (
                <article style={card}>
                  <h2 style={sectionTitle}>
                    <Brain size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                    Emotional journey
                  </h2>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{canon.psychology.journeySummary}</p>
                  {canon.psychology.hiddenMeaning && (
                    <p style={{ marginTop: 10, fontSize: 14, color: '#5c5146' }}>
                      <strong>Hidden meaning:</strong> {canon.psychology.hiddenMeaning}
                    </p>
                  )}
                </article>
              )}
            </div>

            {canon.chapters.length > 0 && (
              <article style={{ ...card, marginTop: 18 }}>
                <h2 style={sectionTitle}>Chapter map</h2>
                <div style={{ display: 'grid', gap: 10 }}>
                  {canon.chapters.map((ch) => (
                    <div key={ch.id} style={rowStyle}>
                      <strong>{ch.title}</strong>
                      <span style={{ fontSize: 13, color: '#8a7a66' }}>
                        {(ch.content?.split(/\s+/).filter(Boolean).length || 0).toLocaleString()} words
                      </span>
                      <p style={{ margin: '6px 0 0', fontSize: 14, color: '#73695d', gridColumn: '1 / -1' }}>
                        {ch.summary || 'No summary'}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {canon.promises.length > 0 && (
              <article style={{ ...card, marginTop: 18 }}>
                <h2 style={sectionTitle}>
                  <Sparkles size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
                  Story promises ({canon.promiseHealth.open} open, {canon.promiseHealth.broken} broken)
                </h2>
                <div style={{ display: 'grid', gap: 8 }}>
                  {canon.promises.slice(0, 12).map((p) => (
                    <div key={p.id} style={rowStyle}>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: '#9b6d16', fontWeight: 800 }}>{p.type}</span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 8,
                          background: p.status === 'broken' ? '#fef2f2' : p.status === 'paid_off' ? '#ecfdf5' : '#fff8ea',
                          color: p.status === 'broken' ? '#b91c1c' : p.status === 'paid_off' ? '#047857' : '#92400e',
                        }}
                      >
                        {p.status}
                      </span>
                      <p style={{ margin: '4px 0 0', gridColumn: '1 / -1', lineHeight: 1.5 }}>{p.statement}</p>
                    </div>
                  ))}
                </div>
              </article>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <button type="button" onClick={onOpenWorkshop} style={primaryBtn}>
                <Hammer size={16} /> Workshop
              </button>
              <button type="button" onClick={onOpenPsychology} style={ghostBtn}>
                <Brain size={16} /> Psychology
              </button>
              <button type="button" onClick={onOpenResearch} style={ghostBtn}>
                <Search size={16} /> Research
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '14px 18px', borderRadius: 16, background: '#fff8ea', border: '1px solid #eadfce' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#9b6d16', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{value}</div>
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

const rowStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: '#fffdf8',
  border: '1px solid #eadfce',
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 8,
  alignItems: 'center',
};

const statRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 12,
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
  gap: 6,
  border: '1px solid #d8c9b4',
  borderRadius: 12,
  padding: '10px 14px',
  background: '#fffaf2',
  fontWeight: 700,
  cursor: 'pointer',
  color: '#3d3428',
};
