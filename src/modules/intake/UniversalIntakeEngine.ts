import { sourceClassifier } from './SourceClassifier';
import { receiptInterpreter } from './ReceiptInterpreter';
import { sourceLedger } from './SourceLedger';
import { sourcePotentialEngine } from './SourcePotentialEngine';

export class UniversalIntakeEngine {
  async analyse(opts: {
    content: string;
    projectId?: string;
    filename?: string;
  }) {
    const classification = sourceClassifier.classify(opts.content, opts.filename);
    const potential = sourcePotentialEngine.assess(opts.content, classification);
    const receipt = receiptInterpreter.interpret(opts.content, classification);
    const record = await sourceLedger.record({
      content: opts.content,
      classification,
      potentialScore: potential.score,
      projectId: opts.projectId,
      filename: opts.filename,
    });

    return {
      record,
      classification,
      potential,
      receipt,
    };
  }
}

export const universalIntakeEngine = new UniversalIntakeEngine();
