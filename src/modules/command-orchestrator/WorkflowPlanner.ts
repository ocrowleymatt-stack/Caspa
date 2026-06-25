import type { ClassifiedIntent } from './CommandIntentClassifier';
import type { CommandContext } from './CommandContextBuilder';
import { toolRegistry, type ToolDefinition } from './ToolRegistry';
import { generateId, writeJsonFile } from '../../shared/fileStore';

export interface WorkflowStep {
  id: string;
  toolId: string;
  tool: ToolDefinition;
  status: 'pending' | 'ready' | 'skipped';
  params: Record<string, unknown>;
}

export interface WorkflowPlan {
  id: string;
  projectId?: string;
  intent: ClassifiedIntent;
  steps: WorkflowStep[];
  clarifyingQuestions: string[];
  createdAt: string;
}

export class WorkflowPlanner {
  plan(intent: ClassifiedIntent, context: CommandContext): WorkflowPlan {
    const tools = toolRegistry.toolsForIntent(intent.intent);
    const steps: WorkflowStep[] = tools.map((tool) => ({
      id: generateId(),
      toolId: tool.id,
      tool,
      status: 'ready' as const,
      params: {
        projectId: context.projectId ?? intent.entities.projectId,
        text: intent.rawText,
      },
    }));

    const clarifyingQuestions: string[] = [];
    if (!context.projectId && !intent.entities.projectId && intent.intent !== 'unknown') {
      clarifyingQuestions.push('Which project should this apply to?');
    }
    if (intent.confidence < 0.5) {
      clarifyingQuestions.push('Could you clarify what you want to accomplish?');
    }

    return {
      id: generateId(),
      projectId: context.projectId ?? intent.entities.projectId,
      intent,
      steps,
      clarifyingQuestions,
      createdAt: new Date().toISOString(),
    };
  }

  async savePlan(plan: WorkflowPlan): Promise<void> {
    await writeJsonFile('commands', `${plan.id}.json`, plan);
  }
}

export const workflowPlanner = new WorkflowPlanner();
