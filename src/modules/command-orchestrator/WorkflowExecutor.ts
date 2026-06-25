import type { WorkflowPlan, WorkflowStep } from './WorkflowPlanner';
import { generateId, writeJsonFile } from '../../shared/fileStore';

export interface StepResult {
  stepId: string;
  toolId: string;
  success: boolean;
  message: string;
  data?: unknown;
}

export interface ExecutionResult {
  id: string;
  planId: string;
  status: 'completed' | 'partial' | 'failed';
  stepResults: StepResult[];
  completedAt: string;
}

export class WorkflowExecutor {
  async execute(plan: WorkflowPlan): Promise<ExecutionResult> {
    const stepResults: StepResult[] = plan.steps.map((step) => this.simulateStep(step));
    const allOk = stepResults.every((r) => r.success);
    const someOk = stepResults.some((r) => r.success);

    const result: ExecutionResult = {
      id: generateId(),
      planId: plan.id,
      status: allOk ? 'completed' : someOk ? 'partial' : 'failed',
      stepResults,
      completedAt: new Date().toISOString(),
    };

    await writeJsonFile('commands', `exec-${result.id}.json`, result);
    return result;
  }

  private simulateStep(step: WorkflowStep): StepResult {
    return {
      stepId: step.id,
      toolId: step.toolId,
      success: true,
      message: `Planned execution for ${step.tool.name} via ${step.tool.route}`,
      data: { route: step.tool.route, method: step.tool.method, params: step.params },
    };
  }
}

export const workflowExecutor = new WorkflowExecutor();
