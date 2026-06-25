import type { ShowstopperBundle } from '../../shared/types';
import { aiWithFallback, getProjectFullText, requireProject } from '../../shared/elevationHelpers';

export function buildShowstopperBundle(title: string, theme: string, aiExtras?: Partial<ShowstopperBundle>): ShowstopperBundle {
  return {
    posterLines: aiExtras?.posterLines ?? [
      `"${title}" — nothing stays buried forever`,
      `Some doors should never be opened`,
      `Love. Loss. The truth between.`,
      `The night everything changed`,
      `${theme.slice(0, 40) || 'A story that won\'t let go'}`,
    ],
    trailerLines: aiExtras?.trailerLines ?? [
      'In a world where secrets define us...',
      'They thought it was over.',
      'One choice. Infinite consequences.',
      'This summer, believe the impossible.',
      'From the edge of hope — a new legend.',
    ],
    finalLines: aiExtras?.finalLines ?? [
      'I never stopped believing in you.',
      'We carry each other home.',
      'The light finds us, eventually.',
    ],
    showstopperScenes: aiExtras?.showstopperScenes ?? [
      'Ensemble revelation number at midpoint',
      'Silent tableau before the climax',
      'Full-cast reprise with raised stakes',
    ],
    songHooks: aiExtras?.songHooks ?? [
      'What if tonight is all we have?',
      'Hold the line, hold the light',
      'Running toward the breaking dawn',
    ],
    riskyOption: aiExtras?.riskyOption ?? 'Fourth-wall break inviting audience participation during finale',
  };
}

export class SignatureMomentFinder {
  async find(projectId: string): Promise<ShowstopperBundle & { projectId: string; generatedAt: string }> {
    const project = await requireProject(projectId);
    const text = await getProjectFullText(projectId);
    const { text: aiLine } = await aiWithFallback(
      'Suggest one risky showstopper moment for stage adaptation.',
      text.slice(0, 4000),
      'Audience-participation finale',
      projectId,
    );
    const bundle = buildShowstopperBundle(project.title, project.description, { riskyOption: aiLine });
    return { projectId, ...bundle, generatedAt: new Date().toISOString() };
  }
}

export const signatureMomentFinder = new SignatureMomentFinder();
