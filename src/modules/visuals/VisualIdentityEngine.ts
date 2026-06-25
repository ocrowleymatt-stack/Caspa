import { aiWithFallback, requireProject } from '../../shared/elevationHelpers';

export interface VisualIdentity {
  projectId: string;
  mood: string;
  keywords: string[];
  typography: string;
  imagery: string;
  generatedAt: string;
}

export class VisualIdentityEngine {
  async build(projectId: string): Promise<VisualIdentity> {
    const project = await requireProject(projectId);
    const { text } = await aiWithFallback(
      'Describe visual identity mood in one phrase.',
      project.description,
      'Atmospheric and emotionally charged',
      projectId,
    );
    return {
      projectId,
      mood: text,
      keywords: project.genre.split(/[\s,]+/).filter(Boolean).slice(0, 5).concat(['emotion', 'light', 'shadow']),
      typography: 'Serif display + clean sans body',
      imagery: 'High-contrast photography with single accent colour',
      generatedAt: new Date().toISOString(),
    };
  }
}

export const visualIdentityEngine = new VisualIdentityEngine();
