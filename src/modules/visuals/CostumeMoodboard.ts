import { showFactoryService } from '../show-factory';
import { colourPaletteAdvisor } from './ColourPaletteAdvisor';

export class CostumeMoodboard {
  async brief(showPackageId: string) {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    const palette = await colourPaletteAdvisor.advise(pkg.projectId);
    return {
      showPackageId,
      palette: palette.palette,
      looks: [
        { character: 'Lead', description: 'Contemporary with period accent pieces', colours: palette.palette.slice(0, 3) },
        { character: 'Antagonist', description: 'Structured silhouette, darker tones', colours: [palette.primary, palette.accent] },
        { character: 'Ensemble', description: 'Cohesive neutral base with accent accessories', colours: palette.palette },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const costumeMoodboard = new CostumeMoodboard();
