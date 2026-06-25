import { budgetEstimator } from './BudgetEstimator';

export interface RevenueScenario {
  showPackageId: string;
  scenarios: { name: string; occupancy: number; revenue: number; profit: number }[];
  breakEvenOccupancy: number;
  generatedAt: string;
}

export class RevenueScenarioModel {
  async model(showPackageId: string): Promise<RevenueScenario> {
    const budget = await budgetEstimator.estimate(showPackageId);
    const ticketPrice = 35;
    const capacity = 400;
    const scenarios = [
      { name: 'Conservative', occupancy: 0.55, revenue: 0, profit: 0 },
      { name: 'Target', occupancy: 0.75, revenue: 0, profit: 0 },
      { name: 'Optimistic', occupancy: 0.9, revenue: 0, profit: 0 },
    ].map((s) => {
      const revenue = Math.round(capacity * ticketPrice * s.occupancy * 20);
      const profit = revenue - budget.mid;
      return { ...s, revenue, profit };
    });

    const breakEvenOccupancy = Math.min(1, budget.mid / (capacity * ticketPrice * 20));

    return { showPackageId, scenarios, breakEvenOccupancy: Math.round(breakEvenOccupancy * 100) / 100, generatedAt: new Date().toISOString() };
  }
}

export const revenueScenarioModel = new RevenueScenarioModel();
