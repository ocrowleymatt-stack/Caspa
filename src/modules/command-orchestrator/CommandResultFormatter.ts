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
      next_step: ['Open project overview', 'Check Outputs for latest draft', 'Run Gold Pass when ready'],
      pier: ['Survey manuscript', 'Place a structural pole', 'Lay boards between poles'],
      gold_pass: ['Run Gold Pass', 'Review synthesis revision plan', 'Apply from Outputs after confirmation'],
      swarm: ['Run Agent Swarm critique', 'Review distinct agent reports', 'Save consensus to Outputs'],
      awards: ['Select award lenses', 'Run judge assessment', 'Feed assessment into Gold Pass'],
      quality_check: ['Run quality gates', 'Check for AI smell', 'Apply Wonder polish'],
      publish: ['Check publish confidence', 'Run final gate', 'Export EPUB'],
      music: ['Interpret music prompt', 'Start jam session'],
      research: ['Suggest research topics', 'Extract claims', 'Check accuracy against library'],
      intake: ['Import via New Project wizard', 'Open Manuscript tab'],
      product_plan: ['Generate or refine Project Bible', 'Confirm structure type'],
      document: ['Preview document render'],
      workflow: ['Open Outputs archive', 'Continue from latest output'],
      unknown: ['Try Studio Command quick actions', 'Rephrase with a project selected'],
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
