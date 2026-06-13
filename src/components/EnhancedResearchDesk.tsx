/**
 * EnhancedResearchDesk.tsx
 * 
 * Comprehensive creative research & ideation interface for Caspa
 * Layers: Deep Research + Seed Ingestion + Literary Excellence + Humanizing + Multi-Format Output
 * 
 * Mobile-optimized, responsive, production-ready
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen, Sparkles, Zap, Users, Layers, FileText, Download,
  Plus, Trash2, Check, Loader2, ChevronDown, ChevronUp,
  Award, Heart, Brain, Palette, TrendingUp, Settings,
  AlertCircle, Eye, EyeOff, Archive, Share2
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Tab {
  id: 'research' | 'seeds' | 'excellence' | 'characters' | 'formats' | 'library';
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface SeedIdea {
  id: string;
  rawInput: string;
  type: 'text' | 'image' | 'voice' | 'url';
  proposal?: any; // SeedProposal
  createdAt: Date;
}

interface CharacterPsyche {
  id: string;
  name: string;
  brief: string;
  psychology?: any; // CharacterPsychology
  loading?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export const EnhancedResearchDesk: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab['id']>('research');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Research
  const [topicSearch, setTopicSearch] = useState('');
  const [researchDepth, setResearchDepth] = useState<'surface' | 'intermediate' | 'deep'>('intermediate');
  const [researchResults, setResearchResults] = useState<any[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);

  // Seeds
  const [seeds, setSeeds] = useState<SeedIdea[]>([]);
  const [seedInput, setSeedInput] = useState('');
  const [seedType, setSeedType] = useState<'text' | 'image' | 'voice' | 'url'>('text');

  // Excellence Scoring
  const [textToScore, setTextToScore] = useState('');
  const [proseMetrics, setProseMetrics] = useState<any>(null);
  const [scoringLoading, setScoringSLoading] = useState(false);

  // Characters
  const [characters, setCharacters] = useState<CharacterPsyche[]>([]);
  const [newCharName, setNewCharName] = useState('');
  const [newCharBrief, setNewCharBrief] = useState('');

  // Mobile handler
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSearchResearch = async () => {
    if (!topicSearch.trim()) return;
    setResearchLoading(true);
    try {
      // Mock API call
      await new Promise(r => setTimeout(r, 1500));
      setResearchResults([
        {
          id: '1',
          title: `Research: ${topicSearch}`,
          source: 'Academic Database',
          depth: researchDepth,
          summary: `Deep research on "${topicSearch}" at ${researchDepth} level...`,
          content: 'Lorem ipsum dolor sit amet...',
          timestamp: new Date()
        }
      ]);
    } finally {
      setResearchLoading(false);
    }
  };

  const handleAddSeed = () => {
    if (!seedInput.trim()) return;
    const newSeed: SeedIdea = {
      id: Math.random().toString(36).slice(2, 10),
      rawInput: seedInput,
      type: seedType,
      createdAt: new Date()
    };
    setSeeds([newSeed, ...seeds]);
    setSeedInput('');
  };

  const handleScoreProse = async () => {
    if (!textToScore.trim()) return;
    setScoringSLoading(true);
    try {
      // Mock API call
      await new Promise(r => setTimeout(r, 2000));
      setProseMetrics({
        clarity: 78,
        originality: 85,
        emotionalResonance: 72,
        narrativeStrength: 80,
        characterDepth: 82,
        proseQuality: 76,
        overallScore: 79,
        prizeWorthinessLevel: 'shortlist',
        strengthAreas: ['Unique voice', 'Emotional depth', 'Character complexity'],
        developmentAreas: ['Pacing in Act 2', 'Dialogue naturalism'],
        recommendations: [
          'Cut 10% of exposition in chapter 5',
          'Strengthen the antagonist\'s motivation',
          'Add sensory details in the final act'
        ]
      });
    } finally {
      setScoringSLoading(false);
    }
  };

  const handleAddCharacter = () => {
    if (!newCharName.trim()) return;
    const newChar: CharacterPsyche = {
      id: Math.random().toString(36).slice(2, 10),
      name: newCharName,
      brief: newCharBrief,
      loading: false
    };
    setCharacters([newChar, ...characters]);
    setNewCharName('');
    setNewCharBrief('');
  };

  const handleHumanizeCharacter = async (id: string) => {
    setCharacters(chars =>
      chars.map(c =>
        c.id === id ? { ...c, loading: true } : c
      )
    );
    try {
      // Mock API call
      await new Promise(r => setTimeout(r, 2000));
      setCharacters(chars =>
        chars.map(c =>
          c.id === id
            ? {
              ...c,
              loading: false,
              psychology: {
                primaryWound: 'Fear of abandonment',
                defenseMechanism: 'Emotional distance',
                desireVsNeed: {
                  surfaceDesire: 'To be alone',
                  deepNeed: 'To be loved unconditionally'
                },
                psychologicalMotivations: [
                  'Attachment insecurity',
                  'Control needs',
                  'Self-protection'
                ],
                actionableInsights: [
                  'Write them contradicting their own desires',
                  'Show physical reactions to emotional triggers',
                  'Reveal vulnerability only in private moments'
                ]
              }
            }
            : c
        )
      );
    } finally {
      setCharacters(chars =>
        chars.map(c => c.id === id ? { ...c, loading: false } : c)
      );
    }
  };

  // ── Tabs ────────────────────────────────────────────────────────────────

  const tabs: Tab[] = [
    {
      id: 'research',
      label: 'Deep Research',
      icon: <BookOpen className="w-4 h-4" />,
      description: 'Research topics across 6+ dimensions'
    },
    {
      id: 'seeds',
      label: 'Seed Ideas',
      icon: <Sparkles className="w-4 h-4" />,
      description: 'Transform raw ideas into story proposals'
    },
    {
      id: 'excellence',
      label: 'Literary Excellence',
      icon: <Award className="w-4 h-4" />,
      description: 'Score prose quality & prize-worthiness'
    },
    {
      id: 'characters',
      label: 'Characters',
      icon: <Brain className="w-4 h-4" />,
      description: 'Humanize characters with psychology'
    },
    {
      id: 'formats',
      label: 'Output Formats',
      icon: <Palette className="w-4 h-4" />,
      description: 'Design novels, manuals, training materials'
    },
    {
      id: 'library',
      label: 'Reference Library',
      icon: <Archive className="w-4 h-4" />,
      description: 'Save & organize all findings'
    }
  ];

  return (
    <div className="enhanced-research-desk flex flex-col h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-slate-700 bg-slate-900/95 backdrop-blur px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-teal-500/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-teal-400" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">Enhanced Research Desk</h1>
              <p className="text-xs text-slate-400">Research • Ideation • Excellence • Humanizing</p>
            </div>
            <h1 className="sm:hidden text-base font-bold text-white">Research Desk</h1>
          </div>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-slate-200">
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-slate-200">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation - Horizontal Scroll on Mobile */}
        <div className="mt-4 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto sm:overflow-x-visible">
          <div className="flex gap-2 sm:gap-1 pb-2 sm:pb-0 min-w-min sm:min-w-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium
                  transition duration-200
                  ${activeTab === tab.id
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
                    : 'bg-slate-700/40 text-slate-400 hover:text-slate-300 border border-slate-600/30'
                  }
                `}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">

          {/* RESEARCH TAB */}
          {activeTab === 'research' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-teal-400" />
                  Deep Research Desk
                </h2>

                <div className="space-y-4">
                  {/* Topic Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Research Topic
                    </label>
                    <input
                      type="text"
                      value={topicSearch}
                      onChange={e => setTopicSearch(e.target.value)}
                      placeholder="e.g., 'The psychology of shame' or 'Victorian shipping routes'"
                      className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 focus:bg-slate-700"
                    />
                  </div>

                  {/* Depth Selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Research Depth
                    </label>
                    <div className="flex gap-2">
                      {(['surface', 'intermediate', 'deep'] as const).map(depth => (
                        <button
                          key={depth}
                          onClick={() => setResearchDepth(depth)}
                          className={`
                            flex-1 px-3 py-2 rounded-lg text-sm font-medium transition
                            ${researchDepth === depth
                              ? 'bg-teal-500/30 text-teal-300 border border-teal-500/50'
                              : 'bg-slate-700/30 text-slate-400 border border-slate-600/30'
                            }
                          `}
                        >
                          {depth.charAt(0).toUpperCase() + depth.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Button */}
                  <button
                    onClick={handleSearchResearch}
                    disabled={researchLoading || !topicSearch.trim()}
                    className="w-full px-4 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition flex items-center justify-center gap-2"
                  >
                    {researchLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Researching...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Search Research
                      </>
                    )}
                  </button>
                </div>

                {/* Results */}
                {researchResults.length > 0 && (
                  <div className="mt-6 space-y-3 border-t border-slate-700 pt-6">
                    {researchResults.map(result => (
                      <div key={result.id} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
                        <h3 className="font-semibold text-white text-sm sm:text-base">{result.title}</h3>
                        <p className="text-xs text-slate-400 mt-1">{result.source} • {result.depth} depth</p>
                        <p className="text-sm text-slate-300 mt-2">{result.summary}</p>
                        <button className="mt-3 text-xs text-teal-400 hover:text-teal-300 font-medium">
                          → Add to Library
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEEDS TAB */}
          {activeTab === 'seeds' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  Seed Ingestion
                </h2>

                <div className="space-y-4">
                  {/* Input Type */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Input Type
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {(['text', 'image', 'voice', 'url'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => setSeedType(type)}
                          className={`
                            px-3 py-2 rounded-lg text-sm font-medium transition
                            ${seedType === type
                              ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                              : 'bg-slate-700/30 text-slate-400 border border-slate-600/30'
                            }
                          `}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Seed Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Your Idea (Raw Input)
                    </label>
                    <textarea
                      value={seedInput}
                      onChange={e => setSeedInput(e.target.value)}
                      placeholder="Paste text, describe an image, summarize a voice memo, or enter a URL..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500/50 resize-none"
                    />
                  </div>

                  {/* Add Seed Button */}
                  <button
                    onClick={handleAddSeed}
                    disabled={!seedInput.trim()}
                    className="w-full px-4 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Transform into Story Proposal
                  </button>
                </div>

                {/* Seed List */}
                {seeds.length > 0 && (
                  <div className="mt-6 space-y-3 border-t border-slate-700 pt-6">
                    {seeds.map(seed => (
                      <div key={seed.id} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-400 mb-1 font-mono">{seed.type.toUpperCase()}</p>
                            <p className="text-sm text-slate-300 break-words">{seed.rawInput.slice(0, 150)}...</p>
                          </div>
                          <button className="text-red-400 hover:text-red-300 flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {seed.proposal && (
                          <div className="mt-3 pt-3 border-t border-slate-600/30">
                            <p className="text-sm font-semibold text-teal-300">{seed.proposal.title}</p>
                            <p className="text-xs text-slate-400 mt-1">{seed.proposal.genre} • {seed.proposal.contentType}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* EXCELLENCE TAB */}
          {activeTab === 'excellence' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-400" />
                  Literary Excellence Scoring
                </h2>

                <div className="space-y-4">
                  {/* Text to Score */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Paste Text to Score
                    </label>
                    <textarea
                      value={textToScore}
                      onChange={e => setTextToScore(e.target.value)}
                      placeholder="Paste a chapter, scene, or excerpt for prose quality evaluation..."
                      rows={6}
                      className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-none text-sm"
                    />
                  </div>

                  {/* Score Button */}
                  <button
                    onClick={handleScoreProse}
                    disabled={scoringLoading || !textToScore.trim()}
                    className="w-full px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition flex items-center justify-center gap-2"
                  >
                    {scoringLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4" />
                        Score Literary Quality
                      </>
                    )}
                  </button>
                </div>

                {/* Metrics Display */}
                {proseMetrics && (
                  <div className="mt-6 border-t border-slate-700 pt-6 space-y-4">
                    {/* Overall Score */}
                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4">
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-bold text-purple-300">{proseMetrics.overallScore}</span>
                        <div>
                          <p className="text-sm text-slate-300">Overall Literary Quality</p>
                          <p className="text-xs text-purple-300 font-semibold mt-1">
                            Prize Level: {proseMetrics.prizeWorthinessLevel.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dimension Scores */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'clarity', label: 'Clarity', icon: '✓' },
                        { key: 'originality', label: 'Originality', icon: '★' },
                        { key: 'emotionalResonance', label: 'Emotion', icon: '❤' },
                        { key: 'narrativeStrength', label: 'Narrative', icon: '→' },
                        { key: 'characterDepth', label: 'Characters', icon: '👤' },
                        { key: 'proseQuality', label: 'Prose', icon: '✨' }
                      ].map(dimension => (
                        <div key={dimension.key} className="bg-slate-700/30 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-300">{dimension.label}</span>
                            <span className="text-sm font-bold text-purple-300">{proseMetrics[dimension.key]}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                              style={{ width: `${proseMetrics[dimension.key]}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Strengths & Recommendations */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <h4 className="font-semibold text-green-300 text-sm mb-2">Strengths</h4>
                        <ul className="text-xs text-slate-300 space-y-1">
                          {proseMetrics.strengthAreas.map((area: string, i: number) => (
                            <li key={i} className="flex gap-2">
                              <Check className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                              {area}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-300 text-sm mb-2">Recommendations</h4>
                        <ul className="text-xs text-slate-300 space-y-1">
                          {proseMetrics.recommendations.slice(0, 3).map((rec: string, i: number) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-blue-400 flex-shrink-0">→</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CHARACTERS TAB */}
          {activeTab === 'characters' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-pink-400" />
                  Character Humanizer
                </h2>

                <div className="space-y-4">
                  {/* New Character Input */}
                  <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Character Name
                      </label>
                      <input
                        type="text"
                        value={newCharName}
                        onChange={e => setNewCharName(e.target.value)}
                        placeholder="e.g., 'Marcus Webb' or 'The Postmaster'"
                        className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Brief Description
                      </label>
                      <textarea
                        value={newCharBrief}
                        onChange={e => setNewCharBrief(e.target.value)}
                        placeholder="A grieving architect obsessed with precision and haunted by a construction accident from his past..."
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 resize-none text-sm"
                      />
                    </div>

                    <button
                      onClick={handleAddCharacter}
                      disabled={!newCharName.trim()}
                      className="w-full px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition text-sm"
                    >
                      + Add Character
                    </button>
                  </div>

                  {/* Character List */}
                  {characters.length > 0 && (
                    <div className="space-y-3 border-t border-slate-700 pt-6">
                      {characters.map(char => (
                        <div key={char.id} className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <h3 className="font-bold text-white text-sm sm:text-base">{char.name}</h3>
                              <p className="text-xs text-slate-400 mt-1">{char.brief}</p>
                            </div>
                            <button
                              onClick={() => handleHumanizeCharacter(char.id)}
                              disabled={char.loading}
                              className="px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 text-xs font-medium transition flex items-center gap-1.5 flex-shrink-0"
                            >
                              {char.loading ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  <Heart className="w-3 h-3" />
                                  Humanize
                                </>
                              )}
                            </button>
                          </div>

                          {/* Psychology Display */}
                          {char.psychology && (
                            <div className="bg-slate-700/50 rounded-lg p-3 space-y-2 text-xs">
                              <div>
                                <p className="text-slate-400 font-semibold">Primary Wound</p>
                                <p className="text-slate-300 mt-0.5">{char.psychology.primaryWound}</p>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                  <p className="text-slate-400 font-semibold">Defense Mechanism</p>
                                  <p className="text-slate-300 mt-0.5">{char.psychology.defenseMechanism}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400 font-semibold">Deep Need</p>
                                  <p className="text-slate-300 mt-0.5">{char.psychology.desireVsNeed?.deepNeed}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-slate-400 font-semibold">Key Insights</p>
                                <ul className="text-slate-300 mt-1 space-y-0.5">
                                  {char.psychology.actionableInsights?.slice(0, 2).map((insight: string, i: number) => (
                                    <li key={i}>• {insight}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* FORMATS TAB */}
          {activeTab === 'formats' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-blue-400" />
                  Output Format Designer
                </h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { type: 'Novel', icon: '📖', color: 'blue' },
                    { type: 'Illustrated Manual', icon: '📘', color: 'green' },
                    { type: 'Training Course', icon: '🎓', color: 'amber' },
                    { type: 'Subject Bible', icon: '📚', color: 'purple' },
                    { type: 'Cookbook', icon: '👨‍🍳', color: 'orange' },
                    { type: 'Academic Paper', icon: '🔬', color: 'cyan' }
                  ].map(format => (
                    <button
                      key={format.type}
                      className={`p-4 rounded-lg border transition text-left group bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50 hover:border-${format.color}-500/30`}
                    >
                      <p className="text-2xl mb-2">{format.icon}</p>
                      <p className="font-semibold text-white text-sm group-hover:text-teal-300">{format.type}</p>
                      <p className="text-xs text-slate-400 mt-1">Generate structure & layout</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LIBRARY TAB */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Archive className="w-5 h-5 text-green-400" />
                  Reference Library
                </h2>

                <div className="text-center py-12">
                  <Archive className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Save research, seeds, characters, and analyses here</p>
                  <button className="mt-4 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition">
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default EnhancedResearchDesk;
