import { showFactoryService } from '../show-factory';

export class SetDesignBrief {
  async brief(showPackageId: string) {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    return {
      showPackageId,
      concept: 'Modular unit set with transformative centre piece',
      scenes: [
        { act: 1, environment: 'Domestic interior — warm, enclosed' },
        { act: 2, environment: 'Public space — exposed, vertical' },
        { act: 3, environment: 'Abstract — minimal, symbolic' },
      ],
      practicals: ['Revolve or truck for scene transitions', 'Overhead practical lighting'],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const setDesignBrief = new SetDesignBrief();
