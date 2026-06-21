import { GoogleGenerativeAI } from '@google/generative-ai';

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ===== Prize Engine =====
export class LiteraryPrizeEngine {
  private prizes: Record<string, any> = {
    booker: {
      name: 'The Booker Prize',
      description: 'UK & Commonwealth literary fiction',
      maxScore: 100
    },
    pulitzer: {
      name: 'Pulitzer Prize for Fiction',
      description: 'US national literary award',
      maxScore: 100
    },
    hugo: {
      name: 'Hugo Award',
      description: 'Science fiction award',
      maxScore: 100
    }
  };

  async analyzePrize(manuscriptText: string, prizeId: string) {
    const prize = this.prizes[prizeId];
    if (!prize) throw new Error(`Prize ${prizeId} not found`);

    const prompt = `Analyze this manuscript excerpt for ${prize.name} readiness:

${manuscriptText.substring(0, 1500)}

Return JSON: {
  "competitiveScore": 0-100,
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"],
  "judgePerspective": "brief judge opinion",
  "assistance": "one-sentence advice"
}`;

    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      const parsed = JSON.parse(text);
      return {
        prizeId,
        prizeName: prize.name,
        competitiveScore: Math.min(parsed.competitiveScore || 50, 100),
        strengthAreas: parsed.strengths || [],
        improvementAreas: parsed.improvements || [],
        judgePerspective: parsed.judgePerspective || '',
        realTimeAssistance: parsed.assistance || ''
      };
    } catch (err) {
      return {
        prizeId,
        prizeName: prize.name,
        competitiveScore: 50,
        strengthAreas: ['Potential detected', 'Original voice', 'Character focus'],
        improvementAreas: ['Prose refinement', 'Pacing', 'Emotional depth'],
        judgePerspective: 'Manuscript shows promise.',
        realTimeAssistance: 'Refine prose and deepen character interiority.'
      };
    }
  }

  async scanMultiplePrizes(manuscriptText: string) {
    const analyses = await Promise.all(
      Object.keys(this.prizes).map(pid => this.analyzePrize(manuscriptText, pid))
    );
    return analyses.sort((a, b) => b.competitiveScore - a.competitiveScore);
  }

  getPrizeDefinitions() {
    return Object.entries(this.prizes).map(([id, def]) => ({ id, name: def.name, description: def.description }));
  }
}

// ===== Psychology Engine =====
export class PsychologyEngine {
  async validateCharacter(characterProfile: string) {
    const prompt = `Validate character psychology: ${characterProfile}
    
Rate 0-100: motivation authenticity, psychological consistency, emotional depth.
Return JSON with scores and suggestions.`;

    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      const parsed = JSON.parse(text);
      return {
        motivationAuthenticity: parsed.motivationAuthenticity || 65,
        psychologicalConsistency: parsed.psychologicalConsistency || 70,
        emotionalDepth: parsed.emotionalDepth || 60,
        suggestions: parsed.suggestions || []
      };
    } catch {
      return {
        motivationAuthenticity: 65,
        psychologicalConsistency: 70,
        emotionalDepth: 60,
        suggestions: ['Deepen backstory', 'Show internal conflict', 'Develop triggers']
      };
    }
  }
}

// ===== Research Desk (simplified) =====
export class ResearchDesk {
  async research(query: string) {
    // Simulate multi-source research consensus
    return {
      query,
      sources: 12,
      consensus: ['Key finding 1', 'Key finding 2'],
      conflicts: ['Differing viewpoint'],
      gaps: ['Area needing deeper research']
    };
  }
}

// ===== Export Service =====
export class OneClickExporter {
  generateKDPMetadata(title: string, author: string, isbn: string) {
    return {
      title,
      author,
      isbn,
      format: 'paperback',
      distributionRights: 'wide'
    };
  }

  generateIngramMetadata(title: string, author: string, isbn: string) {
    return {
      title,
      author,
      isbn,
      format: 'paperback',
      binSize: '6x9'
    };
  }

  getPrintChecklist() {
    return [
      '✓ PDF is 300 DPI minimum',
      '✓ Color space is CMYK (or RGB)',
      '✓ Bleeds set to 3.5mm',
      '✓ Safety zone: 5mm',
      '✓ No text in safety zone',
      '✓ Fonts embedded',
      '✓ No crop marks outside bleed'
    ];
  }
}
