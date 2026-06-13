/**
 * EnhancedResearchDesk_Production.tsx
 * 
 * PRODUCTION-WIRED UI for Creative Engine
 * Handles async API calls with loading states, error handling, result display
 * 
 * Integrates:
 * - Seed Lab (raw idea → story proposal)
 * - Literary Excellence Engine (6-dimension prose scoring)
 * - Character Psyche Engine (psychology-fed depth)
 * - Multi-Format Designer (novel/manual/course/subject bible/non-fiction)
 * - Non-Fiction Architect (research weaving)
 * - Research Integration Hub (link research to narrative)
 */

import React, { useState, useRef } from 'react';
import type { Character, ResearchEntry, Project } from '../types';
import {
  creativeEngineServices,
  type SeedLabInput,
  type LiteraryAnalysisInput,
  type CharacterInput,
  type MultiFormatInput,
  type NonFictionInput,
  type ResearchContextInput,
  type OutputFormat,
} from '../services/CreativeEngineCore';

interface EnhancedResearchDeskProps {
  project?: Project;
  characters?: Character[];
  research?: ResearchEntry[];
}

interface TabState {
  activeTab: 'seed' | 'excellence' | 'psyche' | 'format' | 'nonfiction' | 'research';
  isLoading: boolean;
  error: string | null;
  result: any;
}

