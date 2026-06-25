import { showFactoryService } from '../show-factory';

export interface VenueFit {
  showPackageId: string;
  venues: { name: string; capacity: number; fitScore: number; notes: string }[];
  generatedAt: string;
}

export class VenueFitScorer {
  async score(showPackageId: string): Promise<VenueFit> {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    const isTheatre = pkg.type === 'theatre';

    return {
      showPackageId,
      venues: [
        { name: 'Regional Proscenium', capacity: 400, fitScore: isTheatre ? 88 : 45, notes: 'Strong for traditional staging' },
        { name: 'Black Box Studio', capacity: 120, fitScore: isTheatre ? 75 : 60, notes: 'Intimate, flexible configuration' },
        { name: 'Broadcast Studio', capacity: 50, fitScore: pkg.type === 'radio' || pkg.type === 'podcast' ? 95 : 30, notes: 'Ideal for recorded formats' },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const venueFitScorer = new VenueFitScorer();
