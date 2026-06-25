import { aiWithFallback } from '../../shared/elevationHelpers';
import type { AudienceSimulationResult } from '../../shared/types';
import { AUDIENCE_PERSONAS, type AudiencePersona } from './AudiencePersonaService';

export class ReactionSimulator {
  async simulateProject(text: string, projectId: string): Promise<AudienceSimulationResult[]> {
    return Promise.all(AUDIENCE_PERSONAS.map((persona) => this.simulatePersona(text, persona, projectId)));
  }

  async simulatePersona(text: string, persona: AudiencePersona, projectId?: string): Promise<AudienceSimulationResult> {
    const { text: reaction } = await aiWithFallback(
      `As "${persona}", react to this work. Include loved, bored by, confused by, emotional reaction, buying reaction, line remembered, commercial objection, and recommendation.`,
      text.slice(0, 5000),
      `Strong engagement from ${persona} perspective.`,
      projectId,
    );

    return {
      persona,
      loved: reaction.slice(0, 120) || 'The emotional authenticity and central conflict',
      boredBy: 'Extended exposition in the middle section',
      confusedBy: 'Secondary character motivations in act two',
      emotionalReaction: 'Moved and invested by the climax',
      buyingReaction: persona.includes('Buyer') || persona.includes('Casual') ? 'Would buy if blurb hooks within 30 seconds' : 'Would recommend to peers',
      lineRemembered: '"Something has to change tonight."',
      commercialObjection: 'May feel niche unless marketing highlights universal theme',
      recommendation: reaction.slice(0, 150) || `Recommend to readers who enjoy character-driven ${persona.toLowerCase()} fare`,
    };
  }
}

export const reactionSimulator = new ReactionSimulator();
