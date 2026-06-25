import { requireProject } from '../../shared/elevationHelpers';

export class ColourPaletteAdvisor {
  async advise(projectId: string) {
    const project = await requireProject(projectId);
    const isDark = /dark|noir|gothic|thriller/i.test(project.genre + project.description);
    return {
      projectId,
      primary: isDark ? '#1a1a2e' : '#2d4a3e',
      accent: isDark ? '#c9a227' : '#d4645a',
      neutral: '#f5f0eb',
      palette: isDark
        ? ['#1a1a2e', '#16213e', '#c9a227', '#e8e8e8', '#8b0000']
        : ['#2d4a3e', '#7ba05b', '#d4645a', '#f5f0eb', '#3d3d3d'],
      usage: 'Accent for titles and CTAs; primary for backgrounds',
      generatedAt: new Date().toISOString(),
    };
  }
}

export const colourPaletteAdvisor = new ColourPaletteAdvisor();
