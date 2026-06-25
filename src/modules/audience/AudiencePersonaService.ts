export const AUDIENCE_PERSONAS = [
  'Avid Reader',
  'BookTok Influencer',
  'West End Regular',
  'Regional Theatre Patron',
  'Festival Curator',
  'Literary Agent',
  'Casual Buyer',
  'Young Professional',
  'Retired Subscriber',
  'School Teacher',
  'Critic',
  'Gift Buyer',
] as const;

export type AudiencePersona = (typeof AUDIENCE_PERSONAS)[number];

export class AudiencePersonaService {
  list(): AudiencePersona[] {
    return [...AUDIENCE_PERSONAS];
  }

  describe(persona: AudiencePersona): string {
    const descriptions: Record<AudiencePersona, string> = {
      'Avid Reader': 'Reads 50+ books/year, values craft and voice',
      'BookTok Influencer': 'Seeks quotable moments and emotional hooks',
      'West End Regular': 'Expects polish, spectacle, and strong second act',
      'Regional Theatre Patron': 'Supports local stories with universal appeal',
      'Festival Curator': 'Looks for bold voice and cultural relevance',
      'Literary Agent': 'Evaluates marketability and author platform',
      'Casual Buyer': 'Decides on cover, blurb, and first pages',
      'Young Professional': 'Limited time, wants propulsive narrative',
      'Retired Subscriber': 'Values character depth and thematic richness',
      'School Teacher': 'Considers classroom suitability and discussion value',
      'Critic': 'Analyses structure, originality, and cultural context',
      'Gift Buyer': 'Wants emotional payoff and broad appeal',
    };
    return descriptions[persona];
  }
}

export const audiencePersonaService = new AudiencePersonaService();
