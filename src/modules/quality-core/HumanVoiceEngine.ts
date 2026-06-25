import { audienceSimulator } from '../wonder/AudienceSimulator';

export interface HumanVoiceResult {
  score: number;
  status: 'authentic' | 'needs_work' | 'flat';
  suggestions: string[];
  delegatedFrom: string[];
}

export class HumanVoiceEngine {
  async assess(text: string, projectId?: string): Promise<HumanVoiceResult> {
    const suggestions: string[] = [];

    if (/^\s*Furthermore|Moreover|Additionally/i.test(text)) {
      suggestions.push('Reduce formal transition words — use natural speech rhythm');
    }
    if (!/\b(I|we|you|she|he|they)\b/i.test(text.slice(0, 500))) {
      suggestions.push('Add a human viewpoint or direct address in opening passages');
    }

    if (projectId) {
      const audience = await audienceSimulator.simulate(text, projectId);
      if (audience.averageEngagement < 60) {
        suggestions.push('Audience engagement low — add sensory detail and specificity');
      }
    }

    const avgSentenceLen = text.split(/[.!?]+/).filter(Boolean).length
      ? text.length / text.split(/[.!?]+/).filter(Boolean).length
      : 0;
    if (avgSentenceLen > 120) {
      suggestions.push('Sentences run long — vary rhythm for spoken authenticity');
    }

    const score = Math.max(30, 100 - suggestions.length * 12);
    const status = score >= 75 ? 'authentic' : score >= 50 ? 'needs_work' : 'flat';

    return {
      score,
      status,
      suggestions,
      delegatedFrom: ['AudienceSimulator', 'quality-heuristics'],
    };
  }
}

export const humanVoiceEngine = new HumanVoiceEngine();
