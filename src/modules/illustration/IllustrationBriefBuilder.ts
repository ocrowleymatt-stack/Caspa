export interface IllustrationBrief {
  id: string;
  projectId?: string;
  scene: string;
  mood: string;
  style: string;
  palette: string[];
  notes: string;
  createdAt: string;
}

export class IllustrationBriefBuilder {
  build(opts: {
    scene: string;
    mood?: string;
    style?: string;
    projectId?: string;
  }): Omit<IllustrationBrief, 'id' | 'createdAt'> {
    const mood = opts.mood ?? 'atmospheric';
    const paletteMap: Record<string, string[]> = {
      atmospheric: ['#2d1b4e', '#8b7355', '#c9a227', '#1a1a2e'],
      dramatic: ['#1a0000', '#4a0e0e', '#c9a227', '#000000'],
      whimsical: ['#6b4c9a', '#f4d03f', '#ecf0f1', '#2ecc71'],
    };

    return {
      projectId: opts.projectId,
      scene: opts.scene,
      mood,
      style: opts.style ?? 'editorial watercolour',
      palette: paletteMap[mood] ?? paletteMap.atmospheric,
      notes: 'Brief generated locally — connect an illustration API for image generation.',
    };
  }
}

export const illustrationBriefBuilder = new IllustrationBriefBuilder();
