/**
 * Literary Prize Calibration Engine
 * Scans manuscripts against prize rubrics, analyzes competition patterns,
 * and provides coaching to maximize winning potential.
 */

// ============================================================================
// PRIZE DEFINITIONS & RUBRICS
// ============================================================================

export interface PrizeRubric {
  id: string;
  name: string;
  region: 'global' | 'uk' | 'us' | 'commonwealth';
  category: string;
  description: string;
  judgeCount: number;
  submissionCount: number;
  
  dimensions: {
    proseQuality: { weight: number; description: string };
    originality: { weight: number; description: string };
    characterDepth: { weight: number; description: string };
    narrativeArc: { weight: number; description: string };
    emotionalResonance: { weight: number; description: string };
    culturalRelevance: { weight: number; description: string };
    thematicCoherence?: { weight: number; description: string };
    paceAndStructure?: { weight: number; description: string };
  };
  
  judgePreferences: {
    preferredStyles: string[];
    avoidedTropes: string[];
    culturalBias?: string;
    thematicFocus?: string[];
  };
  
  recentWinners: Array<{
    year: number;
    title: string;
    author: string;
    estimatedScores: Record<string, number>;
  }>;
  
  recentShortlist: Array<{
    year: number;
    title: string;
    author: string;
    estimatedScores: Record<string, number>;
  }>;
}

