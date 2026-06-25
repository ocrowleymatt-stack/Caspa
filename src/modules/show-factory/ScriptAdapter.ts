import { findById, type Chapter } from '../../shared/index';
import { AIOrchestrator, aiOrchestrator } from '../ai/index';

export interface DialogueLine {
  character: string;
  line: string;
}

export class ScriptAdapter {
  constructor(private readonly orchestrator: AIOrchestrator = aiOrchestrator) {}

  async adaptChapterToScript(
    chapterId: string,
    format: 'theatre' | 'radio',
  ): Promise<string> {
    const chapter = await findById<Chapter>('chapters', chapterId);
    if (!chapter) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }

    const formatLabel = format === 'theatre' ? 'theatre stage script' : 'radio drama script';
    const response = await this.orchestrator.generateWithContext(
      {
        prompt: `Adapt the following chapter prose into a ${formatLabel}. Include character names before dialogue, stage directions or sound cues as appropriate, and preserve the story beats.\n\nChapter: ${chapter.title}\n\n${chapter.content}`,
        temperature: 0.7,
      },
      chapter.projectId,
    );

    return response.text;
  }

  async extractDialogue(text: string): Promise<DialogueLine[]> {
    const response = await this.orchestrator.generate({
      prompt: `Extract all dialogue from the following text. Return ONLY a JSON array of objects with "character" and "line" fields. No markdown fences.\n\n${text}`,
      temperature: 0.3,
    });

    try {
      const parsed = JSON.parse(response.text.trim()) as DialogueLine[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // fall through to heuristic extraction
    }

    const lines: DialogueLine[] = [];
    const pattern = /^([A-Z][A-Z\s]+):\s*(.+)$/;
    for (const line of text.split('\n')) {
      const match = line.trim().match(pattern);
      if (match) {
        lines.push({ character: match[1].trim(), line: match[2].trim() });
      }
    }
    return lines;
  }

  async generateStageDirections(text: string): Promise<string> {
    const response = await this.orchestrator.generate({
      prompt: `Add detailed stage directions to the following script excerpt. Return the full script with directions in parentheses or italics markers.\n\n${text}`,
      temperature: 0.6,
    });
    return response.text;
  }

  formatAsScript(dialogue: DialogueLine[], directions: string[]): string {
    const parts: string[] = [];
    let directionIndex = 0;

    for (const entry of dialogue) {
      if (directionIndex < directions.length) {
        parts.push(`(${directions[directionIndex]})`);
        directionIndex += 1;
      }
      parts.push(`${entry.character.toUpperCase()}: ${entry.line}`);
    }

    while (directionIndex < directions.length) {
      parts.push(`(${directions[directionIndex]})`);
      directionIndex += 1;
    }

    return parts.join('\n\n');
  }
}

export const scriptAdapter = new ScriptAdapter();
