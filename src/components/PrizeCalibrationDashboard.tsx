import React, { useState } from 'react';
import { Award, TrendingUp, Target, Zap, BookOpen, Star } from 'lucide-react';

interface Prize {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
}

interface DimensionScore {
  name: string;
  score: number;
  weight: number;
  feedback: string;
}

const PRIZES: Prize[] = [
  { id: 'booker', name: 'Booker Prize', description: 'Literary excellence & cultural impact', category: 'Fiction', icon: '📚' },
  { id: 'costa', name: 'Costa Awards', description: 'Readability & emotional resonance', category: 'Fiction', icon: '☕' },
  { id: 'womens', name: "Women's Prize", description: 'Complex female characters & perspectives', category: 'Fiction', icon: '👩‍🎓' },
  { id: 'hugo', name: 'Hugo Award', description: 'Imaginative worldbuilding & ideas', category: 'SFF', icon: '🚀' },
  { id: 'nebula', name: 'Nebula Award', description: 'Craft excellence & narrative innovation', category: 'SFF', icon: '🌌' },
  { id: 'pulitzer', name: 'Pulitzer Prize', description: 'Distinguished literary merit', category: 'Fiction', icon: '🏛️' },
  { id: 'nba', name: 'National Book Award', description: 'Literary achievement & vision', category: 'Fiction', icon: '🎖️' },
  { id: 'orwell', name: 'Orwell Prize', description: 'Political clarity & social commentary', category: 'Non-Fiction', icon: '✍️' },
];

const DIMENSIONS: DimensionScore[] = [
  { name: 'Prose Quality', score: 0, weight: 0.18, feedback: 'Elegance, clarity, originality of language' },
  { name: 'Character Depth', score: 0, weight: 0.20, feedback: 'Psychological authenticity & complexity' },
  { name: 'Narrative Craft', score: 0, weight: 0.18, feedback: 'Plot structure, pacing, tension' },
  { name: 'Originality', score: 0, weight: 0.17, feedback: 'Fresh voice, unique perspective, innovation' },
  { name: 'Emotional Resonance', score: 0, weight: 0.15, feedback: 'Reader connection, emotional depth' },
  { name: 'Cultural Relevance', score: 0, weight: 0.12, feedback: 'Timely themes, social impact' },
];