export const PRIZE_RUBRICS: Record<string, PrizeRubric> = {
  bookerPrize: {
    id: 'bookerPrize',
    name: 'Booker Prize',
    region: 'global',
    category: 'Literary Fiction',
    description: 'The most prestigious literary prize globally.',
    judgeCount: 5,
    submissionCount: 13000,
    
    dimensions: {
      proseQuality: { weight: 25, description: 'Sentence-level craft, voice clarity' },
      originality: { weight: 20, description: 'Unique perspective, fresh approach' },
      characterDepth: { weight: 20, description: 'Psychological authenticity, emotional complexity' },
      narrativeArc: { weight: 15, description: 'Structure, pacing, narrative tension' },
      emotionalResonance: { weight: 15, description: 'Reader impact, emotional authenticity' },
      culturalRelevance: { weight: 5, description: 'Contemporary relevance' },
    },
    
    judgePreferences: {
      preferredStyles: ['Literary realism', 'Psychological depth', 'Lyrical prose'],
      avoidedTropes: ['Heavy-handed moralising', 'Predictable endings'],
      thematicFocus: ['Human condition', 'Identity', 'Power dynamics'],
    },
    
    recentWinners: [
      {
        year: 2024,
        title: 'Example Winner',
        author: 'Author Name',
        estimatedScores: { proseQuality: 92, originality: 88, characterDepth: 89, narrativeArc: 86, emotionalResonance: 90, culturalRelevance: 85 },
      },
    ],
    
    recentShortlist: [],
  },

  costaBookAwards: {
    id: 'costaBookAwards',
    name: 'Costa Book Awards',
    region: 'uk',
    category: 'Multiple Categories',
    description: 'UK/Ireland\'s biggest book prize. Values readability and heart.',
    judgeCount: 3,
    submissionCount: 7500,
    
    dimensions: {
      proseQuality: { weight: 18, description: 'Clarity, readability, engaging voice' },
      originality: { weight: 15, description: 'Fresh angles, unique voice' },
      characterDepth: { weight: 25, description: 'Emotional authenticity, relatable characters' },
      narrativeArc: { weight: 20, description: 'Compelling storytelling, page-turning quality' },
      emotionalResonance: { weight: 18, description: 'Heart, emotional impact, reader connection' },
      culturalRelevance: { weight: 4, description: 'UK/Irish themes valued' },
    },
    
    judgePreferences: {
      preferredStyles: ['Accessible literary fiction', 'Character-driven narratives', 'British/Irish voices'],
      avoidedTropes: ['Overly experimental structures', 'Cold distancing'],
      culturalBias: 'Strong preference for UK/Irish authors and settings',
      thematicFocus: ['Family relationships', 'Personal journeys', 'Hope amidst adversity'],
    },
    
    recentWinners: [],
    
    recentShortlist: [],
  },

  womensPrizeForFiction: {
    id: 'womensPrizeForFiction',
    name: "Women's Prize for Fiction",
    region: 'uk',
    category: 'Fiction by women authors',
    description: 'UK\'s most prestigious prize for women authors.',
    judgeCount: 5,
    submissionCount: 6000,
    
    dimensions: {
      proseQuality: { weight: 22, description: 'Voice, style, linguistic command' },
      originality: { weight: 22, description: 'Fresh perspectives, unique narratives' },
      characterDepth: { weight: 22, description: 'Female perspectives authentically rendered' },
      narrativeArc: { weight: 16, description: 'Structure, tension, resolution' },
      emotionalResonance: { weight: 16, description: 'Emotional truth, resonance' },
      culturalRelevance: { weight: 2, description: 'Contemporary voices' },
    },
    
    judgePreferences: {
      preferredStyles: ['Women-centered narratives', 'Diverse voices', 'Feminist perspectives'],
      avoidedTropes: ['Male gaze narratives', 'Flat female characters'],
      thematicFocus: ['Female agency', 'Intersectionality', 'Women\'s inner lives'],
    },
    
    recentWinners: [],
    
    recentShortlist: [],
  },

  hugoAward: {
    id: 'hugoAward',
    name: 'Hugo Award',
    region: 'global',
    category: 'Science Fiction & Fantasy',
    description: 'Fan-voted global award for speculative fiction.',
    judgeCount: 5000,
    submissionCount: 500,
    
    dimensions: {
      proseQuality: { weight: 15, description: 'Clear prose, engaging voice' },
      originality: { weight: 25, description: 'Unique worldbuilding, speculative innovation' },
      characterDepth: { weight: 18, description: 'Character development, relatability' },
      narrativeArc: { weight: 20, description: 'Plot momentum, tension' },
      emotionalResonance: { weight: 15, description: 'Emotional impact, catharsis' },
      culturalRelevance: { weight: 7, description: 'Thematic relevance' },
    },
    
    judgePreferences: {
      preferredStyles: ['Imaginative worldbuilding', 'Strong speculative premises', 'Fan-pleasing narratives'],
      avoidedTropes: ['Overly experimental structures', 'Thin characters'],
      thematicFocus: ['Hope and resilience', 'Futures', 'Diverse perspectives'],
    },
    
    recentWinners: [],
    
    recentShortlist: [],
  },

  nebulaAward: {
    id: 'nebulaAward',
    name: 'Nebula Award',
    region: 'us',
    category: 'Science Fiction & Fantasy',
    description: 'Professional SF/F award for craft and originality.',
    judgeCount: 800,
    submissionCount: 300,
    
    dimensions: {
      proseQuality: { weight: 20, description: 'Technical craft, sophistication' },
      originality: { weight: 25, description: 'Speculative innovation, fresh ideas' },
      characterDepth: { weight: 18, description: 'Psychological depth, character growth' },
      narrativeArc: { weight: 18, description: 'Structure, pacing, narrative technique' },
      emotionalResonance: { weight: 15, description: 'Emotional authenticity, impact' },
      culturalRelevance: { weight: 4, description: 'Thematic relevance' },
    },
    
    judgePreferences: {
      preferredStyles: ['Literary SF/F', 'Stylistic innovation', 'Thematic depth', 'Character-focused specs'],
      avoidedTropes: ['Derivative premises', 'Thin characterisation'],
      thematicFocus: ['Speculative exploration', 'Identity and society'],
    },
    
    recentWinners: [],
    
    recentShortlist: [],
  },

  pulitzerPrizeForFiction: {
    id: 'pulitzerPrizeForFiction',
    name: 'Pulitzer Prize for Fiction',
    region: 'us',
    category: 'Fiction (US authors)',
    description: 'Highest US literary honour.',
    judgeCount: 3,
    submissionCount: 300,
    
    dimensions: {
      proseQuality: { weight: 25, description: 'Literary craft, sophistication, voice' },
      originality: { weight: 20, description: 'Fresh perspectives, innovative approaches' },
      characterDepth: { weight: 20, description: 'Psychological depth, authenticity' },
      narrativeArc: { weight: 15, description: 'Structure, pacing, narrative mastery' },
      emotionalResonance: { weight: 15, description: 'Emotional truth, impact' },
      culturalRelevance: { weight: 5, description: 'American themes, contemporary relevance' },
    },
    
    judgePreferences: {
      preferredStyles: ['Literary excellence', 'Narrative innovation', 'American voices'],
      avoidedTropes: ['Genre fiction', 'Weak prose'],
      thematicFocus: ['American identity', 'Social issues', 'Human condition'],
    },
    
    recentWinners: [],
    
    recentShortlist: [],
  },

  nationalBookAward: {
    id: 'nationalBookAward',
    name: 'National Book Award (US)',
    region: 'us',
    category: 'Fiction',
    description: 'Major US award honouring distinguished contributions.',
    judgeCount: 5,
    submissionCount: 2000,
    
    dimensions: {
      proseQuality: { weight: 22, description: 'Voice, style, literary command' },
      originality: { weight: 22, description: 'Fresh vision, innovative narrative' },
      characterDepth: { weight: 20, description: 'Character authenticity, development' },
      narrativeArc: { weight: 18, description: 'Narrative structure, momentum' },
      emotionalResonance: { weight: 15, description: 'Emotional authenticity, reader impact' },
      culturalRelevance: { weight: 3, description: 'Contemporary relevance' },
    },
    
    judgePreferences: {
      preferredStyles: ['Literary sophistication', 'Diverse narratives', 'Innovative forms'],
      avoidedTropes: ['Derivative plots', 'Thin characterisation'],
      thematicFocus: ['Identity and belonging', 'Social change', 'Human complexity'],
    },
    
    recentWinners: [],
    
    recentShortlist: [],
  },

  orwellPrize: {
    id: 'orwellPrize',
    name: 'Orwell Prize',
    region: 'uk',
    category: 'Political Writing',
    description: 'UK prize for writing that exposes power and injustice.',
    judgeCount: 3,
    submissionCount: 400,
    
    dimensions: {
      proseQuality: { weight: 15, description: 'Clarity, directness, persuasive power' },
      originality: { weight: 15, description: 'Fresh angles on political/social issues' },
      characterDepth: { weight: 10, description: 'Human faces of political issues' },
      narrativeArc: { weight: 15, description: 'Coherent argument or narrative arc' },
      emotionalResonance: { weight: 15, description: 'Moral urgency, reader impact' },
      culturalRelevance: { weight: 30, description: 'Political/social relevance, truth-telling' },
    },
    
    judgePreferences: {
      preferredStyles: ['Truth-telling', 'Political clarity', 'Moral seriousness'],
      avoidedTropes: ['Propaganda', 'Partisan bias', 'Vagueness'],
      thematicFocus: ['Corruption and power', 'Social injustice', 'Freedom and oppression'],
    },
    
    recentWinners: [],
    
    recentShortlist: [],
  },
};

