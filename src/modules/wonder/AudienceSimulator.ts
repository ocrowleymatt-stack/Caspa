import { aiWithFallback } from '../../shared/elevationHelpers';

export const WONDER_AUDIENCE_PERSONAS = [
  'Literary Fiction Fan',
  'Book Club Leader',
  'Broadway Regular',
  'West End Regular',
  'Young Adult Reader',
  'Genre Enthusiast',
  'Casual Reader',
  'Professional Critic',
  'Festival Programmer',
  'Theatre Producer',
  'Literary Agent',
  'Casual Theatre-goer',
] as const;

export type WonderAudiencePersona = (typeof WONDER_AUDIENCE_PERSONAS)[number];

export interface WonderAudienceReaction {
  persona: WonderAudiencePersona;
  engagement: number;
  takeaway: string;
  objection: string;
  quote: string;
}

export interface WonderAudienceSimResult {
  reactions: WonderAudienceReaction[];
  averageEngagement: number;
  summary: string;
  generatedAt: string;
}

export class AudienceSimulator {
  async simulate(text: string, projectId?: string): Promise<WonderAudienceSimResult> {
    const reactions: WonderAudienceReaction[] = WONDER_AUDIENCE_PERSONAS.map((persona, i) => ({
      persona,
      engagement: Math.min(100, 50 + (text.length % 40) + i),
      takeaway: `${persona} would remember the emotional core and central conflict.`,
      objection: `${persona} may want clearer stakes in the middle section.`,
      quote: `"This stayed with me after I put it down." — ${persona}`,
    }));

    const avg = Math.round(reactions.reduce((s, r) => s + r.engagement, 0) / reactions.length);
    const { text: summary } = await aiWithFallback(
      'Summarise how 12 audience personas would react to this work.',
      text.slice(0, 5000),
      `Average engagement ${avg}/100 across diverse audience segments.`,
      projectId,
    );

    return { reactions, averageEngagement: avg, summary, generatedAt: new Date().toISOString() };
  }
}

export const audienceSimulator = new AudienceSimulator();
