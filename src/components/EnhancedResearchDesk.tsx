/**
 * Creative Studio — Nexus Strategist Design System
 * Follows O'Crowley Systems brand guidelines
 */

import React, { useState } from 'react';
import './EnhancedResearchDesk.module.css';

interface TabContent {
  seedLab: { idea: string; genre: string; audience: string };
  literaryExcellence: { manuscript: string };
}

interface ApiResponse {
  type: string;
  data?: unknown;
  error?: string;
}

const EnhancedResearchDesk: React.FC = () => {
  const [activeTab, setActiveTab] = useState('seed-lab');
  const [forms, setForms] = useState<TabContent>({
    seedLab: { idea: '', genre: '', audience: '' },
    literaryExcellence: { manuscript: '' },
  });
  const [results, setResults] = useState<Record<string, ApiResponse | null>>({});
  const [loading, setLoading] = useState(false);

  const handleFormChange = (
    tab: keyof TabContent,
    field: string,
    value: string
  ) => {
    setForms(prev => ({
      ...prev,
      [tab]: { ...prev[tab], [field]: value },
    }));
  };

  const callApi = async (endpoint: string, payload: object) => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, ...payload }),
      });
      const data = await response.json();
      setResults(prev => ({
        ...prev,
        [endpoint]: data,
      }));
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [endpoint]: { type: 'error', error: String(err) },
      }));
    }
    setLoading(false);
  };

  const handleSeedLabSubmit = () => {
    callApi('generate_story_proposal', {
      idea: forms.seedLab.idea,
      genre: forms.seedLab.genre,
      targetAudience: forms.seedLab.audience,
    });
  };

  const handleLiteraryExcellenceSubmit = () => {
    callApi('evaluate_prose', {
      manuscript: forms.literaryExcellence.manuscript,
    });
  };

  const renderResult = (key: string) => {
    const result = results[key];
    if (!result) return null;

    if (result.error) {
      return (
        <div className="nexus-alert nexus-alert-error">
          <span className="nexus-alert-icon">⚠</span>
          <span>{result.error}</span>
        </div>
      );
    }

    return (
      <div className="nexus-result">
        <div className="nexus-result-header">
          <span className="nexus-result-title">Analysis Complete</span>
          <button
            className="nexus-btn-copy"
            onClick={() =>
              navigator.clipboard.writeText(JSON.stringify(result, null, 2))
            }
          >
            Copy
          </button>
        </div>
        <pre className="nexus-result-content">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="nexus-creative-studio">
      {/* Header */}
      <div className="nexus-header">
        <div className="nexus-crest">◎</div>
        <div className="nexus-header-text">
          <h1 className="nexus-title">CREATIVE STUDIO</h1>
          <p className="nexus-subtitle">
            Autonomous Knowledge Transformation Engine
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="nexus-tabs">
        {[
          { id: 'seed-lab', label: 'Seed Lab' },
          { id: 'literary-excellence', label: 'Literary Excellence' },
          { id: 'character-psyche', label: 'Character Psyche' },
          { id: 'multi-format', label: 'Multi-Format' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`nexus-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="nexus-content">
        {activeTab === 'seed-lab' && (
          <div className="nexus-panel">
            <div className="nexus-section">
              <label className="nexus-label">Story Idea</label>
              <textarea
                className="nexus-textarea"
                placeholder="Describe your story concept, theme, or premise..."
                value={forms.seedLab.idea}
                onChange={e =>
                  handleFormChange('seedLab', 'idea', e.target.value)
                }
              />
            </div>

            <div className="nexus-row">
              <div className="nexus-section">
                <label className="nexus-label">Genre</label>
                <input
                  type="text"
                  className="nexus-input"
                  placeholder="e.g., Literary Fiction, Science Fiction"
                  value={forms.seedLab.genre}
                  onChange={e =>
                    handleFormChange('seedLab', 'genre', e.target.value)
                  }
                />
              </div>

              <div className="nexus-section">
                <label className="nexus-label">Target Audience</label>
                <input
                  type="text"
                  className="nexus-input"
                  placeholder="e.g., 18-35, Academic, General"
                  value={forms.seedLab.audience}
                  onChange={e =>
                    handleFormChange('seedLab', 'audience', e.target.value)
                  }
                />
              </div>
            </div>

            <button
              className="nexus-btn-primary"
              onClick={handleSeedLabSubmit}
              disabled={loading}
            >
              {loading ? '○' : '→'} Generate Proposal
            </button>

            {renderResult('generate_story_proposal')}
          </div>
        )}

        {activeTab === 'literary-excellence' && (
          <div className="nexus-panel">
            <div className="nexus-section">
              <label className="nexus-label">Manuscript Excerpt</label>
              <textarea
                className="nexus-textarea"
                placeholder="Paste a passage from your manuscript for literary analysis..."
                value={forms.literaryExcellence.manuscript}
                onChange={e =>
                  handleFormChange('literaryExcellence', 'manuscript', e.target.value)
                }
                rows={8}
              />
            </div>

            <button
              className="nexus-btn-primary"
              onClick={handleLiteraryExcellenceSubmit}
              disabled={loading}
            >
              {loading ? '○' : '→'} Evaluate Prose
            </button>

            {renderResult('evaluate_prose')}
          </div>
        )}

        {activeTab === 'character-psyche' && (
          <div className="nexus-panel">
            <div className="nexus-coming-soon">
              <p className="nexus-coming-soon-text">Coming Soon</p>
              <p className="nexus-coming-soon-desc">
                Character psychology validation engine
              </p>
            </div>
          </div>
        )}

        {activeTab === 'multi-format' && (
          <div className="nexus-panel">
            <div className="nexus-coming-soon">
              <p className="nexus-coming-soon-text">Coming Soon</p>
              <p className="nexus-coming-soon-desc">
                Multi-format document transformation
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedResearchDesk;
