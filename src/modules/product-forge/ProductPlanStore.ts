import { generateId, writeJsonFile, readJsonFile, listJsonFiles } from '../../shared/fileStore';
import type { ProductRecommendation } from './ProductTypeEngine';

export interface ProductPlan {
  id: string;
  projectId: string;
  title: string;
  recommendations: ProductRecommendation[];
  selectedType?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export class ProductPlanStore {
  private subPath = 'product-plans';

  async create(plan: Omit<ProductPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductPlan> {
    const now = new Date().toISOString();
    const full: ProductPlan = {
      ...plan,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await writeJsonFile(this.subPath, `${full.id}.json`, full);
    return full;
  }

  async get(id: string): Promise<ProductPlan | null> {
    return readJsonFile<ProductPlan>(this.subPath, `${id}.json`);
  }

  async save(plan: ProductPlan): Promise<ProductPlan> {
    plan.updatedAt = new Date().toISOString();
    await writeJsonFile(this.subPath, `${plan.id}.json`, plan);
    return plan;
  }

  async list(projectId?: string): Promise<ProductPlan[]> {
    const files = await listJsonFiles(this.subPath);
    const plans: ProductPlan[] = [];
    for (const file of files) {
      const p = await readJsonFile<ProductPlan>(this.subPath, file);
      if (p && (!projectId || p.projectId === projectId)) plans.push(p);
    }
    return plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export const productPlanStore = new ProductPlanStore();
