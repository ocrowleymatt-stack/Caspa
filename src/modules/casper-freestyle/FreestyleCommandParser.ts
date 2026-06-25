import { commandIntentClassifier } from '../command-orchestrator/CommandIntentClassifier';
import { toolRegistry } from '../command-orchestrator/ToolRegistry';

export interface ParsedFreestyleCommand {
  intent: string;
  confidence: number;
  suggestedTools: string[];
  reply: string;
}

export class FreestyleCommandParser {
  parse(input: string): ParsedFreestyleCommand {
    const classified = commandIntentClassifier.classify(input);
    const tools = toolRegistry.toolsForIntent(classified.intent);
    const reply = classified.confidence >= 0.6
      ? `I'll help with ${classified.intent.replace(/_/g, ' ')}. Suggested tools: ${tools.map((t) => t.name).join(', ')}.`
      : `I'm not entirely sure — could you tell me more? I can help with quality, music, research, publishing, and more.`;

    return {
      intent: classified.intent,
      confidence: classified.confidence,
      suggestedTools: tools.map((t) => t.id),
      reply,
    };
  }
}

export const freestyleCommandParser = new FreestyleCommandParser();
