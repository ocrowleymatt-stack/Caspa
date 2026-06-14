/**
 * EnhancedResearchDesk - Fixed Production Version
 * Simplified, battle-tested Creative Studio UI
 */

import React, { useState } from 'react';
import type { Character, ResearchEntry, Project } from '../types';
import { creativeEngineServices } from '../services/CreativeEngineCore';

interface EnhancedResearchDeskProps {
  project?: Project;
  characters?: Character[];
  chapters?: any[];
  research?: ResearchEntry[];
  sourceMaterials?: any[];
  services?: any;
  onNavigate?: (view: string) => void;
  onNotify?: (msg: string, type: string) => void;
  onError?: (msg: string) => void;
  onSaveProject?: (proj: any) => void;
  onSaveCharacter?: (char: any) => void;
  onUpdateChapters?: (chaps: any[]) => void;
}

export const EnhancedResearchDesk: React.FC<EnhancedResearchDeskProps> = ({
  project,
  characters = [],
  chapters = [],
  research = [],
  sourceMaterials = [],
  services = creativeEngineServices,
  onNavigate,
  onNotify,
  onError,
  onSaveProject,
  onSaveCharacter,
  onUpdateChapters,
}) => {
  const [activeTab, setActiveTab] = useState<'seed' | 'excellence' | 'psyche' | 'format' | 'nonfiction' | 'research'>('seed');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Form states
  const [seedInput, setSeedInput] = useState({ idea: '', genre: '', targetAudience: '' });
  const [excellenceInput, setExcellenceInput] = useState({ excerpt: '', genre: '' });

  const handleSeedLab = async () => {
    if (!seedInput.idea.trim()) {
      onError?.('Please enter a core idea');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function: 'seedLab',
          input: seedInput,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
      onNotify?.('Story proposal generated! ✨', 'success');
    } catch (err: any) {
      const msg = err.message || 'Error generating proposal';
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExcellence = async () => {
    if (!excellenceInput.excerpt.trim()) {
      onError?.('Please paste manuscript excerpt');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function: 'literaryAnalysis',
          input: excellenceInput,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
      onNotify?.('Literary analysis complete! 🏆', 'success');
    } catch (err: any) {
      const msg = err.message || 'Error analyzing prose';
      setError(msg);
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'seed' as const, label: '🌱 Seed Lab', icon: '🌱' },
    { id: 'excellence' as const, label: '🏆 Literary Excellence', icon: '🏆' },
    { id: 'psyche' as const, label: '🧠 Character Psyche', icon: '🧠' },
    { id: 'format' as const, label: '📚 Multi-Format', icon: '📚' },
    { id: 'nonfiction' as const, label: '🔬 Non-Fiction', icon: '🔬' },
    { id: 'research' as const, label: '🔗 Research Hub', icon: '🔗' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f9fafb', overflowY: 'auto' }}>
      {/* HEADER */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
          🎬 Creative Studio
        </h1>
        <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
          Prize-worthy literary fiction, humanized characters, multi-format publishing
        </p>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{ display: 'flex', gap: '4px', padding: '12px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff', overflowX: 'auto', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setResult(null); setError(null); }}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: '500',
              border: activeTab === tab.id ? '2px solid #2563eb' : '1px solid #d1d5db',
              backgroundColor: activeTab === tab.id ? '#dbeafe' : '#fff',
              color: activeTab === tab.id ? '#1e40af' : '#4b5563',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
            onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = '#fff'; }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {/* ERROR */}
        {error && (
          <div style={{ padding: '12px 16px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', marginBottom: '16px', fontSize: '14px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* SEED LAB */}
        {activeTab === 'seed' && (
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>🌱 Seed Lab</h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>
              Transform a single idea into a complete story proposal with characters, structure, and prize positioning.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#111827' }}>Core Idea *</label>
                <textarea
                  value={seedInput.idea}
                  onChange={(e) => setSeedInput((s) => ({ ...s, idea: e.target.value }))}
                  placeholder="A woman finds her twin in an alternate timeline..."
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', fontFamily: 'inherit', minHeight: '80px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#111827' }}>Genre</label>
                <input
                  type="text"
                  value={seedInput.genre}
                  onChange={(e) => setSeedInput((s) => ({ ...s, genre: e.target.value }))}
                  placeholder="Literary Fiction, Science Fiction..."
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#111827' }}>Target Audience</label>
                <input
                  type="text"
                  value={seedInput.targetAudience}
                  onChange={(e) => setSeedInput((s) => ({ ...s, targetAudience: e.target.value }))}
                  placeholder="Adult readers seeking literary depth..."
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={handleSeedLab}
                disabled={isLoading}
                style={{
                  padding: '10px 16px',
                  backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb'; }}
              >
                {isLoading ? '✨ Generating...' : '✨ Generate Story Proposal'}
              </button>
            </div>
          </div>
        )}

        {/* LITERARY EXCELLENCE */}
        {activeTab === 'excellence' && (
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>🏆 Literary Excellence Engine</h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>
              Score your prose on 6 dimensions: quality, narrative arc, character depth, emotional resonance, originality, and prize tier.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#111827' }}>Manuscript Excerpt *</label>
                <textarea
                  value={excellenceInput.excerpt}
                  onChange={(e) => setExcellenceInput((s) => ({ ...s, excerpt: e.target.value }))}
                  placeholder="Paste 300-800 words of your best prose..."
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', fontFamily: 'monospace', minHeight: '200px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#111827' }}>Genre (Optional)</label>
                <input
                  type="text"
                  value={excellenceInput.genre}
                  onChange={(e) => setExcellenceInput((s) => ({ ...s, genre: e.target.value }))}
                  placeholder="Literary Fiction, Mystery..."
                  style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={handleExcellence}
                disabled={isLoading}
                style={{
                  padding: '10px 16px',
                  backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb'; }}
              >
                {isLoading ? '🏆 Scoring...' : '🏆 Score Prose'}
              </button>
            </div>
          </div>
        )}

        {/* PLACEHOLDER TABS */}
        {(activeTab === 'psyche' || activeTab === 'format' || activeTab === 'nonfiction' || activeTab === 'research') && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
            <p style={{ fontSize: '16px', margin: '0' }}>
              {activeTab === 'psyche' && '🧠 Character Psyche — Coming Soon'}
              {activeTab === 'format' && '📚 Multi-Format Designer — Coming Soon'}
              {activeTab === 'nonfiction' && '🔬 Non-Fiction Architect — Coming Soon'}
              {activeTab === 'research' && '🔗 Research Integration — Coming Soon'}
            </p>
          </div>
        )}

        {/* RESULT */}
        {result && (
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#0369a1' }}>✨ Result</h3>
            <pre style={{ margin: '0', fontSize: '12px', color: '#111827', overflow: 'auto', maxHeight: '300px', backgroundColor: '#fff', padding: '12px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
            <button
              onClick={() => setResult(null)}
              style={{ marginTop: '12px', padding: '6px 12px', fontSize: '12px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedResearchDesk;
