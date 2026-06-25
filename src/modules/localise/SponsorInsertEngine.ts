export class SponsorInsertEngine {
  generateSafe(context: string, sponsor?: string) {
    const name = sponsor ?? 'Community Partner';
    return {
      sponsor: name,
      safeMentions: [
        `Thank you to ${name} for supporting tonight's performance`,
        `Interval signage — ${name} logo placement`,
      ],
      avoid: ['Product placement in dialogue', 'Competitor references', 'Unapproved script changes'],
      scriptInsert: `[ANNOUNCEMENT] This production is proudly supported by ${name}.`,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const sponsorInsertEngine = new SponsorInsertEngine();
