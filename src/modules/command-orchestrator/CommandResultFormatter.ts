import type { ClassifiedIntent } from './CommandIntentClassifier';
import type { WorkflowPlan } from './WorkflowPlanner';
import type { ExecutionResult } from './WorkflowExecutor';

export interface FormattedCommandResult {
  summary: string;
  intent: string;
  confidence: number;
  suggestedActions: string[];
  plan?: WorkflowPlan;
  execution?: ExecutionResult;
  formattedAt: string;
}

export class CommandResultFormatter {
  formatInterpretation(intent: ClassifiedIntent, questions: string[]): FormattedCommandResult {
    const actionMap: Record<string, string[]> = {
      quality_check: ['Run quality gates', 'Check for AI smell', 'Apply Wonder polish'],
      publish: ['Check publish confidence', 'Run final gate', 'Export EPUB'],
      music: ['Interpret music prompt', 'Start jam session'],
      research: ['Plan research', 'Verify claims'],
      intake: ['Analyse source material'],
      product_plan: ['Recommend product formats'],
      document: ['Preview document render'],
      workflow: ['Execute full pipeline'],
      unknown: ['Try Casper freestyle', 'Rephrase your command'],
    };

    return {
      summary: questions.length
        ? `Understood intent: ${intent.intent}. Need clarification before proceeding.`
        : `Ready to proceed with: ${intent.intent}`,
      intent: intent.intent,
      confidence: intent.confidence,
      suggestedActions: actionMap[intent.intent] ?? actionMap.unknown,
      formattedAt: new Date().toISOString(),
    };
  }

  formatPlan(plan: WorkflowPlan): FormattedCommandResult {
    return {
      summary: `Workflow planned with ${plan.steps.length} step(s)`,
      intent: plan.intent.intent,
      confidence: plan.intent.confidence,
      suggestedActions: plan.steps.map((s) => s.tool.name),
      plan,
      formattedAt: new Date().toISOString(),
    };
  }

  formatExecution(plan: WorkflowPlan, execution: ExecutionResult): FormattedCommandResult {
    return {
      summary: `Workflow ${execution.status}: ${execution.stepResults.length} step(s) processed`,
      intent: plan.intent.intent,
      confidence: plan.intent.confidence,
      suggestedActions: [],
      plan,
      execution,
      formattedAt: new Date().toISOString(),
    };
  }
}

export const commandResultFormatter = new CommandResultFormatter();
