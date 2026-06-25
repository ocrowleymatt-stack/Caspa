import { showFactoryService } from '../show-factory';

export interface ProductionSchedule {
  showPackageId: string;
  phases: { phase: string; startWeek: number; durationWeeks: number; tasks: string[] }[];
  totalWeeks: number;
  generatedAt: string;
}

export class ProductionScheduleBuilder {
  async build(showPackageId: string): Promise<ProductionSchedule> {
    await showFactoryService.getShowPackage(showPackageId);
    const phases = [
      { phase: 'Development', startWeek: 1, durationWeeks: 4, tasks: ['Workshop script', 'Casting sessions'] },
      { phase: 'Rehearsal', startWeek: 5, durationWeeks: 6, tasks: ['Blocking', 'Tech rehearsals'] },
      { phase: 'Preview', startWeek: 11, durationWeeks: 2, tasks: ['Preview performances', 'Notes integration'] },
      { phase: 'Opening', startWeek: 13, durationWeeks: 1, tasks: ['Press night', 'Opening run'] },
    ];
    return {
      showPackageId,
      phases,
      totalWeeks: phases.reduce((s, p) => s + p.durationWeeks, 0),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const productionScheduleBuilder = new ProductionScheduleBuilder();
