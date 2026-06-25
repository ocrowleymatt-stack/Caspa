import { aiWithFallback, getProjectChapters, getProjectFullText, requireProject, scoreFromMetrics } from '../../shared/elevationHelpers';

export interface EmotionalArcPoint {
  label: string;
  intensity: number;
  description: string;
}

export interface EmotionalArcAnalysis {
  projectId: string;
  arcShape: string;
  peaks: EmotionalArcPoint[];
  valleys: EmotionalArcPoint[];
  pacingNotes: string[];
  emotionalRange: number;
  generatedAt: string;
}

export class EmotionalArcEngine {
  async analyseProject(projectId: string): Promise<EmotionalArcAnalysis> {
    const project = await requireProject(projectId);
    const chapters = await getProjectChapters(projectId);
    const text = await getProjectFullText(projectId);

    const chapterScores = chapters.map((ch, i) => {
      const tension = Math.min(100, 30 + (i / Math.max(chapters.length, 1)) * 50 + (ch.wordCount > 2000 ? 20 : 10));
      return { label: ch.title, intensity: Math.round(tension), description: `Chapter ${i + 1} emotional load` };
    });

    const peaks = chapterScores.filter((p) => p.intensity >= 70).slice(0, 3);
    const valleys = chapterScores.filter((p) => p.intensity < 50).slice(0, 3);

    const fallback = `Arc for "${project.title}": ${peaks.length} peaks, ${valleys.length} valleys across ${chapters.length} chapters.`;
    const { text: aiNotes } = await aiWithFallback(
      'Summarise the emotional arc of this work in 2-3 sentences.',
      text,
      fallback,
      projectId,
    );

    return {
      projectId,
      arcShape: chapters.length > 5 ? 'multi-act rise' : 'compressed arc',
      peaks: peaks.length ? peaks : [{ label: 'Climax', intensity: 85, description: 'Project climax zone' }],
      valleys: valleys.length ? valleys : [{ label: 'Opening', intensity: 35, description: 'Establishing tone' }],
      pacingNotes: aiNotes.split(/[.!?]+/).filter(Boolean).slice(0, 4),
      emotionalRange: scoreFromMetrics(chapterScores.map((p) => p.intensity)),
      generatedAt: new Date().toISOString(),
    };
  }

  async analyseChapter(chapterId: string, content: string, title: string, projectId: string): Promise<EmotionalArcAnalysis> {
    const intensity = Math.min(100, Math.round(content.length / 200 + 20));
    const { text: notes } = await aiWithFallback(
      `Analyse emotional arc of chapter "${title}".`,
      content.slice(0, 4000),
      `Chapter "${title}" carries moderate emotional intensity.`,
      projectId,
    );

    return {
      projectId,
      arcShape: 'single-chapter',
      peaks: [{ label: title, intensity, description: notes.slice(0, 120) }],
      valleys: [],
      pacingNotes: [notes],
      emotionalRange: intensity,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const emotionalArcEngine = new EmotionalArcEngine();
