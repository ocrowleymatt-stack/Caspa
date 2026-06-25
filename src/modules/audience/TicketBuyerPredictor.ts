import { requireProject } from '../../shared/elevationHelpers';

export interface TicketBuyerFit {
  projectId: string;
  likelihood: number;
  priceSensitivity: 'low' | 'medium' | 'high';
  demographics: string[];
  hooks: string[];
  barriers: string[];
  generatedAt: string;
}

export class TicketBuyerPredictor {
  async predict(projectId: string): Promise<TicketBuyerFit> {
    const project = await requireProject(projectId);
    const likelihood = Math.min(100, Math.round(45 + project.title.length + project.description.length / 20));

    return {
      projectId,
      likelihood,
      priceSensitivity: likelihood > 70 ? 'low' : likelihood > 50 ? 'medium' : 'high',
      demographics: ['25-54 theatre-goers', 'Literary adaptation fans', 'Date-night couples'],
      hooks: [project.title, 'Emotional climax', 'Recognisable themes'],
      barriers: likelihood < 60 ? ['Needs stronger second-act momentum', 'Title may need market testing'] : ['Minimal barriers at preview stage'],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const ticketBuyerPredictor = new TicketBuyerPredictor();
