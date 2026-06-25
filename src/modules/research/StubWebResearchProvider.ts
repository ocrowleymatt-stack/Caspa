export interface WebResearchResult {
  available: false;
  query: string;
  message: string;
}

export class StubWebResearchProvider {
  search(query: string): WebResearchResult {
    return {
      available: false,
      query,
      message: 'Web research provider is unavailable. Add sources manually or connect an external API.',
    };
  }
}

export const stubWebResearchProvider = new StubWebResearchProvider();
