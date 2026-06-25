import { findById } from '../../shared/db';
import { productTypeEngine } from './ProductTypeEngine';
import { productPlanStore } from './ProductPlanStore';

export class ProductForgeBuilder {
  async recommend(projectId: string) {
    const project = await findById<{
      id: string;
      title: string;
      genre: string;
      targetWordCount: number;
    }>('projects', projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const recommendations = productTypeEngine.recommend({
      genre: project.genre,
      wordCount: project.targetWordCount,
      hasMusic: /musical|music/i.test(project.genre),
    });

    const plan = await productPlanStore.create({
      projectId,
      title: `${project.title} — Product Plan`,
      recommendations,
      notes: '',
    });

    return { plan, recommendations };
  }
}

export const productForgeBuilder = new ProductForgeBuilder();