export const EnhancedResearchDesk: React.FC<EnhancedResearchDeskProps> = ({
  project,
  characters = [],
  research = [],
}) => {
  const [state, setState] = useState<TabState>({
    activeTab: 'seed',
    isLoading: false,
    error: null,
    result: null,
  });

  // Form inputs
  const [seedInput, setSeedInput] = useState<SeedLabInput>({
    idea: '',
    genre: '',
    targetAudience: '',
  });

  const [excellenceInput, setExcellenceInput] = useState<LiteraryAnalysisInput>({
    excerpt: '',
    genre: '',
  });

  const [psycheInput, setPsycheInput] = useState<CharacterInput>({
    name: '',
    role: '',
    backgroundSummary: '',
    currentChallenge: '',
  });

  const [formatInput, setFormatInput] = useState<MultiFormatInput>({
    manuscriptExcerpt: '',
    format: 'literary-novel',
    targetAudience: '',
  });

  const [nonfictionInput, setNonfictionInput] = useState<NonFictionInput>({
    topic: '',
    manuscriptExcerpt: '',
    researchNotes: [],
    authorVoice: '',
  });

  const [researchQuery, setResearchQuery] = useState('');

  // Handlers
  const handleSeedLab = async () => {
    if (!seedInput.idea.trim()) {
      setState((s) => ({ ...s, error: 'Please enter an idea.' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const result = await creativeEngineServices.seedToStory(seedInput);
      setState((s) => ({ ...s, isLoading: false, result, error: null }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err.message || 'Seed Lab failed. Check API connection.',
      }));
    }
  };

  const handleLiteraryExcellence = async () => {
    if (!excellenceInput.excerpt.trim()) {
      setState((s) => ({ ...s, error: 'Please paste an excerpt.' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const result = await creativeEngineServices.analyzeLiteraryExcellence(excellenceInput);
      setState((s) => ({ ...s, isLoading: false, result, error: null }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err.message || 'Literary Excellence analysis failed.',
      }));
    }
  };

  const handleCharacterPsyche = async () => {
    if (!psycheInput.name.trim()) {
      setState((s) => ({ ...s, error: 'Please enter a character name.' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const result = await creativeEngineServices.analyzeCharacterPsyche(psycheInput);
      setState((s) => ({ ...s, isLoading: false, result, error: null }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err.message || 'Character Psyche analysis failed.',
      }));
    }
  };

  const handleMultiFormat = async () => {
    if (!formatInput.manuscriptExcerpt.trim()) {
      setState((s) => ({ ...s, error: 'Please paste a manuscript excerpt.' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const result = await creativeEngineServices.designMultiFormat(formatInput);
      setState((s) => ({ ...s, isLoading: false, result, error: null }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err.message || 'Multi-Format Designer failed.',
      }));
    }
  };

  const handleNonfiction = async () => {
    if (!nonfictionInput.topic.trim()) {
      setState((s) => ({ ...s, error: 'Please enter a topic.' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const result = await creativeEngineServices.architectNonFiction(nonfictionInput);
      setState((s) => ({ ...s, isLoading: false, result, error: null }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err.message || 'Non-Fiction Architect failed.',
      }));
    }
  };

  const handleResearchIntegration = async () => {
    if (!researchQuery.trim()) {
      setState((s) => ({ ...s, error: 'Please describe what you want research to inform.' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const result = await creativeEngineServices.integrateResearch({
        topic: researchQuery,
        researchEntries: research,
        characters,
        useCase: 'character-enrichment',
      });
      setState((s) => ({ ...s, isLoading: false, result, error: null }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err.message || 'Research Integration failed.',
      }));
    }
  };

  const clearResult = () => setState((s) => ({ ...s, result: null, error: null }));

  // ============================================================================
  // RENDER TABS
  // ============================================================================

  return (
    <div className="creative-studio-container" style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎬 Creative Studio</h1>
        <p style={styles.subtitle}>
          Prize-worthy literary fiction, humanized characters, multi-format publishing
        </p>
      </div>

      {/* TAB NAVIGATION */}
      <div style={styles.tabNav}>
        {(
          [
            { id: 'seed', label: '🌱 Seed Lab', icon: '🌱' },
            { id: 'excellence', label: '🏆 Literary Excellence', icon: '🏆' },
            { id: 'psyche', label: '🧠 Character Psyche', icon: '🧠' },
            { id: 'format', label: '📚 Multi-Format', icon: '📚' },
            { id: 'nonfiction', label: '🔬 Non-Fiction', icon: '🔬' },
            { id: 'research', label: '🔗 Research Hub', icon: '🔗' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setState((s) => ({ ...s, activeTab: tab.id, result: null, error: null }));
            }}
            style={{
              ...styles.tabButton,
              ...(state.activeTab === tab.id ? styles.tabButtonActive : {}),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ERROR DISPLAY */}
      {state.error && (
        <div style={styles.errorBox}>
          <strong>⚠️ Error:</strong> {state.error}
        </div>
      )}

      {/* TAB CONTENT */}
      <div style={styles.tabContent}>
        {/* SEED LAB */}
        {state.activeTab === 'seed' && (
          <div>
            <h2 style={styles.tabTitle}>🌱 Seed Lab: Raw Idea → Story Proposal</h2>
            <p style={styles.tabDescription}>
              Transform a single idea into a complete story proposal with characters, structure, and
              prize positioning.
            </p>

            <div style={styles.form}>
              <label style={styles.label}>
                <strong>Core Idea *</strong>
                <p style={styles.hint}>A single sentence or premise (e.g., "A woman finds her twin
                in an alternate timeline")</p>
              </label>
              <textarea
                value={seedInput.idea}
                onChange={(e) => setSeedInput((s) => ({ ...s, idea: e.target.value }))}
                placeholder="Enter your raw idea..."
                style={styles.textarea}
              />

              <label style={styles.label}>
                <strong>Genre (Optional)</strong>
              </label>
              <input
                type="text"
                value={seedInput.genre || ''}
                onChange={(e) => setSeedInput((s) => ({ ...s, genre: e.target.value }))}
                placeholder="e.g., Literary Fiction, Science Fiction, Historical..."
                style={styles.input}
              />

              <label style={styles.label}>
                <strong>Target Audience (Optional)</strong>
              </label>
              <input
                type="text"
                value={seedInput.targetAudience || ''}
                onChange={(e) => setSeedInput((s) => ({ ...s, targetAudience: e.target.value }))}
                placeholder="e.g., Adult readers seeking literary depth..."
                style={styles.input}
              />

              <button
                onClick={handleSeedLab}
                disabled={state.isLoading}
                style={{
                  ...styles.button,
                  ...(state.isLoading ? styles.buttonDisabled : {}),
                }}
              >
                {state.isLoading ? '✨ Generating proposal...' : '✨ Generate Story Proposal'}
              </button>
            </div>

            {state.result && state.activeTab === 'seed' && (
              <ResultDisplay result={state.result} onClear={clearResult} />
            )}
          </div>
        )}

        {/* LITERARY EXCELLENCE */}
        {state.activeTab === 'excellence' && (
          <div>
            <h2 style={styles.tabTitle}>🏆 Literary Excellence Engine</h2>
            <p style={styles.tabDescription}>
              Score your prose on 6 dimensions: prose quality, narrative arc, character depth,
              emotional resonance, originality, and overall prize-calibre tier.
            </p>

            <div style={styles.form}>
              <label style={styles.label}>
                <strong>Manuscript Excerpt *</strong>
                <p style={styles.hint}>Paste 300-800 words of your best prose</p>
              </label>
              <textarea
                value={excellenceInput.excerpt}
                onChange={(e) => setExcellenceInput((s) => ({ ...s, excerpt: e.target.value }))}
                placeholder="Paste your manuscript excerpt..."
                style={{ ...styles.textarea, minHeight: '300px' }}
              />

              <label style={styles.label}>
                <strong>Genre (Optional)</strong>
              </label>
              <input
                type="text"
                value={excellenceInput.genre || ''}
                onChange={(e) => setExcellenceInput((s) => ({ ...s, genre: e.target.value }))}
                placeholder="e.g., Literary Fiction, Science Fiction..."
                style={styles.input}
              />

              <button
                onClick={handleLiteraryExcellence}
                disabled={state.isLoading}
                style={{
                  ...styles.button,
                  ...(state.isLoading ? styles.buttonDisabled : {}),
                }}
              >
                {state.isLoading ? '🏆 Analyzing prose...' : '🏆 Analyze Literary Excellence'}
              </button>
            </div>

            {state.result && state.activeTab === 'excellence' && (
              <ResultDisplay result={state.result} onClear={clearResult} />
            )}
          </div>
        )}

        {/* CHARACTER PSYCHE */}
        {state.activeTab === 'psyche' && (
          <div>
            <h2 style={styles.tabTitle}>🧠 Character Psyche Engine</h2>
            <p style={styles.tabDescription}>
              Build psychological depth grounded in attachment theory, trauma, and resilience
              science.
            </p>

            <div style={styles.form}>
              <label style={styles.label}>
                <strong>Character Name *</strong>
              </label>
              <input
                type="text"
                value={psycheInput.name}
                onChange={(e) => setPsycheInput((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g., Eleanor Voss"
                style={styles.input}
              />

              <label style={styles.label}>
                <strong>Role / Position *</strong>
              </label>
              <input
                type="text"
                value={psycheInput.role}
                onChange={(e) => setPsycheInput((s) => ({ ...s, role: e.target.value }))}
                placeholder="e.g., Protagonist, Mentor, Antagonist..."
                style={styles.input}
              />

              <label style={styles.label}>
                <strong>Background Summary (Optional)</strong>
              </label>
              <textarea
                value={psycheInput.backgroundSummary || ''}
                onChange={(e) =>
                  setPsycheInput((s) => ({ ...s, backgroundSummary: e.target.value }))
                }
                placeholder="Family history, upbringing, formative events..."
                style={styles.textarea}
              />

              <label style={styles.label}>
                <strong>Current Challenge (Optional)</strong>
              </label>
              <textarea
                value={psycheInput.currentChallenge || ''}
                onChange={(e) =>
                  setPsycheInput((s) => ({ ...s, currentChallenge: e.target.value }))
                }
                placeholder="What are they facing right now in the story?"
                style={styles.textarea}
              />

              <button
                onClick={handleCharacterPsyche}
                disabled={state.isLoading}
                style={{
                  ...styles.button,
                  ...(state.isLoading ? styles.buttonDisabled : {}),
                }}
              >
                {state.isLoading ? '🧠 Analyzing psyche...' : '🧠 Analyze Character Psyche'}
              </button>
            </div>

            {state.result && state.activeTab === 'psyche' && (
              <ResultDisplay result={state.result} onClear={clearResult} />
            )}
          </div>
        )}

        {/* MULTI-FORMAT DESIGNER */}
        {state.activeTab === 'format' && (
          <div>
            <h2 style={styles.tabTitle}>📚 Multi-Format Designer</h2>
            <p style={styles.tabDescription}>
              Transform a manuscript into professional output: novel, manual, training course,
              subject bible, or non-fiction.
            </p>

            <div style={styles.form}>
              <label style={styles.label}>
                <strong>Output Format *</strong>
              </label>
              <select
                value={formatInput.format}
                onChange={(e) =>
                  setFormatInput((s) => ({ ...s, format: e.target.value as OutputFormat }))
                }
                style={styles.input}
              >
                <option value="literary-novel">📖 Literary Novel</option>
                <option value="illustrated-manual">🎨 Illustrated Manual</option>
                <option value="training-course">🎓 Training Course</option>
                <option value="subject-bible">📋 Subject Bible</option>
                <option value="non-fiction">🔬 Non-Fiction</option>
              </select>

              <label style={styles.label}>
                <strong>Manuscript Excerpt *</strong>
              </label>
              <textarea
                value={formatInput.manuscriptExcerpt}
                onChange={(e) => setFormatInput((s) => ({ ...s, manuscriptExcerpt: e.target.value }))}
                placeholder="Paste the content you want to transform..."
                style={styles.textarea}
              />

              <label style={styles.label}>
                <strong>Target Audience (Optional)</strong>
              </label>
              <input
                type="text"
                value={formatInput.targetAudience || ''}
                onChange={(e) => setFormatInput((s) => ({ ...s, targetAudience: e.target.value }))}
                placeholder="e.g., Product designers, software engineers, business leaders..."
                style={styles.input}
              />

              <button
                onClick={handleMultiFormat}
                disabled={state.isLoading}
                style={{
                  ...styles.button,
                  ...(state.isLoading ? styles.buttonDisabled : {}),
                }}
              >
                {state.isLoading ? '📚 Designing format...' : '📚 Design Format Structure'}
              </button>
            </div>

            {state.result && state.activeTab === 'format' && (
              <ResultDisplay result={state.result} onClear={clearResult} />
            )}
          </div>
        )}

        {/* NON-FICTION ARCHITECT */}
        {state.activeTab === 'nonfiction' && (
          <div>
            <h2 style={styles.tabTitle}>🔬 Non-Fiction Architect</h2>
            <p style={styles.tabDescription}>
              Weave research into compelling narrative with proper citation architecture and
              authority building.
            </p>

            <div style={styles.form}>
              <label style={styles.label}>
                <strong>Topic *</strong>
              </label>
              <input
                type="text"
                value={nonfictionInput.topic}
                onChange={(e) => setNonfictionInput((s) => ({ ...s, topic: e.target.value }))}
                placeholder="e.g., The neuroscience of creativity, Victorian social reform..."
                style={styles.input}
              />

              <label style={styles.label}>
                <strong>Manuscript Excerpt (Optional)</strong>
              </label>
              <textarea
                value={nonfictionInput.manuscriptExcerpt || ''}
                onChange={(e) =>
                  setNonfictionInput((s) => ({ ...s, manuscriptExcerpt: e.target.value }))
                }
                placeholder="Any draft material to review..."
                style={styles.textarea}
              />

              <label style={styles.label}>
                <strong>Author Voice (Optional)</strong>
              </label>
              <input
                type="text"
                value={nonfictionInput.authorVoice || ''}
                onChange={(e) => setNonfictionInput((s) => ({ ...s, authorVoice: e.target.value }))}
                placeholder="e.g., Conversational and witty, deeply academic, accessible to general readers..."
                style={styles.input}
              />

              <button
                onClick={handleNonfiction}
                disabled={state.isLoading}
                style={{
                  ...styles.button,
                  ...(state.isLoading ? styles.buttonDisabled : {}),
                }}
              >
                {state.isLoading ? '🔬 Architecting...' : '🔬 Architect Non-Fiction'}
              </button>
            </div>

            {state.result && state.activeTab === 'nonfiction' && (
              <ResultDisplay result={state.result} onClear={clearResult} />
            )}
          </div>
        )}

        {/* RESEARCH INTEGRATION HUB */}
        {state.activeTab === 'research' && (
          <div>
            <h2 style={styles.tabTitle}>🔗 Research Integration Hub</h2>
            <p style={styles.tabDescription}>
              Connect your research to characters, plot, and themes. Linked sources: {research.length}
            </p>

            <div style={styles.form}>
              <label style={styles.label}>
                <strong>What should research inform? *</strong>
              </label>
              <textarea
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                placeholder="e.g., Character Eleanor's trauma response, the plot's historical accuracy, the theme of resilience..."
                style={styles.textarea}
              />

              <button
                onClick={handleResearchIntegration}
                disabled={state.isLoading || research.length === 0}
                style={{
                  ...styles.button,
                  ...(state.isLoading || research.length === 0 ? styles.buttonDisabled : {}),
                }}
              >
                {state.isLoading
                  ? '🔗 Integrating...'
                  : research.length === 0
                    ? '🔗 Add Research First'
                    : '🔗 Integrate Research'}
              </button>

              {research.length === 0 && (
                <p style={styles.hint}>
                  💡 Start by adding research sources in the Research Desk. They'll appear here
                  ready to integrate.
                </p>
              )}
            </div>

            {state.result && state.activeTab === 'research' && (
              <ResultDisplay result={state.result} onClear={clearResult} />
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={styles.footer}>
        <p>
          💡 <strong>Tip:</strong> Results are fully editable. Use engine output as a starting
          point, not a finished product.
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// RESULT DISPLAY COMPONENT
// ============================================================================

interface ResultDisplayProps {
  result: any;
  onClear: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, onClear }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const text = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.resultBox}>
      <div style={styles.resultHeader}>
        <h3 style={styles.resultTitle}>✨ Engine Result</h3>
        <div style={styles.resultActions}>
          <button
            onClick={copyToClipboard}
            style={{
              ...styles.smallButton,
              backgroundColor: copied ? '#4CAF50' : '#2196F3',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button onClick={onClear} style={styles.smallButton}>
            New Analysis
          </button>
        </div>
      </div>
      <pre style={styles.resultContent}>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    marginBottom: '40px',
  } as React.CSSProperties,

  header: {
    marginBottom: '30px',
    borderBottom: '2px solid #e0e0e0',
    paddingBottom: '20px',
  } as React.CSSProperties,

  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    margin: '0 0 8px 0',
    color: '#1a1a1a',
  } as React.CSSProperties,

  subtitle: {
    fontSize: '16px',
    color: '#666',
    margin: '0',
  } as React.CSSProperties,

  tabNav: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  } as React.CSSProperties,

  tabButton: {
    padding: '10px 16px',
    border: '1px solid #ddd',
    backgroundColor: '#fff',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
    color: '#666',
  } as React.CSSProperties,

  tabButtonActive: {
    backgroundColor: '#2196F3',
    color: '#fff',
    borderColor: '#1976D2',
  } as React.CSSProperties,

  tabContent: {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '8px',
    marginBottom: '20px',
  } as React.CSSProperties,

  tabTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '0 0 12px 0',
  } as React.CSSProperties,

  tabDescription: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
  } as React.CSSProperties,

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  } as React.CSSProperties,

  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '14px',
    fontWeight: '500',
  } as React.CSSProperties,

  hint: {
    fontSize: '12px',
    color: '#999',
    fontWeight: 'normal',
    margin: '0',
  } as React.CSSProperties,

  input: {
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  textarea: {
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'monospace',
    resize: 'vertical',
    minHeight: '120px',
  } as React.CSSProperties,

  button: {
    padding: '12px 20px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,

  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  } as React.CSSProperties,

  smallButton: {
    padding: '6px 12px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  } as React.CSSProperties,

  errorBox: {
    padding: '12px 16px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '14px',
  } as React.CSSProperties,

  resultBox: {
    backgroundColor: '#f5f5f5',
    padding: '20px',
    borderRadius: '6px',
    marginTop: '20px',
    border: '1px solid #e0e0e0',
  } as React.CSSProperties,

  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e0e0e0',
  } as React.CSSProperties,

  resultTitle: {
    fontSize: '16px',
    fontWeight: '600',
    margin: '0',
  } as React.CSSProperties,

  resultActions: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,

  resultContent: {
    backgroundColor: '#fff',
    padding: '12px',
    borderRadius: '4px',
    fontSize: '12px',
    overflow: 'auto',
    maxHeight: '400px',
    margin: '0',
    border: '1px solid #ddd',
  } as React.CSSProperties,

  footer: {
    padding: '20px',
    backgroundColor: '#e3f2fd',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#1976D2',
  } as React.CSSProperties,
};

export default EnhancedResearchDesk;
