import { showFactoryService } from '../show-factory';

export interface PacingReport {
  showPackageId: string;
  actBreaks: { label: string; minute: number }[];
  slowSections: string[];
  recommendations: string[];
  generatedAt: string;
}

export class PacingAnalyser {
  async analyse(showPackageId: string): Promise<PacingReport> {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    const totalMin = Math.round(pkg.components.join('').length / 1200);

    return {
      showPackageId,
      actBreaks: [
        { label: 'Act One break', minute: Math.round(totalMin * 0.35) },
        { label: 'Interval', minute: Math.round(totalMin * 0.55) },
        { label: 'Finale', minute: Math.round(totalMin * 0.9) },
      ],
      slowSections: ['Scene 4 dialogue exchange may lag', 'Transition into Act Two'],
      recommendations: ['Trim 30 seconds from Scene 4', 'Add underscoring to Act Two entrance'],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const pacingAnalyser = new PacingAnalyser();