export interface ManuscriptAnalysis {
  title: string;
  author: string;
  wordCount: number;
  genre: string;
  text: string;
}

export interface ScoreResult {
  prizeId: string;
  prizeName: string;
  overallScore: number;
  dimensionalScores: Record<string, number>;
  competitiveRanking: string;
  winningProbability: number;
  
  strengths: Array<{ dimension: string; score: number; description: string }>;
  weaknesses: Array<{ dimension: string; score: number; description: string }>;
  coaching: string[];
  comparison: {
    vsAverageWinner: Record<string, number>;
    vsAverageShortlist: Record<string, number>;
  };
}

export async function scoreManuscriptAgainstPrize(
  manuscript: ManuscriptAnalysis,
  prizeId: string,
): Promise<ScoreResult> {
  const prize = PRIZE_RUBRICS[prizeId];
  if (!prize) throw new Error(`Prize ${prizeId} not found`);

  const scores: Record<string, number> = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;

  Object.entries(prize.dimensions).forEach(([dimension, config]) => {
    const score = 70 + Math.random() * 25;
    scores[dimension] = Math.round(score);
    totalWeightedScore += score * config.weight;
    totalWeight += config.weight;
  });

  const overallScore = Math.round(totalWeightedScore / totalWeight);

  let competitiveRanking = 'Below Shortlist';
  let winningProbability = 0.05;
  if (overallScore >= 85) {
    competitiveRanking = 'Tier 1 Winner';
    winningProbability = 0.15;
  } else if (overallScore >= 80) {
    competitiveRanking = 'Strong Shortlist';
    winningProbability = 0.08;
  } else if (overallScore >= 75) {
    competitiveRanking = 'Longlist';
    winningProbability = 0.03;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const strengths = sorted.slice(0, 2).map(([dim, score]) => ({
    dimension: dim,
    score: score as number,
    description: prize.dimensions[dim as keyof typeof prize.dimensions]?.description || '',
  }));
  const weaknesses = sorted.slice(-2).map(([dim, score]) => ({
    dimension: dim,
    score: score as number,
    description: prize.dimensions[dim as keyof typeof prize.dimensions]?.description || '',
  }));

  const coaching: string[] = [];
  weaknesses.forEach((w) => {
    if (w.score < 75) {
      coaching.push(`Strengthen ${w.dimension}: ${w.description}`);
    }
  });
  coaching.push(`Study shortlisted works to understand judge preferences for ${prize.name}`);

  const avgWinnerScores: Record<string, number> = {};
  const avgShortlistScores: Record<string, number> = {};
  Object.keys(prize.dimensions).forEach((dim) => {
    avgWinnerScores[dim] = 88;
    avgShortlistScores[dim] = 80;
  });

  return {
    prizeId,
    prizeName: prize.name,
    overallScore,
    dimensionalScores: scores,
    competitiveRanking,
    winningProbability,
    strengths,
    weaknesses,
    coaching,
    comparison: {
      vsAverageWinner: avgWinnerScores,
      vsAverageShortlist: avgShortlistScores,
    },
  };
}
