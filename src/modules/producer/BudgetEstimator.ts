import { showFactoryService } from '../show-factory';

export interface BudgetEstimate {
  showPackageId: string;
  currency: string;
  low: number;
  mid: number;
  high: number;
  lineItems: { category: string; amount: number }[];
  generatedAt: string;
}

export class BudgetEstimator {
  async estimate(showPackageId: string): Promise<BudgetEstimate> {
    const pkg = await showFactoryService.getShowPackage(showPackageId);
    const base = pkg.type === 'theatre' ? 85000 : pkg.type === 'radio' ? 25000 : 35000;

    return {
      showPackageId,
      currency: 'GBP',
      low: Math.round(base * 0.7),
      mid: base,
      high: Math.round(base * 1.4),
      lineItems: [
        { category: 'Cast & crew', amount: Math.round(base * 0.45) },
        { category: 'Venue & tech', amount: Math.round(base * 0.25) },
        { category: 'Marketing', amount: Math.round(base * 0.15) },
        { category: 'Contingency', amount: Math.round(base * 0.15) },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const budgetEstimator = new BudgetEstimator();
