export type CommandIntent =
  | 'quality_check'
  | 'publish'
  | 'music'
  | 'research'
  | 'intake'
  | 'product_plan'
  | 'document'
  | 'workflow'
  | 'pier'
  | 'gold_pass'
  | 'swarm'
  | 'awards'
  | 'next_step'
  | 'unknown';

export interface ClassifiedIntent {
  intent: CommandIntent;
  confidence: number;
  entities: Record<string, string>;
  rawText: string;
}

const INTENT_PATTERNS: Array<{ intent: CommandIntent; patterns: RegExp[] }> = [
  { intent: 'next_step', patterns: [/what should i do next|next step|where do i go|what now/i] },
  { intent: 'pier', patterns: [/pier|pole|lay board|structural|without padding|no filler|anti-filler/i] },
  { intent: 'gold_pass', patterns: [/gold pass|gold against|run gold|synthes/i] },
  { intent: 'swarm', patterns: [/swarm|multi-agent|agent critique|critique agents/i] },
  { intent: 'awards', patterns: [/award shelf|award lens|judge|booker|prize target/i] },
  { intent: 'quality_check', patterns: [/quality|smell|gate|polish|revise|improve manuscript/i] },
  { intent: 'publish', patterns: [/publish|confidence|export|epub|pdf/i] },
  { intent: 'music', patterns: [/music|song|jam|prompt|melody|track/i] },
  { intent: 'research', patterns: [/research|verify|claim|fact|source|accuracy|depth pass/i] },
  { intent: 'intake', patterns: [/intake|upload|import manuscript|paste notes/i] },
  { intent: 'product_plan', patterns: [/bible|premise|logline|character plan|product format|audiobook/i] },
  { intent: 'document', patterns: [/document|render|preview|markdown|html/i] },
  { intent: 'workflow', patterns: [/workflow|orchestr|pipeline|run all|continue writing|output/i] },
];

export class CommandIntentClassifier {
  classify(text: string): ClassifiedIntent {
    const rawText = text.trim();
    let best: CommandIntent = 'unknown';
    let confidence = 0.3;

    for (const { intent, patterns } of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(rawText)) {
          best = intent;
          confidence = 0.85;
          break;
        }
      }
      if (confidence > 0.5) break;
    }

    const entities: Record<string, string> = {};
    const projectMatch = rawText.match(/project[:\s]+([a-zA-Z0-9_-]+)/i);
    if (projectMatch) entities.projectId = projectMatch[1];

    return { intent: best, confidence, entities, rawText };
  }
}

export const commandIntentClassifier = new CommandIntentClassifier();