export const PrizeCalibrationDashboard: React.FC = () => {
  const [selectedPrizes, setSelectedPrizes] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'comparison'>('overview');
  const [analyzedDimensions] = useState<DimensionScore[]>(
    DIMENSIONS.map(d => ({ ...d, score: Math.floor(Math.random() * 30) + 65 }))
  );

  const togglePrize = (prizeId: string) => {
    setSelectedPrizes(prev => 
      prev.includes(prizeId) 
        ? prev.filter(id => id !== prizeId)
        : [...prev, prizeId]
    );
  };

  const selectedPrizeObjects = PRIZES.filter(p => selectedPrizes.includes(p.id));
  const overallScore = Math.round(analyzedDimensions.reduce((sum, d) => sum + d.score, 0) / analyzedDimensions.length);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
            <Award className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
            Prize Calibration Engine
          </h1>
        </div>
        <p className="text-slate-400 text-lg ml-11">Calibrate your manuscript against the world's leading literary prizes</p>
      </div>

      {/* View Mode Selector */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {(['overview', 'detailed', 'comparison'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              viewMode === mode
                ? 'bg-amber-500 text-white shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {mode === 'overview' && '📊 Overview'}
            {mode === 'detailed' && '🔍 Detailed Analysis'}
            {mode === 'comparison' && '⚖️ Compare Prizes'}
          </button>
        ))}
      </div>

      {/* Prize Selector Grid */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-amber-50 mb-4">Select Prizes to Analyze</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRIZES.map(prize => (
            <button
              key={prize.id}
              onClick={() => togglePrize(prize.id)}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                selectedPrizes.includes(prize.id)
                  ? 'border-amber-400 bg-amber-500/10 shadow-lg'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
              }`}
            >
              <div className="text-3xl mb-2">{prize.icon}</div>
              <div className="text-left">
                <h3 className="font-bold text-amber-50 text-sm group-hover:text-amber-300">{prize.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{prize.category}</p>
                <p className="text-xs text-slate-500 mt-2">{prize.description}</p>
              </div>
              {selectedPrizes.includes(prize.id) && (
                <div className="mt-3 pt-3 border-t border-amber-400/30">
                  <span className="text-xs font-semibold text-amber-300">✓ Selected</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedPrizeObjects.length > 0 ? (
        <>
          {/* Overall Score Card */}
          <div className="mb-12 p-8 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/5 to-amber-600/5 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32 mb-4">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#334155" strokeWidth="6" />
                    <circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      stroke="url(#scoreGradient)"
                      strokeWidth="6"
                      strokeDasharray={`${(overallScore / 100) * 283} 283`}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#d97706" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-amber-400">{overallScore}</div>
                      <div className="text-xs text-slate-400">/ 100</div>
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-amber-50">Manuscript Score</h3>
              </div>

              <div className="md:col-span-2 space-y-4">
                <div>
                  <h4 className="text-amber-50 font-semibold mb-3">📈 Competitive Standing</h4>
                  <div className="space-y-2">
                    {selectedPrizeObjects.slice(0, 3).map(prize => {
                      const prizeScore = Math.floor(Math.random() * 30) + 60;
                      return (
                        <div key={prize.id} className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">{prize.icon} {prize.name}</span>
                          <div className="flex items-center gap-3 flex-1 ml-4">
                            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                                style={{ width: `${prizeScore}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-amber-400 w-10 text-right">{prizeScore}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-amber-400/20">
                  <h4 className="text-amber-50 font-semibold mb-2">🎯 Key Insights</h4>
                  <ul className="text-sm text-slate-300 space-y-1">
                    <li>✓ Strong character work — leverage for character-focused prizes</li>
                    <li>✓ Original voice — competitive for innovation-heavy awards</li>
                    <li>⚠ Pacing needs tightening — critical for pace-sensitive judges</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Dimension Breakdown */}
          {viewMode === 'overview' || viewMode === 'detailed' && (
            <div className="mb-12">
              <h2 className="text-xl font-bold text-amber-50 mb-6">📊 Dimensional Analysis</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analyzedDimensions.map((dim, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-amber-400/30 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-amber-50 group-hover:text-amber-300 transition-colors">{dim.name}</h3>
                        <p className="text-xs text-slate-400 mt-1">{dim.feedback}</p>
                      </div>
                      <div className="text-2xl font-bold text-amber-400 tabular-nums">{dim.score}</div>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                        style={{ width: `${dim.score}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-slate-500">Weight: {(dim.weight * 100).toFixed(0)}%</span>
                      <span className={`text-xs font-semibold ${
                        dim.score >= 80 ? 'text-emerald-400' : dim.score >= 65 ? 'text-amber-300' : 'text-orange-400'
                      }`}>
                        {dim.score >= 80 ? '⭐ Excellent' : dim.score >= 65 ? '✓ Strong' : '⚠ Develop'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prize-Specific Coaching */}
          {viewMode === 'comparison' && selectedPrizeObjects.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-bold text-amber-50 mb-6">🏆 Prize-Specific Coaching</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {selectedPrizeObjects.map(prize => (
                  <div
                    key={prize.id}
                    className="p-6 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-400/20 shadow-lg hover:shadow-xl hover:border-amber-400/40 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{prize.icon}</span>
                      <div>
                        <h3 className="font-bold text-amber-50">{prize.name}</h3>
                        <p className="text-xs text-slate-400">{prize.description}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-amber-300 mb-2">🎯 To Win This Prize:</h4>
                        <ul className="text-sm text-slate-300 space-y-1">
                          {prize.id === 'booker' && (
                            <>
                              <li>✓ Maximize prose elegance and language innovation</li>
                              <li>✓ Develop rich cultural/social commentary</li>
                              <li>✓ Focus on character psychology</li>
                            </>
                          )}
                          {prize.id === 'costa' && (
                            <>
                              <li>✓ Strengthen emotional accessibility</li>
                              <li>✓ Enhance narrative momentum and readability</li>
                              <li>✓ Build deeper reader connection</li>
                            </>
                          )}
                          {prize.id === 'womens' && (
                            <>
                              <li>✓ Develop complex female perspectives</li>
                              <li>✓ Explore women's agency and autonomy</li>
                              <li>✓ Create authentic emotional journeys</li>
                            </>
                          )}
                          {prize.id === 'hugo' && (
                            <>
                              <li>✓ Enhance worldbuilding depth and consistency</li>
                              <li>✓ Develop speculative ideas and innovation</li>
                              <li>✓ Strengthen imaginative scope</li>
                            </>
                          )}
                          {prize.id === 'nebula' && (
                            <>
                              <li>✓ Polish craft and narrative technique</li>
                              <li>✓ Innovate in storytelling approach</li>
                              <li>✓ Deepen thematic resonance</li>
                            </>
                          )}
                          {prize.id === 'pulitzer' && (
                            <>
                              <li>✓ Demonstrate distinguished literary merit</li>
                              <li>✓ Show unique American voice and vision</li>
                              <li>✓ Build cultural significance</li>
                            </>
                          )}
                          {prize.id === 'nba' && (
                            <>
                              <li>✓ Express distinctive literary achievement</li>
                              <li>✓ Demonstrate visionary storytelling</li>
                              <li>✓ Create lasting cultural impact</li>
                            </>
                          )}
                          {prize.id === 'orwell' && (
                            <>
                              <li>✓ Strengthen political clarity</li>
                              <li>✓ Develop social commentary</li>
                              <li>✓ Build argumentative power</li>
                            </>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="mt-12 p-6 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 border border-amber-400/20 text-center">
            <h3 className="text-lg font-bold text-amber-50 mb-3">📤 Ready to analyze your manuscript?</h3>
            <p className="text-slate-300 mb-4">Upload your manuscript or paste text to see detailed scoring against each prize</p>
            <button className="px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold hover:shadow-lg hover:shadow-amber-500/50 transition-all">
              Upload Manuscript →
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-12 px-6 rounded-xl bg-slate-800/30 border border-slate-700">
          <Zap className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Select at least one prize to see analysis</p>
        </div>
      )}
    </div>
  );
};

export default PrizeCalibrationDashboard;
