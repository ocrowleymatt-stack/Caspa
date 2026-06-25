import type { ClassifiedIntent } from './CommandIntentClassifier';

export interface ClarifyingQuestion {
  id: string;
  question: string;
  options?: string[];
  required: boolean;
}

export class ClarifyingQuestionEngine {
  generate(intent: ClassifiedIntent, hasProject: boolean): ClarifyingQuestion[] {
    const questions: ClarifyingQuestion[] = [];

    if (intent.confidence < 0.6) {
      questions.push({
        id: 'clarify-intent',
        question: 'What would you like to do?',
        options: ['Check quality', 'Plan products', 'Research sources', 'Create music', 'Publish'],
        required: true,
      });
    }

    if (!hasProject && intent.intent !== 'unknown') {
      questions.push({
        id: 'select-project',
        question: 'Which project is this for?',
        required: true,
      });
    }

    if (intent.intent === 'music') {
      questions.push({
        id: 'music-style',
        question: 'What mood or genre are you aiming for?',
        options: ['Ballad', 'Upbeat', 'Atmospheric', 'Showstopper'],
        required: false,
      });
    }

    return questions;
  }
}

export const clarifyingQuestionEngine = new ClarifyingQuestionEngine();
